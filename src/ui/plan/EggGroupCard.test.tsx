import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import type { WorkflowEgg } from '../../shared/eggWorkflow';
import { EggGroupCard } from './EggGroupCard';
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
const groupOf = (eggs: WorkflowEgg[]) => groupEggStock(eggs, facts)[0];

test('主卡只有名字、×N 和两行状态，不展开性格', () => {
  const group = groupOf([
    egg('a', { listed: true }),
    egg('b'),
    egg('c', { status: 'reserved' }),
    egg('d', { location: 'home', claimPending: true }),
    egg('e', { location: 'home' }),
  ]);
  render(<EggGroupCard group={group} total={5} name={name} expanded={false} onToggle={() => undefined} />);
  const card = screen.getByTestId('stock-group-card');
  expect(card).toHaveAttribute('data-egg-count', '5');
  expect(card).toHaveAttribute('data-group-key', 'species:3049');
  expect(card).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByText('白发懒人')).toBeInTheDocument();
  expect(screen.getByText('×5')).toBeInTheDocument();
  expect(screen.getByText('1/5 已挂出')).toBeInTheDocument();
  expect(screen.getByText('1 待认领')).toBeInTheDocument();
  // 拍板：换蛋中不占卡片状态条（展开面板里看）
  expect(screen.queryByText(/换蛋中/)).toBeNull();
  // 性格 / 体型 / 声音不在主卡展开
  expect(screen.queryByText(/性格|平和|冷静/)).toBeNull();
});

test('筛选命中少于全量时写 ×命中/全量；部分自产写 自产 3/5', () => {
  const group = groupOf([
    egg('a'),
    egg('b'),
    egg('c'),
    egg('d', { provenance: 'external' }),
    egg('e', { provenance: 'external' }),
  ]);
  render(<EggGroupCard group={group} total={7} name={name} expanded={false} onToggle={() => undefined} />);
  expect(screen.getByText('×5/7')).toBeInTheDocument();
  expect(screen.getByText('自产3/5')).toBeInTheDocument();
});

test('组内任一绿窝就给绿框；点卡展开并带上 ▴', () => {
  const group = groupOf([egg('a', { greenNest: true }), egg('b')]);
  const onToggle = vi.fn();
  const { rerender } = render(<EggGroupCard group={group} total={2} name={name} expanded={false} onToggle={onToggle} />);
  expect(screen.getByTestId('stock-group-card').className).toContain('border-emerald-500');
  fireEvent.click(screen.getByTestId('stock-group-card'));
  expect(onToggle).toHaveBeenCalledTimes(1);
  rerender(<EggGroupCard group={group} total={2} name={name} expanded onToggle={onToggle} />);
  expect(screen.getByTestId('stock-group-card')).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('×2 ▴')).toBeInTheDocument();
});
