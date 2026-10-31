import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { CollectionDemand, CollectionGroupSummary } from '../shared/collectionGroups';
import { getCollectionDemands, listCollectionGroups } from '../api/collectionGroups';
import { markSynced } from '../api/session';
import { useClaimedDemands } from './useClaimedDemands';

vi.mock('../api/collectionGroups', () => ({
  listCollectionGroups: vi.fn(),
  getCollectionDemands: vi.fn(),
}));

const listMock = vi.mocked(listCollectionGroups);
const demandMock = vi.mocked(getCollectionDemands);

const group = (id: string): CollectionGroupSummary => ({
  id,
  name: `组${id}`,
  ownerAccountId: 'owner',
  memberCount: 1,
  groupType: 'mother',
  targetRevision: 1,
  targetReady: true,
});

const claimed = (over: Partial<CollectionDemand> = {}): CollectionDemand => ({
  groupId: 'g1',
  demanderAccountId: 'm1',
  eggGameId: 100,
  nature: '固执',
  gender: '母',
  body: '大块头',
  voice: '+100',
  status: 'claimed',
  claimerAccountId: 'me',
  version: 1,
  createdAt: 1,
  updatedAt: 2,
  ...over,
});

beforeEach(() => {
  window.localStorage.clear();
  listMock.mockReset();
  demandMock.mockReset();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('useClaimedDemands', () => {
  test('60 秒内的缓存直接复用，反复挂载不重拉；重试会强制刷新', async () => {
    window.localStorage.setItem('roco.accountId', 'a1');
    listMock.mockResolvedValue([group('g1')]);
    demandMock.mockResolvedValue([claimed({ claimerAccountId: 'a1' })]);

    const first = renderHook(() => useClaimedDemands());
    await waitFor(() => expect(first.result.current.items).toHaveLength(1));
    expect(listMock).toHaveBeenCalledTimes(1);
    first.unmount();

    const second = renderHook(() => useClaimedDemands());
    await waitFor(() => expect(second.result.current.items).toHaveLength(1));
    expect(listMock).toHaveBeenCalledTimes(1);
    expect(second.result.current.loading).toBe(false);

    act(() => second.result.current.reload());
    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(2));
  });

  test('换身份后旧请求晚回来也不回写，列表不会串到新身份', async () => {
    window.localStorage.setItem('roco.accountId', 'me');
    listMock.mockResolvedValue([group('g1')]);
    let releaseOld: (value: CollectionDemand[]) => void = () => {};
    demandMock.mockImplementationOnce(
      () => new Promise<CollectionDemand[]>((resolve) => (releaseOld = resolve)),
    );
    demandMock.mockResolvedValue([]);

    const view = renderHook(() => useClaimedDemands());
    await waitFor(() => expect(view.result.current.loading).toBe(true));

    await act(async () => {
      window.localStorage.setItem('roco.accountId', 'other');
      markSynced(0);
    });
    await waitFor(() => expect(view.result.current.accountId).toBe('other'));

    await act(async () => {
      releaseOld([claimed()]);
    });
    expect(view.result.current.items).toEqual([]);
  });

  test('一个小组读失败时保留其它组的单，并提示有几个组失败', async () => {
    window.localStorage.setItem('roco.accountId', 'x9');
    listMock.mockResolvedValue([group('g1'), group('g2')]);
    demandMock.mockImplementation(async (groupId: string) => {
      if (groupId === 'g2') throw new Error('组已解散');
      return [claimed({ claimerAccountId: 'x9' })];
    });

    const view = renderHook(() => useClaimedDemands());
    await waitFor(() => expect(view.result.current.loading).toBe(false));

    expect(view.result.current.items).toHaveLength(1);
    expect(view.result.current.error).toContain('1 个小组读取失败');
  });
});
