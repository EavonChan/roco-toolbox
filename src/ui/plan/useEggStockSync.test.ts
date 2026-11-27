import { act, renderHook, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { EggMatchingError } from '../../api/eggMatching';
import { useEggStockSync } from './useEggStockSync';
import { emptyEggWorkflow } from '../../shared/eggWorkflow';

/**
 * 蛋仓同步的错误口径（2026-11-26，D3 / R4）。
 *
 * 线上反馈「先弹小组数据已变化、再弹蛋仓同步失败」其实是同一个 409 被两处回显；
 * 现在远程 409 统一说成「版本冲突」（客户端已经自动重试过一次），
 * 本地合并异常单独标出来，别再让用户对着同一句话猜两次。
 */
const home = {
  schemaVersion: 1 as const, gameId: '1001', capturedAt: '2026-11-17T23:00:00+08:00',
  residents: [{ instanceId: '11', baseId: 'b', confId: 10009, furnitureGuid: 'nest1', actorId: 'a1', name: '菊花梨', gender: '母' as const }],
  nests: [{ furnitureGuid: 'nest1', configId: 1, nestType: 'ordinary' as const, nestName: '普通小窝', residentIds: [] }],
  layEggCouples: [], sceneEggs: [{ actorId: 'e1', furnitureGuid: 'nest1' }], couplesStale: false, snapshotKind: 'full' as const,
};
const snapshot = {
  accountName: '甲', gameId: 1001, exportedAt: '2026-11-17T14:00:00Z',
  importedAt: '2026-11-17T14:00:01Z', pets: [], eggs: [], eggInventoryComplete: true, home,
};
const api = (mutate: (action: unknown) => Promise<unknown>) => ({
  data: { version: 5, state: emptyEggWorkflow() }, busy: false, mutate,
});

test('远程 409：提示「版本冲突」而不是把服务端原话再抄一遍', async () => {
  const mutate = vi.fn().mockRejectedValue(new EggMatchingError('小组数据已变化，请刷新后重试', 409, 'REVISION_CONFLICT', 6));
  const { result } = renderHook(() => useEggStockSync({ api: api(mutate), groupId: 'g', me: 'a', snapshots: [snapshot] }));
  await waitFor(() => expect(result.current.syncError).not.toBe(''));
  expect(result.current.syncError).toBe('版本冲突（已自动重试一次）');
  expect(mutate).toHaveBeenCalledTimes(1);
});

test('本地合并异常：单独标出来，不和版本冲突混在一起', async () => {
  const broken = { ...snapshot, eggs: undefined } as unknown as typeof snapshot;
  const mutate = vi.fn().mockResolvedValue(undefined);
  const { result } = renderHook(() => useEggStockSync({ api: api(mutate), groupId: 'g', me: 'a', snapshots: [broken] }));
  await waitFor(() => expect(result.current.syncError).not.toBe(''));
  expect(result.current.syncError.startsWith('本地合并异常：')).toBe(true);
  expect(mutate).not.toHaveBeenCalled();
});

test('数据正在更新：原样透出，提示稍后重试', async () => {
  const mutate = vi.fn().mockRejectedValue(new Error('数据正在更新，请稍后重试'));
  const { result } = renderHook(() => useEggStockSync({ api: api(mutate), groupId: 'g', me: 'a', snapshots: [snapshot] }));
  await waitFor(() => expect(result.current.syncError).not.toBe(''));
  expect(result.current.syncError).toBe('数据正在更新，请稍后重试');
});

test('失败的采集不会自己重发，人工重试才会', async () => {
  const mutate = vi.fn().mockRejectedValue(new EggMatchingError('小组数据已变化，请刷新后重试', 409));
  const { result } = renderHook(() => useEggStockSync({ api: api(mutate), groupId: 'g', me: 'a', snapshots: [snapshot] }));
  await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
  await new Promise((resolve) => setTimeout(resolve, 40));
  expect(mutate).toHaveBeenCalledTimes(1);
  await act(async () => { result.current.retrySync(); });
  await waitFor(() => expect(mutate).toHaveBeenCalledTimes(2));
});
