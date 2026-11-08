import type { DemandBody, DemandCriteria } from '../shared/collectionGroups';
import { matchesParentGrade } from './demandCriteria';
import { isBreedableGroup } from './eggs';
import { GRADE_BODY, type PetGrade } from './petFilters';
import type { OwnedPet, SpeciesEntry } from './types';

/**
 * 种公阵列的跨号补缺（2026-11-02 用户口径）。
 *
 * 单账号视角下矩阵出现缺口时，回答「其他号能不能出这颗蛋」：
 * 只给配对（母 × 公），不估孵化次数、不算补格数、不做成本排序。
 * 成体不能传，所以候选一律是「在源号配出蛋 → 把蛋传过来孵」。
 *
 * 口径与需求中心一致：父母双方都要满足当前档位，至少一方带目标性格；
 * 双亲同为目标性格 60%，单方 30%（学院小窝 100% 不在本模块建模）。
 * 蛋物种必须能出公（`maleCapable`），否则孵不出种公。
 */

export interface StudTransferPair {
  account: string;
  /** 蛋物种（母本所在的蛋血脉）。 */
  eggGameId: number;
  motherGameId: number;
  motherName: string;
  motherNature: string;
  motherCaptureId?: string;
  fatherGameId: number;
  fatherName: string;
  fatherNature: string;
  fatherCaptureId?: string;
  /** 遗传目标性格的概率：双亲同性格 0.6，单方 0.3。 */
  chance: 0.6 | 0.3;
  /** 这颗蛋覆盖的蛋组（双蛋组会有两个）。 */
  groupIds: number[];
}

interface AccountIndex {
  /** key = 蛋物种 id（母本蛋血脉）。 */
  femalesByEgg: Map<number, OwnedPet[]>;
  /** key = 蛋组 id。 */
  malesByGroup: Map<number, OwnedPet[]>;
}

/** 当前档位对应的亲本口径：体型 + 声音。 */
const parentCriteriaOf = (grade: PetGrade): DemandCriteria => ({
  eggGameId: 0,
  nature: '',
  gender: '',
  body: GRADE_BODY[grade] as DemandBody,
  voice: grade === '大婉' || grade === '小婉' ? '+100' : '-100',
});

const addTo = <T>(map: Map<number, T[]>, key: number, value: T): void => {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
};

const buildIndex = (
  pets: readonly OwnedPet[],
  grade: PetGrade,
  speciesByGameId: ReadonlyMap<number, SpeciesEntry>,
): AccountIndex => {
  const criterion = parentCriteriaOf(grade);
  const index: AccountIndex = { femalesByEgg: new Map(), malesByGroup: new Map() };
  for (const pet of pets) {
    if (!matchesParentGrade(pet, criterion)) continue;
    const entry = speciesByGameId.get(pet.gameId);
    if (!entry) continue;
    if (pet.gender === '母') {
      const eggGameId = entry.eggGameId != null && entry.eggGameId > 0 ? entry.eggGameId : entry.gameId;
      addTo(index.femalesByEgg, eggGameId, pet);
      continue;
    }
    if (pet.gender !== '公') continue;
    for (const group of entry.eggGroups ?? []) {
      if (isBreedableGroup(group)) addTo(index.malesByGroup, group, pet);
    }
  }
  return index;
};

const betterPair = (candidate: StudTransferPair | null, next: StudTransferPair): boolean => {
  if (!candidate) return true;
  if (next.chance !== candidate.chance) return next.chance > candidate.chance;
  // 同概率时优先双蛋组（一颗蛋能同时补两个组）
  return next.groupIds.length > candidate.groupIds.length;
};

const pairsForAccount = (
  account: string,
  index: AccountIndex,
  cell: { groupId: number; natureName: string },
  eggSpecies: readonly SpeciesEntry[],
): StudTransferPair[] => {
  /** 同一个号的同一种蛋只留一条（哪只母本上场没区别，用户按蛋选）。 */
  const byEgg = new Map<number, StudTransferPair>();

  for (const egg of eggSpecies) {
    const groups = (egg.eggGroups ?? []).filter(isBreedableGroup);
    if (!groups.includes(cell.groupId)) continue;
    const mothers = index.femalesByEgg.get(egg.gameId);
    if (!mothers || mothers.length === 0) continue;

    const fathers: OwnedPet[] = [];
    const seen = new Set<OwnedPet>();
    for (const group of groups) {
      for (const father of index.malesByGroup.get(group) ?? []) {
        if (seen.has(father)) continue;
        seen.add(father);
        fathers.push(father);
      }
    }
    if (fathers.length === 0) continue;

    for (const mother of mothers) {
      for (const father of fathers) {
        const motherHit = mother.nature === cell.natureName;
        const fatherHit = father.nature === cell.natureName;
        if (!motherHit && !fatherHit) continue;
        const next: StudTransferPair = {
          account,
          eggGameId: egg.gameId,
          motherGameId: mother.gameId,
          motherName: mother.name,
          motherNature: mother.nature,
          motherCaptureId: mother.captureId,
          fatherGameId: father.gameId,
          fatherName: father.name,
          fatherNature: father.nature,
          fatherCaptureId: father.captureId,
          chance: motherHit && fatherHit ? 0.6 : 0.3,
          groupIds: groups,
        };
        const current = byEgg.get(egg.gameId);
        if (betterPair(current ?? null, next)) byEgg.set(egg.gameId, next);
      }
    }
  }
  return [...byEgg.values()];
};

/**
 * 对每个缺口格，列出每个源号能出的**所有蛋**（同一号同一种蛋去重，保留最高概率的一对）。
 * 返回 key = `${groupId}::${natureName}`，没有可补的格不出现在 Map 里。
 */
export function transferPairsForCells(
  pets: readonly OwnedPet[],
  cells: readonly { groupId: number; natureName: string }[],
  grade: PetGrade,
  species: readonly SpeciesEntry[],
): Map<string, StudTransferPair[]> {
  const speciesByGameId = new Map(species.map((entry) => [entry.gameId, entry]));
  const byAccount = new Map<string, OwnedPet[]>();
  for (const pet of pets) {
    const list = byAccount.get(pet.account);
    if (list) list.push(pet);
    else byAccount.set(pet.account, [pet]);
  }

  const indexes = new Map<string, AccountIndex>();
  for (const [account, accountPets] of byAccount) {
    indexes.set(account, buildIndex(accountPets, grade, speciesByGameId));
  }

  const result = new Map<string, StudTransferPair[]>();
  const eggSpecies = species.filter(
    (entry) =>
      (entry.eggGameId != null && entry.eggGameId > 0 ? entry.eggGameId : entry.gameId) ===
        entry.gameId && entry.maleCapable === true,
  );
  for (const cell of cells) {
    const pairs: StudTransferPair[] = [];
    for (const [account] of byAccount) {
      pairs.push(...pairsForAccount(account, indexes.get(account)!, cell, eggSpecies));
    }
    if (pairs.length === 0) continue;
    pairs.sort(
      (a, b) =>
        b.chance - a.chance ||
        a.account.localeCompare(b.account) ||
        a.eggGameId - b.eggGameId,
    );
    result.set(`${cell.groupId}::${cell.natureName}`, pairs);
  }
  return result;
}
