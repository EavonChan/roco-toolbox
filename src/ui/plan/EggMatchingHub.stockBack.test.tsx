import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { expect, test, vi } from 'vitest';
import { emptyEggWorkflow } from '../../shared/eggWorkflow';
import { EggMatchingHub } from './EggMatchingHub';

/**
 * 蛋仓屏「返回」的去向（2026-11-25 U3）。
 *
 * 原来 `EggMatchingHub` 里写死 `setPage(null)`：不管从哪进来，返回都掉回换蛋页。
 * U2 加了「我的 → 蛋仓」直达入口后，这会把用户送回换蛋页 —— 所以返回目标改成可传参。
 */
const mutate = vi.fn().mockResolvedValue(undefined);
const state = emptyEggWorkflow();
vi.mock('./useEggMatching', () => ({
  useEggMatching: () => ({ data: { version: 0, state }, loading: false, busy: false, error: null, refresh: vi.fn(), mutate }),
}));
const props = {
  groupId: 'g', viewerAccountId: 'a',
  species: [{ gameId: 3227, eggGameId: 3227, name: '菊花梨', key: '3227', number: '1', eggGroups: [2] }],
  members: [{ accountId: 'a', displayName: '我' }], snapshots: [],
};

const openStock = () => fireEvent.click(screen.getByRole('button', { name: /^蛋仓/ }));

test('从「我的」进蛋仓：点返回回「我的」（调用方给的去向），不掉回换蛋页', () => {
  const onStockBack = vi.fn();
  const view = render(<EggMatchingHub {...props} onStockBack={onStockBack} stockBackLabel="返回我的" />);
  openStock();
  expect(screen.getByRole('heading', { name: '我的蛋仓' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '‹ 返回' }));
  expect(onStockBack).toHaveBeenCalledTimes(1);
  // 去向由调用方决定：本组件不自己跳回换蛋页（跳走是调用方的事）
  expect(screen.queryByText('我的收集')).toBeNull();
  view.unmount();
});

test('没传去向时返回仍然回换蛋页（现有行为不变）', () => {
  const view = render(<EggMatchingHub {...props} />);
  openStock();
  fireEvent.click(screen.getByRole('button', { name: '‹ 返回' }));
  expect(screen.getByText('我的收集')).toBeTruthy();
  expect(screen.getByText('组内广场')).toBeTruthy();
  view.unmount();
});

test('「我的换蛋」那屏的返回不受影响，始终回换蛋页', () => {
  const onStockBack = vi.fn();
  const view = render(<EggMatchingHub {...props} onStockBack={onStockBack} />);
  fireEvent.click(screen.getByRole('button', { name: /我的换蛋/ }));
  fireEvent.click(screen.getByRole('button', { name: '‹ 返回' }));
  expect(onStockBack).not.toHaveBeenCalled();
  expect(screen.getByText('我的收集')).toBeTruthy();
  view.unmount();
});

/** 「我的」页的简化替身：把 onStockBack 接成「回到我的」。 */
function ProfileWithStockEntry() {
  const [here, setHere] = useState<'profile' | 'stock'>('profile');
  return here === 'profile'
    ? <button type="button" onClick={() => setHere('stock')}>去蛋仓（我的页入口）</button>
    : <EggMatchingHub {...props} onStockBack={() => setHere('profile')} stockBackLabel="返回我的" />;
}

test('从「我的」进蛋仓：点返回真的回到「我的」（去向由入口接管，不掉回换蛋页）', () => {
  render(<ProfileWithStockEntry />);
  fireEvent.click(screen.getByRole('button', { name: '去蛋仓（我的页入口）' }));
  // 真实链路里入口用 openStock 直达蛋仓屏；这里点页面自己的「蛋仓」按钮做等价动作
  openStock();
  expect(screen.getByRole('heading', { name: '我的蛋仓' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '‹ 返回' }));
  expect(screen.getByRole('button', { name: '去蛋仓（我的页入口）' })).toBeTruthy();
  expect(screen.queryByText('我的收集')).toBeNull();
});
