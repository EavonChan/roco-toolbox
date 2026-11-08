import type { RetainedEntry } from '../pcap/nearbyRetain';

/**
 * 附近页的「常驻列表」（2026-11-06）。
 *
 * 只保留高价值条目（稀有 / 命中需求中心），离开视野后再保留 10 分钟；
 * 页面切走再回来不会丢，纯内存，不写 localStorage。
 */
let entries: RetainedEntry[] = [];
const listeners = new Set<() => void>();

export function readNearbyRetained(): RetainedEntry[] {
  return entries;
}

export function writeNearbyRetained(next: RetainedEntry[]): void {
  entries = next;
  for (const listener of listeners) listener();
}

export function subscribeNearbyRetained(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 测试用：清空常驻列表。 */
export function resetNearbyRetainedForTest(): void {
  entries = [];
}
