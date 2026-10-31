import {
  linesIndexSuppliesEgg,
  type ProductionIndex,
  type ProductionLinesIndex,
} from './productionLines';
import { speciesDisplayName } from './speciesName';
import type { SpeciesEntry } from './types';

/**
 * 种公需求的候选蛋（2026-10-30 用户口径）。
 *
 * 种公需求本身只记「蛋组 + 性格 + 性别公 + 体型 / 声音」，在需求中心会变成一张
 * 没有头像的空卡。这里按**组内产线**把「能孵出这颗公的蛋」全部算出来：
 * 卡片用其中一枚当代表（双蛋组优先），其余用角标标数量。
 */
export interface StudCandidateMember {
  accountId: string;
  /** null = 旧摘要没带产线，只能用 `eggGameIds` 兜底判断。 */
  linesIndex: ProductionLinesIndex | null;
  eggGameIds: ReadonlySet<number>;
}

export interface StudDemandCandidate {
  eggGameId: number;
  name: string;
  /** 组内能产这枚蛋（且满足性格 / 体型 / 声音）的成员。 */
  supplierIds: string[];
  /** 这枚蛋的可配蛋组数量；>= 2 视为双蛋组，排序优先。 */
  groupCount: number;
}

export interface StudDemandQuery {
  groupId: number;
  nature: string;
  body: string;
  voice: string;
}

/** 组内能孵出「这颗公」的蛋，按双蛋组 → 能补人数 → 图鉴号排序。 */
export function findStudDemandCandidates(
  query: StudDemandQuery,
  species: readonly SpeciesEntry[],
  index: ProductionIndex,
  members: readonly StudCandidateMember[],
): StudDemandCandidate[] {
  const target = {
    kind: 'stud' as const,
    groupId: query.groupId,
    nature: query.nature,
    body: query.body,
    voice: query.voice,
  };
  // 蛋物种清单直接取索引（`eggsByGroup` 已按「能出公的蛋物种」筛好），
  // 不再扫全图鉴——那是 `demandCriteria` 之外的第二份口径（2026-11-01 代码审查 R2-1-M03）。
  const eggIds = index.eggsByGroup.get(query.groupId) ?? [];
  if (eggIds.length === 0) return [];

  const speciesByGameId = new Map<number, SpeciesEntry>();
  for (const entry of species) speciesByGameId.set(entry.gameId, entry);

  const candidates: StudDemandCandidate[] = [];
  for (const eggGameId of eggIds) {
    const entry = speciesByGameId.get(eggGameId);
    if (!entry) continue;

    const supplierIds: string[] = [];
    for (const member of members) {
      if (member.linesIndex == null) {
        if (member.eggGameIds.has(eggGameId)) supplierIds.push(member.accountId);
        continue;
      }
      if (linesIndexSuppliesEgg(member.linesIndex, eggGameId, target)) {
        supplierIds.push(member.accountId);
      }
    }
    if (supplierIds.length === 0) continue;

    candidates.push({
      eggGameId,
      name: speciesDisplayName(entry, entry.name),
      supplierIds,
      groupCount: index.eggGroupsByGameId.get(eggGameId)?.length ?? 0,
    });
  }

  return candidates.sort(
    (a, b) =>
      Number(b.groupCount >= 2) - Number(a.groupCount >= 2) ||
      b.supplierIds.length - a.supplierIds.length ||
      a.eggGameId - b.eggGameId,
  );
}
