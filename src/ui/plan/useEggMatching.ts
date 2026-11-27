import { eggTaskActionable } from '../../shared/eggTaskActions';
import { publishPlanAlertBadge } from './planAlertsStore';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EggMatchingError, getEggMatching, mutateEggMatching, type EggMatchingResponse } from '../../api/eggMatching';

/**
 * 需求中心 / 蛋仓的数据缓存（2026-11-18，2026-11-23 加持久化）。
 *
 * 之前每次进页面都把 data 清空再请求，用户每次都要等一次完整加载。
 * 现在分三层：
 * 1. 内存缓存：切页回来立刻出内容；
 * 2. localStorage：刷新页面 / 重开 App 后先用上次的蛋仓出内容，不等网络；
 * 3. 新鲜度：`EGG_MATCHING_FRESH_MS` 内再次进入不重复请求，超过就先用旧内容再后台刷新。
 * 服务器仍是唯一真相：所有请求成功都会覆盖缓存，失败的请求不会动它。
 */
const CACHE_PREFIX = 'roco.eggStockCache.';
/** 上次成功拉到之后这么久内再次进入，不再重复请求（后台轮询照旧）。 */
export const EGG_MATCHING_FRESH_MS = 60_000;
/** localStorage 里最多留几份不同「小组 + 账号」的蛋仓，避免越攒越大。 */
const MAX_PERSISTED = 6;

const cache = new Map<string, EggMatchingResponse>();
const cacheAt = new Map<string, number>();
const storageKeyOf = (key: string) => `${CACHE_PREFIX}${key}`;

function isUsable(value: unknown): value is EggMatchingResponse {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<EggMatchingResponse>;
  return typeof candidate.version === 'number'
    && Number.isFinite(candidate.version)
    && !!candidate.state
    && typeof candidate.state === 'object'
    && Array.isArray(candidate.state.eggs);
}

function prunePersisted(): void {
  try {
    const entries: Array<{ key: string; at: number }> = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith(CACHE_PREFIX)) continue;
      let at = 0;
      try {
        at = Number((JSON.parse(window.localStorage.getItem(key) ?? '{}') as { at?: unknown }).at) || 0;
      } catch {
        at = 0;
      }
      entries.push({ key, at });
    }
    entries.sort((a, b) => b.at - a.at);
    for (const entry of entries.slice(MAX_PERSISTED)) window.localStorage.removeItem(entry.key);
  } catch {
    // 隐私模式 / 配额满：只影响下次冷启动能不能先出内容
  }
}

/** 读上一次的蛋仓（内存优先）；读到就顺手把内存缓存补齐。 */
function readCached(key: string): EggMatchingResponse | null {
  const inMemory = cache.get(key);
  if (inMemory) return inMemory;
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKeyOf(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: unknown; data?: unknown };
    if (typeof parsed.at !== 'number' || !Number.isFinite(parsed.at) || !isUsable(parsed.data)) return null;
    cache.set(key, parsed.data);
    cacheAt.set(key, parsed.at);
    return parsed.data;
  } catch {
    return null;
  }
}

/** 请求成功后写入内存 + localStorage。写盘失败不影响本次会话。 */
function remember(key: string, data: EggMatchingResponse): void {
  const at = Date.now();
  cache.set(key, data);
  cacheAt.set(key, at);
  try {
    window.localStorage.setItem(storageKeyOf(key), JSON.stringify({ at, data }));
    prunePersisted();
  } catch {
    // 配额满 / 隐私模式：内存缓存仍然生效
  }
}

/** 仅测试用：清掉全部缓存（内存 + localStorage），避免用例互相影响。 */
export function clearEggMatchingCache(): void {
  cache.clear();
  cacheAt.clear();
  if (typeof window === 'undefined') return;
  try {
    const keys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(CACHE_PREFIX)) keys.push(key);
    }
    for (const key of keys) window.localStorage.removeItem(key);
  } catch {
    // 清不掉也不影响用例继续跑
  }
}

/** 仅测试用：模拟「刷新页面」——只丢内存缓存，localStorage 留着。 */
export function clearEggMatchingMemoryForTests(): void {
  cache.clear();
  cacheAt.clear();
}

export function useEggMatching(groupId: string, accountId: string) {
  const key = `${groupId}:${accountId}`;
  const initial = useRef<EggMatchingResponse | null>(groupId ? readCached(key) : null);
  const [data, setData] = useState<EggMatchingResponse | null>(initial.current);
  const [loading, setLoading] = useState(initial.current == null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = useRef<EggMatchingResponse | null>(initial.current);
  const identity = useRef('');
  const writing = useRef<string | null>(null);
  const refresh = useCallback(async () => {
    if (writing.current) return;
    const requested = key;
    try {
      const next = await getEggMatching(groupId);
      remember(requested, next);
      if (identity.current !== requested || writing.current) return;
      if (!current.current || next.version >= current.current.version) { current.current = next; setData(next); }
      setError(null);
    } catch (failure) {
      if (identity.current === requested) setError(failure instanceof Error ? failure.message : '读取失败');
    } finally { if (identity.current === requested) setLoading(false); }
  }, [groupId, key]);
  useEffect(() => {
    // 没有小组就没有蛋仓 / 需求：别拿空 groupId 去打接口（家园页的蛋仓入口在未入组时会这样挂载）。
    if (!groupId) {
      identity.current = '';
      current.current = null;
      setData(null);
      setLoading(false);
      setBusy(false);
      setError(null);
      return;
    }
    identity.current = key; writing.current=null; setBusy(false); setError(null);
    const cached = readCached(key);
    current.current = cached;
    setData(cached);
    setLoading(!cached);
    // 60 秒内刚拉过就先不请求，直接用缓存；超过就用旧内容顶着、后台刷新。
    const fetchedAt = cacheAt.get(key) ?? 0;
    if (!cached || Date.now() - fetchedAt >= EGG_MATCHING_FRESH_MS) void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 20_000);
    const focus = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('focus', focus);
    return () => { identity.current = ''; window.clearInterval(timer); window.removeEventListener('focus', focus); };
  }, [key, refresh]);
  const mutate = useCallback(async (action: unknown) => {
    if (writing.current || !current.current) throw new Error('数据正在更新，请稍后重试');
    const requested = key;
    // 蛋仓同步的失败由 `useEggStockSync` 统一展示；这里不再写一份 api.error，避免同一条 409 弹两个横幅。
    const kind = (action as { type?: unknown } | null)?.type;
    writing.current = requested; setBusy(true);
    const install = (next: EggMatchingResponse) => {
      remember(requested, next);
      if (identity.current !== requested) return;
      current.current = next; setData(next); setError(null);
    };
    /** 把服务端 409 回带的最新版本接过来（不补拉，省一次往返）。 */
    const adoptHint = (hint: number): number => {
      if (identity.current === requested && current.current && current.current.version !== hint) {
        const next = { ...current.current, version: hint };
        current.current = next;
        setData(next);
      }
      return hint;
    };
    /** 409 之后要用的版本：优先用响应里回带的，没有才重新 GET 一次。 */
    const latestVersion = async (hint?: number): Promise<number> => {
      if (typeof hint === 'number') return adoptHint(hint);
      const fetched = await getEggMatching(groupId);
      remember(requested, fetched);
      if (identity.current === requested) { current.current = fetched; setData(fetched); }
      return fetched.version;
    };
    try {
      const next = await mutateEggMatching(groupId, current.current.version, action);
      install(next);
      return next;
    } catch (initial) {
      let failure: unknown = initial;
      if (failure instanceof EggMatchingError && failure.status === 409) {
        /**
         * 409 表示这次**没有落库**（版本校验 / CAS 都在写之前失败），所以用最新版本
         * 自动重试一次是安全的；仍冲突才把错误交给界面（2026-11-26 R3）。
         */
        try {
          const version = await latestVersion(failure.currentVersion);
          const next = await mutateEggMatching(groupId, version, action);
          install(next);
          return next;
        } catch (retryFailure) {
          failure = retryFailure;
        }
      }
      if (identity.current === requested) {
        if (failure instanceof EggMatchingError && failure.status === 409 &&
            typeof failure.currentVersion === 'number') adoptHint(failure.currentVersion);
        if (kind !== 'stock-sync') setError(failure instanceof Error ? failure.message : '操作失败');
      }
      throw failure;
    } finally { if(writing.current===requested)writing.current = null; if (identity.current === requested) setBusy(false); }
  }, [groupId, key]);
  useEffect(()=>{if(data)publishPlanAlertBadge(data.state.trades.filter(t=>eggTaskActionable(t,accountId)).length);},[data,accountId]);
  return { data, loading, busy, error, refresh, mutate };
}
