import type { LiveNearbyPet } from '../collector/captureProgress';

/**
 * 附近常驻列表的定期清理（2026-11-06）。
 *
 * 用户口径：常驻列表只保留高价值精灵（稀有 / 目标出现 / 炫彩异色污染），普通精灵离开视野就清掉；
 * 高价值精灵离开后再保留 10 分钟，避免刚走开就丢记录，也防止列表无限增长。
 * 2026-11-25 需求中心下线，不再有「命中需求」这条保留理由。
 *
 * 2026-11-28 口径修正：「全部」档展示的是**当前快照里的全部精灵**（见
 * {@link composeNearbyRows}）∪ 已离开视野的高价值常驻条目；常驻表本身仍然只收高价值，
 * 避免被普通精灵灌满（30s 定时清理也必须先过 {@link retainablePets}）。
 */
export const RETAIN_TTL_MS = 10 * 60 * 1000;
export const RETAIN_MAX_ENTRIES = 60;

export interface RetainedEntry {
  key: string;
  pet: LiveNearbyPet;
  firstSeenAt: number;
  lastSeenAt: number;
  /** 是否仍在当前附近列表里；false = 已离开视野，等待 TTL 清理 */
  present: boolean;
  /** 稀有或目标出现：离开后仍保留 */
  highValue: boolean;
}

export interface RetainClassify {
  highValue: boolean;
}

/** 真正值得常驻的牌子：炫彩 / 异色 / 污染；体重牌、单声音牌不常驻。 */
const KEEP_KINDS = new Set(['colorful', 'shiny', 'pollution']);

/**
 * 常驻列表的「高价值」口径（2026-11-06 用户反馈收紧，2026-11-09 补回稀有）：
 * - 可主动提醒（±100dB，或体重牌 + 声音牌）；
 * - 稀有（与附近页「稀有」筛选同一口径，雷达上能看到就必须能在列表里看到）；
 * - 炫彩 / 异色 / 污染。
 *
 * 只有单一「大块头 / 小不点 / 婉转声 / 粗嗓门」牌子的普通精灵只在雷达/当前视野显示，
 * 不再进入常驻列表。
 */
export function isHighValuePet(pet: LiveNearbyPet): boolean {
  return pet.rare
    || Boolean(pet.alertReason)
    || pet.kinds.some((kind) => KEEP_KINDS.has(kind));
}

export interface RetainOptions {
  ttlMs?: number;
  maxEntries?: number;
}

/**
 * 能进常驻表的精灵：只有高价值（`classify().highValue`，页面里包含稀有 / 目标出现 /
 * 炫彩异色污染 / 蹲守目标）。普通精灵不写常驻，否则离开视野后也清不掉、表会被灌满。
 */
export function retainablePets(
  current: readonly LiveNearbyPet[],
  classify: (pet: LiveNearbyPet) => RetainClassify,
): LiveNearbyPet[] {
  return current.filter((pet) => classify(pet).highValue);
}

/**
 * 附近列表的展示数据（2026-11-28）：
 * 当前快照里的**全部**精灵 ∪ 已离开视野但仍在 TTL 内的高价值常驻条目。
 *
 * - 普通精灵只出现在 `current` 里，离开视野立刻消失（不进 {@link pruneRetained} 的常驻表）；
 * - 首次出现时间优先沿用上一轮展示行（`shown`），其次沿用常驻记录，最后取 `now`，
 *   这样普通精灵每次快照刷新不会把「首次」一直刷成当前时间；
 * - 排序由页面按 `present / alertReason / kinds / 距离` 再做，这里保持快照顺序。
 */
export function composeNearbyRows(
  shown: readonly RetainedEntry[],
  retained: readonly RetainedEntry[],
  current: readonly LiveNearbyPet[],
  now: number,
  classify: (pet: LiveNearbyPet) => RetainClassify,
): RetainedEntry[] {
  const shownByKey = new Map(shown.map((entry) => [entry.key, entry]));
  const retainedByKey = new Map(retained.map((entry) => [entry.key, entry]));
  const currentKeys = new Set(current.map((pet) => pet.key));
  const rows: RetainedEntry[] = [];

  for (const pet of current) {
    const before = shownByKey.get(pet.key) ?? retainedByKey.get(pet.key);
    rows.push({
      key: pet.key,
      pet,
      firstSeenAt: before?.firstSeenAt ?? now,
      lastSeenAt: now,
      present: true,
      highValue: classify(pet).highValue,
    });
  }

  for (const entry of retained) {
    if (currentKeys.has(entry.key)) continue;
    rows.push({ ...entry, present: false });
  }

  return rows;
}

export function pruneRetained(
  previous: readonly RetainedEntry[],
  current: readonly LiveNearbyPet[],
  now: number,
  classify: (pet: LiveNearbyPet) => RetainClassify,
  options: RetainOptions = {},
): RetainedEntry[] {
  const ttlMs = options.ttlMs ?? RETAIN_TTL_MS;
  const maxEntries = options.maxEntries ?? RETAIN_MAX_ENTRIES;
  const previousByKey = new Map(previous.map((entry) => [entry.key, entry]));
  const currentKeys = new Set(current.map((pet) => pet.key));
  const rows: RetainedEntry[] = [];

  for (const pet of current) {
    const before = previousByKey.get(pet.key);
    const result = classify(pet);
    rows.push({
      key: pet.key,
      pet,
      firstSeenAt: before?.firstSeenAt ?? now,
      lastSeenAt: now,
      present: true,
      highValue: result.highValue,
    });
  }

  for (const entry of previous) {
    if (currentKeys.has(entry.key)) continue;
    // 普通精灵离开视野即清理，不进入常驻
    if (!entry.highValue) continue;
    if (now - entry.lastSeenAt > ttlMs) continue;
    rows.push({ ...entry, present: false });
  }

  if (rows.length <= maxEntries) return rows;
  // 超上限时先淘汰「已离开」的旧记录，再淘汰最久没出现的
  const ordered = [...rows].sort((left, right) =>
    Number(left.present) - Number(right.present) || left.lastSeenAt - right.lastSeenAt);
  const keep = new Set(ordered.slice(ordered.length - maxEntries).map((row) => row.key));
  return rows.filter((row) => keep.has(row.key));
}
