import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { AccountSnapshot } from '../domain/parseBackup';
import type { HomeSnapshot } from '../domain/types';

const h = vi.hoisted(() => ({
  canRefreshHome: false,
  startHomeCapture: vi.fn(async () => {}),
  stopHomeCapture: vi.fn(async () => {}),
  readHomeCaptureState: vi.fn(async () => ({ phase: 'capturing', message: '' })),
  readHomeFromCapture: vi.fn(async () => null as AccountSnapshot | null),
  saveRefreshedHome: vi.fn(async (incoming: AccountSnapshot) => incoming),
}));

vi.mock('./homeRefresh', () => ({
  HOME_REFRESH_POLL_MS: 1000,
  HOME_REFRESH_TIMEOUT_MS: 10_000,
  canRefreshHome: () => h.canRefreshHome,
  startHomeCapture: h.startHomeCapture,
  stopHomeCapture: h.stopHomeCapture,
  readHomeCaptureState: h.readHomeCaptureState,
  readHomeFromCapture: h.readHomeFromCapture,
  saveRefreshedHome: h.saveRefreshedHome,
}));

import { useHomeRefresh } from './useHomeRefresh';

const home: HomeSnapshot = {
  schemaVersion: 1,
  gameId: '1',
  capturedAt: '2026-11-01T00:00:00.000Z',
  residents: [],
  nests: [],
  layEggCouples: [{ femaleActorId: 'f', maleActorIds: ['m'] }],
  sceneEggs: [],
  couplesStale: false,
};
const incoming: AccountSnapshot = {
  accountName: '账号A',
  gameId: 1,
  accountKey: 'uid:1',
  exportedAt: '2026-11-01T00:00:00.000Z',
  importedAt: '2026-11-01T00:00:00.000Z',
  pets: [],
  eggs: [],
  home,
};

beforeEach(() => {
  h.canRefreshHome = true;
  vi.clearAllMocks();
  h.readHomeCaptureState.mockResolvedValue({ phase: 'capturing', message: '' });
  h.readHomeFromCapture.mockResolvedValue(null);
  h.saveRefreshedHome.mockResolvedValue(incoming);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('刷新家园状态机', () => {
  test('浏览器里不可用：start 什么也不做', () => {
    h.canRefreshHome = false;
    const { result } = renderHook(() => useHomeRefresh());
    expect(result.current.available).toBe(false);
    act(() => result.current.start());
    expect(h.startHomeCapture).not.toHaveBeenCalled();
    expect(result.current.stage).toBe('idle');
  });

  test('开始后自动读到家园：合并、提示结果并停采集', async () => {
    vi.useFakeTimers();
    h.readHomeFromCapture.mockResolvedValue(incoming);
    const { result } = renderHook(() => useHomeRefresh());

    act(() => result.current.start());
    expect(h.startHomeCapture).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(h.saveRefreshedHome).toHaveBeenCalledWith(incoming);
    expect(h.stopHomeCapture).toHaveBeenCalled();
    expect(result.current.stage).toBe('done');
    expect(result.current.message).toContain('1 对配对');
  });

  test('还没读到家园时保持等待，点「完成刷新」再读一次', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useHomeRefresh());

    act(() => result.current.start());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.stage).toBe('waiting');
    expect(h.saveRefreshedHome).not.toHaveBeenCalled();

    h.readHomeFromCapture.mockResolvedValue(incoming);
    await act(async () => {
      result.current.finish();
    });
    expect(h.saveRefreshedHome).toHaveBeenCalledTimes(1);
    expect(result.current.stage).toBe('done');
  });

  test('采集失败时收尾成 failed 并停采集', async () => {
    vi.useFakeTimers();
    h.readHomeCaptureState.mockResolvedValue({ phase: 'failed', message: 'VPN 已断开' });
    const { result } = renderHook(() => useHomeRefresh());

    act(() => result.current.start());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(result.current.stage).toBe('failed');
    expect(result.current.message).toContain('VPN 已断开');
    expect(h.stopHomeCapture).toHaveBeenCalled();
  });

  test('取消会停采集并回到 idle', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useHomeRefresh());
    await act(async () => {
      result.current.start();
      await vi.advanceTimersByTimeAsync(0);
    });

    act(() => result.current.cancel());
    expect(result.current.stage).toBe('idle');
    expect(h.stopHomeCapture).toHaveBeenCalled();
  });

  test('关掉提示只清文案，刷新状态不受影响', async () => {
    const { result } = renderHook(() => useHomeRefresh());
    await act(async () => {
      result.current.start();
    });
    expect(result.current.message).toContain('已开始刷新');

    act(() => result.current.dismiss());
    expect(result.current.message).toBe('');
    // 采集还在等家园：按钮仍是「取消 / 完成刷新」，别把状态一起清掉
    expect(result.current.stage).toBe('waiting');
  });
});
