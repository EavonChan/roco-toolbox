import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import * as api from '../api/collectionGroups';
import { MotherGroupsApiError } from '../api/motherGroups';
import { markSynced } from '../api/session';
import type {
  CollectionDemand,
  CollectionDemandFeed,
  CollectionGroupDetail,
  CollectionGroupSummary,
} from '../shared/collectionGroups';
import { useCollectionGroups } from './useCollectionGroups';

/**
 * 只钉住几条关键路径（2026-10-29 审查 B6-M05 / R2-7-M06），不追求覆盖率：
 * ① 切组后旧组的需求响应晚到不能写进新组；
 * ② 切号后旧身份的组列表响应不能写回；
 * ③ 撤回成功后本地立即移除该条，已结单计数与完成回执不受影响；
 * ④ 接单失败立刻重拉；
 * ⑤ 自动切组后即使两组版本号相同也要拉一次详情。
 */

vi.mock('../api/collectionGroups', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/collectionGroups')>();
  return {
    ...actual,
    listCollectionGroups: vi.fn(),
    getCollectionGroup: vi.fn(),
    getCollectionGroupVersion: vi.fn(),
    getCollectionTasks: vi.fn(),
    getCollectionDemandFeed: vi.fn(),
    claimCollectionDemand: vi.fn(),
    withdrawCollectionDemand: vi.fn(),
    publishCollectionResources: vi.fn(),
  };
});

const summaryOf = (id: string, owner = 'A'): CollectionGroupSummary => ({
  id,
  name: `组${id}`,
  ownerAccountId: owner,
  memberCount: 2,
  groupType: 'mother',
  targetRevision: 1,
  targetReady: true,
});

const detailOf = (id: string, owner = 'A'): CollectionGroupDetail => ({
  group: {
    id,
    name: `组${id}`,
    ownerAccountId: owner,
    createdAt: 1,
    groupType: 'mother',
    targetRevision: 1,
    resourceEpoch: 0,
    target: null,
  },
  members: [
    {
      accountId: owner,
      displayName: '甲',
      joinedAt: 1,
      resourceRevision: 0,
      resource: null,
      studResource: null,
    },
  ],
});

const demandOf = (overrides: Partial<CollectionDemand> = {}): CollectionDemand => ({
  groupId: 'g1',
  demanderAccountId: 'A',
  eggGameId: 3466,
  nature: '',
  gender: '母',
  body: '大块头',
  voice: '+100',
  status: 'open',
  claimerAccountId: null,
  version: 0,
  createdAt: 1,
  updatedAt: 1,
  ...overrides,
});

/** 需求中心一次拉全的三份数据（2026-11-01：列表只含未完成）。 */
const feedOf = (
  demands: CollectionDemand[] = [],
  completedCounts: Record<string, number> = {},
  myRecentCompleted: CollectionDemand[] = [],
): CollectionDemandFeed => ({ demands, completedCounts, myRecentCompleted });

const EMPTY_TASKS = {
  targetRevision: 1,
  confirmed: false,
  pendingMemberIds: [],
  tasks: [],
};

const input = { snapshots: [], species: [], catalogVersion: 'test-v1' };

/** 把当前微任务队列跑完（不依赖 waitFor）。 */
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
  window.localStorage.setItem('roco.accountId', 'A');
  window.localStorage.setItem('roco.deviceToken', 'token-1');
  vi.mocked(api.listCollectionGroups).mockResolvedValue([summaryOf('g1')]);
  vi.mocked(api.getCollectionGroup).mockImplementation(async (id: string) => detailOf(id));
  vi.mocked(api.getCollectionTasks).mockResolvedValue(EMPTY_TASKS);
  vi.mocked(api.getCollectionDemandFeed).mockResolvedValue(feedOf());
  vi.mocked(api.withdrawCollectionDemand).mockResolvedValue(undefined);
});

afterEach(() => {
  window.localStorage.clear();
});

describe('useCollectionGroups：切组 / 切号 / 撤回', () => {
  test('发布撞上「其他设备刚更新」时，拉最新修订自动重发一次', async () => {
    const { result } = renderHook(() => useCollectionGroups(input));
    await flush();

    // 另一台设备（通常是手机导入后的自动发布）已经把修订推到 3
    const fresh = detailOf('g1');
    fresh.members[0].resourceRevision = 3;
    vi.mocked(api.getCollectionGroup).mockResolvedValue(fresh);
    vi.mocked(api.publishCollectionResources)
      .mockRejectedValueOnce(
        new MotherGroupsApiError(409, 'REVISION_CONFLICT', '小组资源已被其他设备更新，请重新预览再发布'),
      )
      .mockResolvedValueOnce({ resourceRevision: 4, publishedAt: 1 });

    await act(async () => {
      await result.current.stopSharing();
    });

    expect(api.publishCollectionResources).toHaveBeenCalledTimes(2);
    expect(vi.mocked(api.publishCollectionResources).mock.calls[0][1].baseRevision).toBe(0);
    expect(vi.mocked(api.publishCollectionResources).mock.calls[1][1].baseRevision).toBe(3);
  });

  test('切组后旧组的需求响应晚到，不会覆盖新组列表', async () => {
    const oldFeed = deferred<CollectionDemandFeed>();
    vi.mocked(api.getCollectionDemandFeed)
      .mockReturnValueOnce(oldFeed.promise)
      .mockResolvedValue(feedOf([demandOf({ groupId: 'g2', eggGameId: 4001 })]));

    const { result } = renderHook(() => useCollectionGroups(input));
    await flush();
    expect(result.current.currentGroupId).toBe('g1');

    act(() => result.current.selectGroup('g2'));
    await flush();
    expect(result.current.currentGroupId).toBe('g2');
    expect(result.current.demands.map((demand) => demand.eggGameId)).toEqual([4001]);

    await act(async () => {
      oldFeed.resolve(feedOf([demandOf({ groupId: 'g1', eggGameId: 4002 })]));
    });
    await flush();
    expect(result.current.demands.map((demand) => demand.eggGameId)).toEqual([4001]);
  });

  test('切号后旧身份的组列表响应晚到，不会覆盖新身份', async () => {
    const oldList = deferred<CollectionGroupSummary[]>();
    vi.mocked(api.listCollectionGroups)
      .mockReturnValueOnce(oldList.promise)
      .mockResolvedValue([summaryOf('gB', 'B')]);
    vi.mocked(api.getCollectionGroup).mockImplementation(async (id: string) =>
      detailOf(id, id === 'gB' ? 'B' : 'A'),
    );

    const { result } = renderHook(() => useCollectionGroups(input));
    await flush();

    act(() => {
      window.localStorage.setItem('roco.accountId', 'B');
      window.localStorage.setItem('roco.deviceToken', 'token-B');
      markSynced(0);
    });
    await flush();
    expect(result.current.accountId).toBe('B');
    expect(result.current.groups.map((group) => group.id)).toEqual(['gB']);

    await act(async () => {
      oldList.resolve([summaryOf('g1')]);
    });
    await flush();
    expect(result.current.accountId).toBe('B');
    expect(result.current.groups.map((group) => group.id)).toEqual(['gB']);
  });

  test('撤回请求在途时切组，旧响应不写回新组列表', async () => {
    const pending = deferred<void>();
    vi.mocked(api.withdrawCollectionDemand).mockReturnValueOnce(pending.promise);
    vi.mocked(api.getCollectionDemandFeed)
      .mockResolvedValueOnce(feedOf([demandOf()]))
      // 新组恰好有一条同内容需求：旧响应若写回，会把它误删
      .mockResolvedValueOnce(feedOf([demandOf({ groupId: 'g2' })]));

    const { result } = renderHook(() => useCollectionGroups(input));
    await flush();
    expect(result.current.demands).toHaveLength(1);

    act(() => {
      void result.current.withdrawDemand(3466, {
        nature: '',
        gender: '母',
        body: '大块头',
        voice: '+100',
      });
    });
    act(() => result.current.selectGroup('g2'));
    await flush();
    expect(result.current.demands.map((demand) => demand.groupId)).toEqual(['g2']);

    await act(async () => {
      pending.resolve();
    });
    await flush();
    expect(result.current.demands.map((demand) => demand.groupId)).toEqual(['g2']);
  });

  test('撤回成功后本地立即移除该条，已结单计数与完成回执不受影响', async () => {
    const open = demandOf();
    const done = demandOf({ eggGameId: 3467, status: 'done', claimerAccountId: 'B' });
    vi.mocked(api.getCollectionDemandFeed).mockResolvedValue(
      feedOf([open], { B: 1 }, [done]),
    );

    const { result } = renderHook(() => useCollectionGroups(input));
    await flush();
    expect(result.current.demands).toHaveLength(1);

    await act(async () => {
      await result.current.withdrawDemand(3466, {
        nature: '',
        gender: '母',
        body: '大块头',
        voice: '+100',
      });
    });

    expect(api.withdrawCollectionDemand).toHaveBeenCalledWith('g1', 3466, {
      nature: '',
      gender: '母',
      body: '大块头',
      voice: '+100',
    });
    expect(result.current.demands).toEqual([]);
    // 已完成的单不在列表里，但仍计入承接人的已结单与完成回执
    expect(result.current.completedCounts).toEqual({ B: 1 });
    expect(result.current.myRecentCompleted.map((demand) => demand.eggGameId)).toEqual([3467]);
  });

  test('旧服务端仍把已完成行混在列表里时，前端也不显示它', async () => {
    vi.mocked(api.getCollectionDemandFeed).mockResolvedValue(
      feedOf([
        demandOf(),
        demandOf({ eggGameId: 3467, status: 'done', claimerAccountId: 'B' }),
      ]),
    );

    const { result } = renderHook(() => useCollectionGroups(input));
    await flush();
    expect(result.current.demands.map((demand) => demand.status)).toEqual(['open']);
  });

  test('接单失败后立即重拉需求列表，不用等轮询（R2-3-M04）', async () => {
    vi.mocked(api.claimCollectionDemand).mockRejectedValueOnce(new Error('已被人接单'));
    const { result } = renderHook(() => useCollectionGroups(input));
    await flush();
    const before = vi.mocked(api.getCollectionDemandFeed).mock.calls.length;

    await act(async () => {
      await expect(result.current.claimDemand(demandOf())).rejects.toThrow('已被人接单');
    });
    await flush();
    expect(vi.mocked(api.getCollectionDemandFeed).mock.calls.length).toBeGreaterThan(before);
  });

  test('自动切组后即使两组版本号相同，也会完整拉一次详情（R2-3-M03）', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(api.getCollectionGroupVersion).mockResolvedValue({
        detail: '5',
        demands: '5',
        tasks: '5',
      });
      window.localStorage.setItem(
        'roco.collectionGroups:B',
        JSON.stringify({ mode: 'group', lastGroupIds: { mother: 'gB' } }),
      );
      vi.mocked(api.getCollectionGroup).mockImplementation(async (id: string) =>
        detailOf(id, id === 'gB' ? 'B' : 'A'),
      );

      const { result } = renderHook(() => useCollectionGroups(input));
      await flush();
      // 跑一轮 60 秒轮询，把 g1 的版本号记为 5
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      expect(vi.mocked(api.getCollectionGroup).mock.calls.length).toBe(2);

      act(() => {
        window.localStorage.setItem('roco.accountId', 'B');
        window.localStorage.setItem('roco.deviceToken', 'token-B');
        markSynced(0);
      });
      await flush();
      expect(result.current.currentGroupId).toBe('gB');
      const afterSwitch = vi.mocked(api.getCollectionGroup).mock.calls.length;

      // 新组版本号同为 5：修复后版本基准已清空，仍会拉一次详情
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000);
      });
      expect(vi.mocked(api.getCollectionGroup).mock.calls.length).toBe(afterSwitch + 1);
    } finally {
      vi.useRealTimers();
    }
  });
});
