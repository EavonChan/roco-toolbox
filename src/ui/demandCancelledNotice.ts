import { demandKeyOf, type CollectionDemand } from '../shared/collectionGroups';

/**
 * 承接人的「你接的需求已被取消」提示（R2-7-M05，2026-11-01 拍板选 A）。
 *
 * 需求方被移出小组时，服务端会连带删掉他所有未完成需求（status != 'done'），
 * 承接人这边没有任何通知，那条单会直接从列表消失。服务端不记取消原因（要改表），
 * 所以这里用本机记忆补一条提示：记住「我接过哪些单」，下次刷新时对不上的就是被取消的。
 *
 * 换设备看不到——这是 A 方案已经接受的代价；B 方案（服务端记原因）要改 schema。
 */
export interface DemandCancelledNotice {
  /** 本次新发现被取消的单数。 */
  count: number;
}

export interface DemandCancelledState {
  /** 上次刷新时「我承接且未完成」的单（key 带 updatedAt，重发后会换新 key）。 */
  claimed: string[];
  /** 已经提示过的取消，避免每次刷新都弹。 */
  notified: string[];
}

export interface DemandCancelledDecision {
  notice: DemandCancelledNotice | null;
  state: DemandCancelledState;
}

const KEY_PREFIX = 'roco.demandCancelled:';

/** 一条需求在「我接过的单」里的标识：需求方 + 需求内容 + 版本时间。 */
export function cancelledDemandKey(groupId: string, demand: CollectionDemand): string {
  return `${groupId}|${demand.demanderAccountId}|${demandKeyOf(demand)}|${demand.updatedAt}`;
}

/**
 * 计算这次要不要提示「你接的 N 条需求已被取消」。
 *
 * - `state === null`：本机第一次记录这个组，只存当前承接的单，不提示；
 * - 消失且没出现在已完成里 → 算被取消；已完成的不算（结单后列表本来就不再下发 done 行）；
 * - 已提示过的 key 不再重复提示。
 */
export function resolveDemandCancelledNotice(
  demands: readonly CollectionDemand[],
  claimerAccountId: string,
  state: DemandCancelledState | null,
): DemandCancelledDecision {
  const mineClaimed = demands.filter(
    (demand) => demand.status === 'claimed' && demand.claimerAccountId === claimerAccountId,
  );
  const claimed = mineClaimed.map((demand) => cancelledDemandKey(demand.groupId, demand));
  const doneKeys = new Set(
    demands
      .filter((demand) => demand.status === 'done' && demand.claimerAccountId === claimerAccountId)
      .map((demand) => cancelledDemandKey(demand.groupId, demand)),
  );

  if (state == null) return { notice: null, state: { claimed, notified: [] } };

  const alive = new Set(claimed);
  const notified = new Set(state.notified);
  const cancelled = state.claimed.filter(
    (key) => !alive.has(key) && !doneKeys.has(key) && !notified.has(key),
  );
  const next: DemandCancelledState = {
    claimed,
    notified: [...state.notified, ...cancelled],
  };
  return {
    notice: cancelled.length > 0 ? { count: cancelled.length } : null,
    state: next,
  };
}

function storageKey(accountId: string, groupId: string): string {
  return `${KEY_PREFIX}${accountId}:${groupId}`;
}

export function readDemandCancelledState(
  accountId: string | null,
  groupId: string | null,
): DemandCancelledState | null {
  if (!accountId || !groupId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey(accountId, groupId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DemandCancelledState>;
    return {
      claimed: Array.isArray(parsed.claimed) ? parsed.claimed.filter((key) => typeof key === 'string') : [],
      notified: Array.isArray(parsed.notified)
        ? parsed.notified.filter((key) => typeof key === 'string')
        : [],
    };
  } catch {
    return null;
  }
}

export function saveDemandCancelledState(
  accountId: string,
  groupId: string,
  state: DemandCancelledState,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(accountId, groupId), JSON.stringify(state));
  } catch {
    // 存不下只是下次还会再提示一次（同 demandCompletionReadStore.ts）
  }
}

/** 重置本机数据时清掉当前云身份的这些记忆（与 R2-2-M07 的清理口径一致）。 */
export function clearDemandCancelledState(accountId: string | null): void {
  if (!accountId || typeof window === 'undefined') return;
  const prefix = `${KEY_PREFIX}${accountId}:`;
  try {
    const keys: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && key.startsWith(prefix)) keys.push(key);
    }
    for (const key of keys) window.localStorage.removeItem(key);
  } catch {
    // 清不掉只是那份记忆还留着
  }
}
