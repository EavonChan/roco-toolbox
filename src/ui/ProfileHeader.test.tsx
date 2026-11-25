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

  test('已登录：写清已登录与同步动作，多个账号按个数写', () => {
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
    expect(screen.getByTestId('profile-header-action')).toHaveTextContent('同步');
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
});
