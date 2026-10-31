import { classifyGrade, GRADE_BODY, type PetGrade, type TargetMode } from './petFilters';
import { isBreedableGroup } from './eggs';
import { accountKeyOf, type AccountSnapshot } from './parseBackup';
import type { SpeciesEntry } from './types';

/**
 * 「产线」：同一账号里能稳定产出的 蛋 × 档位 × 性格。
 *
 * 规则（2026-10-27 与用户逐条确认）：
 * - **不能跨账号**：母本和配对公必须在同一个游戏账号里；
 * - **双方同档位**：声音遗传是 (父 + 母) / 2，要 +100 必须父母双双 +100；
 *   体型同理，双大块头才出大块头蛋；
 * - 母本必须是这枚蛋的物种（或它的进化形态），公只要同蛋组、同档位；
 * - 性格可以由母本带，也可以由公带（放学院小窝，100% 遗传），所以
 *   `natures` = 母本性格 ∪ 同档位可配公的性格；
 * - 种公需求还要看这枚蛋能不能出公（`maleCapable`），母本需求不需要。
 *
 * 这里只做纯计算，不读网络、不写库；共享摘要与页面都复用这一份口径。
 */
export interface ProductionLine {
  /** 这枚蛋的 gameId（母本的血脉蛋，不是形态 id）。 */
  eggGameId: number;
  /** 双方共同的档位（大婉 / 小婉 / 大粗 / 小粗）。 */
  grade: PetGrade;
  /** 这条产线能产出的性格（母本 + 同档位可配公）。 */
  natures: string[];
}

export interface AccountProductionLines {
  accountKey: string;
  lines: ProductionLine[];
}

export interface BuildProductionLinesInput {
  snapshots: readonly AccountSnapshot[];
  species: readonly SpeciesEntry[];
  mode: TargetMode;
}

/** 母本 / 种公两种目标；母本必须指定蛋，种公只认蛋组。 */
export type ProductionTarget =
  | {
      kind: 'mother';
      eggGameId: number;
      nature: string;
      body: string;
      voice: string;
    }
  | {
      kind: 'stud';
      groupId: number;
      nature: string;
      body: string;
      voice: string;
    };

const sortNatures = (natures: Iterable<string>): string[] =>
  [...new Set(natures)].sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));

const eggGroupsOf = (species: readonly SpeciesEntry[]): Map<number, number[]> => {
  const map = new Map<number, number[]>();
  for (const entry of species) {
    if (entry.eggGameId != null && entry.eggGameId === entry.gameId) {
      map.set(entry.gameId, (entry.eggGroups ?? []).filter(isBreedableGroup));
    }
  }
  return map;
};

/**
 * 从账号快照生成产线。每个账号单独算，绝不跨账号拼父母。
 */
export function buildProductionLines(
  input: BuildProductionLinesInput,
): AccountProductionLines[] {
  const { snapshots, species, mode } = input;
  const eggOfGameId = new Map<number, number>();
  for (const entry of species) {
    if (entry.eggGameId != null && entry.eggGameId > 0) {
      eggOfGameId.set(entry.gameId, entry.eggGameId);
    }
  }
  const groupsByEgg = eggGroupsOf(species);
  const groupsByGameId = new Map<number, number[]>();
  for (const entry of species) {
    groupsByGameId.set(entry.gameId, (entry.eggGroups ?? []).filter(isBreedableGroup));
  }

  return snapshots.map((snapshot) => {
    const mothers = new Map<string, { eggGameId: number; grade: PetGrade; natures: Set<string> }>();
    const males = new Map<PetGrade, Array<{ groups: number[]; nature: string }>>();

    for (const pet of snapshot.pets) {
      const grade = classifyGrade(pet, mode);
      if (!grade) continue;
      if (pet.gender === '公') {
        const groups = groupsByGameId.get(pet.gameId) ?? [];
        if (groups.length === 0) continue;
        const list = males.get(grade) ?? [];
        list.push({ groups, nature: pet.nature });
        males.set(grade, list);
        continue;
      }
      if (pet.gender !== '母') continue;
      const eggGameId = eggOfGameId.get(pet.gameId);
      if (eggGameId == null) continue;
      const key = `${eggGameId}|${grade}`;
      const entry = mothers.get(key) ?? {
        eggGameId,
        grade,
        natures: new Set<string>(),
      };
      entry.natures.add(pet.nature);
      mothers.set(key, entry);
    }

    const lines: ProductionLine[] = [];
    for (const mother of mothers.values()) {
      const eggGroups = groupsByEgg.get(mother.eggGameId) ?? [];
      if (eggGroups.length === 0) continue;
      const compatibleMales = (males.get(mother.grade) ?? []).filter((male) =>
        male.groups.some((group) => eggGroups.includes(group)),
      );
      if (compatibleMales.length === 0) continue;
      const natures = new Set(mother.natures);
      for (const male of compatibleMales) natures.add(male.nature);
      lines.push({
        eggGameId: mother.eggGameId,
        grade: mother.grade,
        natures: sortNatures(natures),
      });
    }

    lines.sort((a, b) => a.eggGameId - b.eggGameId || a.grade.localeCompare(b.grade));
    return {
      accountKey: snapshot.accountKey ?? accountKeyOf(snapshot),
      lines,
    };
  });
}

/**
 * 产线档位 → 能匹配的声音标签。
 *
 * 产线只记档位、不记具体分贝，所以 +100 与婉转声 / -100 与粗嗓门在档位上等价，
 * 四标签互通（2026-10-28b）。这里与目标模式无关，判定统一用这一张表
 * （2026-10-29 代码审查 B1-L01：原来按 mode 分层再合并，mode 实际不生效）。
 */
const VOICE_GRADES: Record<string, readonly PetGrade[]> = {
  '+100': ['大婉', '小婉'],
  婉转声: ['大婉', '小婉'],
  '-100': ['大粗', '小粗'],
  粗嗓门: ['大粗', '小粗'],
};

const gradeMatchesTarget = (grade: PetGrade, target: ProductionTarget): boolean => {
  if (target.body && GRADE_BODY[grade] !== target.body) return false;
  if (!target.voice) return true;
  return (VOICE_GRADES[target.voice] ?? []).includes(grade);
};

/**
 * 产线判定用的图鉴索引：一次构建，供 `lineSuppliesTarget` 反复使用。
 *
 * 这些 Map 原来在每个 `lineSuppliesTarget` 调用里重建（`species.find` + 全表 Map），
 * 调用方又在「行 × 成员 × 性格」的循环里，属于重复计算（2026-10-29 代码审查 B1-M02）。
 */
export interface ProductionIndex {
  /** 形态 gameId → 可孵蛋组（公本可以是进化形态，所以按形态自己的蛋组）。 */
  eggGroupsByGameId: Map<number, number[]>;
  /** 蛋物种 gameId → 能否出公（只对蛋物种本身有意义）。 */
  maleCapableByGameId: Map<number, boolean>;
  /** 蛋组 id → 能出公的蛋物种（种公需求查表用，避免每次扫全图鉴）。 */
  eggsByGroup: Map<number, number[]>;
}

export function buildProductionIndex(species: readonly SpeciesEntry[]): ProductionIndex {
  const eggGroupsByGameId = new Map<number, number[]>();
  const maleCapableByGameId = new Map<number, boolean>();
  const eggsByGroup = new Map<number, number[]>();
  for (const entry of species) {
    const groups = (entry.eggGroups ?? []).filter(isBreedableGroup);
    eggGroupsByGameId.set(entry.gameId, groups);
    if (entry.eggGameId != null && entry.eggGameId === entry.gameId) {
      const maleCapable = entry.maleCapable === true;
      maleCapableByGameId.set(entry.gameId, maleCapable);
      if (maleCapable) {
        for (const group of groups) {
          const list = eggsByGroup.get(group) ?? [];
          list.push(entry.gameId);
          eggsByGroup.set(group, list);
        }
      }
    }
  }
  return { eggGroupsByGameId, maleCapableByGameId, eggsByGroup };
}

/**
 * 一条产线能否满足目标。
 *
 * - 母本：必须是指定蛋；
 * - 种公：蛋属于目标蛋组即可，且该蛋必须能出公；
 * - 性格：目标不挑 = 任意；否则产线的 `natures` 必须包含；
 * - 体型 / 声音：按档位匹配。
 */
export function lineSuppliesTarget(
  line: ProductionLine,
  target: ProductionTarget,
  index: ProductionIndex,
): boolean {
  if (target.kind === 'mother') {
    if (line.eggGameId !== target.eggGameId) return false;
  } else {
    const groups = index.eggGroupsByGameId.get(line.eggGameId) ?? [];
    if (!groups.includes(target.groupId)) return false;
    if (index.maleCapableByGameId.get(line.eggGameId) !== true) return false;
  }
  if (target.nature && !line.natures.includes(target.nature)) return false;
  return gradeMatchesTarget(line.grade, target);
}

/** 一组产线（一个账号 / 一个小组）里是否有人能满足目标。 */
export function linesSupplyTarget(
  lines: readonly ProductionLine[],
  target: ProductionTarget,
  index: ProductionIndex,
): boolean {
  return lines.some((line) => lineSuppliesTarget(line, target, index));
}

/**
 * 产线索引：`eggGameId → 档位 → 性格集合`。
 *
 * 「我缺的」要按 200 颗蛋 × 成员 × 性格 反复判定，原来每次都线性扫该成员全部产线
 * （20 个账号 × 1024 条），实机上就是几秒级卡顿（2026-10-31）。先把产线压成索引，
 * 之后每次判定只是几次 Map / Set 命中。
 */
export type ProductionLinesIndex = Map<number, Map<PetGrade, Set<string>>>;

export function buildLinesIndex(lines: readonly ProductionLine[]): ProductionLinesIndex {
  const byEgg: ProductionLinesIndex = new Map();
  for (const line of lines) {
    let byGrade = byEgg.get(line.eggGameId);
    if (!byGrade) {
      byGrade = new Map();
      byEgg.set(line.eggGameId, byGrade);
    }
    let natures = byGrade.get(line.grade);
    if (!natures) {
      natures = new Set();
      byGrade.set(line.grade, natures);
    }
    for (const nature of line.natures) natures.add(nature);
  }
  return byEgg;
}

/**
 * 索引版的「**这一颗蛋**的产线能否满足目标」。
 *
 * 与 `linesIndexSuppliesTarget` 共用同一套档位 / 性格判定，区别是只管调用方指定的那颗蛋
 * （蛋组 / 能否出公由调用方筛）。`lines` 为空（旧摘要没产线）时返回 false。
 */
export function linesIndexSuppliesEgg(
  lines: ProductionLinesIndex | undefined,
  eggGameId: number,
  target: ProductionTarget,
): boolean {
  const byGrade = lines?.get(eggGameId);
  if (!byGrade) return false;
  for (const [grade, natures] of byGrade) {
    if (!gradeMatchesTarget(grade, target)) continue;
    if (target.nature && !natures.has(target.nature)) continue;
    return true;
  }
  return false;
}

/**
 * 索引版的「这个成员的产线能否满足目标」，语义与 `linesSupplyTarget` 完全一致。
 * `index` 为空（旧摘要没有产线）时返回 false，调用方自己决定是否退回「有没有这只蛋」。
 */
export function linesIndexSuppliesTarget(
  lines: ProductionLinesIndex | undefined,
  target: ProductionTarget,
  productionIndex: ProductionIndex,
): boolean {
  if (!lines) return false;
  if (target.kind === 'mother') return linesIndexSuppliesEgg(lines, target.eggGameId, target);
  for (const eggGameId of productionIndex.eggsByGroup.get(target.groupId) ?? []) {
    if (linesIndexSuppliesEgg(lines, eggGameId, target)) return true;
  }
  return false;
}
