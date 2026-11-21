import { describe, expect, test } from 'vitest';
import { createDemand } from '../shared/eggMatching';
import type { WorkflowTrade } from '../shared/eggWorkflow';
import { buildCollectionPlanCards } from './collectionPlan';

const groups = [
  {
    chainKey: 'egg:3227',
    eggGameId: 3227,
    formLabel: '菊花梨',
    number: '027',
    eggGroups: [2],
  },
];

const members = [
  { accountId: 'me', displayName: '我' },
  { accountId: 'b', displayName: '小布' },
];

const trade = (input: Partial<WorkflowTrade>): WorkflowTrade => ({
  id: 't1',
  groupId: 'g1',
  demandId: 'd1',
  supplierAccountId: 'b',
  demanderAccountId: 'me',
  give: {
    id: 'egg-b',
    accountId: 'b',
    eggGameId: 3227,
    nature: '固执',
    body: '大块头',
    voice: '婉转声',
    kind: 'ordinary',
    status: 'available',
    provenance: 'unknown',
    confidence: 'manual',
    labelSource: 'unknown',
  },
  receive: null,
  type: 'spot',
  status: 'proposed',
  placed: false,
  createdAt: 1,
  initiatorAccountId: 'b',
  ...input,
});

const base = {
  planKeys: ['egg:3227'],
  motherGroups: groups,
  naturesByEgg: new Map([[3227, ['固执', '平和']]]),
  viewerAccountId: 'me',
  members,
};

describe('buildCollectionPlanCards', () => {
  test('计划项没有组内请求时显示已计划和下一步', () => {
    const [card] = buildCollectionPlanCards({
      ...base,
      demands: [],
      trades: [],
    });
    expect(card).toMatchObject({
      eggGameId: 3227,
      name: '菊花梨',
      natures: ['固执', '平和'],
      status: 'planned',
      statusLabel: '已计划',
      statusDetail: '还没有发布到小组',
    });
  });

  test('已发布但没有回应时写明仍在等组员回应', () => {
    const [card] = buildCollectionPlanCards({
      ...base,
      demands: [
        createDemand({
          id: 'd1',
          groupId: 'g1',
          demanderAccountId: 'me',
          eggGameId: 3227,
          natures: ['固执'],
          body: '大块头',
          voice: '+100',
          quantity: 1,
        }),
      ],
      trades: [],
    });
    expect(card.status).toBe('published');
    expect(card.statusLabel).toBe('已发布');
    expect(card.statusDetail).toContain('固执');
    expect(card.statusDetail).toContain('仍在等组员回应');
  });

  test('收到别人意向时直接写谁想换什么', () => {
    const [card] = buildCollectionPlanCards({
      ...base,
      demands: [
        createDemand({
          id: 'd1',
          groupId: 'g1',
          demanderAccountId: 'me',
          eggGameId: 3227,
          natures: ['固执'],
          body: '大块头',
          voice: '+100',
          quantity: 1,
        }),
      ],
      trades: [trade({})],
    });
    expect(card.status).toBe('proposal');
    expect(card.statusLabel).toBe('收到新意向');
    expect(card.statusDetail).toContain('小布想换固执');
    expect(card.statusDetail).not.toContain('需求已满');
    expect(card.statusDetail).not.toContain('已被其他交换占用');
  });

  test('已接受时写明承接人和剩余数量', () => {
    const [card] = buildCollectionPlanCards({
      ...base,
      demands: [
        createDemand({
          id: 'd1',
          groupId: 'g1',
          demanderAccountId: 'me',
          eggGameId: 3227,
          natures: ['固执'],
          body: '大块头',
          voice: '+100',
          quantity: 1,
        }),
      ],
      trades: [trade({ status: 'accepted', initiatorAccountId: 'me' })],
    });
    expect(card.status).toBe('in_progress');
    expect(card.statusLabel).toBe('小布已接单');
    expect(card.statusDetail).toContain('小布已接受固执');
    expect(card.statusDetail).toContain('还剩 0 份');
  });

  test('多性格部分已安排时仍保留另一条待回应', () => {
    const [card] = buildCollectionPlanCards({
      ...base,
      demands: [
        createDemand({
          id: 'd1',
          groupId: 'g1',
          demanderAccountId: 'me',
          eggGameId: 3227,
          natures: ['固执', '平和'],
          body: '大块头',
          voice: '+100',
          quantity: 2,
        }),
      ],
      trades: [trade({ status: 'accepted', initiatorAccountId: 'me' })],
    });
    expect(card.statusDetail).toContain('小布已接受固执');
    expect(card.statusDetail).toContain('平和仍在等组员回应');
  });
});
