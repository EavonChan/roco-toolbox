import { afterEach, describe, expect, test } from 'vitest';
import { getLiveMode, resetLiveModeForTest, setLiveMode, toggleLiveMode } from './liveModeStore';

afterEach(() => {
  resetLiveModeForTest();
  window.localStorage.clear();
});

describe('持续获取模式开关', () => {
  test('默认关闭', () => {
    expect(getLiveMode()).toBe(false);
  });

  test('切换后写入 localStorage，重新读取仍然开启', () => {
    toggleLiveMode();
    expect(getLiveMode()).toBe(true);
    expect(window.localStorage.getItem('roco.liveCaptureMode')).toBe('true');
  });

  test('显式设置优先于切换', () => {
    setLiveMode(false);
    expect(getLiveMode()).toBe(false);
    setLiveMode(true);
    expect(getLiveMode()).toBe(true);
  });
});
