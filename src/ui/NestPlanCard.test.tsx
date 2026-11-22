import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  type NestPairing,
  type NestPet,
  type NestPlan,
  type NestTier,
} from '../domain/nestPlan';
import type { MotherNestPairing } from '../domain/motherNest';
import { NestPlanCard } from './NestPlanCard';

/** 勾选占窝会写 localStorage：每个用例从 0 开始，避免串味 */
beforeEach(() => {
  localStorage.clear();
});

const nestPet = (key: string, name: string): NestPet => ({
  key,
  gameId: 3001,
  name,
  account: '账号甲',
  gender: '公',
  nature: '固执',
  voiceDb: 100,
  medalBody: '大块头',
  box: '盒子1 第1位',
});

/** 手写一条配对（不经算法）：验卡片/摆位图的呈现规则时用 */
const pairingOf = (
  mother: NestPet,
  father: NestPet,
  over: Partial<NestPairing> = {},
): NestPairing => {
  const tier = over.tier ?? 'normal60';
  const groupIds = over.groupIds ?? [2];
  const natureChance =
    over.natureChance ?? (tier === 'academy' ? 1 : tier === 'normal60' ? 0.6 : 0.3);
  return {
    tier,
    groupIds,
    natureName: '固执',
    grade: '大婉',
    account: '账号甲',
    father,
    mother,
    academyParent: null,
    partner: father,
    natureChance,
    distance: 8,
    fatherPosition: { x: 8, y: 0 },
    motherPosition: { x: 0, y: 0 },
    expected: { species: mother.name, nature: '固执', body: '大块头', voice: '100' },
    expectedValue: natureChance * groupIds.length,
    ...over,
  };
};

/** 手写一份方案 */
const planOf = (pairings: NestPairing[], slots: NestPlan['slots'] = []): NestPlan => ({
  account: '账号甲',
  pairings,
  blockedLinks: [],
  slots,
  nestsUsed: slots.length,
  nestsTotal: 11,
  clusters: [slots.map((slot) => slot.position)],
  unfilled: [],
  delegated: [],
  alternatives: [],
});

describe('配对卡片颜色 / 位置', () => {
  const male = { ...nestPet('a', '甲兽'), gender: '公' as const };
  const otherMale = { ...nestPet('a2', '甲兽'), gender: '公' as const };
  const femaleB = { ...nestPet('b', '乙兽'), gender: '母' as const };
  const femaleC = { ...nestPet('c', '丙兽'), gender: '母' as const };
  const pairingAt = (
    mother: NestPet,
    motherPosition: { x: number; y: number },
    tier: NestTier,
    father: NestPet = male,
  ): NestPairing => ({
    tier,
    groupIds: [2],
    natureName: '固执',
    grade: '大婉',
    account: '账号甲',
    father,
    mother,
    academyParent: null,
    partner: father,
    natureChance: tier === 'academy' ? 1 : tier === 'normal60' ? 0.6 : 0.3,
    distance: 8,
    fatherPosition: { x: 0, y: 0 },
    motherPosition,
    expected: { species: mother.name, nature: '固执', body: '大块头', voice: '100' },
    expectedValue: 1.2,
  });
  const plan = planOf([
    pairingAt(femaleB, { x: 8, y: 0 }, 'normal60'),
    pairingAt(femaleC, { x: 0, y: 8 }, 'normal30', otherMale),
  ]);

  test('不同配对卡片用不同颜色区分', () => {
    render(<NestPlanCard plans={[plan]} />);
    // 一条 60%（高概率）、一条 30%（低概率）：颜色在两张卡之间也要区分开
    const highCards = screen.getAllByTestId('breed-suggestion');
    fireEvent.click(screen.getByTestId('stud-tab-low'));
    const cards = [...highCards, ...screen.getAllByTestId('breed-suggestion')];
    expect(cards).toHaveLength(2);
    expect(new Set(cards.map((card) => (card as HTMLElement).style.borderLeftColor)).size).toBe(2);
  });

  test('卡片里不再重复账号（账号已在分组标题），只写位置', () => {
    render(<NestPlanCard plans={[plan]} />);
    const cards = screen.getAllByTestId('breed-suggestion');
    expect(cards[0]).toHaveTextContent('盒子1 第1位');
    expect(cards[0]).not.toHaveTextContent('账号甲');
  });
});
describe('NestPlanCard（配窝建议的行合并规则）', () => {
  const male = (key: string, name: string): NestPet => ({ ...nestPet(key, name), gender: '公' });
  const female = (key: string, name: string): NestPet => ({ ...nestPet(key, name), gender: '母' });

  test('同名同性格的两只母本各占一行（按个体 key，不按名字合并）', () => {
    const father = male('f', '种公兽');
    const otherFather = male('f2', '种公兽');
    render(
      <NestPlanCard
        plans={[
          planOf([
            pairingOf(female('a', '母方兽'), father),
            pairingOf(female('b', '母方兽'), otherFather),
          ]),
        ]}
      />,
    );
    expect(screen.getAllByTestId('breed-suggestion')).toHaveLength(2);
  });

  test('学院那只挂 2 个配对方时合并成一行', () => {
    const academy = male('ac', '鸭吉吉');
    const academyPairing = (partner: NestPet, natureName: string): NestPairing =>
      pairingOf(partner, academy, {
        tier: 'academy',
        academyParent: academy,
        partner,
        natureName,
        natureChance: 1,
      });
    render(
      <NestPlanCard
        plans={[planOf([academyPairing(female('p1', '粉星仔'), '固执'), academyPairing(female('p2', '水滴蛇'), '认真')])]}
      />,
    );
    const rows = screen.getAllByTestId('breed-suggestion');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('粉星仔');
    expect(rows[0]).toHaveTextContent('水滴蛇');
    // 学院小窝那只必须用绿边框（2026-11-19 用户反馈）
    const cards = within(rows[0]).getAllByTestId('breed-pet-card');
    expect(cards[0].className).toContain('border-emerald-500');
    expect(cards[1].className).not.toContain('border-emerald-500');
  });

  test('同一对精灵补两个性格时合并成一行，两个性格都列出来', () => {
    const mother = female('m', '噼啪鸟');
    const father = male('f', '粉星仔');
    render(
      <NestPlanCard
        plans={[
          planOf([
            pairingOf(mother, father, { tier: 'normal30', natureName: '平和', natureChance: 0.3 }),
            pairingOf(mother, father, { tier: 'normal30', natureName: '开朗', natureChance: 0.3 }),
          ]),
        ]}
      />,
    );
    // 两条都是 30%（实际 15%），在「低概率」分组里
    fireEvent.click(screen.getByTestId('stud-tab-low'));
    const rows = screen.getAllByTestId('breed-suggestion');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('平和');
    expect(rows[0]).toHaveTextContent('开朗');
  });

  test('同一对精灵补两个性格（各 30%）→ 每个性格单独写「15%平和公」', () => {
    const mother = female('m', '噼啪鸟');
    const father = male('f', '粉星仔');
    render(
      <NestPlanCard
        plans={[
          planOf([
            pairingOf(mother, father, { tier: 'normal30', natureName: '平和', natureChance: 0.3 }),
            pairingOf(mother, father, { tier: 'normal30', natureName: '急躁', natureChance: 0.3 }),
          ]),
        ]}
      />,
    );
    fireEvent.click(screen.getByTestId('stud-tab-low'));
    const row = screen.getAllByTestId('breed-suggestion')[0];
    // 30% 性格 × 50% 出公 = 15% 拿到这个性格的公（性别用图标）
    expect(row).toHaveTextContent('15%平和♂');
    expect(row).toHaveTextContent('15%急躁♂');
    // 档位标签与拆开的「性格 / 出公」不再出现（2026-11-18）
    expect(row).not.toHaveTextContent('普通');
    expect(row).not.toHaveTextContent('性格 ');
    expect(row).not.toHaveTextContent('出公 ');
  });

  test('同一对精灵对不同性格分别是 60% / 30%：概率按性格各算，不按档位一刀切', () => {
    const mother = female('m', '噼啪鸟');
    const father = male('f', '粉星仔');
    render(
      <NestPlanCard
        plans={[
          planOf([
            pairingOf(mother, father, { tier: 'normal60', natureName: '固执', natureChance: 0.6 }),
            pairingOf(mother, father, { tier: 'normal30', natureName: '开朗', natureChance: 0.3 }),
          ]),
        ]}
      />,
    );
    const row = screen.getAllByTestId('breed-suggestion')[0];
    expect(row).toHaveTextContent('30%固执♂');
    expect(row).toHaveTextContent('15%开朗♂');
  });

  test('建议按「产出目标性格的概率」从高到低排：学院 50% → 普通 30% → 普通 15%', () => {
    const single = female('s', '三成母');
    const singleFather = male('sf', '三成公');
    const duo = female('d', '六成母');
    const duoFather = male('df', '六成公');
    const academy = male('ac', '金冠公');
    const academyPartner = female('ap', '配对母');

    render(
      <NestPlanCard
        plans={[
          planOf([
            // 故意倒着放，验证展示时会被重排
            pairingOf(single, singleFather, { tier: 'normal30', natureName: '平和', natureChance: 0.3 }),
            pairingOf(duo, duoFather, { tier: 'normal60', natureName: '急躁', natureChance: 0.6 }),
            pairingOf(academyPartner, academy, {
              tier: 'academy',
              academyParent: academy,
              partner: academyPartner,
              natureName: '固执',
              natureChance: 1,
            }),
          ]),
        ]}
      />,
    );

    // 高概率：学院 50% → 普通 60%（实际 30%）
    expect(screen.getByTestId('stud-tab-high')).toHaveTextContent('配窝建议2');
    expect(screen.getByTestId('stud-tab-low')).toHaveTextContent('低概率1');
    const highRows = screen.getAllByTestId('breed-suggestion');
    expect(highRows).toHaveLength(2);
    expect(highRows[0]).toHaveTextContent('50%固执♂');
    expect(highRows[1]).toHaveTextContent('30%急躁♂');
    // 低概率：普通 30%（实际 15%）
    fireEvent.click(screen.getByTestId('stud-tab-low'));
    const lowRows = screen.getAllByTestId('breed-suggestion');
    expect(lowRows).toHaveLength(1);
    expect(lowRows[0]).toHaveTextContent('15%平和♂');
    for (const row of [...highRows, ...lowRows]) {
      expect(row).not.toHaveTextContent('普通');
      expect(row).not.toHaveTextContent('学院小窝');
    }
  });
});

describe('共用种公（2026-11-20 用户口径：像家园一样并成一张卡）', () => {
  const male = (key: string, name: string, box: string): NestPet => ({
    ...nestPet(key, name),
    gender: '公',
    box,
  });
  const female = (key: string, name: string, box: string): NestPet => ({
    ...nestPet(key, name),
    gender: '母',
    box,
  });
  const stud = male('stud', '蒲公英', '盒子01 第30位');
  const motherA = female('ma', '蒲公英', '盒子13 第24位');
  const motherB = female('mb', '海枝枝', '盒子10 第9位');

  test('同一只种公配两只母本：并成一张卡，勾一次占三个窝', () => {
    render(
      <NestPlanCard
        plans={[
          planOf([
            pairingOf(motherA, stud, { natureName: '聪明' }),
            pairingOf(motherB, stud, { natureName: '聪明' }),
          ]),
        ]}
      />,
    );

    const cards = screen.getAllByTestId('breed-suggestion');
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveAttribute('data-layout', 'shared-stud');
    expect(cards[0]).toHaveTextContent('共用种公');
    expect(cards[0]).toHaveTextContent('1 只 · 配 2 只母本');
    // 种公只画一次，两只母本都在
    expect(within(cards[0]).getByText('盒子01 第30位')).toBeTruthy();
    expect(within(cards[0]).getByText('盒子13 第24位')).toBeTruthy();
    expect(within(cards[0]).getByText('盒子10 第9位')).toBeTruthy();
    expect(screen.getByTestId('stud-tab-high')).toHaveTextContent('配窝建议1');

    // 一窝一只精灵：公 + 两只母 = 三个窝，一次勾上
    fireEvent.click(within(cards[0]).getByTestId('nest-pick'));
    expect(screen.getByTestId('breed-account-name')).toHaveTextContent('用 3/11 个窝');

    // 再点一次整组取消
    fireEvent.click(within(cards[0]).getByTestId('nest-pick'));
    expect(screen.getByTestId('breed-account-name')).toHaveTextContent('用 0/11 个窝');
  });

  test('低概率的母本共用高概率的种公：一起并进高概率卡，低概率里不再单独出现', () => {
    render(
      <NestPlanCard
        plans={[
          planOf([
            pairingOf(motherA, stud, { tier: 'normal60', natureName: '聪明', natureChance: 0.6 }),
            pairingOf(motherB, stud, { tier: 'normal30', natureName: '聪明', natureChance: 0.3 }),
          ]),
        ]}
      />,
    );

    // 一张「共用种公」卡：60% 的母本把共用的低概率母本带上
    expect(screen.getByTestId('stud-tab-high')).toHaveTextContent('配窝建议1');
    expect(screen.getByTestId('stud-tab-low')).toHaveTextContent('低概率0');
    const cards = screen.getAllByTestId('breed-suggestion');
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveAttribute('data-layout', 'shared-stud');
    expect(within(cards[0]).getByText('盒子13 第24位')).toBeTruthy();
    expect(within(cards[0]).getByText('盒子10 第9位')).toBeTruthy();
    // 两个母本各写自己的概率（高的 30%、低的 15%）
    expect(cards[0]).toHaveTextContent('30%聪明♂');
    expect(cards[0]).toHaveTextContent('15%聪明♂');

    // 低概率页签里不再重复这张卡
    fireEvent.click(screen.getByTestId('stud-tab-low'));
    expect(screen.getByTestId('stud-empty')).toHaveTextContent('没有低概率种公配对');
  });

  test('同名但不同个体的种公不合并（卡片仍按个体区分）', () => {
    const otherStud = male('stud2', '蒲公英', '盒子01 第28位');
    render(
      <NestPlanCard
        plans={[
          planOf([
            pairingOf(motherA, stud, { natureName: '聪明' }),
            pairingOf(motherB, otherStud, { natureName: '聪明' }),
          ]),
        ]}
      />,
    );
    const cards = screen.getAllByTestId('breed-suggestion');
    expect(cards).toHaveLength(2);
    expect(cards.some((card) => card.getAttribute('data-layout') === 'shared-stud')).toBe(false);
    expect(screen.getByTestId('stud-tab-high')).toHaveTextContent('配窝建议2');
  });

  test('学院 1:2 的三只卡保持原样，不跟同公的普通卡混成一张', () => {
    const academy = male('ac', '鸭吉吉', '学院窝');
    const academyMother = female('am', '粉星仔', '盒子02 第1位');
    const normalMother = female('nm', '水滴蛇', '盒子03 第2位');
    const academyPairing = (partner: NestPet): NestPairing =>
      pairingOf(partner, academy, {
        tier: 'academy',
        academyParent: academy,
        partner,
        natureName: '固执',
        natureChance: 1,
      });
    render(
      <NestPlanCard
        plans={[
          planOf([
            academyPairing(academyMother),
            academyPairing(female('am2', '豆丁鱼', '盒子04 第3位')),
            pairingOf(normalMother, academy, { natureName: '聪明' }),
          ]),
        ]}
      />,
    );
    const cards = screen.getAllByTestId('breed-suggestion');
    expect(cards).toHaveLength(2);
    for (const card of cards) expect(card).not.toHaveAttribute('data-layout', 'shared-stud');
  });
});

describe('NestPlanCard 配窝建议（2026-11-18）', () => {
  const female = (key: string, name: string): NestPet => ({ ...nestPet(key, name), gender: '母' });
  const male = (key: string, name: string): NestPet => ({ ...nestPet(key, name), gender: '公' });
  const mother = female('m1', '母方兽');
  const father = male('f1', '种公兽');

  test('卡片头只写概率 + 性格，不再写蛋组（2026-11-19）', () => {
    render(
      <NestPlanCard
        plans={[
          planOf([
            pairingOf(mother, father, { groupIds: [2, 7] }),
            pairingOf(male('m2', '母方兽'), male('f2', '种公兽'), {
              groupIds: [8],
              natureName: '开朗',
            }),
          ]),
        ]}
      />,
    );
    const rows = screen.getAllByTestId('breed-suggestion');
    for (const row of rows) {
      const head = within(row).getByTestId('pairing-head');
      // 蛋组只在下面两张精灵卡里出现，卡头不再重复
      expect(within(head).queryAllByTestId('pairing-group-chip')).toHaveLength(0);
      expect(head).not.toHaveTextContent('组');
      expect(head).not.toHaveTextContent('双组');
      expect(head).not.toHaveTextContent('单组');
      expect(head).not.toHaveTextContent('补');
      expect(head).not.toHaveTextContent('种公');
    }
  });

  test('卡片不再标期望补格数（2026-11-18 用户口径）', () => {
    render(
      <NestPlanCard plans={[planOf([pairingOf(mother, father, { expectedValue: 2.4 })])]} />,
    );
    expect(screen.getByTestId('breed-suggestion')).not.toHaveTextContent('期望');
  });

  test('组别后面写公母平均声音，向下取整（97 / 100 → 98dB）', () => {
    const mother = { ...female('m', '母方兽'), voiceDb: 97 };
    const father = male('f', '种公兽');
    render(<NestPlanCard plans={[planOf([pairingOf(mother, father)])]} />);
    const head = within(screen.getByTestId('breed-suggestion')).getByTestId('pairing-head');
    expect(head).toHaveTextContent('98dB');
    expect(head).not.toHaveTextContent('99dB');
  });

  test('一条配窝 = 两张精灵背包卡，卡里有分贝 / 身高 / 体重', () => {
    const mother = { ...nestPet('m1', '母兽'), gender: '母' as const };
    const father = { ...nestPet('f1', '公兽'), heightPercent: 80, weightPercent: 40 };
    render(<NestPlanCard plans={[planOf([pairingOf(mother, father)])]} />);

    const cards = screen.getAllByTestId('breed-pet-card');
    expect(cards).toHaveLength(2);
    expect(cards[1]).toHaveTextContent('100dB');
    expect(cards[1]).toHaveTextContent('高80%');
    expect(cards[1]).toHaveTextContent('重40%');
  });

  test('卡片压成 86px 紧凑版：盒子位置在卡底，不再写编号', () => {
    const mother = { ...nestPet('m1', '母兽'), gender: '母' as const, box: '盒子8 第5位' };
    const father = { ...nestPet('f1', '公兽'), box: '盒子3 第1位' };
    render(<NestPlanCard plans={[planOf([pairingOf(mother, father)])]} />);

    const cards = screen.getAllByTestId('breed-pet-card');
    for (const card of cards) expect(card.className).toContain('h-[86px]');
    expect(cards[0]).toHaveTextContent('盒子8 第5位');
    expect(cards[1]).toHaveTextContent('盒子3 第1位');
    expect(cards[0]).not.toHaveTextContent('No.');
  });

  test('配窝卡保留完整形态名，长名字自动缩小字号', () => {
    const mother = { ...nestPet('m1', '蹦蹦种子_海神球形态'), gender: '母' as const };
    const father = { ...nestPet('f1', '公兽'), gender: '公' as const };
    render(<NestPlanCard plans={[planOf([pairingOf(mother, father)])]} />);

    const cards = screen.getAllByTestId('breed-pet-card');
    expect(cards[0]).toHaveTextContent('蹦蹦种子_海神球形态');
    expect(cards[0].querySelector('h4')?.className).toContain('text-[9px]');
    expect(cards[1]).toHaveTextContent('公兽');
    expect(cards[1].querySelector('h4')?.className).toContain('text-[11px]');
  });

  test('本号已收齐的蛋组标绿，没收齐的保持蓝色', () => {
    const mother = { ...nestPet('m1', '母兽'), gender: '母' as const };
    const father = { ...nestPet('f1', '公兽') };
    render(
      <NestPlanCard
        plans={[planOf([pairingOf(mother, father)])]}
        collectedGroupIdsByAccount={new Map([['账号甲', new Set([6])]])}
      />,
    );

    const firstCard = screen.getAllByTestId('breed-pet-card')[0];
    // 猫系测试精灵在动物组(6) + 拟人组(9)：6 已收齐 → 绿，9 还是缺口 → 原蓝色
    expect(firstCard.querySelector('[title="动物组（已收齐）"]')).not.toBeNull();
    expect(firstCard.querySelector('[title="拟人组"]')).not.toBeNull();
  });

  test('缺口清单与跨号兜底清单不再出现在配窝卡里（2026-11-19 用户口径）', () => {
    const plan: NestPlan = {
      ...planOf([]),
      unfilled: [{ groupId: 3, natureName: '认真', grade: '大婉', reason: 'has-mother' }],
      delegated: [
        { groupId: 2, natureName: '固执', grade: '大婉' as const, byAccount: '账号乙' },
      ],
    };
    render(<NestPlanCard plans={[plan]} />);
    expect(screen.queryByTestId('breed-unfilled')).toBeNull();
    expect(screen.queryByTestId('breed-delegated')).toBeNull();
    expect(screen.queryByText('缺带这个性格的公')).toBeNull();
    expect(screen.queryByText('由 账号乙 出蛋，孵好传过来')).toBeNull();
  });
  test('多账号用滑条切换；账号 tab 写勾选的「窝」且默认 0', () => {
    const breeder = { ...planOf([pairingOf(mother, father)]), account: '账号甲', nestsUsed: 2 };
    const receiver = {
      ...planOf([]),
      account: '账号乙',
      nestsUsed: 0,
      delegated: [
        { groupId: 2, natureName: '固执', grade: '大婉' as const, byAccount: '账号甲' },
      ],
    };
    render(
      <NestPlanCard
        plans={[breeder, receiver]}
        studRecommendationsByAccount={
          new Map([
            [
              '账号乙',
              [
                {
                  id: '3003|固执|大婉|2',
                  natureName: '固执',
                  displayName: '固执鸟',
                  groupIds: [2],
                  groupLabels: ['天空组'],
                  grade: '大婉' as const,
                  gameId: 3003,
                },
              ],
            ],
          ])
        }
      />,
    );

    expect(screen.getByTestId('breed-account-tabs')).toBeTruthy();
    const tabs = screen.getAllByTestId('breed-account-tab');
    // 2026-11-20：方案不再自动算窝数，默认是 0
    expect(tabs[0]).toHaveTextContent('账号甲0 窝');
    expect(tabs[1]).toHaveTextContent('账号乙待补');

    // 默认显示有配对的号，并写明这颗蛋还有谁在等
    expect(screen.getByTestId('breed-account-name')).toHaveTextContent('账号甲');
    expect(screen.getByTestId('breed-account-name')).toHaveTextContent('用 0/11 个窝');
    expect(screen.getByTestId('breed-receivers')).toHaveTextContent('账号乙');

    // 勾当前号的一对卡 = 母 + 公两个窝，只加这个号
    fireEvent.click(within(screen.getByTestId('breed-suggestion')).getByTestId('nest-pick'));
    expect(screen.getByTestId('breed-account-name')).toHaveTextContent('用 2/11 个窝');
    expect(screen.getAllByTestId('breed-account-tab')[0]).toHaveTextContent('2 窝');
    expect(screen.getAllByTestId('breed-account-tab')[1]).toHaveTextContent('待补');

    fireEvent.click(screen.getAllByTestId('breed-account-tab')[1]);
    expect(screen.getByTestId('breed-account-name')).toHaveTextContent('账号乙');
  });



  test('账号格按账号名排序，名字里的数字按数值', () => {
    const planFor = (account: string) => {
      const motherOf = { ...nestPet(`m-${account}`, '甲兽'), gender: '母' as const, account };
      const fatherOf = { ...nestPet(`f-${account}`, '乙兽'), account };
      return { ...planOf([pairingOf(motherOf, fatherOf)]), account };
    };
    render(<NestPlanCard plans={['账号10', '账号2', '大号'].map(planFor)} />);
    expect(screen.getAllByTestId('breed-account-tab').map((tab) => tab.textContent)).toEqual([
      '大号0 窝',
      '账号20 窝',
      '账号100 窝',
    ]);
  });

  test('种公都收齐的号也留在账号格：不写「全齐」，点开写都收齐了', () => {
    const worker = { ...planOf([pairingOf(mother, father)]), account: '账号10' };
    const full = { ...planOf([]), account: '账号2' };
    render(
      <NestPlanCard
        plans={[worker, full]}
        gapsByAccount={
          new Map([
            ['账号10', 5],
            ['账号2', 0],
          ])
        }
        studCompleteAccounts={new Set(['账号2'])}
      />,
    );

    expect(screen.getAllByTestId('breed-account-tab').map((tab) => tab.textContent)).toEqual([
      '账号20 窝',
      '账号100 窝',
    ]);
    // 默认仍看有内容的号，全齐号不抢默认选中
    expect(screen.getByTestId('breed-account-name')).toHaveTextContent('账号10');

    fireEvent.click(screen.getAllByTestId('breed-account-tab')[0]);
    expect(screen.getByTestId('breed-account-name')).toHaveTextContent('账号2');
    expect(screen.getByTestId('breed-account-name')).toHaveTextContent('种公都收齐了');
    expect(screen.getByTestId('breed-idle')).toHaveTextContent('本号种公都收齐了');
  });

  test('全齐号替别的号出蛋：配对卡写「全齐号 → 缺的号」', () => {
    const mother2 = { ...nestPet('m2', '甲兽'), gender: '母' as const, account: '账号2' };
    const father2 = { ...nestPet('f2', '乙兽'), account: '账号2' };
    const supplier = { ...planOf([pairingOf(mother2, father2)]), account: '账号2' };
    const receiver = {
      ...planOf([]),
      account: '账号10',
      delegated: [
        { groupId: 2, natureName: '固执', grade: '大婉' as const, byAccount: '账号2' },
      ],
    };
    render(
      <NestPlanCard
        plans={[supplier, receiver]}
        gapsByAccount={
          new Map([
            ['账号2', 0],
            ['账号10', 3],
          ])
        }
        studCompleteAccounts={new Set(['账号2'])}
      />,
    );

    fireEvent.click(screen.getAllByTestId('breed-account-tab')[0]);
    expect(screen.getByTestId('breed-account-name')).toHaveTextContent('可帮 1 个号补种公');
    expect(screen.getByTestId('breed-receivers')).toHaveTextContent('账号2 → 账号10');
  });


  test('账号 tab 只报勾选的窝数：方案本身占 11 个窝也默认 0', () => {
    const a = { ...planOf([pairingOf(mother, father)]), account: '账号甲', nestsUsed: 11 };
    const b = { ...planOf([pairingOf(mother, father)]), account: '账号乙', nestsUsed: 2 };
    render(<NestPlanCard plans={[a, b]} />);

    const tabs = screen.getAllByTestId('breed-account-tab');
    expect(tabs[0]).toHaveTextContent('0 窝');
    expect(tabs[1]).toHaveTextContent('0 窝');
    expect(tabs[0]).not.toHaveTextContent('对');
    // 勾一对（母 + 公）才 +2，且写的是「窝」不是「对」
    fireEvent.click(within(screen.getByTestId('breed-suggestion')).getByTestId('nest-pick'));
    expect(screen.getAllByTestId('breed-account-tab')[0]).toHaveTextContent('2 窝');
    expect(screen.getAllByTestId('breed-account-tab')[0]).not.toHaveTextContent('对');
  });

  test('账号标题写本号还差几个种公目标（按号各算）', () => {
    const plan = { ...planOf([pairingOf(mother, father)]), account: '账号甲' };
    render(
      <NestPlanCard plans={[plan]} gapsByAccount={new Map([['账号甲', 4]])} />,
    );
    expect(screen.getByTestId('breed-account-name')).toHaveTextContent('差 4 个种公目标');
  });

});

test('母本配窝：按出蛋的号分组，本号内线写概率+性格+性别，跨号线写传给谁', () => {
    const mother = { ...nestPet('m', '喵喵'), gender: '母' as const, nature: '开朗', voiceDb: 97 };
    const father = { ...nestPet('f', '喵喵'), gender: '公' as const, nature: '踏实' };
    const studMother = { ...nestPet('sm', '火豆丁'), gender: '母' as const };
    const studFather = { ...nestPet('sf', '火花'), gender: '公' as const };
    const plan = planOf([pairingOf(studMother, studFather)], []);
    const motherSuggestions = new Map([
      [
        '账号甲',
        {
          gapCount: 1,
          pairings: [
            {
              account: '账号甲',
              grade: '大婉' as const,
              eggGameId: 3001,
              eggName: '喵喵',
              groupIds: [6, 9],
              recommendedNatures: ['踏实'],
              mother,
              father,
              natureChance: 0.3,
              femaleChance: 0.5,
              motherGain: 0.15,
              studGain: 0.6,
              expectedValue: 0.75,
              sameSpecies: true,
              nestsNeeded: 2,
            },
          ],
          tasks: [
            {
              account: '账号甲',
              grade: '大婉' as const,
              eggGameId: 3001,
              eggName: '喵喵',
              groupIds: [6, 9],
              recommendedNatures: ['踏实'],
              sourceAccount: '账号乙',
              mother: { ...mother, account: '账号乙' },
              father: { ...father, account: '账号乙' },
              natureChance: 0.3,
              femaleChance: 0.2,
              chance: 0.06,
              sameSpecies: true,
            },
          ],
          helps: [],
          nestsUsed: 2,
        },
      ],
    ]);
    render(<NestPlanCard plans={[plan]} motherSuggestions={motherSuggestions} />);
    // 2026-11-20：账号下方的「母本配窝」标题已移除，直接进分组横条
    expect(screen.getByTestId('mother-nest')).toBeTruthy();
    expect(screen.getByTestId('mother-nest')).not.toHaveTextContent('母本配窝');
    // 2026-11-18：母本线写「概率+性格+性别」= 出母 50% × 性格 30%；不再标双收 / 占窝 / 期望
    const motherPairing = screen.getByTestId('mother-pairing');
    expect(motherPairing).toHaveTextContent('15%踏实♀');
    // 2026-11-20：卡头只按推荐性格写，不再混双亲自己的性格
    expect(motherPairing).not.toHaveTextContent('15%开朗♀');
    expect(motherPairing).not.toHaveTextContent('推荐性格');
    expect(motherPairing).not.toHaveTextContent('同种 · 双收');
    expect(within(motherPairing).getByText('98dB')).toBeInTheDocument();
    expect(motherPairing).not.toHaveTextContent('母本 +');
    expect(motherPairing).not.toHaveTextContent('种公 +');
    expect(motherPairing).not.toHaveTextContent('占 2 个窝');
    expect(motherPairing).not.toHaveTextContent('期望');
    // 2026-11-20：窝数不自动算，默认 0；勾一张母本卡 = 母 + 公两个窝
    expect(screen.getByTestId('breed-account-name')).toHaveTextContent('用 0/11 个窝');
    fireEvent.click(within(motherPairing).getByTestId('nest-pick'));
    expect(screen.getByTestId('breed-account-name')).toHaveTextContent('用 2/11 个窝');
    fireEvent.click(within(motherPairing).getByTestId('nest-pick'));
    expect(screen.getByTestId('breed-account-name')).toHaveTextContent('用 0/11 个窝');
    // 2026-11-20：跨号任务归到出蛋的号（账号乙）下面，不混在本号内线里
    expect(screen.queryByTestId('mother-task')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /账号乙/ }));
    expect(screen.getByTestId('mother-task')).toHaveTextContent('6%踏实♀');
    expect(screen.getByTestId('mother-task')).not.toHaveTextContent('6%开朗♀');
    // 2026-11-19：卡头去掉「跨号 · 传蛋」和蛋组，只留性格 / 百分比 / 性别
    const taskHead = screen.getByTestId('mother-task-head');
    expect(taskHead).not.toHaveTextContent('跨号');
    expect(taskHead).not.toHaveTextContent('动物组');
    expect(within(motherPairing).getByTestId('mother-pairing-head')).not.toHaveTextContent('动物组');
    // 谁传给谁：在出蛋号的卡片底部写目标号
    expect(screen.getByTestId('mother-task-flow')).toHaveTextContent('传给 账号甲');
    // 2026-11-19：摆位图已移除，不再画母本黄线
    expect(screen.queryByTestId('nest-layout')).toBeNull();
});

/** 造一张只有跨号母本任务的方案，专门验卡头性格过滤 */
const renderMotherTask = (motherNature: string, fatherNature: string): void => {
  const mother = { ...nestPet('m', '喵喵'), gender: '母' as const, nature: motherNature };
  const father = { ...nestPet('f', '喵喵'), gender: '公' as const, nature: fatherNature };
  const motherSuggestions = new Map([
    [
      '账号甲',
      {
        gapCount: 1,
        pairings: [],
        tasks: [
          {
            account: '账号甲',
            grade: '大婉' as const,
            eggGameId: 3001,
            eggName: '喵喵',
            groupIds: [6],
            recommendedNatures: [],
            sourceAccount: '账号乙',
            mother: { ...mother, account: '账号乙' },
            father: { ...father, account: '账号乙' },
            natureChance: 1,
            femaleChance: 0.5,
            chance: 0.5,
            sameSpecies: false,
          },
        ],
        helps: [],
        nestsUsed: 0,
      },
    ],
  ]);
  render(<NestPlanCard plans={[planOf([])]} motherSuggestions={motherSuggestions} />);
};


test('只有双方都是非八大性格时，卡头才写非八大性格', () => {
  renderMotherTask('调皮', '偏执');
  const head = screen.getByTestId('mother-task-head');
  expect(head).toHaveTextContent('15%调皮♀');
  expect(head).toHaveTextContent('15%偏执♀');
  // 「加入传蛋待办」按钮已按用户口径移除
  expect(screen.queryByTestId('mother-task-add')).toBeNull();
});

test('一方是八大性格时，不展示另一方的非八大性格', () => {
  renderMotherTask('开朗', '偏执');
  const head = screen.getByTestId('mother-task-head');
  expect(head).toHaveTextContent('15%开朗♀');
  expect(head).not.toHaveTextContent('偏执');
});

test('公退到非八大时才标「非八大公」，八大公不标（2026-11-19 用户口径）', () => {
  renderMotherTask('开朗', '忧郁');
  expect(screen.getByTestId('mother-task-head')).toHaveTextContent('非八大公');
});

test('公是八大性格时不写「非八大公」', () => {
  renderMotherTask('开朗', '固执');
  expect(screen.queryByTestId('mother-non-eight-stud')).toBeNull();
});

test('每条内求线右下角都是「小组求助」，和流转/本号文字同一行，点了回调（2026-11-20 用户口径）', () => {
  const onSeekHelp = vi.fn();
  const mother = { ...nestPet('m', '喵喵'), gender: '母' as const, nature: '开朗' };
  const father = { ...nestPet('f', '喵喵'), gender: '公' as const, nature: '踏实' };
  const motherSuggestions = new Map([
    [
      '账号甲',
      {
        gapCount: 2,
        pairings: [
          {
            account: '账号甲',
            grade: '大婉' as const,
            eggGameId: 3001,
            eggName: '喵喵',
            groupIds: [6],
            recommendedNatures: ['踏实'],
            mother,
            father,
            natureChance: 0.6,
            femaleChance: 0.5,
            motherGain: 0.3,
            studGain: 0,
            expectedValue: 0.3,
            sameSpecies: true,
            nestsNeeded: 2,
          },
        ],
        tasks: [
          {
            account: '账号甲',
            grade: '大婉' as const,
            eggGameId: 3002,
            eggName: '火苗',
            groupIds: [12],
            recommendedNatures: ['固执'],
            sourceAccount: '账号乙',
            mother: { ...mother, account: '账号乙' },
            father: { ...father, account: '账号乙' },
            natureChance: 0.6,
            femaleChance: 0.5,
            chance: 0.3,
            sameSpecies: false,
          },
        ],
        helps: [],
        nestsUsed: 2,
      },
    ],
  ]);
  render(
    <NestPlanCard plans={[planOf([])]} motherSuggestions={motherSuggestions} onSeekHelp={onSeekHelp} />,
  );
  // 默认在出蛋号账号甲：本号内线一个按钮，和「本号自己配」同一行
  let buttons = screen.getAllByTestId('mother-seek-help');
  expect(buttons).toHaveLength(1);
  expect(buttons[0]).toHaveTextContent('小组求助');
  expect(screen.getByTestId('mother-pairing-action').parentElement).toContainElement(buttons[0]);
  fireEvent.click(buttons[0]);
  expect(onSeekHelp).toHaveBeenCalledTimes(1);

  // 切到账号乙：跨号线一个按钮，和「传给 账号甲」同一行
  fireEvent.click(screen.getByRole('button', { name: /账号乙/ }));
  buttons = screen.getAllByTestId('mother-seek-help');
  expect(buttons).toHaveLength(1);
  expect(buttons[0]).toHaveTextContent('小组求助');
  expect(screen.getByTestId('mother-task-flow').parentElement).toContainElement(buttons[0]);
});

test('未收集的母本不进「低概率」：低概率只放本号已有母本的线', () => {
  const motherSuggestions = new Map([
    [
      '账号甲',
      {
        gapCount: 1,
        pairings: [],
        tasks: [],
        helps: [
          {
            eggGameId: 3001,
            eggName: '喵喵',
            groupIds: [6, 9],
            recommendedNatures: ['踏实'],
            bestNatureChance: 0.6,
            femaleChance: 0.5,
          },
        ],
        nestsUsed: 0,
      },
    ],
  ]);
  render(
    <NestPlanCard
      plans={[planOf([])]}
      motherSuggestions={motherSuggestions}
      onSeekHelp={vi.fn()}
    />,
  );
  // 未收集母本只算缺口，不进低概率；页签仍然在，方便去「缺口」看
  expect(screen.getByTestId('mother-tab-low')).toHaveTextContent('低概率0');
  fireEvent.click(screen.getByTestId('mother-tab-low'));
  expect(screen.queryByTestId('mother-help')).toBeNull();
  expect(screen.getByTestId('mother-low')).toHaveTextContent('没有低概率配窝');
});

test('本号已有母本、出母只有 20% 的线并进「低概率」，不再单开牢五门（2026-11-20 用户口径）', () => {
  const mother = { ...nestPet('sm', '阿米亚特'), gender: '母' as const, nature: '固执' };
  const father = { ...nestPet('sf', '阿米亚特'), gender: '公' as const, nature: '固执' };
  const motherSuggestions = new Map([
    [
      '账号甲',
      {
        gapCount: 1,
        pairings: [],
        tasks: [],
        helps: [
          {
            eggGameId: 3001,
            eggName: '阿米亚特',
            groupIds: [2, 11],
            recommendedNatures: ['固执'],
            bestNatureChance: 0.6,
            femaleChance: 0.2,
            mother,
            father,
          },
        ],
        nestsUsed: 0,
      },
    ],
  ]);
  render(<NestPlanCard plans={[planOf([])]} motherSuggestions={motherSuggestions} />);
  expect(screen.queryByTestId('mother-tab-scarce')).toBeNull();
  expect(screen.getByTestId('mother-tab-low')).toHaveTextContent('低概率1');
  fireEvent.click(screen.getByTestId('mother-tab-low'));
  const card = within(screen.getByTestId('mother-low')).getByTestId('mother-help');
  expect(card).toHaveTextContent('阿米亚特');
  // 12% = 推荐性格 60% × 出母 20%，不再另写一串「出母 20% · 到手 12%」
  expect(card).toHaveTextContent('12%固执');
  expect(card).not.toHaveTextContent('未收集');
});

test('本号有这只母本：求助卡用真实母本 + 配对种公，不换成小组求助卡（2026-11-20）', () => {
  const mother = { ...nestPet('hm', '阿米亚特'), gender: '母' as const, nature: '固执' };
  const father = { ...nestPet('hf', '阿米亚特'), gender: '公' as const, nature: '固执' };
  const motherSuggestions = new Map([
    [
      '账号甲',
      {
        gapCount: 1,
        pairings: [],
        tasks: [],
        helps: [
          {
            eggGameId: 3001,
            eggName: '阿米亚特',
            groupIds: [2, 11],
            recommendedNatures: ['固执'],
            bestNatureChance: 0.3,
            femaleChance: 0.2,
            mother,
            father,
          },
        ],
        nestsUsed: 0,
      },
    ],
  ]);
  render(<NestPlanCard plans={[planOf([])]} motherSuggestions={motherSuggestions} />);
  fireEvent.click(screen.getByTestId('mother-tab-low'));
  const card = screen.getByTestId('mother-help');
  expect(card).toHaveTextContent('阿米亚特');
  expect(within(card).getAllByTestId('breed-pet-card')).toHaveLength(2);
  expect(screen.queryByTestId('mother-help-action-card')).toBeNull();
});

test('本号已有母本、出母 100% 但推荐性格只有 30% 的蛋也在「低概率」横条', () => {
  const mother = { ...nestPet('dm', '大耳帽兜'), gender: '母' as const, nature: '平和' };
  const father = { ...nestPet('df', '大耳帽兜'), gender: '公' as const, nature: '踏实' };
  const motherSuggestions = new Map([
    [
      '账号甲',
      {
        gapCount: 1,
        pairings: [],
        tasks: [],
        helps: [
          {
            eggGameId: 3001,
            eggName: '大耳帽兜',
            groupIds: [7, 9],
            recommendedNatures: ['平和', '踏实'],
            bestNatureChance: 0.3,
            femaleChance: 1,
            mother,
            father,
          },
        ],
        nestsUsed: 0,
      },
    ],
  ]);
  render(<NestPlanCard plans={[planOf([])]} motherSuggestions={motherSuggestions} />);
  expect(screen.queryByTestId('mother-tab-scarce')).toBeNull();
  fireEvent.click(screen.getByTestId('mother-tab-low'));
  const card = within(screen.getByTestId('mother-low')).getByTestId('mother-help');
  expect(card).toHaveTextContent('30%平和');
  expect(within(card).queryByTestId('mother-female-rate')).toBeNull();
});

test('同一源号同一颗蛋只出一张卡：留最高概率的一对，目标号合并（2026-11-20）', () => {
  const mother = { ...nestPet('m', '喵喵'), gender: '母' as const, nature: '开朗' };
  const fatherA = { ...nestPet('fa', '公A'), gender: '公' as const, nature: '踏实' };
  const fatherB = { ...nestPet('fb', '公B'), gender: '公' as const, nature: '踏实' };
  const taskOf = (father: NestPet, chance: number) => ({
    account: '账号甲',
    grade: '大婉' as const,
    eggGameId: 3001,
    eggName: '喵喵',
    groupIds: [6],
    recommendedNatures: ['踏实'],
    sourceAccount: '账号乙',
    mother,
    father,
    natureChance: chance,
    femaleChance: 1,
    chance,
    sameSpecies: false,
  });
  const motherSuggestions = new Map([
    [
      '账号甲',
      {
        gapCount: 1,
        pairings: [],
        tasks: [taskOf(fatherA, 0.6), taskOf(fatherB, 0.48)],
        helps: [],
        nestsUsed: 0,
      },
    ],
  ]);
  render(<NestPlanCard plans={[planOf([])]} motherSuggestions={motherSuggestions} />);
  // 默认切到出蛋号账号乙：同一颗蛋只有一张卡，且是概率更高的公A
  const cards = screen.getAllByTestId('mother-task');
  expect(cards).toHaveLength(1);
  expect(cards[0]).toHaveTextContent('公A');
  expect(cards[0]).not.toHaveTextContent('公B');
  expect(screen.getByTestId('mother-task-flow')).toHaveTextContent('传给 账号甲');
  expect(screen.getByTestId('breed-account-name')).toHaveTextContent('账号乙');
});

describe('NestPlanCard 空方案提示', () => {
  test('页面给了提示语时用页面文案（目标全收齐不再让用户去覆盖度找缺口）', () => {
    render(<NestPlanCard plans={[planOf([])]} emptyNote="种公目标已全部收集，不用再配窝" />);
    expect(screen.getByTestId('breed-empty')).toHaveTextContent('种公目标已全部收集');
  });

  test('没给提示语时保留原来的排查提示', () => {
    render(<NestPlanCard plans={[planOf([])]} />);
    expect(screen.getByTestId('breed-empty')).toHaveTextContent('先到「覆盖度」');
  });
});

describe('NestPlanCard section 联动（2026-11-20 用户口径）', () => {
  const motherPet = { ...nestPet('m', '喵喵'), gender: '母' as const, nature: '开朗', voiceDb: 97 };
  const fatherPet = { ...nestPet('f', '喵喵'), gender: '公' as const, nature: '踏实' };
  const studMother = { ...nestPet('sm', '火豆丁'), gender: '母' as const };
  const studFather = { ...nestPet('sf', '火花'), gender: '公' as const };
  const plan = planOf([pairingOf(studMother, studFather)]);
  const motherSuggestions = new Map([
    [
      '账号甲',
      {
        gapCount: 1,
        pairings: [
          {
            account: '账号甲',
            grade: '大婉' as const,
            eggGameId: 3001,
            eggName: '喵喵',
            groupIds: [6],
            recommendedNatures: ['踏实'],
            mother: motherPet,
            father: fatherPet,
            natureChance: 0.3,
            femaleChance: 0.5,
            motherGain: 0.15,
            studGain: 0.6,
            expectedValue: 0.75,
            sameSpecies: true,
            nestsNeeded: 2,
          },
        ],
        tasks: [],
        helps: [],
        nestsUsed: 2,
      },
    ],
  ]);

  test('section="studs"：只显示种公配对，隐藏母本配窝', () => {
    render(<NestPlanCard plans={[plan]} motherSuggestions={motherSuggestions} section="studs" />);
    expect(screen.getAllByTestId('breed-suggestion').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('mother-nest')).toBeNull();
  });

  test('section="mothers"：只显示母本配窝，隐藏种公配对', () => {
    render(<NestPlanCard plans={[plan]} motherSuggestions={motherSuggestions} section="mothers" />);
    expect(screen.getByTestId('mother-nest')).toBeTruthy();
    expect(screen.queryByTestId('breed-list')).toBeNull();
  });

  test('勾选存本地：去别的页面再回来，窝数还在', () => {
    const props = { plans: [plan], motherSuggestions, section: 'studs' as const };
    const { unmount } = render(<NestPlanCard {...props} />);
    fireEvent.click(within(screen.getByTestId('breed-suggestion')).getByTestId('nest-pick'));
    expect(screen.getByTestId('breed-account-name')).toHaveTextContent('用 2/11 个窝');

    unmount();
    render(<NestPlanCard {...props} />);
    expect(screen.getByTestId('breed-account-name')).toHaveTextContent('用 2/11 个窝');
  });

  test('种公卡和母本卡共用同一份窝数（勾过的切换分区不丢）', () => {
    const { rerender } = render(
      <NestPlanCard plans={[plan]} motherSuggestions={motherSuggestions} section="studs" />,
    );
    fireEvent.click(within(screen.getByTestId('breed-suggestion')).getByTestId('nest-pick'));
    expect(screen.getByTestId('breed-account-name')).toHaveTextContent('用 2/11 个窝');

    rerender(<NestPlanCard plans={[plan]} motherSuggestions={motherSuggestions} section="mothers" />);
    expect(screen.getByTestId('breed-account-name')).toHaveTextContent('用 2/11 个窝');
    fireEvent.click(within(screen.getByTestId('mother-pairing')).getByTestId('nest-pick'));
    expect(screen.getByTestId('breed-account-name')).toHaveTextContent('用 4/11 个窝');
  });

  test('同一只精灵被两张卡勾选时只占一个窝', () => {
    const motherA = { ...nestPet('ma', '喵喵'), gender: '母' as const };
    const motherB = { ...nestPet('mb', '喵喵'), gender: '母' as const };
    const sharedFather = { ...nestPet('ff', '喵喵'), gender: '公' as const };
    const pairing = (mother: NestPet): MotherNestPairing => ({
      account: '账号甲',
      grade: '大婉',
      eggGameId: 3001,
      eggName: '喵喵',
      groupIds: [6],
      recommendedNatures: ['踏实'],
      mother,
      father: sharedFather,
      natureChance: 0.3,
      femaleChance: 0.5,
      motherGain: 0.15,
      studGain: 0.6,
      expectedValue: 0.75,
      sameSpecies: true,
      nestsNeeded: 2,
    });
    const suggestions = new Map([
      [
        '账号甲',
        {
          gapCount: 2,
          pairings: [pairing(motherA), pairing(motherB)],
          tasks: [],
          helps: [],
          nestsUsed: 4,
        },
      ],
    ]);
    render(
      <NestPlanCard plans={[planOf([])]} motherSuggestions={suggestions} section="mothers" />,
    );

    const picks = screen.getAllByTestId('nest-pick');
    fireEvent.click(picks[0]);
    expect(screen.getByTestId('breed-account-name')).toHaveTextContent('用 2/11 个窝');
    // 第二张卡的母本不同、公是同一只：只再占一个窝，不是两个
    fireEvent.click(picks[1]);
    expect(screen.getByTestId('breed-account-name')).toHaveTextContent('用 3/11 个窝');
  });

  test('section="studs"：只有母本建议、没有种公方案的号不进滑条', () => {
    // plan 没有任何种公配对 / 缺口 / 等蛋 → 种公视角下没有可显示的号
    render(
      <NestPlanCard
        plans={[planOf([])]}
        motherSuggestions={motherSuggestions}
        section="studs"
        emptyNote="没有能自己孵的方案"
      />,
    );
    expect(screen.getByTestId('breed-empty')).toHaveTextContent('没有能自己孵的方案');
  });

});
