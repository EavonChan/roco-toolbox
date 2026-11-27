import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import type { OwnedPet } from '../domain/types';
import { SimulatedBackpackView } from './SimulatedBackpack';

function pet(overrides: Partial<OwnedPet> & { name: string; account: string }): OwnedPet {
  return {
    gameId: 999999,
    gender: '母',
    nature: '开朗',
    voiceDb: 0,
    medalBody: '',
    isShiny: false,
    boxGroup: '盒子01',
    boxNumber: 1,
    slotOrder: 1,
    ...overrides,
  };
}

function renderBag(
  pets: OwnedPet[],
  accounts: string[] = ['账号甲'],
  excluded = new Set<string>(),
  hasAnyPets = true,
  standardCards = false,
) {
  render(
    <SimulatedBackpackView
      pets={pets}
      accounts={accounts}
      excludedAccounts={excluded}
      hasAnyPets={hasAnyPets}
      standardCards={standardCards}
    />,
  );
}

describe('SimulatedBackpackView（仿真背包）', () => {
  test('一页固定 6×5=30 格，按 slotOrder 落位，卡片头像 / 名字 / 性格 / 性别 / 奖牌 / dB 都有', () => {
    renderBag([
      pet({
        name: '夜枭',
        account: '账号甲',
        gender: '母',
        nature: '偏执',
        voiceDb: 100,
        medalBody: '大块头',
        weightPercent: 100,
        slotOrder: 7,
      }),
    ]);

    const grid = screen.getByTestId('sim-backpack-grid');
    expect(grid.children).toHaveLength(30);
    expect(screen.getAllByTestId('sim-backpack-empty-slot')).toHaveLength(29);

    const card = screen.getByTestId('sim-backpack-pet');
    expect(card).toHaveAttribute('data-slot', '7');
    // 卡片底色跟性别走：母 = 粉色
    expect(card.className).toContain('sim-card-female');
    expect(within(card).getByText('夜枭')).toBeInTheDocument();
    expect(within(card).getByText('偏执')).toBeInTheDocument();
    expect(within(card).getByText('100dB')).toBeInTheDocument();
    expect(within(card).getByTitle('母')).toBeInTheDocument();
    expect(within(card).getByAltText('大块头')).toBeInTheDocument();
    expect(within(card).getByAltText('婉转声')).toBeInTheDocument();
    // 头像：图鉴里没有的 gameId 也交给 PetAvatar 兜底
    expect(card.querySelector('[data-testid="pet-avatar"]')).not.toBeNull();

    // 用户口径：头像在左，性别+性格 / 奖牌 / dB 在右，名字在下方
    expect(card.children[0].className).toContain('sim-card-body');
    expect(card.children[1].className).toContain('sim-card-name');
    const [avatar, stats] = [...card.children[0].children];
    expect(avatar.className).toContain('sim-card-avatar');
    expect(stats.className).toContain('sim-card-stats');
    const statOrder = [...stats.children].map((child) => child.className);
    expect(statOrder[0]).toContain('sim-card-nature');
    expect(statOrder[1]).toContain('sim-card-medals');
    expect(statOrder[2]).toContain('sim-card-db');
  });

  test('盒子按真实序号分页，上一页 / 下一页 / 页签都能翻', () => {
    renderBag(
      [
        pet({ name: '一盒一号', account: '账号甲', boxGroup: '盒子01', boxNumber: 1, slotOrder: 1 }),
        pet({ name: '二盒二号', account: '账号甲', boxGroup: '盒子02', boxNumber: 2, slotOrder: 2 }),
      ],
      ['账号甲'],
    );

    expect(screen.getByTestId('sim-backpack-page-count')).toHaveTextContent('1/2');
    expect(screen.getByTestId('sim-backpack-pet')).toHaveTextContent('一盒一号');
    expect(screen.getByTestId('sim-backpack-prev')).toBeDisabled();

    fireEvent.click(screen.getByTestId('sim-backpack-next'));
    expect(screen.getByTestId('sim-backpack-page-count')).toHaveTextContent('2/2');
    expect(screen.getByTestId('sim-backpack-pet')).toHaveTextContent('二盒二号');
    expect(screen.getByTestId('sim-backpack-pet')).toHaveAttribute('data-slot', '2');
    expect(screen.getByTestId('sim-backpack-next')).toBeDisabled();

    fireEvent.click(screen.getByTestId('sim-backpack-page-0'));
    expect(screen.getByTestId('sim-backpack-page-count')).toHaveTextContent('1/2');
  });

  test('多账号从顶部切换，盒外精灵排在最后', () => {
    renderBag(
      [
        pet({ name: '甲精灵', account: '账号甲', boxGroup: '盒子01', boxNumber: 1, slotOrder: 1 }),
        pet({ name: '乙精灵', account: '账号乙', boxGroup: '盒子03', boxNumber: 3, slotOrder: 1 }),
        pet({ name: '甲外一', account: '账号甲', boxGroup: '盒外精灵' }),
      ],
      ['账号甲', '账号乙'],
    );

    expect(screen.getByTestId('sim-backpack-page-count')).toHaveTextContent('1/2');
    expect(screen.getByTestId('sim-backpack-page-1')).toHaveTextContent('外');

    fireEvent.click(screen.getByTestId('sim-backpack-page-1'));
    expect(screen.getByTestId('sim-backpack-pet')).toHaveTextContent('甲外一');

    fireEvent.click(screen.getByRole('button', { name: '账号乙' }));
    expect(screen.getByTestId('sim-backpack-page-count')).toHaveTextContent('1/1');
    expect(screen.getByTestId('sim-backpack-pet')).toHaveTextContent('乙精灵');
  });

  test('账号筛选会排除对应账号', () => {
    renderBag(
      [
        pet({ name: '甲精灵', account: '账号甲' }),
        pet({ name: '乙精灵', account: '账号乙' }),
      ],
      ['账号甲', '账号乙'],
      new Set(['账号甲']),
    );

    expect(screen.queryByRole('button', { name: '账号甲' })).toBeNull();
    expect(screen.getByTestId('sim-backpack-pet')).toHaveTextContent('乙精灵');
  });

  test('是整页视图：没有 dialog / 遮罩，也没有顶部返回和标题文字', () => {
    renderBag([pet({ name: '测试精灵', account: '账号甲' })]);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('sim-backpack').tagName).toBe('MAIN');
    expect(screen.queryByTestId('sim-backpack-back')).toBeNull();
    expect(screen.queryByText('仿真背包')).toBeNull();
    expect(screen.queryByText('返回')).toBeNull();
  });

  test('底部页号最多显示 10 个，随当前页滑动', () => {
    const pets = Array.from({ length: 12 }, (_, index) =>
      pet({
        name: `盒${index + 1}`,
        account: '账号甲',
        boxGroup: `盒子${String(index + 1).padStart(2, '0')}`,
        boxNumber: index + 1,
        slotOrder: 1,
      }),
    );
    renderBag(pets, ['账号甲']);

    expect(screen.getAllByTestId(/^sim-backpack-page-\d+$/)).toHaveLength(10);
    expect(screen.getByTestId('sim-backpack-page-0')).toBeInTheDocument();
    expect(screen.getByTestId('sim-backpack-page-9')).toBeInTheDocument();
    expect(screen.queryByTestId('sim-backpack-page-10')).toBeNull();

    for (let step = 0; step < 5; step += 1) {
      fireEvent.click(screen.getByTestId('sim-backpack-next'));
    }
    expect(screen.getAllByTestId(/^sim-backpack-page-\d+$/)).toHaveLength(10);
    expect(screen.queryByTestId('sim-backpack-page-0')).toBeNull();
    expect(screen.getByTestId('sim-backpack-page-2')).toBeInTheDocument();
    expect(screen.getByTestId('sim-backpack-page-10')).toBeInTheDocument();
    expect(screen.queryByTestId('sim-backpack-page-11')).toBeNull();
    expect(screen.getByTestId('sim-backpack-page-count')).toHaveTextContent('6/12');
  });

  test('真没数据 / 筛选后为空给不同空态', () => {
    renderBag([], ['账号甲'], new Set(), false);
    expect(screen.getByText('还没有导入精灵数据')).toBeInTheDocument();
  });

  test('展开筛选时用精灵背包标准卡，仍是一行六个、五行 30 格', () => {
    renderBag([pet({ name: '标准卡精灵', account: '账号甲', slotOrder: 3 })], ['账号甲'], new Set(), true, true);

    expect(screen.getByTestId('sim-standard-cards')).toBeInTheDocument();
    expect(screen.getAllByTestId('sim-standard-card')).toHaveLength(1);
    expect(screen.getAllByTestId('sim-standard-empty')).toHaveLength(29);
    expect(screen.getByText('标准卡精灵')).toBeInTheDocument();
    expect(screen.queryByTestId('sim-backpack-grid')).toBeNull();
    expect(screen.getByTestId('sim-backpack-box')).toHaveTextContent('盒子01 · 1/30');
    expect(screen.getByTestId('sim-backpack-page-count')).toHaveTextContent('1/1');
  });

  test('有数据但筛选后为空，提示筛选条件', () => {
    renderBag([], ['账号甲'], new Set(), true);
    expect(screen.getByText('没有符合筛选条件的精灵')).toBeInTheDocument();
  });
});
