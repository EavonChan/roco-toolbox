import { describe, expect, test } from 'vitest';
import { emptyEggWorkflow, type WorkflowEgg } from './eggWorkflow';
import { recordIngestedHomeEggs, recordPatrolProducedEgg, type EggLabelIndex } from './eggPatrolStock';
import type { PatrolEgg, PatrolObservation, PatrolTask } from './eggPatrol';

const task: PatrolTask = {
  groupId: 'g',
  tradeId: 't',
  side: 'give',
  uid: '293143',
  producerAccountId: 'b',
  recipientAccountId: 'a',
  motherId: 'mother',
  fatherId: 'father',
  eggGameId: 3062,
  nature: '固执',
  body: '',
  voice: '',
};

const egg: PatrolEgg = {
  actorId: 'egg-1',
  nestId: 'nest-1',
  mother: {
    petId: 'mother',
    nestId: 'nest-1',
    speciesGameId: 3062,
    natureId: 2,
    voiceDb: 100,
    weightKg: 55,
  },
  fathers: [{
    petId: 'father',
    nestId: 'nest-2',
    speciesGameId: 3744,
    natureId: 2,
    voiceDb: 100,
    weightKg: 30,
  }],
  biologicalParentageConfirmed: true,
};

const produced: PatrolObservation = { task, actorId: egg.actorId, status: 'produced' };

describe('recordPatrolProducedEgg', () => {
  test('a produced patrol egg is added once as home stock', () => {
    const first = recordPatrolProducedEgg(emptyEggWorkflow(), task, produced, egg, 1000);
    expect(first.eggs).toHaveLength(1);
    expect(first.eggs[0]).toMatchObject({
      id: JSON.stringify(['uid:293143', 'home', 'egg-1']),
      accountId: 'b',
      gameAccountKey: 'uid:293143',
      eggGameId: 3062,
      location: 'home',
      status: 'available',
      listed: false,
      provenance: 'self-bred',
      lastConfirmedAt: 1000,
    });
    expect(first.eggs[0].parents).toMatchObject({
      mother: { id: 'mother', gameId: 3062 },
      fathers: [{ id: 'father', gameId: 3744 }],
      confirmed: true,
    });

    const again = recordPatrolProducedEgg(first, task, produced, egg, 2000);
    expect(again.eggs).toHaveLength(1);
    expect(again.eggs[0].lastConfirmedAt).toBe(2000);
  });

  /**
   * 2026-11-25 核心回归：用户那颗就是「rc 生蛋了吗」入库的——母本学院小窝 + 父本普通小窝。
   * 机器人两条入库函数以前完全不碰 greenNest，所以自动采进来的蛋永远没有绿窝标记。
   */
  test('green nest flag follows any academy parent, not exactly one and not the nature', () => {
    const greenOf = (patrolEgg: PatrolEgg) =>
      recordPatrolProducedEgg(emptyEggWorkflow(), task, produced, patrolEgg, 1000).eggs[0].greenNest;
    const motherAcademy: PatrolEgg = { ...egg, mother: { ...egg.mother!, nestConfigId: 1001072 } };
    expect(greenOf(motherAcademy)).toBe(true);
    expect(greenOf({ ...motherAcademy, fathers: [{ ...motherAcademy.fathers[0], nestConfigId: 1001072 }] })).toBe(true);
    expect(greenOf({ ...egg, mother: { ...egg.mother!, nestConfigId: 1001071 },
      fathers: [{ ...egg.fathers[0], nestConfigId: 1001072 }] })).toBe(true);
    expect(greenOf({
      ...egg,
      mother: { ...egg.mother!, nestConfigId: 1001071 },
      fathers: [{ ...egg.fathers[0], nestConfigId: 1001071 }],
    })).toBe(false);
  });

  test('repeat patrol backfills a missing green flag but never flips an existing one', () => {
    const academyEgg: PatrolEgg = { ...egg, mother: { ...egg.mother!, nestConfigId: 1001072 } };
    const first = recordPatrolProducedEgg(emptyEggWorkflow(), task, produced, academyEgg, 1000);
    expect(first.eggs[0].greenNest).toBe(true);
    // 历史行（缺字段）→ 下一次巡查回填
    const legacy = { ...first, eggs: first.eggs.map(({ greenNest, ...rest }) => rest) };
    const backfilled = recordPatrolProducedEgg(legacy, task, produced, academyEgg, 2000);
    expect(backfilled.eggs[0].greenNest).toBe(true);
    // 用户手动取消（false）→ 不回填
    const optedOut = { ...first, eggs: [{ ...first.eggs[0], greenNest: false }] };
    expect(recordPatrolProducedEgg(optedOut, task, produced, academyEgg, 3000).eggs[0].greenNest).toBe(false);
  });

  test('ambiguous observations never create stock', () => {
    const next = recordPatrolProducedEgg(
      emptyEggWorkflow(),
      task,
      { ...produced, status: 'ambiguous' },
      egg,
      1000,
    );
    expect(next.eggs).toEqual([]);
  });

  test('repeat patrol preserves manual labels and occupied state', () => {
    const first = recordPatrolProducedEgg(emptyEggWorkflow(), task, produced, egg, 1000);
    first.eggs[0] = {
      ...first.eggs[0],
      nature: '固执',
      body: '大块头',
      voice: '婉转声',
      labelSource: 'manual',
      confidence: 'manual',
      status: 'reserved',
      listed: true,
    };

    const next = recordPatrolProducedEgg(first, task, produced, egg, 2000);
    expect(next.eggs[0]).toMatchObject({
      nature: '固执',
      body: '大块头',
      voice: '婉转声',
      labelSource: 'manual',
      confidence: 'manual',
      status: 'reserved',
      listed: true,
      lastConfirmedAt: 2000,
    });
  });
});

describe('recordIngestedHomeEggs', () => {
  const ingested = [{ egg, eggGameId: 3062 }];
  const index: EggLabelIndex = {
    bodySizeByGameId: new Map([[3062, { small: 50, big: 60 }], [3744, { small: 25, big: 35 }]]),
    natureNameById: new Map([[2, '固执'], [3, '胆小']]),
  };
  const labeledEgg: PatrolEgg = {
    ...egg,
    mother: { ...egg.mother!, weightKg: 60, natureId: 2, voiceDb: 100 },
    fathers: [{ ...egg.fathers[0], weightKg: 35, natureId: 2, voiceDb: 100 }],
  };

  test('a reported home egg becomes home stock with the shared id', () => {
    const { state } = recordIngestedHomeEggs(emptyEggWorkflow(), 'b', '293143', ingested, 1000);
    expect(state.eggs).toHaveLength(1);
    expect(state.eggs[0]).toMatchObject({
      id: JSON.stringify(['uid:293143', 'home', 'egg-1']),
      accountId: 'b',
      gameAccountKey: 'uid:293143',
      eggGameId: 3062,
      location: 'home',
      status: 'available',
      listed: false,
      provenance: 'self-bred',
      lastConfirmedAt: 1000,
    });
    expect(state.eggs[0].parents).toMatchObject({
      mother: { id: 'mother', gameId: 3062 },
      fathers: [{ id: 'father', gameId: 3744 }],
      confirmed: true,
    });
  });

  test('labels are inferred from parents (nature, body medal, voice)', () => {
    const { state, written } = recordIngestedHomeEggs(
      emptyEggWorkflow(), 'b', '293143', [{ egg: labeledEgg, eggGameId: 3062 }], 1000, index,
    );
    expect(written).toBe(1);
    expect(state.eggs[0]).toMatchObject({
      nature: '固执',
      body: '大块头',
      voice: '+100',
      confidence: 'system',
      labelSource: 'system',
    });
    expect(state.eggs[0].parents).toMatchObject({
      mother: { nature: '固执', body: '大块头', voice: '+100' },
      fathers: [{ nature: '固执', body: '大块头', voice: '+100' }],
    });
  });

  test('an existing unlabeled egg gets labels filled without a new record', () => {
    const first = recordIngestedHomeEggs(emptyEggWorkflow(), 'b', '293143', [{ egg: labeledEgg, eggGameId: 3062 }], 1000);
    expect(first.state.eggs[0].body).toBe('unknown');
    const later = recordIngestedHomeEggs(
      first.state, 'b', '293143', [{ egg: labeledEgg, eggGameId: 3062 }], 1000 + 60_000, index,
    );
    expect(later.written).toBe(0);
    expect(later.labeled).toBe(1);
    expect(later.state.eggs[0]).toMatchObject({ nature: '固执', body: '大块头', voice: '+100' });
  });

  test('academy nest parent gives its nature 100% even when the other parent differs', () => {
    const academyEgg: PatrolEgg = {
      ...labeledEgg,
      mother: { ...labeledEgg.mother!, natureId: 2, nestConfigId: 1001072 },
      fathers: [{ ...labeledEgg.fathers[0], natureId: 3, nestConfigId: 1001071 }],
    };
    const { state } = recordIngestedHomeEggs(
      emptyEggWorkflow(), 'b', '293143', [{ egg: academyEgg, eggGameId: 3062 }], 1000, index,
    );
    expect(state.eggs[0]).toMatchObject({ nature: '固执', body: '大块头', voice: '+100' });
    expect(state.eggs[0].parents).toMatchObject({
      mother: { nature: '固执', academy: true, nestName: '学院小窝' },
      fathers: [{ nature: '胆小', nestName: '普通小窝' }],
    });
  });

  test('ingested green nest flag follows any academy parent and backfills legacy rows', () => {
    const academyEgg: PatrolEgg = {
      ...labeledEgg,
      mother: { ...labeledEgg.mother!, nestConfigId: 1001072 },
      fathers: [{ ...labeledEgg.fathers[0], nestConfigId: 1001071 }],
    };
    const first = recordIngestedHomeEggs(emptyEggWorkflow(), 'b', '293143', [{ egg: academyEgg, eggGameId: 3062 }], 1000, index);
    expect(first.state.eggs[0]).toMatchObject({ nature: '固执', greenNest: true });
    // 双亲都在学院小窝
    const bothAcademy = { ...academyEgg, fathers: [{ ...academyEgg.fathers[0], nestConfigId: 1001072 }] };
    expect(recordIngestedHomeEggs(emptyEggWorkflow(), 'b', '293143', [{ egg: bothAcademy, eggGameId: 3062 }], 1000, index)
      .state.eggs[0].greenNest).toBe(true);
    // 双亲都普通小窝 → 不许误标
    const ordinary = { ...academyEgg, mother: { ...academyEgg.mother!, nestConfigId: 1001071 } };
    expect(recordIngestedHomeEggs(emptyEggWorkflow(), 'b', '293143', [{ egg: ordinary, eggGameId: 3062 }], 1000, index)
      .state.eggs[0].greenNest).toBe(false);
    // 历史行（rc 入库早期没有 greenNest）→ 下一次上报回填
    const legacy = { ...first.state, eggs: first.state.eggs.map(({ greenNest, ...rest }) => rest) };
    const backfilled = recordIngestedHomeEggs(legacy, 'b', '293143', [{ egg: academyEgg, eggGameId: 3062 }], 1000 + 60 * 60_000, index);
    expect(backfilled.state.eggs[0].greenNest).toBe(true);
    // 用户手动取消过（false）→ 不回填
    const optedOut = { ...first.state, eggs: [{ ...first.state.eggs[0], greenNest: false }] };
    expect(recordIngestedHomeEggs(optedOut, 'b', '293143', [{ egg: academyEgg, eggGameId: 3062 }], 1000 + 60 * 60_000, index)
      .state.eggs[0].greenNest).toBe(false);
  });

  test('re-reporting the same egg within 30 minutes does not write', () => {
    const first = recordIngestedHomeEggs(emptyEggWorkflow(), 'b', '293143', ingested, 1000, index);
    const again = recordIngestedHomeEggs(first.state, 'b', '293143', ingested, 1000 + 60_000, index);
    expect(again.state).toBe(first.state);
    expect(again.written).toBe(0);
    expect(again.labeled).toBe(0);
  });

  test('re-reporting after 30 minutes only refreshes the confirm time', () => {
    const first = recordIngestedHomeEggs(emptyEggWorkflow(), 'b', '293143', ingested, 1000, index);
    const later = recordIngestedHomeEggs(first.state, 'b', '293143', ingested, 1000 + 31 * 60_000, index);
    expect(later.state.eggs).toHaveLength(1);
    expect(later.state.eggs[0].lastConfirmedAt).toBe(1000 + 31 * 60_000);
  });

  test('ingest never overrides manual labels or occupied state', () => {
    const first = recordIngestedHomeEggs(emptyEggWorkflow(), 'b', '293143', ingested, 1000, index);
    const manual: WorkflowEgg = {
      ...first.state.eggs[0],
      nature: '胆小',
      body: '小不点',
      voice: '+100',
      labelSource: 'manual',
      confidence: 'manual',
      status: 'reserved',
      listed: true,
    };
    const state = { ...first.state, eggs: [manual] };
    const later = recordIngestedHomeEggs(state, 'b', '293143', ingested, 1000 + 60 * 60_000, index);
    expect(later.state.eggs[0]).toMatchObject({
      nature: '胆小',
      body: '小不点',
      labelSource: 'manual',
      status: 'reserved',
      listed: true,
    });
    expect(later.labeled).toBe(0);
  });

  test('eggs without a known egg game id are skipped', () => {
    const { state } = recordIngestedHomeEggs(
      emptyEggWorkflow(), 'b', '293143', [{ egg, eggGameId: 0 }], 1000,
    );
    expect(state.eggs).toHaveLength(0);
  });

  test('several eggs in one report are all added', () => {
    const another: PatrolEgg = { ...egg, actorId: 'egg-2' };
    const { state } = recordIngestedHomeEggs(
      emptyEggWorkflow(), 'b', '293143',
      [{ egg, eggGameId: 3062 }, { egg: another, eggGameId: 3062 }], 1000,
    );
    expect(state.eggs).toHaveLength(2);
    expect(new Set(state.eggs.map(value => value.id)).size).toBe(2);
  });

  test('a home egg is never auto-listed even with weight height voice and obtained time', () => {
    const first = recordIngestedHomeEggs(emptyEggWorkflow(), 'b', '293143', ingested, 1000, index);
    const measured = { ...first.state.eggs[0], weightGrams: 2320, heightCm: 34, voice: '婉转声' as const,
      obtainedAt: '2026-11-17T22:31:00' };
    const later = recordIngestedHomeEggs({ ...first.state, eggs: [measured] }, 'b', '293143', ingested, 1000 + 60 * 60_000, index);
    expect(later.state.eggs[0]).toMatchObject({
      location: 'home', listed: false, weightGrams: 2320, heightCm: 34, voice: '婉转声',
      obtainedAt: '2026-11-17T22:31:00',
    });
  });

  test('a merged home row that already sits in the bag is auto-listed on ingest', () => {
    const first = recordIngestedHomeEggs(emptyEggWorkflow(), 'b', '293143', ingested, 1000, index);
    const merged = { ...first.state.eggs[0], location: 'bag' as const, weightGrams: 2320, heightCm: 34,
      voice: '婉转声' as const, obtainedAt: '2026-11-17T22:31:00' };
    const later = recordIngestedHomeEggs({ ...first.state, eggs: [merged] }, 'b', '293143', ingested, 1000 + 60 * 60_000, index);
    expect(later.state.eggs[0]).toMatchObject({ location: 'bag', listed: true });
  });
});
