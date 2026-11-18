import { classifyGrade, type PetGrade, type TargetMode } from './petFilters';
import { isQualifiedMother, type MotherCriteria } from './motherCriteria';
import { genderFactorOf, genderShareOf } from './genderRatio';
import { isBreedableGroup } from './eggs';
import { speciesDisplayName } from './speciesName';
import { boxLabel } from './coverageDetail';
import type { NestPet } from './nestPlan';
import type { OwnedPet, SpeciesEntry } from './types';

/**
 * 母本配窝建议（2026-11-18 用户口径）。
 *
 * 现有配窝方案只补种公；母本缺口是另一条收集线。这里补上「这个号怎么把未收集的母本配出来」：
 * - 本号有目标档位母本、只是性格不对 → 配一只带推荐性格的公；同种（母本蛋血脉 = 种公蛋血脉）
 *   时这条线同时补种公格，记「一窝双收益」。
 * - 本号连目标档位母本都没有 → 别的号配蛋传过来；每个源号只取**最高概率**的那一对，
 *   再按「对性母」概率（推荐性格 × 出母率）排序，不再用固定的 15% / 30%。
 *
 * 只做纯计算，不读网络、不写库。本号内的线要占窝：返回 `nestsNeeded`，由调用方从剩余窝位里扣。
 */
export interface MotherNestPairing {
  account: string;
  grade: PetGrade;
  eggGameId: number;
  eggName: string;
  /** 这枚蛋的蛋组（后代随母方，蛋组也就是母方的蛋组） */
  groupIds: number[];
  /** 该蛋的推荐性格（母本达标条件要求推荐性格时，子代要命中其中之一） */
  recommendedNatures: string[];
  mother: NestPet;
  father: NestPet;
  /** 子代拿到推荐性格的概率（公带 0.3 / 双方同性格 0.6 / 学院不在本模块建模） */
  natureChance: number;
  /** 子代是母的概率（按蛋物种性别比例；缺数据按 5:5） */
  femaleChance: number;
  /** 母本收益 = 推荐性格概率 × 出母率 */
  motherGain: number;
  /** 同种时这条线同时补上的种公期望（否则 0） */
  studGain: number;
  /** 母本 + 种公，排序与界面「期望」都用它 */
  expectedValue: number;
  /** 公的蛋血脉 = 母本的蛋血脉（同一个精灵 / 同一颗蛋） */
  sameSpecies: boolean;
  /** 这条线新占几个窝（父/母已在种公方案里的不重复占） */
  nestsNeeded: number;
}

export interface MotherNestTask {
  /** 目标号（需要这只母本的账号） */
  account: string;
  grade: PetGrade;
  eggGameId: number;
  eggName: string;
  groupIds: number[];
  recommendedNatures: string[];
  sourceAccount: string;
  mother: NestPet;
  father: NestPet;
  natureChance: number;
  femaleChance: number;
  /** 对性母概率 = natureChance × femaleChance（界面排序用这个，不用 15% / 30%） */
  chance: number;
  /** 目标号已经有同种（同一颗蛋）的目标档位公：蛋到手孵成母本后直接和它配窝 */
  sameSpecies: boolean;
}

export interface MotherNestAccount {
  /** 本号未收集的母本蛋数（没有达标母本的蛋；不等于下面能补的条数） */
  gapCount: number;
  pairings: MotherNestPairing[];
  /** 跨号建议：每个蛋只留最高概率的源号，按 chance 降序 */
  tasks: MotherNestTask[];
  /** 本号母本配窝新占的窝数（已从剩余窝位里扣过） */
  nestsUsed: number;
}

export interface MotherNestInput {
  species: SpeciesEntry[];
  owned: OwnedPet[];
  mode: TargetMode;
  /** 当前目标档位；母本和公都要这个档位（体型 + 声音） */
  grade: PetGrade;
  /** 母本达标条件（`grades` 应与 grade 一致；推荐性格开关决定本号内能不能配） */
  criteria: MotherCriteria;
  naturesOf: (gameId: number) => readonly string[];
  /** 每个号的种公覆盖度（同种双收要找未覆盖的种公格） */
  coverageByAccount: ReadonlyMap<
    string,
    { cells: ReadonlyArray<{ groupId: number; natureName: string; grade: PetGrade; state: string }> }
  >;
  /** 每个号已排的种公方案：用来算新占几个窝，以及「这个号已有同种种公」 */
  plans?: readonly MotherNestPlanUsage[];
}

interface MotherNestPlanUsage {
  account: string;
  slots: ReadonlyArray<{ pet: { key: string } }>;
  nestsUsed: number;
  nestsTotal: number;
}

interface AccountIndex {
  account: string;
  pets: OwnedPet[];
  /** 目标档位母本，按蛋血脉分组 */
  femalesByEgg: Map<number, OwnedPet[]>;
  /** 目标档位公，按蛋组分组 */
  malesByGroup: Map<number, OwnedPet[]>;
  /** 这个号已有目标档位母本的蛋（达标条件口径，不只是目标档位） */
  qualifiedEggs: Set<number>;
  /** 这个号已有目标档位公的蛋血脉（同种判断） */
  maleEggs: Set<number>;
  /** 种公方案里已经占窝的个体（`NestPet.key` = `账号#账号内序号`） */
  placedKeys: Set<string>;
  nestsUsed: number;
  nestsTotal: number;
}

const eggOf = (pet: OwnedPet, byGameId: ReadonlyMap<number, SpeciesEntry>): number | null => {
  const entry = byGameId.get(pet.gameId);
  const egg = entry?.eggGameId;
  return egg != null && egg > 0 ? egg : null;
};

const groupsOf = (pet: OwnedPet, byGameId: ReadonlyMap<number, SpeciesEntry>): number[] =>
  (byGameId.get(pet.gameId)?.eggGroups ?? []).filter(isBreedableGroup);

const sharesGroup = (a: OwnedPet, b: OwnedPet, byGameId: ReadonlyMap<number, SpeciesEntry>): boolean => {
  const groups = groupsOf(a, byGameId);
  return groupsOf(b, byGameId).some((group) => groups.includes(group));
};

const toNestPet = (
  pet: OwnedPet,
  key: string,
  byGameId: ReadonlyMap<number, SpeciesEntry>,
): NestPet => ({
  key,
  gameId: pet.gameId,
  name: speciesDisplayName(byGameId.get(pet.gameId), pet.name),
  account: pet.account,
  gender: pet.gender === '公' ? '公' : '母',
  nature: pet.nature,
  voiceDb: pet.voiceDb,
  medalBody: pet.medalBody,
  heightPercent: pet.heightPercent ?? null,
  weightPercent: pet.weightPercent ?? null,
  box: boxLabel(pet),
});

/** 子代拿到推荐性格集合中任意一个的概率：双方同性格 0.6 / 单方带 0.3（不累加同一方）。 */
export function recommendedNatureChance(
  motherNature: string,
  fatherNature: string,
  recommended: readonly string[],
): number {
  let chance = 0;
  for (const nature of recommended) {
    const m = motherNature === nature;
    const f = fatherNature === nature;
    if (m && f) chance += 0.6;
    else if (m || f) chance += 0.3;
  }
  return chance;
}

const buildIndex = (
  account: string,
  pets: OwnedPet[],
  byGameId: ReadonlyMap<number, SpeciesEntry>,
  mode: TargetMode,
  grade: PetGrade,
  criteria: MotherCriteria,
  naturesOf: (gameId: number) => readonly string[],
  plan: MotherNestPlanUsage | undefined,
): AccountIndex => {
  const femalesByEgg = new Map<number, OwnedPet[]>();
  const malesByGroup = new Map<number, OwnedPet[]>();
  const qualifiedEggs = new Set<number>();
  const maleEggs = new Set<number>();

  for (const pet of pets) {
    const egg = eggOf(pet, byGameId);
    if (egg == null) continue;
    if (pet.gender === '母' && isQualifiedMother(pet, criteria, naturesOf)) qualifiedEggs.add(egg);
    if (classifyGrade(pet, mode) !== grade) continue;
    if (pet.gender === '母') {
      const list = femalesByEgg.get(egg) ?? [];
      list.push(pet);
      femalesByEgg.set(egg, list);
    } else if (pet.gender === '公') {
      maleEggs.add(egg);
      for (const group of groupsOf(pet, byGameId)) {
        const list = malesByGroup.get(group) ?? [];
        list.push(pet);
        malesByGroup.set(group, list);
      }
    }
  }

  const placedKeys = new Set((plan?.slots ?? []).map((slot) => slot.pet.key));
  return {
    account,
    pets,
    femalesByEgg,
    malesByGroup,
    qualifiedEggs,
    maleEggs,
    placedKeys,
    nestsUsed: plan?.nestsUsed ?? 0,
    nestsTotal: plan?.nestsTotal ?? 0,
  };
};

/** 一只目标档位母本 + 一只目标档位公，按「推荐性格 + 同种双收」挑最好的一对。 */
const bestPairForEgg = (
  eggGameId: number,
  mothers: OwnedPet[],
  account: AccountIndex,
  byGameId: ReadonlyMap<number, SpeciesEntry>,
  grade: PetGrade,
  recommendedNatures: string[],
  uncoveredCells: ReadonlySet<string>,
  eggGroups: number[],
): { mother: OwnedPet; father: OwnedPet; natureChance: number; studGain: number } | null => {
  let best: {
    mother: OwnedPet;
    father: OwnedPet;
    natureChance: number;
    studGain: number;
  } | null = null;
  const fathers = new Set<OwnedPet>();
  for (const group of eggGroups) {
    for (const father of account.malesByGroup.get(group) ?? []) fathers.add(father);
  }
  for (const mother of mothers) {
    for (const father of fathers) {
      if (mother === father || !sharesGroup(mother, father, byGameId)) continue;
      const natureChance = recommendedNatureChance(mother.nature, father.nature, recommendedNatures);
      if (natureChance <= 0) continue;
      const sameSpecies = eggOf(father, byGameId) === eggGameId;
      let studGain = 0;
      if (sameSpecies) {
        const groupCount = eggGroups.filter((group) =>
          uncoveredCells.has(`${group}|${father.nature}|${grade}`),
        ).length;
        if (groupCount > 0) {
          studGain =
            (father.nature === mother.nature ? 0.6 : 0.3) *
            groupCount *
            genderFactorOf(byGameId.get(eggGameId), '公');
        }
      }
      const candidate = { mother, father, natureChance, studGain };
      if (
        !best ||
        candidate.studGain > best.studGain ||
        (candidate.studGain === best.studGain && candidate.natureChance > best.natureChance)
      ) {
        best = candidate;
      }
    }
  }
  return best;
};

export function buildMotherNestSuggestions(input: MotherNestInput): Map<string, MotherNestAccount> {
  const { species, owned, mode, grade, criteria, naturesOf, coverageByAccount, plans = [] } = input;
  const byGameId = new Map(species.map((entry) => [entry.gameId, entry]));
  const plansByAccount = new Map(plans.map((plan) => [plan.account, plan]));

  // 每个号一份索引（与 buildNestPlans 的账号分组、`NestPet.key` 序号保持一致）
  const ownedByAccount = new Map<string, OwnedPet[]>();
  for (const pet of owned) {
    const list = ownedByAccount.get(pet.account) ?? [];
    list.push(pet);
    ownedByAccount.set(pet.account, list);
  }
  const indexes = new Map<string, AccountIndex>();
  for (const [account, pets] of ownedByAccount) {
    indexes.set(
      account,
      buildIndex(
        account,
        pets,
        byGameId,
        mode,
        grade,
        criteria,
        naturesOf,
        plansByAccount.get(account),
      ),
    );
  }

  /** 蛋物种全集（只保留能孵、能出母的蛋；性别比例缺数据按 5:5） */
  const eggEntries = species.filter((entry) => {
    if (entry.eggGameId !== entry.gameId) return false;
    if (!(entry.eggGroups ?? []).some(isBreedableGroup)) return false;
    return genderShareOf(entry, '母') > 0;
  });

  const recommendedNaturesOn = criteria.recommendedNatures === true;
  const result = new Map<string, MotherNestAccount>();
  for (const [account, index] of indexes) {
    const uncovered = new Set<string>();
    for (const cell of coverageByAccount.get(account)?.cells ?? []) {
      if (cell.state !== 'covered' && cell.grade === grade) {
        uncovered.add(`${cell.groupId}|${cell.natureName}|${cell.grade}`);
      }
    }

    // —— 本号内：目标档位母本已有、只是没达标（推荐性格）——
    const pairings: MotherNestPairing[] = [];
    if (recommendedNaturesOn) {
      for (const [eggGameId, mothers] of index.femalesByEgg) {
        if (index.qualifiedEggs.has(eggGameId)) continue;
        const egg = byGameId.get(eggGameId);
        if (!egg) continue;
        const eggGroups = (egg.eggGroups ?? []).filter(isBreedableGroup);
        const recommended = [...naturesOf(eggGameId)];
        if (recommended.length === 0) continue;
        const best = bestPairForEgg(
          eggGameId,
          mothers,
          index,
          byGameId,
          grade,
          recommended,
          uncovered,
          eggGroups,
        );
        if (!best) continue;
        const femaleChance = genderShareOf(egg, '母');
        const motherGain = best.natureChance * femaleChance;
        const sameSpecies = eggOf(best.father, byGameId) === eggGameId;
        pairings.push({
          account,
          grade,
          eggGameId,
          eggName: speciesDisplayName(egg, egg.name),
          groupIds: [...eggGroups].sort((a, b) => a - b),
          recommendedNatures: recommended,
          mother: toNestPet(best.mother, `${account}#${index.pets.indexOf(best.mother)}`, byGameId),
          father: toNestPet(best.father, `${account}#${index.pets.indexOf(best.father)}`, byGameId),
          natureChance: best.natureChance,
          femaleChance,
          motherGain,
          studGain: best.studGain,
          expectedValue: motherGain + best.studGain,
          sameSpecies,
          nestsNeeded:
            (index.placedKeys.has(`${account}#${index.pets.indexOf(best.mother)}`) ? 0 : 1) +
            (index.placedKeys.has(`${account}#${index.pets.indexOf(best.father)}`) ? 0 : 1),
        });
      }
    }
    pairings.sort(
      (a, b) =>
        b.expectedValue - a.expectedValue ||
        Number(b.sameSpecies) - Number(a.sameSpecies) ||
        a.eggName.localeCompare(b.eggName, 'zh-Hans-CN'),
    );
    // 本号内的线要占窝：按期望从高到低，占得下的才收；占不下的不硬塞
    let nestsLeft = Math.max(0, index.nestsTotal - index.nestsUsed);
    const accepted: MotherNestPairing[] = [];
    for (const pairing of pairings) {
      if (pairing.nestsNeeded > nestsLeft) continue;
      nestsLeft -= pairing.nestsNeeded;
      accepted.push(pairing);
    }

    // —— 跨号：本号没有目标档位母本，别的号最高概率的那一对 ——
    const tasks: MotherNestTask[] = [];
    for (const egg of eggEntries) {
      const eggGameId = egg.gameId;
      if (index.femalesByEgg.has(eggGameId) || index.qualifiedEggs.has(eggGameId)) continue;
      const eggGroups = (egg.eggGroups ?? []).filter(isBreedableGroup);
      const recommended = [...naturesOf(eggGameId)];
      if (recommendedNaturesOn && recommended.length === 0) continue;
      const femaleChance = genderShareOf(egg, '母');
      let bestTask: MotherNestTask | null = null;
      for (const [sourceAccount, source] of indexes) {
        if (sourceAccount === account) continue;
        const mothers = source.femalesByEgg.get(eggGameId);
        if (!mothers || mothers.length === 0) continue;
        const fathers = new Set<OwnedPet>();
        for (const group of eggGroups) {
          for (const father of source.malesByGroup.get(group) ?? []) fathers.add(father);
        }
        let bestPair: { mother: OwnedPet; father: OwnedPet; natureChance: number } | null = null;
        for (const mother of mothers) {
          for (const father of fathers) {
            if (mother === father || !sharesGroup(mother, father, byGameId)) continue;
            const natureChance = recommendedNaturesOn
              ? recommendedNatureChance(mother.nature, father.nature, recommended)
              : 1;
            if (natureChance <= 0) continue;
            if (!bestPair || natureChance > bestPair.natureChance) {
              bestPair = { mother, father, natureChance };
            }
          }
        }
        if (!bestPair) continue;
        const task: MotherNestTask = {
          account,
          grade,
          eggGameId,
          eggName: speciesDisplayName(egg, egg.name),
          groupIds: [...eggGroups].sort((a, b) => a - b),
          recommendedNatures: recommended,
          sourceAccount,
          mother: toNestPet(
            bestPair.mother,
            `${sourceAccount}#${source.pets.indexOf(bestPair.mother)}`,
            byGameId,
          ),
          father: toNestPet(
            bestPair.father,
            `${sourceAccount}#${source.pets.indexOf(bestPair.father)}`,
            byGameId,
          ),
          natureChance: bestPair.natureChance,
          femaleChance,
          chance: bestPair.natureChance * femaleChance,
          sameSpecies: index.maleEggs.has(eggGameId),
        };
        if (
          !bestTask ||
          task.chance > bestTask.chance ||
          (task.chance === bestTask.chance && Number(task.sameSpecies) > Number(bestTask.sameSpecies))
        ) {
          bestTask = task;
        }
      }
      if (bestTask) tasks.push(bestTask);
    }
    tasks.sort(
      (a, b) =>
        b.chance - a.chance ||
        Number(b.sameSpecies) - Number(a.sameSpecies) ||
        a.eggName.localeCompare(b.eggName, 'zh-Hans-CN'),
    );

    const gapCount = eggEntries.filter((egg) => !index.qualifiedEggs.has(egg.gameId)).length;
    result.set(account, {
      gapCount,
      pairings: accepted,
      tasks: tasks.slice(0, 5),
      nestsUsed: accepted.reduce((sum, pairing) => sum + pairing.nestsNeeded, 0),
    });
  }
  return result;
}
