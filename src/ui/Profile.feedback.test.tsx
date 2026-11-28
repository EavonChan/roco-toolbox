import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { Profile } from './Profile';
import { resetMeCacheForTest } from './accountMe';
import { clearSyncFeedback } from './syncNoticeStore';
import { clearAllSnapshots } from '../storage/snapshots';
import { resetSnapshotCacheForTest } from '../storage/snapshotStore';

/**
 * 「我的」页的交互手感（2026-11-28 FX1，依据 docs/评审-UI-2026-11-28.md §6）。
 *
 * 只盯「动作发生的地方有没有反馈」，不测版式：
 * ② 页内跳转落点要躲开 88px 的 sticky 头；
 * ④ 可点元素有按下态、切 section 有 120ms 淡入。
 */

const stubFetch = (): void => {
  // 这页会读 /api/me；单测不许真的打线上
  vi.stubGlobal('fetch', () =>
    Promise.resolve(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ),
  );
};

beforeEach(() => {
  resetMeCacheForTest();
  stubFetch();
});

afterEach(async () => {
  cleanup();
  clearSyncFeedback();
  window.localStorage.clear();
  delete window.RocoServer;
  delete window.RocoUpdate;
  vi.unstubAllGlobals();
  resetMeCacheForTest();
  await clearAllSnapshots();
  resetSnapshotCacheForTest();
});

const renderData = () =>
  render(<Profile section="data" returnToGroups={false} onNavigate={vi.fn()} />);

describe('② 页内跳转不被顶栏盖住', () => {
  test('「采集数据」的落点带 scroll-mt-24（96px），标题不会被 88px 的 sticky 头吃掉', () => {
    const scrollIntoView = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      renderData();

      fireEvent.click(screen.getByTestId('profile-entry-collect'));

      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      // 96px > 顶栏 88px：滚动目标自己让出头部高度，不再靠调用点各减一次
      const target = screen.getByTestId('profile-collect');
      expect(target.className).toContain('scroll-mt-24');
      // 落点块里的标题「本机采集」在这个块内，跟着一起让位
      expect(within(target).getByRole('heading', { name: '本机采集' })).toBeTruthy();
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });
});

describe('④ 点击与切换的反馈', () => {
  test('列表行有按下态，且用的是 DESIGN1 的 surface token（不新写颜色）', () => {
    renderData();

    for (const id of ['profile-section-identity', 'profile-guide']) {
      const row = screen.getByTestId(id);
      expect(row.className).toMatch(/\bactive:/);
      expect(row.className).toContain('active:bg-surface-sunken');
      // 按下态要立刻出现，不能等动画结束
      expect(row.className).toContain('transition-colors');
    }
  });

  test('二级分区的「‹ 返回我的」也有按下态', () => {
    render(<Profile section="identity" returnToGroups={false} onNavigate={vi.fn()} />);

    const back = screen.getByTestId('profile-section-data');
    expect(back.className).toMatch(/\bactive:/);
    expect(back.className).toContain('active:bg-surface-sunken');
  });

  test('切 section 时换一个新容器重放 120ms 淡入（不是位移，避免和滚动打架）', () => {
    const { rerender } = render(
      <Profile section="data" returnToGroups={false} onNavigate={vi.fn()} />,
    );
    const fade = screen.getByTestId('profile-section-fade');
    expect(fade.className).toContain('profile-section-fade');

    rerender(<Profile section="identity" returnToGroups={false} onNavigate={vi.fn()} />);
    const next = screen.getByTestId('profile-section-fade');
    // 换容器 = 动画重新播一遍；不换容器的话 CSS 动画不会重放
    expect(next).not.toBe(fade);
    expect(next.className).toContain('profile-section-fade');
  });
});

describe('① 概览卡不再有伪同步按钮', () => {
  test('已登录：右上角什么都不放，同步只留在「私有同步」卡里', () => {
    window.localStorage.setItem('roco.accountId', 'acc-1');
    try {
      renderData();

      expect(screen.queryByTestId('profile-header-action')).toBeNull();
      expect(screen.getByTestId('profile-header')).not.toHaveTextContent('同步');
      // 真正执行同步的按钮仍在下面那张卡里
      expect(
        within(screen.getByTestId('profile-sync-block')).getByTestId('account-sync'),
      ).toHaveTextContent('立即同步');
    } finally {
      window.localStorage.clear();
    }
  });

  test('未登录：右上角仍给「登录」，这是本机模式的唯一动作', () => {
    renderData();

    expect(screen.getByTestId('profile-header-action')).toHaveTextContent('登录');
  });
});
