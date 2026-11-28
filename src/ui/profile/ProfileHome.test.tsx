import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ProfileHome } from './ProfileHome';
import { PROFILE_ACTIVE, PROFILE_REORDER_V2, PROFILE_STABLE_V1 } from './recipes';
import { makeCtx } from './testContext';
import type { SectionDef } from './types';

/**
 * 配方层（2026-11-28）：页面 = 区块数组。
 * 这里验证三件事：默认配方首屏顺序、空数据只留一句空态、删块/换配方不炸。
 */
afterEach(cleanup);

describe('「我的」页配方', () => {
  test('有数据：首屏顺序是 身份 → 三个数字 → 三个入口 → 采集 → 更多/设置', () => {
    render(<ProfileHome ctx={makeCtx()} />);

    const home = screen.getByTestId('profile-home');
    expect(home.getAttribute('data-sections')).toBe('identity,todos,entries,collect,settings');
    expect(screen.getByTestId('profile-todos')).toBeTruthy();
    expect(screen.getByTestId('profile-quick-entries')).toBeTruthy();
    expect(screen.queryByTestId('profile-new-user')).toBeNull();
  });

  test('没有数据：身份 + 一句空态 + 更多/设置（不出现数字/入口/采集重复空态）', () => {
    render(<ProfileHome ctx={makeCtx({ snapshots: [] })} />);

    // 设置块不设 when：新用户也要能从「我的」进身份 / 看引导；
    // 「不进首屏」靠配方顺序（排最后），不靠隐藏。
    expect(screen.getByTestId('profile-home').getAttribute('data-sections')).toBe(
      'identity,new-user,settings',
    );
    expect(screen.queryByTestId('profile-todos')).toBeNull();
    expect(screen.queryByTestId('profile-quick-entries')).toBeNull();
    expect(screen.queryByTestId('profile-collect')).toBeNull();
    expect(screen.getByTestId('profile-new-user')).toBeTruthy();
  });

  test('区块 when=false 时不渲染、不占高度', () => {
    const hidden: SectionDef = {
      id: 'never',
      title: '永不显示',
      render: () => <div data-testid="should-not-render" className="h-96" />,
      when: () => false,
    };
    const { container } = render(
      <ProfileHome ctx={makeCtx()} recipe={[hidden]} />,
    );

    expect(screen.queryByTestId('should-not-render')).toBeNull();
    expect(screen.getByTestId('profile-home').getAttribute('data-sections')).toBe('');
    expect(container.querySelector('[data-testid="profile-home"]')?.children.length ?? 0).toBe(0);
  });

  test('任意子集都能渲染：空配方也不炸', () => {
    render(<ProfileHome ctx={makeCtx()} recipe={[]} />);
    expect(screen.getByTestId('profile-home')).toBeTruthy();
  });

  test('PROFILE_ACTIVE 指向重排版；STABLE_V1 是不含数字块的旧结构（一行回退）', () => {
    expect(PROFILE_ACTIVE).toBe(PROFILE_REORDER_V2);
    expect(PROFILE_STABLE_V1.map((section) => section.id)).toEqual([
      'identity',
      'entries',
      'collect',
      'settings',
    ]);
    // 区块数落在方案要求的 5~7 个
    expect(PROFILE_REORDER_V2.length).toBeGreaterThanOrEqual(5);
    expect(PROFILE_REORDER_V2.length).toBeLessThanOrEqual(7);
    // 区块之间不共享可变状态：只有 render/when 两个函数字段
    for (const section of PROFILE_REORDER_V2) {
      expect(typeof section.id).toBe('string');
      expect(typeof section.render).toBe('function');
      if (section.when !== undefined) expect(typeof section.when).toBe('function');
    }
  });

  test('删掉任意一个区块，页面仍渲染（可回退的最低保证）', () => {
    for (const drop of PROFILE_REORDER_V2) {
      const recipe = PROFILE_REORDER_V2.filter((section) => section.id !== drop.id);
      const { unmount } = render(<ProfileHome ctx={makeCtx()} recipe={recipe} />);
      expect(screen.getByTestId('profile-home')).toBeTruthy();
      unmount();
    }
    vi.clearAllMocks();
  });
});
