import type { LiveNearbyPet } from '../collector/captureProgress';
import { createModuleStore } from '../ui/createModuleStore';
import { nearbyFilterAllows, type NearbyFilter } from './nearbyFilterStore';

/**
 * 目标精灵（蹲守）名单（2026-11-13）。
 *
 * 场景：专门蹲某一只时，附近页地图和列表上的其它精灵全是干扰，只想看自己点名的那几只。
 *
 * 口径：
 * - 名单按**图鉴 gameId**（快照里的 `pet.petId`）识别，与名字 / 形态解耦；
 * - 支持多选，存在 localStorage `roco.nearbyTargets`，跨局 / 重开都保留；
 * - 空数组 = 关闭：范围控件会退回「全部」，判定函数对空名单一律不放行；
 * - 开启后是**替换**语义：跳过三档范围与战斗维度，也不再「命中需求恒放行」；
 * - 关闭时判定完全走原来的 {@link nearbyFilterAllows}，三档与维度的既有语义不变。
 */
const KEY = 'roco.nearbyTargets';

/** 只收正整数 gameId，去重并保持勾选顺序（坏数据一律丢掉）。 */
function normalizeList(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const result: number[] = [];
  for (const value of raw) {
    if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

const store = createModuleStore<number[]>([], { persistKey: KEY, migrate: normalizeList });

/** 当前蹲守名单（图鉴 gameId，按勾选顺序）。 */
export function getNearbyTargets(): readonly number[] {
  return store.get();
}

/** 附近页与悬浮窗共用的订阅。 */
export function useNearbyTargets(): readonly number[] {
  return store.use();
}

export function setNearbyTargets(next: readonly number[]): void {
  const value = normalizeList(next);
  const current = store.get();
  if (value.length === current.length && value.every((id, index) => id === current[index])) return;
  store.set(value);
}

export function toggleNearbyTarget(gameId: number): void {
  const current = store.get();
  setNearbyTargets(
    current.includes(gameId) ? current.filter((id) => id !== gameId) : [...current, gameId],
  );
}

export function clearNearbyTargets(): void {
  setNearbyTargets([]);
}

/** 测试用：清空名单。 */
export function resetNearbyTargetsForTest(): void {
  store.set([]);
}

/** 这只精灵是不是点名蹲守的目标（`petId` 缺失 = 认不出，不算命中）。 */
export function nearbyTargetAllows(
  targets: readonly number[],
  pet: Pick<LiveNearbyPet, 'petId'>,
): boolean {
  return pet.petId != null && targets.includes(pet.petId);
}

/**
 * 地图 / 列表 / 悬浮窗的统一放行口径。
 *
 * `filter === 'target'` 时只看名单；其它档位原样交给 {@link nearbyFilterAllows}，
 * 三档与战斗维度的既有语义不变。
 */
export function nearbyRangeAllows(
  filter: NearbyFilter,
  pet: Pick<LiveNearbyPet, 'petId' | 'rare'>,
  targets: readonly number[] = getNearbyTargets(),
): boolean {
  if (filter === 'target') return nearbyTargetAllows(targets, pet);
  return nearbyFilterAllows(filter, pet);
}
