import { useMemo } from 'react';
import {
  buildCollectionPlanCards,
  type CollectionPlanCard,
  type CollectionPlanMember,
  type CollectionPlanMotherGroup,
  type CollectionPlanStatus,
} from '../domain/collectionPlan';
import type { EggDemand } from '../shared/eggMatching';
import type { WorkflowTrade } from '../shared/eggWorkflow';

/**
 * 「收集中」视图的唯一数据源（2026-11-22 C1）。
 *
 * 之前 `MotherCollectingView` 在两个分支里各拼一次 `buildCollectionPlanCards` 入参，
 * 状态口径也只活在卡片里。这里收口三件事：
 *
 * 1. **哪些状态算收集中**：`planned / published / proposal / in_progress`；
 *    `received`（已收到）等于母本已经到手，归「已收集」，不再留在收集中；
 * 2. **状态计数**：给顶部快速筛选当数字用，数完就能点；
 * 3. **筛选**：按状态过一遍卡片，视图只负责画。
 */
export type CollectingStatus = Exclude<CollectionPlanStatus, 'received'>;
export type CollectingFilter = 'all' | CollectingStatus;

export interface MotherCollectionInput {
  planKeys: readonly string[];
  motherGroups: readonly CollectionPlanMotherGroup[];
  naturesByEgg: ReadonlyMap<number, readonly string[]>;
  demands: readonly EggDemand[];
  trades: readonly WorkflowTrade[];
  members: readonly CollectionPlanMember[];
  viewerAccountId: string;
}

/** 快速筛选的顺序与文案（用户 2026-11-22 口径：已计划 / 已发布 / 已接单…） */
export const COLLECTING_STATUS_FILTERS: ReadonlyArray<{
  value: CollectingStatus;
  label: string;
}> = [
  { value: 'planned', label: '已计划' },
  { value: 'published', label: '已发布' },
  { value: 'proposal', label: '等待回应' },
  { value: 'in_progress', label: '已接单' },
];

/**
 * 底条配色：状态只靠底条区分（整卡统一白底），
 * 与「计划 / 收集中 / 等待组员回应 / 已接单」四档一一对应，位置与高度不变。
 */
const FOOTER_CLASS: Record<CollectingStatus, string> = {
  planned: 'bg-slate-100 text-slate-600',
  published: 'bg-sky-50 text-sky-700',
  proposal: 'bg-amber-50 text-amber-700',
  in_progress: 'bg-teal-50 text-teal-700',
};

export function collectingFooterClass(status: CollectingStatus): string {
  return FOOTER_CLASS[status];
}

export interface CollectingFilterItem {
  value: CollectingFilter;
  label: string;
  count: number;
}

export interface MotherCollectionData {
  /** 收集中卡片（不含已收到） */
  cards: CollectionPlanCard[];
  /** 已收到、已划到「已收集」的条数 */
  received: number;
  total: number;
  counts: Record<CollectingStatus, number>;
  /** 「全部」+ 只保留有卡的状态，数字直接当筛选按钮 */
  filters: CollectingFilterItem[];
  visible: (filter: CollectingFilter) => CollectionPlanCard[];
}

export function deriveMotherCollection(input: MotherCollectionInput): MotherCollectionData {
  const all = buildCollectionPlanCards(input);
  const cards = all.filter((card) => card.status !== 'received');
  const counts: Record<CollectingStatus, number> = {
    planned: 0,
    published: 0,
    proposal: 0,
    in_progress: 0,
  };
  for (const card of cards) counts[card.status as CollectingStatus] += 1;

  const filters: CollectingFilterItem[] = [
    { value: 'all', label: '全部', count: cards.length },
    ...COLLECTING_STATUS_FILTERS.filter((item) => counts[item.value] > 0).map((item) => ({
      value: item.value,
      label: item.label,
      count: counts[item.value],
    })),
  ];

  return {
    cards,
    received: all.length - cards.length,
    total: cards.length,
    counts,
    filters,
    visible: (filter) => (filter === 'all' ? cards : cards.filter((card) => card.status === filter)),
  };
}

export function useMotherCollectionData(input: MotherCollectionInput): MotherCollectionData {
  const { planKeys, motherGroups, naturesByEgg, demands, trades, members, viewerAccountId } = input;
  return useMemo(
    () =>
      deriveMotherCollection({
        planKeys,
        motherGroups,
        naturesByEgg,
        demands,
        trades,
        members,
        viewerAccountId,
      }),
    [planKeys, motherGroups, naturesByEgg, demands, trades, members, viewerAccountId],
  );
}
