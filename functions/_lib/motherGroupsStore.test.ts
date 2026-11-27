// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { gameAccountConflictText } from './motherGroupsStore';

/**
 * 同一游戏号被别的成员占用的 409 文案（2026-11-27）。
 *
 * 现场最常见的一种「撞车」其实是**同一个人建了两个小布助手账号**：
 * 第二个账号发布同一个 UID 会撞 409，而旧文案只说「已由 X 共享」，
 * 用户根本想不到 X 就是他自己。所以文案必须给「用原账号登录」这条自救路径。
 */
describe('同 UID 冲突文案', () => {
  test('知道占用人是谁：点名 + 告诉用户用原账号登录，不用新建账号', () => {
    const text = gameAccountConflictText('阿岚');
    expect(text).toContain('阿岚');
    expect(text).toContain('用当初绑它的那个小布助手账号');
    expect(text).toContain('不用新建账号');
  });

  test('拿不到名字时也要给自救路径，不能只说「被占用了」', () => {
    const text = gameAccountConflictText(null);
    expect(text).toContain('其他成员');
    expect(text).toContain('不用新建账号');
  });
});
