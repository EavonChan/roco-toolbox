import { createModuleStore } from '../ui/createModuleStore';

/**
 * 「持续获取模式」开关（2026-11-05）。
 *
 * 对应多多工具箱的 live mode：开启后采集中不自动停止，数据一有变化就刷新实时计数，
 * 由用户自己决定何时「停止并保存」。关闭时保持原有「内容稳定 → 自动停止并导入」流程。
 */
const KEY = 'roco.liveCaptureMode';
const store = createModuleStore<boolean>(false, { persistKey: KEY });

export function getLiveMode(): boolean {
  return store.get();
}

export function useLiveMode(): boolean {
  return store.use();
}

export function setLiveMode(value: boolean): void {
  store.set(Boolean(value));
}

export function toggleLiveMode(): void {
  store.set(!store.get());
}

/** 测试用：恢复默认关闭。 */
export function resetLiveModeForTest(): void {
  store.set(false);
}
