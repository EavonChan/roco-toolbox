import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { EggStockView } from './EggStockView';

/** jsdom 没有 matchMedia：横屏用例给一份方向判定。 */
const setLandscape = (landscape: boolean) => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('landscape') ? landscape : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
};

/** 身份按用例切换：账号 / 当前小组都由 localStorage 读，这里直接桩掉。 */
const h = vi.hoisted(() => ({ me: 'acc-1' as string | null, group: 'g1' as string | null }));

vi.mock('../../api/session', () => ({
  readAccountId: () => h.me,
  subscribeSession: () => () => {},
}));

vi.mock('../motherGroupStore', () => ({
  readCurrentGroupId: () => h.group,
}));

vi.mock('./useEggMatching', () => ({
  useEggMatching: () => ({
    data: {
      version: 1,
      state: {
        demands: [],
        eggs: [
          {
            id: 'e1', accountId: 'acc-1', gameAccountKey: 'uid:1', eggGameId: 3227,
            nature: '固执', body: '大块头', voice: '婉转声', kind: 'ordinary',
            status: 'available', listed: true, provenance: 'unknown', confidence: 'manual',
            labelSource: 'unknown', location: 'bag', lastConfirmedAt: 1,
          },
          {
            id: 'e2', accountId: 'acc-1', gameAccountKey: 'uid:1', eggGameId: 3227,
            nature: '保守', body: '小不点', voice: '粗嗓门', kind: 'ordinary',
            status: 'available', listed: false, provenance: 'self-bred', confidence: 'manual',
            labelSource: 'unknown', location: 'home', lastConfirmedAt: 2,
          },
        ],
        lines: [],
        trades: [],
      },
    },
    loading: false,
    busy: false,
    error: null,
    refresh: vi.fn(),
    mutate: vi.fn().mockResolvedValue(undefined),
  }),
}));

afterEach(() => {
  h.me = 'acc-1';
  h.group = 'g1';
});

test('有小组时把换蛋的蛋仓原样搬进家园页', () => {
  render(<EggStockView snapshots={[]} />);
  expect(screen.getByTestId('home-egg-stock-view')).toBeTruthy();
  // 蛋仓列表本体就是组内广场那套（stock-card）
  expect(screen.getAllByTestId('stock-card')).toHaveLength(2);
});

test('没加入小组时说明蛋仓跟着小组走，并能直接去组内广场', () => {
  h.group = null;
  const onGoGroups = vi.fn();
  render(<EggStockView snapshots={[]} onGoGroups={onGoGroups} />);
  expect(screen.getByTestId('egg-stock-need-group')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '去组内广场' }));
  expect(onGoGroups).toHaveBeenCalledTimes(1);
});

test('没登录时提示先登录，不渲染蛋仓列表', () => {
  h.me = null;
  const onGoAccount = vi.fn();
  render(<EggStockView snapshots={[]} onGoAccount={onGoAccount} />);
  expect(screen.getByTestId('egg-stock-need-account')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '去登录' }));
  expect(onGoAccount).toHaveBeenCalledTimes(1);
  expect(screen.queryAllByTestId('stock-card')).toHaveLength(0);
});

test('横屏蛋仓的标题栏带返回家园，点了回家园页', () => {
  setLandscape(true);
  const onBack = vi.fn();
  render(<EggStockView snapshots={[]} onBack={onBack} />);
  fireEvent.click(screen.getByRole('button', { name: '返回家园' }));
  expect(onBack).toHaveBeenCalledTimes(1);
});
