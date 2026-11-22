import { describe, expect, test } from 'vitest';
import { emptyEggWorkflow } from './eggWorkflow';
import { recordIngestedHomeEggs, recordPatrolProducedEgg } from './eggPatrolStock';
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

  test('a reported home egg becomes home stock with the shared id', () => {
    const next = recordIngestedHomeEggs(emptyEggWorkflow(), 'b', '293143', ingested, 1000);
    expect(next.eggs).toHaveLength(1);
    expect(next.eggs[0]).toMatchObject({
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
    expect(next.eggs[0].parents).toMatchObject({
      mother: { id: 'mother', gameId: 3062 },
      fathers: [{ id: 'father', gameId: 3744 }],
      confirmed: true,
    });
  });

  test('re-reporting the same egg within 30 minutes does not write', () => {
    const first = recordIngestedHomeEggs(emptyEggWorkflow(), 'b', '293143', ingested, 1000);
    const again = recordIngestedHomeEggs(first, 'b', '293143', ingested, 1000 + 60_000);
    expect(again).toBe(first);
  });

  test('re-reporting after 30 minutes only refreshes the confirm time', () => {
    const first = recordIngestedHomeEggs(emptyEggWorkflow(), 'b', '293143', ingested, 1000);
    const later = recordIngestedHomeEggs(first, 'b', '293143', ingested, 1000 + 31 * 60_000);
    expect(later.eggs).toHaveLength(1);
    expect(later.eggs[0].lastConfirmedAt).toBe(1000 + 31 * 60_000);
  });

  test('ingest never overrides manual labels or occupied state', () => {
    const first = recordIngestedHomeEggs(emptyEggWorkflow(), 'b', '293143', ingested, 1000);
    first.eggs[0] = {
      ...first.eggs[0],
      nature: '胆小',
      body: '大块头',
      labelSource: 'manual',
      confidence: 'manual',
      status: 'reserved',
      listed: true,
    };
    const later = recordIngestedHomeEggs(first, 'b', '293143', ingested, 1000 + 60 * 60_000);
    expect(later.eggs[0]).toMatchObject({
      nature: '胆小',
      body: '大块头',
      labelSource: 'manual',
      status: 'reserved',
      listed: true,
    });
  });

  test('eggs without a known egg game id are skipped', () => {
    const next = recordIngestedHomeEggs(
      emptyEggWorkflow(), 'b', '293143', [{ egg, eggGameId: 0 }], 1000,
    );
    expect(next.eggs).toHaveLength(0);
  });

  test('several eggs in one report are all added', () => {
    const another: PatrolEgg = { ...egg, actorId: 'egg-2' };
    const next = recordIngestedHomeEggs(
      emptyEggWorkflow(), 'b', '293143',
      [{ egg, eggGameId: 3062 }, { egg: another, eggGameId: 3062 }], 1000,
    );
    expect(next.eggs).toHaveLength(2);
    expect(new Set(next.eggs.map(value => value.id)).size).toBe(2);
  });
});
