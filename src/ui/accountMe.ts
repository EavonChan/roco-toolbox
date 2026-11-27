import { useEffect, useSyncExternalStore } from 'react';
import { fetchMe, readAccountId, type MeResult } from '../api/session';

/**
 * 当前账号的云端信息缓存（2026-11-28 RUI P1-02）。
 *
 * 「我的」页的概览卡要写用户名，账号面板要写云端版本，读的是同一份 `/api/me`。
 * 缓存放进程内存、按 accountId 分区：
 * - 页面切换先显示上次结果，不再先闪「已登录」；
 * - 并发加载合并成一次请求（概览卡与账号面板同时挂载时也只会发一次）；
 * - 请求期间换了账号就不写回，避免把 A 的名字挂到 B 身上。
 *
 * 这里只做缓存，不改会话本身；登录 / 退出仍以 `api/session` 为准。
 */
let cached: { accountId: string; me: MeResult } | null = null;
let pending: { accountId: string; promise: Promise<MeResult> } | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeMeCache(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 读缓存：只认当前账号，换个账号就是没有。 */
export function readCachedMe(accountId: string | null): MeResult | null {
  if (!accountId || cached?.accountId !== accountId) return null;
  return cached.me;
}

export function cacheMe(accountId: string, me: MeResult): void {
  cached = { accountId, me };
  notify();
}

/** 退出登录 / 换账号时清空（不动正在飞的请求，写回前会再核对账号）。 */
export function clearCachedMe(): void {
  pending = null;
  if (!cached) return;
  cached = null;
  notify();
}

export interface LoadMeOptions {
  /** 已缓存也要再问一次（云端版本可能变了）；并发请求仍然合并 */
  refresh?: boolean;
}

/** 取账号信息：有缓存直接用，否则请求并写回；失败抛给调用方自己决定要不要提示。 */
export function loadMe(accountId: string, options: LoadMeOptions = {}): Promise<MeResult> {
  if (!options.refresh) {
    const hit = readCachedMe(accountId);
    if (hit) return Promise.resolve(hit);
  }
  if (pending?.accountId === accountId) return pending.promise;

  const promise = fetchMe().then(
    (me) => {
      // 请求回来的同一刻清掉在飞标记：调用方 await 之后紧接着 refresh 也拿得到新请求
      if (pending?.accountId === accountId) pending = null;
      // 请求期间换了账号就不写回缓存，免得把 A 的名字挂到 B 身上
      if (readAccountId() === accountId) cacheMe(accountId, me);
      return me;
    },
    (error: unknown) => {
      if (pending?.accountId === accountId) pending = null;
      throw error;
    },
  );
  pending = { accountId, promise };
  return promise;
}

/**
 * 概览卡用的用户名：先给缓存，再后台补一次；失败静默（卡上退「已登录」）。
 * 未登录时返回 null。
 */
export function useAccountName(accountId: string | null): string | null {
  const username = useSyncExternalStore(
    subscribeMeCache,
    () => readCachedMe(accountId)?.username ?? null,
    () => null,
  );
  useEffect(() => {
    if (!accountId) {
      clearCachedMe();
      return;
    }
    void loadMe(accountId).catch(() => {});
  }, [accountId]);
  return username;
}

/** 只给测试用：把模块级缓存放回初始状态。 */
export function resetMeCacheForTest(): void {
  cached = null;
  pending = null;
}
