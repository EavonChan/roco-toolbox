import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { clearSession } from '../api/session';
import { cacheMe, clearCachedMe, loadMe, readCachedMe, resetMeCacheForTest } from './accountMe';

/**
 * 账号信息缓存（2026-11-28 RUI P1-02）。
 *
 * 「我的」页的概览卡与账号面板要的是同一份 /api/me：谁在用、云端版本多少。
 * 缓存放进程内存、按 accountId 分区，页面切换时先显示上次结果；
 * 并发的加载必须合并成一次请求，别为了一个用户名多发一次。
 */
const me = (accountId: string, username: string | null) => ({
  accountId,
  createdAt: 1,
  username,
  snapshot: null,
});

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });

describe('账号信息缓存', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetMeCacheForTest();
  });

  afterEach(() => {
    clearSession();
    vi.unstubAllGlobals();
    resetMeCacheForTest();
  });

  test('缓存按账号分区：只认当前账号，退出后读不到', () => {
    window.localStorage.setItem('roco.accountId', 'acc-1');
    cacheMe('acc-1', me('acc-1', '阿布'));

    expect(readCachedMe('acc-1')?.username).toBe('阿布');
    expect(readCachedMe('acc-2')).toBeNull();
    expect(readCachedMe(null)).toBeNull();

    clearCachedMe();
    expect(readCachedMe('acc-1')).toBeNull();
  });

  test('并发加载合并成一次请求：有缓存就直接用缓存', async () => {
    window.localStorage.setItem('roco.accountId', 'acc-1');
    let calls = 0;
    vi.stubGlobal('fetch', () => {
      calls += 1;
      return Promise.resolve(json(me('acc-1', '阿布')));
    });

    const [a, b] = await Promise.all([loadMe('acc-1'), loadMe('acc-1')]);
    expect(calls).toBe(1);
    expect(a.username).toBe('阿布');
    expect(b.username).toBe('阿布');

    // 命中缓存：不再发请求
    expect((await loadMe('acc-1')).username).toBe('阿布');
    expect(calls).toBe(1);
  });

  test('refresh 会重新请求一次（云端版本可能变了）', async () => {
    window.localStorage.setItem('roco.accountId', 'acc-1');
    let calls = 0;
    vi.stubGlobal('fetch', () => {
      calls += 1;
      return Promise.resolve(json(me('acc-1', '阿布')));
    });

    await loadMe('acc-1');
    await loadMe('acc-1', { refresh: true });
    expect(calls).toBe(2);
  });

  test('请求失败：抛给调用方，且不写缓存（下次还会再试）', async () => {
    window.localStorage.setItem('roco.accountId', 'acc-1');
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));

    await expect(loadMe('acc-1')).rejects.toThrow();
    expect(readCachedMe('acc-1')).toBeNull();

    // 失败过的请求不会卡住下一次加载
    vi.stubGlobal('fetch', () => Promise.resolve(json(me('acc-1', '阿布'))));
    expect((await loadMe('acc-1')).username).toBe('阿布');
  });
});
