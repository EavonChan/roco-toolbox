import { describe, expect, test } from 'vitest';
import { rememberProfileScroll, restoreProfileScroll } from './profileScroll';

/**
 * 「我的」页返回时恢复滚动位置（2026-11-28 FX1 ③）。
 *
 * 只记「首页 → 二级分区」这一跳，不做全局路由的滚动恢复：
 * 进二级页要滚顶，返回首页才恢复，且内容变短时不硬撑。
 */
describe('rememberProfileScroll', () => {
  test('首页 → 我的身份：记住离开前的位置', () => {
    expect(
      rememberProfileScroll(
        { page: 'profile', profileSection: 'data' },
        { page: 'profile', profileSection: 'identity' },
        525,
      ),
    ).toBe(525);
  });

  test('首页 → 我的小组：同样记住', () => {
    expect(
      rememberProfileScroll(
        { page: 'profile', profileSection: 'data' },
        { page: 'profile', profileSection: 'groups' },
        312.4,
      ),
    ).toBe(312);
  });

  test('二级分区之间互跳不记（身份 → 小组不是「返回」）', () => {
    expect(
      rememberProfileScroll(
        { page: 'profile', profileSection: 'identity' },
        { page: 'profile', profileSection: 'groups' },
        400,
      ),
    ).toBeNull();
  });

  test('离开「我的」页去别的页签不记（那是全局滚动恢复，不在本轮）', () => {
    expect(
      rememberProfileScroll(
        { page: 'profile', profileSection: 'data' },
        { page: 'dashboard', profileSection: 'data' },
        525,
      ),
    ).toBeNull();
  });

  test('顶部（没滚过）不记，避免返回时反而把页面按住', () => {
    expect(
      rememberProfileScroll(
        { page: 'profile', profileSection: 'data' },
        { page: 'profile', profileSection: 'identity' },
        0,
      ),
    ).toBeNull();
  });
});

describe('restoreProfileScroll', () => {
  test('位置够长：原样恢复', () => {
    expect(restoreProfileScroll(525, 1188)).toBe(525);
  });

  test('返回时内容变短：落到最大可滚处，不硬撑', () => {
    expect(restoreProfileScroll(525, 180)).toBe(180);
  });

  test('没有可滚空间 / 没记住：回到顶部', () => {
    expect(restoreProfileScroll(525, 0)).toBe(0);
    expect(restoreProfileScroll(0, 1188)).toBe(0);
  });
});
