import { createModuleStore } from './createModuleStore';
import {
  activeNatureOverrides,
  NATURE_OVERRIDES_KEY,
  NATURE_OVERRIDES_UPDATED_AT_KEY,
  type NatureOverrides,
} from '../domain/recommendedNatures';

/**
 * 「推荐性格」的个人覆盖表（2026-10-25）。
 *
 * 键是**蛋**的 gameId（与母本清单一一对应），值是这颗蛋的推荐性格。
 * 只存改过的蛋；清空某颗蛋 = 回到图鉴推荐 / 种族值兜底。
 *
 * 存 localStorage 并跟随云同步（`roco.natureOverrides` 在 sync 的偏好键里），
 * 这样组长换设备后，小组目标里的那一份仍然是他最新的。
 */
const store = createModuleStore<NatureOverrides>({}, {
  persistKey: NATURE_OVERRIDES_KEY,
  migrate: (loaded) => activeNatureOverrides(loaded),
});

/**
 * 记下本机修改时刻（云同步靠它判断「本机改动是否比云端新」）。
 * 不改它的话，导入后的自动云同步会把还没上传的修改打回云端旧值（2026-11-02 修）。
 */
function markUpdated(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(NATURE_OVERRIDES_UPDATED_AT_KEY, String(Date.now()));
  } catch {
    // 隐私模式写不了：本次只在内存生效
  }
}

export function getNatureOverrides(): NatureOverrides {
  return store.get();
}

export function useNatureOverrides(): NatureOverrides {
  return store.use();
}

/** 覆盖一颗蛋的推荐性格；传空数组 = 恢复默认（从表里删掉）。 */
export function setEggNatures(eggGameId: number, natures: readonly string[]): void {
  const current = store.get();
  const next: NatureOverrides = { ...current };
  const kept = [...new Set(natures.filter((nature) => typeof nature === 'string' && nature.trim()))];
  if (kept.length === 0) delete next[String(eggGameId)];
  else next[String(eggGameId)] = kept;
  store.set(next);
  markUpdated();
}

export function resetAllNatureOverrides(): void {
  store.set({});
  markUpdated();
}

/** 测试用：清空（不写 localStorage 之外的副作用）。 */
export function resetNatureOverridesForTest(): void {
  store.set({});
}
