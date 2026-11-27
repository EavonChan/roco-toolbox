import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import type { WorkflowEgg } from '../../shared/eggWorkflow';
import { EggGroupLevel2 } from './EggGroupLevel2';
import { groupEggStock, type EggGroupFacts } from './eggStockGroups';

const facts: EggGroupFacts = {
  natureText: (e) => e.nature,
  isGreenNest: (e) => e.greenNest === true,
  isSelfProduced: (e) => e.provenance === 'self-bred' || e.location === 'home',
  isAnnotated: (e) => Boolean(e.nature) && ['大块头', '小不点', '满体重', '零体重'].includes(e.body) && ['+100', '-100', '婉转声', '粗嗓门'].includes(e.voice),
  isSpecial: (e) => e.kind === 'special' || e.kind === 'shiny',
};
const egg = (id: string, patch: Partial<WorkflowEgg> = {}): WorkflowEgg => ({
  id,
  accountId: 'acc',
  gameAccountKey: 'uid:1',
  eggGameId: 3049,
  nature: '平和',
  body: '大块头',
  voice: '婉转声',
  provenance: 'self-bred',
  confidence: 'system',
  kind: 'ordinary',
  status: 'available',
  listed: false,
  location: 'bag',
  lastConfirmedAt: 1,
  ...patch,
});
const name = (id: number) => (id === 3049 ? '白发懒人' : '菊花梨');

const EGGS = [
  egg('w1', { listed: true, obtainedAt: '2026-11-24T21:12:00+08:00' }),
  egg('w2', { obtainedAt: '2026-11-24T23:40:00+08:00' }),
  egg('w3', { status: 'reserved', obtainedAt: '2026-11-25T09:05:00+08:00' }),
  egg('w4', { location: 'home', claimPending: true, lastConfirmedAt: new Date('2026-11-25T08:40:00+08:00').getTime() }),
  egg('w5', { nature: '冷静', location: 'home', lastConfirmedAt: new Date('2026-11-25T10:20:00+08:00').getTime() }),
];
const group = groupEggStock(EGGS, facts)[0];

test('二级列表按性格分组：平和 ×4 / 冷静 ×1，组内按获得时间倒序', () => {
  render(<EggGroupLevel2 group={group} total={5} name={name} onPick={() => undefined} onCollapse={() => undefined} />);
  expect(screen.getByTestId('stock-group-rows')).toBeInTheDocument();
  const sections = screen.getAllByTestId('stock-group-section');
  expect(sections).toHaveLength(2);
  expect(within(sections[0]).getByTestId('stock-group-section-title')).toHaveTextContent('平和 ×4');
  expect(within(sections[1]).getByTestId('stock-group-section-title')).toHaveTextContent('冷静 ×1');
  const rows = screen.getAllByTestId('stock-group-row');
  expect(rows).toHaveLength(5);
  expect(rows.map((row) => row.getAttribute('data-egg-id'))).toEqual(['w3', 'w2', 'w1', 'w4', 'w5']);
});

test('每行带状态：已挂出 / 未挂出 / 换蛋中 / 待认领 / 在家园，点行进详情', () => {
  const onPick = vi.fn();
  render(<EggGroupLevel2 group={group} total={5} name={name} onPick={onPick} onCollapse={() => undefined} />);
  const rows = screen.getAllByTestId('stock-group-row');
  expect(within(rows[0]).getByText('换蛋中')).toBeInTheDocument();
  expect(within(rows[1]).getByText('未挂出')).toBeInTheDocument();
  expect(within(rows[2]).getByText('已挂出')).toBeInTheDocument();
  expect(within(rows[3]).getByText('待认领')).toBeInTheDocument();
  expect(within(rows[4]).getByText('在家园')).toBeInTheDocument();
  fireEvent.click(rows[1]);
  expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'w2' }));
});

test('标题摘要写全量；筛选命中少于全量时补「当前筛选」；收起按钮回调', () => {
  const onCollapse = vi.fn();
  render(<EggGroupLevel2 group={group} total={7} name={name} onPick={() => undefined} onCollapse={onCollapse} />);
  expect(screen.getByText(/共 7 颗/)).toBeInTheDocument();
  expect(screen.getByText(/当前筛选 5 颗/)).toBeInTheDocument();
  expect(screen.getByText('白发懒人 · 5 颗')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '收起' }));
  expect(onCollapse).toHaveBeenCalledTimes(1);
});
