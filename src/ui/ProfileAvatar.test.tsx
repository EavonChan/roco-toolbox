import { cleanup, render, screen } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ProfileAvatar, avatarColorClass } from './ProfileAvatar';

/**
 * 头像组件（2026-11-28）：图片 / 用户名首字两种形态，视觉 56~64px，触区 ≥44px。
 * 底色由用户名（没有用户名时用账号 id）哈希决定 —— 同一账号在不同设备上同色，不能随机。
 */
afterEach(cleanup);

describe('ProfileAvatar', () => {
  test('没设置头像：用户名首字 + 稳定底色（同一账号两次渲染同色）', () => {
    const first = render(<ProfileAvatar name="训练家小明" colorSeed="训练家小明" testId="avatar" />);
    expect(screen.getByTestId('avatar')).toHaveTextContent('训');
    const className = screen.getByTestId('avatar').className;
    expect(className).toContain(avatarColorClass('训练家小明'));
    first.unmount();

    render(<ProfileAvatar name="训练家小明" colorSeed="训练家小明" testId="avatar" />);
    expect(screen.getByTestId('avatar').className).toBe(className);
  });

  test('不同用户名的底色来自同一套调色板，且不随机', () => {
    const a = avatarColorClass('训练家小明');
    const b = avatarColorClass('阿布');
    expect(a).toBe(avatarColorClass('训练家小明'));
    expect(b).toBe(avatarColorClass('阿布'));
    // 调色板只有 5 档，class 里必须带底色与文字色
    expect(a).toMatch(/bg-(accent|info|warn|danger)-soft|bg-surface-raised/);
  });

  test('未登录：写「本」、用中性色，不显示空图片框', () => {
    render(<ProfileAvatar name="本机模式 · 未登录" colorSeed={null} testId="avatar" />);

    expect(screen.getByTestId('avatar')).toHaveTextContent('本');
    expect(screen.getByTestId('avatar').className).toContain('bg-surface-raised');
    expect(screen.queryByRole('img')).toBeNull();
  });

  test('已设置精灵：显示图片，alt 用用户名', () => {
    render(
      <ProfileAvatar avatar={{ kind: 'pet', gameId: 3007 }} name="训练家小明" colorSeed="训练家小明" testId="avatar" />,
    );

    const image = screen.getByRole('img');
    expect(image).toHaveAttribute('alt', '训练家小明');
    expect(image.getAttribute('src')).toContain('/jingling/3007/icon.png');
  });

  test('图片加载失败：退回首字，不留破图', () => {
    render(
      <ProfileAvatar avatar={{ kind: 'pet', gameId: 3007 }} name="训练家小明" colorSeed="训练家小明" testId="avatar" />,
    );
    fireEvent.error(screen.getByRole('img'));

    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByTestId('avatar')).toHaveTextContent('训');
  });

  test('触区 ≥44px：视觉 56px 的圆外面还有一层 44px 的最小热区', () => {
    render(<ProfileAvatar name="训练家小明" colorSeed="训练家小明" onClick={vi.fn()} testId="avatar" />);

    const button = screen.getByRole('button', { name: '训练家小明' });
    expect(button).toBe(screen.getByTestId('avatar'));
    expect(button.className).toContain('min-h-11');
    expect(button.className).toContain('min-w-11');
    expect(button.className).toContain('size-14');
  });
});
