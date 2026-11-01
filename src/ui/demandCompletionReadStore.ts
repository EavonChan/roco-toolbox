import { demandKeyOf, type CollectionDemand } from '../shared/collectionGroups';

/**
 * 「需求方已确认完成你的单」的本机已读记录（2026-10-30）。
 *
 * 需求方结单后，承接人这边不会收到推送；他下次打开小组页时，需求中心顶部会提示
 * 「XX 已确认完成你的 N 单」。看过点「知道了」后写本机，之后只提示新的完成。
 * 键带 completedAt（即 done 行的 updatedAt），同款需求重发不会误判成已读。
 */
const KEY_PREFIX = 'roco.demandCompletionRead:';

export type CompletionRead = Record<string, true>;

export function completionReadKey(groupId: string, demand: CollectionDemand): string {
  return `${groupId}|${demand.demanderAccountId}|${demandKeyOf(demand)}|${demand.updatedAt}`;
}

export function readCompletionRead(accountId: string | null): CompletionRead {
  if (!accountId || typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + accountId);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === 'object' ? (parsed as CompletionRead) : {};
  } catch {
    return {};
  }
}

export function markCompletionRead(
  accountId: string,
  keys: readonly string[],
): CompletionRead {
  const read = readCompletionRead(accountId);
  for (const key of keys) read[key] = true;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(KEY_PREFIX + accountId, JSON.stringify(read));
    } catch {
      // 存不下只是下次还会提示一次（同 lastTab.ts / demandPickStore.ts）
    }
  }
  return { ...read };
}

/** 重置本机数据时清掉当前云身份的「完成回执已读」（R2-2-M07）。 */
export function clearCompletionRead(accountId: string | null): void {
  if (!accountId || typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(KEY_PREFIX + accountId);
  } catch {
    // 清不掉只是那份已读还留着
  }
}
