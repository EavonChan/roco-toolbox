/**
 * 附近精灵去重（2026-11-05，逆向自多多工具箱 4.2 的 `_n` 稀有提醒器）。
 *
 * 规则（与多多一致）：
 * - 当前还在附近、但已经不稀有 → 立刻删掉记录，之后再次稀有可以重新提醒；
 * - 首次稀有 → 进提醒队列；再次稀有 → 只刷新时间，不重复提醒；
 * - 已经从附近消失 → 超过 10 分钟才清理；
 * - 任何条目最多保留 30 分钟。
 */
export const LEAVE_TTL_MS = 10 * 60 * 1000;
export const MAX_TTL_MS = 30 * 60 * 1000;

export interface SeenEntry<T> {
  item: T;
  firstSeenAt: number;
  lastSeenAt: number;
}

export class RareAlertGate<T> {
  private seen = new Map<string, SeenEntry<T>>();

  /**
   * @param items 当前附近列表（含不稀有项）
   * @param keyOf 取稳定 key
   * @param isHit 是否满足主动提醒条件
   * @param now 当前时间
   * @returns 本次需要提醒的新条目（首次满足条件）
   */
  scan(items: readonly T[], keyOf: (item: T) => string, isHit: (item: T) => boolean, now = Date.now()): T[] {
    const fresh: T[] = [];
    const present = new Set<string>();
    for (const item of items) {
      const key = keyOf(item);
      if (!key) continue;
      present.add(key);
      if (!isHit(item)) {
        this.seen.delete(key);
        continue;
      }
      const entry = this.seen.get(key);
      if (!entry) {
        this.seen.set(key, { item, firstSeenAt: now, lastSeenAt: now });
        fresh.push(item);
      } else {
        entry.lastSeenAt = now;
        entry.item = item;
      }
    }
    for (const [key, entry] of this.seen) {
      if (!present.has(key) && now - entry.lastSeenAt > LEAVE_TTL_MS) this.seen.delete(key);
    }
    for (const [key, entry] of this.seen) {
      if (now - entry.firstSeenAt > MAX_TTL_MS) this.seen.delete(key);
    }
    return fresh;
  }

  reset(): void {
    this.seen.clear();
  }

  get size(): number {
    return this.seen.size;
  }
}
