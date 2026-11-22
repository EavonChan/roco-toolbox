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
import { clearMotherPlan } from './motherPlanStore';

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
  clearMotherPlan();
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
    // 2026-11-22：母本卡与看板四列卡统一（48px 头像、10px 名字、104px 高、白底灰边、满宽融合底条）
    expect(within(list).getAllByTestId('pet-card-avatar')[0]).toHaveClass(
      'top-[18px]',
      'h-12',
      'w-12',
    );
    expect(within(list).getAllByTestId('pet-avatar')[0]).toHaveClass('h-12', 'w-12');
    expect(within(list).getAllByRole('heading', { level: 3 })[0]).toHaveClass(
      'top-[66px]',
      'text-[10px]',
      'font-bold',
    );
    expect(within(list).getAllByTestId('mother-chain-row')[0]).toHaveAttribute(
      'data-mother-status',
      'uncollected',
    );
    const firstCard = within(list).getAllByTestId('mother-chain-row')[0].querySelector('article');
    expect(firstCard).toHaveClass('bg-white', 'border-slate-200');
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
    const planRow = screen.getAllByTestId('mother-chain-row')[1];
    const planButton = within(planRow).getByTestId('mother-plan-toggle');
    fireEvent.click(planButton);
    expect(screen.queryByTestId('gap-fill-dialog')).toBeNull();
    // 计划中换成淡蓝底（2026-11-22：改成满宽融合条，底色统一 sky-50）
    expect(planRow).toHaveAttribute('data-mother-status', 'planned');
    expect(within(planRow).getByTestId('mother-plan-toggle')).toHaveClass('bg-sky-50');
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
    expect(card).toHaveAttribute('data-mother-status', 'collected');
    expect(card.querySelector('article')).toHaveClass('bg-emerald-50');
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
        'body:满身高',
        'voice:+100',
        `nature:${motherNature}`,
      ]),
    });

    expect(onOpenInventory.mock.calls[0][0].heightRange).toBeUndefined();
  });

  // 本地保留（2026-11-20）：体型按「奖牌 或 身高到顶到底」取并集，小不点档要能筛到无奖牌但身高 0% 的个体
  test('小不点档位带「零身高」并集标签', () => {
    const owned: OwnedPet[] = [
      {
        gameId: 3003,
        name: '火花',
        gender: '母',
        nature: '固执',
        voiceDb: -100,
        medalBody: '',
        heightPercent: 0,
        weightPercent: 2,
        isShiny: false,
        account: '账号甲',
      },
    ];
    const group: MotherGroup = {
      chainKey: 'egg:3003',
      eggGameId: 3003,
      collected: true,
      quality: true,
      motherClass: '小粗',
      formLabel: '火花',
      number: '005',
      eggGroups: [1],
      memberIndexes: [0],
    };
    const onOpenInventory = vi.fn();
    setMotherCriteria({ ...DEFAULT_MOTHER_CRITERIA, grades: ['小粗'] });
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

    fireEvent.click(within(screen.getByTestId('mother-chain-row')).getByRole('button'));
    expect(onOpenInventory).toHaveBeenCalledWith({
      name: '火花',
      tags: expect.arrayContaining(['body:小不点', 'body:零身高', 'voice:-100']),
    });
  });

  test('母本页提供未收集、收集中、已收集三页签', () => {
    render(
      <MotherView
        owned={[]}
        searchIndex={new Map()}
        eggGroupNames={{ 1: '怪兽组' }}
        motherGroups={groups}
        mode="perfect"
        status="collecting"
      />,
    );

    expect(screen.getByRole('button', { name: '未收集' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '收集中' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '已收集' })).toBeTruthy();
    expect(screen.getByTestId('mother-collecting-view')).toBeTruthy();
    expect(screen.queryByTestId('mother-chain-list')).toBeNull();
  });

  test('大列表首屏只渲染部分蛋组，其余按需展开', () => {
    const manyGroups: MotherGroup[] = Array.from({ length: 120 }, (_, index) => ({
      ...groups[0],
      chainKey: `egg:${index + 1}`,
      eggGameId: index + 1,
      formLabel: `批量精灵${index + 1}`,
      number: String(index + 1).padStart(3, '0'),
      eggGroups: [1 + (index % 12)],
    }));
    render(
      <MotherView
        owned={[]}
        searchIndex={new Map()}
        eggGroupNames={{ 1: '怪兽组' }}
        motherGroups={manyGroups}
        mode="perfect"
        status="missing"
      />,
    );

    expect(screen.getAllByTestId('mother-chain-row').length).toBeLessThan(60);
    const more = screen.getByRole('button', { name: /显示更多蛋组/ });
    fireEvent.click(more);
    expect(screen.getAllByTestId('mother-chain-row').length).toBeGreaterThan(60);
  });
});




