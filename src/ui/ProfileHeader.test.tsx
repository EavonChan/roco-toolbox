import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { ProfileHeader } from './ProfileHeader';
import type { AccountSnapshot } from '../domain/parseBackup';

/**
 * 「我的」页顶部的账号概览卡（2026-11-25 U2 方案 A）。
 *
 * 这一卡要回答三个问题：谁在用（登录态）、本机有几个游戏角色、数据有多新。
 * 三个值都来自调用方传进来的 props，所以这里只测展示口径，不碰 store。
 */
const snapshot = (overrides: Partial<AccountSnapshot> = {}): AccountSnapshot => ({
  accountName: '测试甲',
  gameId: 1,
  exportedAt: '2026-11-25 12:00:00',
  importedAt: '2026-11-25T13:56:00.000Z',
  pets: [],
  eggs: [],
  home: undefined,
  ...overrides,
});

describe('ProfileHeader（账号概览卡）', () => {
  test('未登录：写清本机模式，并给出角色数与上次采集时间', () => {
    render(
      <ProfileHeader
        snapshots={[snapshot({ importedAt: '2026-11-25T13:56:00.000Z' })]}
        accountId={null}
        onGoAccount={vi.fn()}
      />,
    );

    expect(screen.getByTestId('profile-header')).toBeTruthy();
    expect(screen.getByTestId('profile-header-name')).toHaveTextContent('本机模式');
    expect(screen.getByTestId('profile-header-name')).toHaveTextContent('未登录');
    expect(screen.getByTestId('profile-header-state')).toHaveTextContent('1 个角色');
    expect(screen.getByTestId('profile-header-state')).toHaveTextContent('上次采集');
    expect(screen.getByTestId('profile-header-action')).toHaveTextContent('登录');
  });

  test('已登录：写清已登录，多个账号按个数写；右上角不再放按钮', () => {
    render(
      <ProfileHeader
        snapshots={[snapshot({}), snapshot({ gameId: 2 })]}
        accountId="acc-1"
        accountName="阿布"
        onGoAccount={vi.fn()}
      />,
    );

    expect(screen.getByTestId('profile-header-name')).toHaveTextContent('阿布');
    expect(screen.getByTestId('profile-header-state')).toHaveTextContent('2 个角色');
    // 2026-11-28 FX1：概览卡的「同步」名不副实（只滚动、不执行同步），删掉；
    // 首屏的绿色强调只剩「导入游戏数据」一个落点，同步只留在「私有同步」卡里。
    expect(screen.queryByTestId('profile-header-action')).toBeNull();
    expect(screen.getByTestId('profile-header')).not.toHaveTextContent('同步');
  });

  test('头像取用户名首字；老账号没有用户名时头像与标题都写「已」', () => {
    const first = render(
      <ProfileHeader snapshots={[]} accountId="acc-1" accountName="阿布" onGoAccount={vi.fn()} />,
    );
    expect(screen.getByTestId('profile-header-avatar')).toHaveTextContent('阿');
    first.unmount();

    render(<ProfileHeader snapshots={[]} accountId="acc-1" onGoAccount={vi.fn()} />);
    expect(screen.getByTestId('profile-header-avatar')).toHaveTextContent('已');
    expect(screen.getByTestId('profile-header-name')).toHaveTextContent('已登录');
  });

  test('本机还没有数据：不编造采集时间，改成一句「还没采集」', () => {
    render(<ProfileHeader snapshots={[]} accountId={null} onGoAccount={vi.fn()} />);

    const state = screen.getByTestId('profile-header-state');
    expect(state).toHaveTextContent('还没采集');
    expect(state).not.toHaveTextContent('上次采集');
  });

  test('点右侧动作交给上层（不自己跳转）', () => {
    const onGoAccount = vi.fn();
    render(<ProfileHeader snapshots={[]} accountId={null} onGoAccount={onGoAccount} />);

    screen.getByTestId('profile-header-action').click();
    expect(onGoAccount).toHaveBeenCalledTimes(1);
  });

  test('已登录时不渲染右侧动作：没有「同步」，也没有任何会滚动的按钮', () => {
    const onGoAccount = vi.fn();
    render(
      <ProfileHeader snapshots={[snapshot()]} accountId="acc-1" onGoAccount={onGoAccount} />,
    );

    expect(screen.queryByTestId('profile-header-action')).toBeNull();
    expect(onGoAccount).not.toHaveBeenCalled();
  });
});
