import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { MotherGroup } from '../domain/petFilters';
import type { OwnedPet } from '../domain/types';
import { DEFAULT_MOTHER_CRITERIA } from '../domain/motherCriteria';
import { eggNatures } from '../domain/recommendedNatures';
import { species } from '../data/catalog';
import { MotherView } from './MotherView';
import { setMotherCriteria } from './motherCriteriaStore';
import { setTargetMode } from './targetModeStore';

const groups: MotherGroup[] = [1, 2, 3, 4].map((id) => ({
  chainKey: `egg:${id}`,
  eggGameId: id,
  collected: false,
  quality: false,
  motherClass: null,
  formLabel: `测试精灵${id}`,
  number: String(id).padStart(3, '0'),
  eggGroups: [1],
  memberIndexes: [],
}));

beforeEach(() => {
  setMotherCriteria({ ...DEFAULT_MOTHER_CRITERIA });
  setTargetMode('perfect');
});

describe('MotherView', () => {
  test('移除母本条件摘要区，未收集精灵以四列头像卡片显示', () => {
    render(
      <MotherView
        owned={[]}
        searchIndex={new Map()}
        eggGroupNames={{ 1: '怪兽组' }}
        motherGroups={groups}
        mode="perfect"
        status="missing"
      />,
    );

    expect(screen.queryByText('我的母本达标条件')).toBeNull();
    expect(screen.queryByText('影响范围')).toBeNull();
    expect(screen.getByTestId('mother-criteria-combinations')).toHaveClass('grid-cols-4');
    const list = screen.getByTestId('mother-chain-group-list-1');
    expect(list).toHaveClass('grid-cols-4');
    expect(within(list).getAllByTestId('mother-chain-row')).toHaveLength(4);
    expect(within(list).getAllByTestId('pet-avatar')).toHaveLength(4);
    expect(within(list).getAllByTestId('pet-card-avatar')[0]).toHaveClass(
      'top-[9px]',
      'h-[62px]',
      'w-[62px]',
    );
    expect(within(list).getAllByTestId('pet-avatar')[0]).toHaveClass('h-[62px]', 'w-[62px]');
    expect(within(list).getAllByRole('heading', { level: 3 })[0]).toHaveClass(
      'top-[72px]',
      'text-[12px]',
      'font-medium',
    );
    expect(within(list).getAllByTestId('mother-card-natures')[0]).toHaveClass('flex-col');
    expect(within(list).getAllByTestId('mother-card-egg-groups')[0]).toHaveClass('flex-col');
  });

  test('未收集卡点开「怎么补」悬浮窗；点底部计划按钮不打开悬浮窗', () => {
    render(
      <MotherView
        owned={[]}
        searchIndex={new Map()}
        eggGroupNames={{ 1: '怪兽组' }}
        motherGroups={groups}
        mode="perfect"
        status="missing"
        motherSuggestions={new Map()}
        accountNames={['昭昭']}
        gapTarget={{ label: '目标 大块头 · 婉转声', bodyMedal: '大块头', voiceDb: 100, weightPercent: 100 }}
      />,
    );

    const rows = screen.getAllByTestId('mother-chain-row');
    // 行内有两个可点元素：整张卡（怎么补）和底部「计划」按钮，这里点卡本身
    fireEvent.click(within(rows[0]).getAllByRole('button')[0]);
    expect(screen.getByRole('dialog', { name: '怎么补' })).toBeTruthy();
    expect(screen.getByTestId('gap-fill-eyebrow').textContent).toBe('母本缺口 · 怎么补');
    expect(screen.getByTestId('gap-unpairable').textContent).toContain('本号、跨号都无法配对');

    fireEvent.click(screen.getByTestId('gap-fill-close'));
    expect(screen.queryByTestId('gap-fill-dialog')).toBeNull();

    // 计划按钮只切计划，不打开悬浮窗
    const planButton = within(screen.getAllByTestId('mother-chain-row')[1]).getByTestId('mother-plan-toggle');
    fireEvent.click(planButton);
    expect(screen.queryByTestId('gap-fill-dialog')).toBeNull();
  });

  test('已收集卡片只显示「查看」，按达标母本给性格上色，点击查看带齐背包筛选', () => {
    const recommended = eggNatures(species, 3003, {});
    const motherNature = recommended[0] ?? '固执';
    const owned: OwnedPet[] = [
      {
        gameId: 3003,
        name: '火花',
        gender: '母',
        nature: motherNature,
        voiceDb: 100,
        medalBody: '大块头',
        weightPercent: 100,
        isShiny: false,
        account: '账号甲',
      },
    ];
    const group: MotherGroup = {
      chainKey: 'egg:3003',
      eggGameId: 3003,
      collected: true,
      quality: true,
      motherClass: '大婉',
      formLabel: '火花',
      number: '005',
      eggGroups: [1],
      memberIndexes: [0],
    };
    const onOpenInventory = vi.fn();
    render(
      <MotherView
        owned={owned}
        searchIndex={new Map()}
        eggGroupNames={{ 1: '巨灵组' }}
        motherGroups={[group]}
        mode="perfect"
        status="collected"
        onOpenInventory={onOpenInventory}
      />,
    );

    const card = screen.getByTestId('mother-chain-row');
    const open = within(card).getByTestId('mother-chain-open');
    expect(open).toHaveTextContent('查看');
    expect(open).not.toHaveTextContent('只');
    expect(within(card).queryByText(/只/)).toBeNull();
    const natures = within(card).getByTestId('mother-card-natures');
    expect(within(natures).getByText(motherNature)).toHaveClass('bg-emerald-100');
    const other = recommended.find((nature) => nature !== motherNature);
    if (other) expect(within(natures).getByText(other)).toHaveClass('bg-slate-100');

    fireEvent.click(open);
    expect(onOpenInventory).toHaveBeenCalledWith({
      name: '火花',
      tags: expect.arrayContaining([
        'gender:母',
        'body:大块头',
        'voice:+100',
        `nature:${motherNature}`,
      ]),
      heightRange: { min: 100, max: 100 },
    });
  });
});
