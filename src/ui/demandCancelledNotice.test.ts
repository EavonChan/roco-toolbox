import { describe, expect, test } from 'vitest';
import type { CollectionDemand } from '../shared/collectionGroups';
import {
  cancelledDemandKey,
  resolveDemandCancelledNotice,
  type DemandCancelledState,
} from './demandCancelledNotice';

const demand = (patch: Partial<CollectionDemand> = {}): CollectionDemand => ({
  groupId: 'g1',
  demanderAccountId: 'A',
  eggGameId: 3466,
  nature: '',
  gender: '母',
  body: '大块头',
  voice: '+100',
  status: 'claimed',
  claimerAccountId: 'B',
  version: 1,
  createdAt: 1,
  updatedAt: 2,
  ...patch,
});

const stateOf = (claimed: CollectionDemand[], notified: string[] = []): DemandCancelledState => ({
  claimed: claimed.map((item) => cancelledDemandKey(item.groupId, item)),
  notified,
});

describe('resolveDemandCancelledNotice', () => {
  test('第一次见到某个组只记录，不把历史当成取消', () => {
    const decision = resolveDemandCancelledNotice([demand()], 'B', null);
    expect(decision.notice).toBeNull();
    expect(decision.state.claimed).toHaveLength(1);
    expect(decision.state.notified).toEqual([]);
  });

  test('接过的单消失且不在已完成里，提示一次并记住', () => {
    const cached = demand();
    const decision = resolveDemandCancelledNotice([], 'B', stateOf([cached]));
    expect(decision.notice).toEqual({ count: 1 });
    expect(decision.state.notified).toEqual([cancelledDemandKey('g1', cached)]);
    expect(decision.state.claimed).toEqual([]);
  });

  test('消失但出现在「我承接的最近完成」里，不算取消', () => {
    const cached = demand();
    const done = demand({ status: 'done' });
    const decision = resolveDemandCancelledNotice([done], 'B', stateOf([cached]));
    expect(decision.notice).toBeNull();
  });

  test('同一条取消只提示一次', () => {
    const cached = demand();
    const decision = resolveDemandCancelledNotice(
      [],
      'B',
      stateOf([cached], [cancelledDemandKey('g1', cached)]),
    );
    expect(decision.notice).toBeNull();
  });

  test('别人接的单消失不影响我', () => {
    const decision = resolveDemandCancelledNotice([demand({ claimerAccountId: 'C' })], 'B', stateOf([]));
    expect(decision.notice).toBeNull();
  });
});
