import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ProfileAvatarPicker } from './ProfileAvatarPicker';

/**
 * 换头像弹层（2026-11-28）：底部弹层，只列本机已导入的精灵；
 * 点一只立即生效并关闭，所以没有「保存」按钮。
 */
afterEach(cleanup);

const candidates = [
  { gameId: 3007, name: '魔力猫' },
  { gameId: 3001, name: '喵喵' },
];

const open = (overrides: Partial<Parameters<typeof ProfileAvatarPicker>[0]> = {}) => {
  const props: Parameters<typeof ProfileAvatarPicker>[0] = {
    open: true,
    current: null,
    candidates,
    displayName: '训练家小明',
    colorSeed: 'acc-1',
    onPick: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<ProfileAvatarPicker {...props} />);
  return props;
};

describe('ProfileAvatarPicker（换头像弹层）', () => {
  test('列出「默认」和本机已有的精灵；不列没导入的精灵', () => {
    open();

    expect(screen.getByTestId('avatar-option-default')).toHaveTextContent('默认');
    expect(screen.getByTestId('avatar-option-3007')).toHaveTextContent('魔力猫');
    expect(screen.getByTestId('avatar-option-3001')).toHaveTextContent('喵喵');
    // 只列传进来的候选，不列全图鉴
    expect(screen.queryByTestId('avatar-option-3003')).toBeNull();
  });

  test('点一只精灵：把 gameId 交给上层，弹层由上层关', () => {
    const props = open();

    fireEvent.click(screen.getByTestId('avatar-option-3007'));

    expect(props.onPick).toHaveBeenCalledWith({ kind: 'pet', gameId: 3007 });
    expect(props.onClose).not.toHaveBeenCalled();
  });

  test('点「默认」：清掉头像（传 null）', () => {
    const props = open({ current: { kind: 'pet', gameId: 3007 } });

    fireEvent.click(screen.getByTestId('avatar-option-default'));

    expect(props.onPick).toHaveBeenCalledWith(null);
  });

  test('当前头像有选中态，键盘/读屏能看出来', () => {
    open({ current: { kind: 'pet', gameId: 3007 } });

    expect(screen.getByTestId('avatar-option-3007')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('avatar-option-3001')).toHaveAttribute('aria-pressed', 'false');
  });

  test('没有精灵可选：给空态和「去采集 / 同步」，不列全图鉴', () => {
    const onGoImport = vi.fn();
    open({ candidates: [], onGoImport });

    expect(screen.getByTestId('avatar-empty')).toHaveTextContent('还没有精灵可选');
    fireEvent.click(screen.getByRole('button', { name: '去采集 / 同步' }));
    expect(onGoImport).toHaveBeenCalledTimes(1);
  });

  test('可关闭：右上角关闭按钮交回上层', () => {
    const props = open();
    fireEvent.click(screen.getByTestId('avatar-picker-close'));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
