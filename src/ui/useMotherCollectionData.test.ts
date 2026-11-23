import { describe, expect, test } from 'vitest';
import { createDemand } from '../shared/eggMatching';
import type { WorkflowTrade } from '../shared/eggWorkflow';
import {
  COLLECTING_STATUS_FILTERS,
  collectingFooterClass,
  deriveMotherCollection,
  type MotherCollectionInput,
} from './useMotherCollectionData';

const groups = [
  { chainKey: 'egg:100', eggGameId: 100, formLabel: '已计划', number: '001', eggGroups: [2] },
  { chainKey: 'egg:200', eggGameId: 200, formLabel: '已发布', number: '002', eggGroups: [2] },
  { chainKey: 'egg:300', eggGameId: 300, formLabel: '等待回应', number: '003', eggGroups: [2] },
  { chainKey: 'egg:400', eggGameId: 400, formLabel: '已接单', number: '004', eggGroups: [2] },
  { chainKey: 'egg:500', eggGameId: 500, formLabel: '已收到', number: '005', eggGroups: [2] },
];

const demand = (eggGameId: number, extra: Partial<Parameters<typeof createDemand>[0]> = {}) =>
  createDemand({
    id: `d${eggGameId}`,
    groupId: 'g1',
    demanderAccountId: 'me',
    eggGameId,
    natures: ['固执'],
    body: '大块头',
    voice: '+100',
    quantity: 1,
    ...extra,
  });

const trade = (eggGameId: number, status: WorkflowTrade['status'], initiatorAccountId = 'me') =>
  ({
    id: `t${eggGameId}`,
    groupId: 'g1',
    demandId: `d${eggGameId}`,
    supplierAccountId: initiatorAccountId === 'me' ? 'b' : 'me',
    demanderAccountId: 'me',
    give: { nature: '固执' },
    receive: null,
    type: 'spot',
    status,
    placed: false,
    createdAt: 1,
    initiatorAccountId,
  }) as unknown as WorkflowTrade;

const base: MotherCollectionInput = {
  planKeys: groups.map((group) => group.chainKey),
  motherGroups: groups,
  naturesByEgg: new Map(groups.map((group) => [group.eggGameId, ['固执']])),
  demands: [
    demand(200),
    demand(300),
    demand(400),
    // 数量 1、已满足 1 → 状态 fulfilled（= 已收到）
    demand(500, { fulfilled: 1 }),
  ],
  trades: [trade(300, 'proposed'), trade(400, 'accepted')],
  members: [
    { accountId: 'me', displayName: '我' },
    { accountId: 'b', displayName: '小布' },
  ],
  viewerAccountId: 'me',
};

describe('useMotherCollectionData', () => {
  test('已收到的卡不再算收集中（已获得 = 已收集），收集中只剩四种状态', () => {
    const data = deriveMotherCollection(base);
    expect(data.cards.map((card) => card.eggGameId)).not.toContain(500);
    expect(data.received).toBe(1);
    expect(data.counts).toEqual({ planned: 1, published: 1, proposal: 1, in_progress: 1 });
    expect(data.total).toBe(4);
  });

  test('状态筛选项带数字，且只保留有卡的状态（顺序固定：已计划 / 已发布 / 等待回应 / 已接单）', () => {
    const data = deriveMotherCollection(base);
    expect(COLLECTING_STATUS_FILTERS.map((item) => item.label)).toEqual([
      '已计划',
      '已发布',
      '等待回应',
      '已接单',
    ]);
    expect(data.filters).toEqual([
      { value: 'all', label: '全部', count: 4 },
      { value: 'planned', label: '已计划', count: 1 },
      { value: 'published', label: '已发布', count: 1 },
      { value: 'proposal', label: '等待回应', count: 1 },
      { value: 'in_progress', label: '已接单', count: 1 },
    ]);
  });

  test('点某个状态只留这一类卡', () => {
    const data = deriveMotherCollection(base);
    expect(data.visible('in_progress').map((card) => card.eggGameId)).toEqual([400]);
    expect(data.visible('all')).toHaveLength(4);
  });

  test('底条按状态分色，且四种状态各不相同', () => {
    const tones = new Set(
      (['planned', 'published', 'proposal', 'in_progress'] as const).map(collectingFooterClass),
    );
    expect(tones.size).toBe(4);
    expect(collectingFooterClass('in_progress')).toContain('teal');
    expect(collectingFooterClass('proposal')).toContain('amber');
  });
});
