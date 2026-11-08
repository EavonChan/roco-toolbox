import { createModuleStore } from '../ui/createModuleStore';

/**
 * 「稀有精灵提醒」开关（2026-11-05）。
 * 默认开启；关闭后附近稀有精灵只展示，不弹通知、不震动。
 */
const KEY = 'roco.rareAlert';
const store = createModuleStore<boolean>(true, { persistKey: KEY });

export function getRareAlert(): boolean {
  return store.get();
}

export function useRareAlert(): boolean {
  return store.use();
}

export function setRareAlert(value: boolean): void {
  store.set(Boolean(value));
}

export function toggleRareAlert(): void {
  store.set(!store.get());
}

/** 测试用：恢复默认开启。 */
export function resetRareAlertForTest(): void {
  store.set(true);
}
