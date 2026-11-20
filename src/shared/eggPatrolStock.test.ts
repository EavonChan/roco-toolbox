import { describe, expect, test } from 'vitest';
import { emptyEggWorkflow } from './eggWorkflow';
import { recordPatrolProducedEgg } from './eggPatrolStock';
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
