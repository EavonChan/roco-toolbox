import { afterEach, describe, expect, test } from 'vitest';
import { getRareAlert, resetRareAlertForTest, setRareAlert, toggleRareAlert } from './rareAlertStore';

afterEach(() => {
  resetRareAlertForTest();
  window.localStorage.clear();
});

describe('稀有精灵提醒开关', () => {
  test('默认开启', () => {
    expect(getRareAlert()).toBe(true);
  });
  test('切换后持久化', () => {
    toggleRareAlert();
    expect(getRareAlert()).toBe(false);
    expect(window.localStorage.getItem('roco.rareAlert')).toBe('false');
  });
  test('显式设置', () => {
    setRareAlert(false);
    expect(getRareAlert()).toBe(false);
    setRareAlert(true);
    expect(getRareAlert()).toBe(true);
  });
});
