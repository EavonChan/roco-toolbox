import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import {
  type NestPairing,
  type NestPet,
  type NestPlan,
  type NestTier,
} from '../domain/nestPlan';
import { NestPlanCard } from './NestPlanCard';

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

describe('LayoutMap 摆位图（单位换算）', () => {
  test('相邻两窝在图上必须相切：1 窝 = 8 单元，不能凭空多出一倍空隙', () => {
    const a = nestPet('a', '甲兽');
    const b = nestPet('b', '乙兽');
    const plan: NestPlan = {
      account: '账号甲',
      pairings: [
        {
          tier: 'normal60',
          groupIds: [2],
          natureName: '固执',
          grade: '大婉',
          account: '账号甲',
          father: a,
          mother: b,
          academyParent: null,
          partner: b,
          natureChance: 0.6,
          distance: 8,
          fatherPosition: { x: 0, y: 0 },
          motherPosition: { x: 8, y: 0 }, // 相隔 1 窝（8 单元）
          expected: { species: '乙兽', nature: '固执', body: '大块头', voice: '100' },
          expectedValue: 1.2,
        },
      ],
      blockedLinks: [],
      slots: [
        { position: { x: 0, y: 0 }, pet: a, cluster: 0, academy: false },
        { position: { x: 8, y: 0 }, pet: b, cluster: 0, academy: false },
      ],
      nestsUsed: 2,
      nestsTotal: 11,
      clusters: [[{ x: 0, y: 0 }, { x: 8, y: 0 }]],
      unfilled: [],
      delegated: [],
      alternatives: [],
    };
    render(<NestPlanCard plans={[plan]} />);
    const rects = [...screen.getByTestId('nest-layout').querySelectorAll('rect')];
    expect(rects).toHaveLength(2);
    const side = Number(rects[0].getAttribute('width'));
    const centerX = (rect: Element): number => Number(rect.getAttribute('x')) + side / 2;
    // 真实小窝是 8×8、紧密并排可以相贴 → 图上相邻两窝中心距应等于窝边长
    expect(centerX(rects[1]) - centerX(rects[0])).toBeCloseTo(side);
    // 四周留了边距：最外圈不贴 viewBox 边缘（描边不会被裁）
    const viewBoxWidth = Number((screen.getByTestId('nest-layout').getAttribute('viewBox') ?? '').split(' ')[2]);
    expect(Number(rects[0].getAttribute('x'))).toBeGreaterThan(0);
    expect(centerX(rects[1]) + side / 2).toBeLessThan(viewBoxWidth);
  });
});

describe('LayoutMap 连线：图层 / 配色 / 公母标注', () => {
  const male = { ...nestPet('a', '甲兽'), gender: '公' as const };
  const femaleB = { ...nestPet('b', '乙兽'), gender: '母' as const };
  const femaleC = { ...nestPet('c', '丙兽'), gender: '母' as const };
  const pairingAt = (
    mother: NestPet,
    motherPosition: { x: number; y: number },
    tier: NestTier,
  ): NestPairing => ({
    tier,
    groupIds: [2],
    natureName: '固执',
    grade: '大婉',
    account: '账号甲',
    father: male,
    mother,
    academyParent: null,
    partner: male,
    natureChance: tier === 'academy' ? 1 : tier === 'normal60' ? 0.6 : 0.3,
    distance: 8,
    fatherPosition: { x: 0, y: 0 },
    motherPosition,
    expected: { species: mother.name, nature: '固执', body: '大块头', voice: '100' },
    expectedValue: 1.2,
  });
  const plan: NestPlan = {
    account: '账号甲',
    pairings: [pairingAt(femaleB, { x: 8, y: 0 }, 'normal60'), pairingAt(femaleC, { x: 0, y: 8 }, 'normal30')],
    blockedLinks: [],
    slots: [
      { position: { x: 0, y: 0 }, pet: male, cluster: 0, academy: false },
      { position: { x: 8, y: 0 }, pet: femaleB, cluster: 0, academy: false },
      { position: { x: 0, y: 8 }, pet: femaleC, cluster: 0, academy: false },
    ],
    nestsUsed: 3,
    nestsTotal: 11,
    clusters: [[{ x: 0, y: 0 }, { x: 8, y: 0 }, { x: 0, y: 8 }]],
    unfilled: [],
    delegated: [],
    alternatives: [],
  };

  test('连线画在窝块之后 → 不会被方块盖住', () => {
    render(<NestPlanCard plans={[plan]} />);
    const tags = [...screen.getByTestId('nest-layout').children].map((el) => el.tagName);
    const lastRect = tags.lastIndexOf('rect');
    const firstLine = tags.indexOf('line');
    expect(lastRect).toBeGreaterThanOrEqual(0);
    expect(firstLine).toBeGreaterThan(lastRect);
  });

  test('不同配对用不同颜色的线；下面的卡片用同色区分', () => {
    render(<NestPlanCard plans={[plan]} />);
    const lines = [...screen.getByTestId('nest-layout').querySelectorAll('line')];
    expect(lines).toHaveLength(2);
    expect(new Set(lines.map((line) => line.getAttribute('stroke'))).size).toBe(2);
    const cards = screen.getAllByTestId('breed-suggestion');
    expect(cards).toHaveLength(2);
    expect(new Set(cards.map((card) => (card as HTMLElement).style.borderLeftColor)).size).toBe(2);
  });

  test('摆位图里名字下面标出公母', () => {
    render(<NestPlanCard plans={[plan]} />);
    const svg = screen.getByTestId('nest-layout');
    expect(svg.textContent).toContain('♂');
    expect(svg.textContent).toContain('♀');
  });

  test('窝里的名字截到 4 个字，形态名（下划线后）先去掉', () => {
    const mother = { ...nestPet('m', '母方兽'), gender: '母' as const };
    const formed = { ...nestPet('f', '鸭吉吉_起来鸭'), gender: '公' as const };
    render(
      <NestPlanCard
        plans={[
          planOf([pairingOf(mother, formed)], [
            { position: { x: 0, y: 0 }, pet: mother, cluster: 0, academy: false },
            { position: { x: 8, y: 0 }, pet: formed, cluster: 0, academy: false },
          ]),
        ]}
      />,
    );
    const svg = screen.getByTestId('nest-layout');
    expect(svg.textContent).toContain('鸭吉吉');
    expect(svg.textContent).not.toContain('起来鸭');
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
    render(
      <NestPlanCard
        plans={[planOf([pairingOf(female('a', '母方兽'), father), pairingOf(female('b', '母方兽'), father)])]}
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

    const rows = screen.getAllByTestId('breed-suggestion');
    expect(rows).toHaveLength(3);
    // 绿窝 100% 性格 × 50% 出公 = 50%固执公；普通窝 60% / 30% 各再乘 50%
    expect(rows[0]).toHaveTextContent('50%固执♂');
    expect(rows[1]).toHaveTextContent('30%急躁♂');
    expect(rows[2]).toHaveTextContent('15%平和♂');
    for (const row of rows) {
      expect(row).not.toHaveTextContent('普通');
      expect(row).not.toHaveTextContent('学院小窝');
    }
  });
});

describe('NestPlanCard 补全计划（2026-11-18）', () => {
  const female = (key: string, name: string): NestPet => ({ ...nestPet(key, name), gender: '母' });
  const male = (key: string, name: string): NestPet => ({ ...nestPet(key, name), gender: '公' });
  const mother = female('m1', '母方兽');
  const father = male('f1', '种公兽');

  test('卡片头只写概率 + 蛋组：单组用原色，双组两个组都用双组紫', () => {
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
    const dualHead = within(rows[0]).getByTestId('pairing-head');
    const dualChips = within(dualHead).getAllByTestId('pairing-group-chip');
    expect(dualChips).toHaveLength(2);
    for (const chip of dualChips) expect(chip.className).toContain('text-violet-700');
    // 不再出现「双组 / 单组 / 补 / 种公」这些字
    expect(dualHead).not.toHaveTextContent('双组');
    expect(dualHead).not.toHaveTextContent('单组');
    expect(dualHead).not.toHaveTextContent('补');
    expect(dualHead).not.toHaveTextContent('种公');

    const singleHead = within(rows[1]).getByTestId('pairing-head');
    const singleChips = within(singleHead).getAllByTestId('pairing-group-chip');
    expect(singleChips).toHaveLength(1);
    expect(singleChips[0].className).toContain('text-slate-600');
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

  test('没有人能出窝时也把缺口列出来（不是一句「没有方案」）', () => {
    const plan: NestPlan = {
      ...planOf([]),
      unfilled: [{ groupId: 3, natureName: '认真', grade: '大婉', reason: 'has-mother' }],
    };
    render(<NestPlanCard plans={[plan]} />);
    expect(screen.getByTestId('breed-unfilled')).toHaveTextContent('缺带这个性格的公');
  });

  test('多账号用滑条切换；写清这格由谁出蛋、蛋传给谁', () => {
    const breeder = { ...planOf([pairingOf(mother, father)]), account: '账号甲' };
    const receiver = {
      ...planOf([]),
      account: '账号乙',
      delegated: [
        { groupId: 2, natureName: '固执', grade: '大婉' as const, byAccount: '账号甲' },
      ],
    };
    render(<NestPlanCard plans={[breeder, receiver]} />);

    expect(screen.getByTestId('breed-account-tabs')).toBeTruthy();
    // 默认显示有配对的号，并写明这颗蛋还有谁在等
    expect(screen.getByTestId('breed-account-name')).toHaveTextContent('账号甲');
    expect(screen.getByTestId('breed-receivers')).toHaveTextContent('账号乙');

    // 切到没配对的号：显示「由 账号甲 出蛋，孵好传过来」
    fireEvent.click(screen.getAllByTestId('breed-account-tab')[1]);
    expect(screen.getByTestId('breed-account-name')).toHaveTextContent('账号乙');
    expect(screen.getByTestId('breed-delegated')).toHaveTextContent('由 账号甲 出蛋');
  });

  test('账号标题写本号还差几个种公目标（按号各算）', () => {
    const plan = { ...planOf([pairingOf(mother, father)]), account: '账号甲' };
    render(
      <NestPlanCard plans={[plan]} gapsByAccount={new Map([['账号甲', 4]])} />,
    );
    expect(screen.getByTestId('breed-account-name')).toHaveTextContent('差 4 个种公目标');
  });

  test('缺口带原因：「这个组没有能出公的母方」', () => {
    const plan: NestPlan = {
      ...planOf([pairingOf(mother, father)]),
      unfilled: [{ groupId: 10, natureName: '认真', grade: '大婉', reason: 'male-scarce' }],
    };
    render(<NestPlanCard plans={[plan]} />);
    const gaps = screen.getByTestId('breed-unfilled');
    expect(gaps).toHaveTextContent('软体组');
    expect(gaps).toHaveTextContent('这个组没有能出公的母方');
  });
});

describe('NestPlanCard 跨号补种公', () => {
  test('有补种公任务时，即使没有能排的方案也展示；可以移除', () => {
    const removed: string[] = [];
    render(
      <NestPlanCard
        plans={[planOf([])]}
        transferTasks={[
          {
            id: 'task-1',
            createdAt: 1,
            targetAccount: '主号',
            sourceAccount: '小号A',
            eggGameId: 101,
            motherGameId: 101,
            motherName: '火花',
            motherNature: '固执',
            fatherGameId: 102,
            fatherName: '火神',
            fatherNature: '固执',
            natureName: '固执',
            grade: '大婉',
            groupIds: [2],
            chance: 0.6,
          },
        ]}
        onRemoveTransferTask={(id) => removed.push(id)}
      />,
    );
    expect(screen.getByTestId('breed-transfer-tasks')).toHaveTextContent('跨号补缺（种公 / 母本）');
    expect(screen.getByTestId('breed-transfer-task')).toHaveTextContent('主号');
    expect(screen.getByTestId('breed-transfer-task')).toHaveTextContent('小号A');
    expect(screen.getByTestId('breed-transfer-task')).toHaveTextContent('巨灵组·固执');
    fireEvent.click(screen.getByTestId('breed-transfer-remove'));
    expect(removed).toEqual(['task-1']);
  });
});

test('母本配窝：每条线写概率+性格+性别，跨号任务同样', () => {
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
          nestsUsed: 2,
        },
      ],
    ]);
    render(<NestPlanCard plans={[plan]} motherSuggestions={motherSuggestions} />);
    expect(screen.getByTestId('mother-nest')).toHaveTextContent('母本配窝');
    // 2026-11-18：母本线写「概率+性格+性别」= 出母 50% × 性格 30%；不再标双收 / 占窝 / 期望
    const motherPairing = screen.getByTestId('mother-pairing');
    expect(motherPairing).toHaveTextContent('15%踏实♀');
    expect(motherPairing).not.toHaveTextContent('推荐性格');
    expect(motherPairing).not.toHaveTextContent('同种 · 双收');
    expect(within(motherPairing).getByText('98dB')).toBeInTheDocument();
    expect(motherPairing).not.toHaveTextContent('母本 +');
    expect(motherPairing).not.toHaveTextContent('种公 +');
    expect(motherPairing).not.toHaveTextContent('占 2 个窝');
    expect(motherPairing).not.toHaveTextContent('期望');
    expect(screen.getByTestId('mother-task')).toHaveTextContent('6%踏实♀');
    // 谁传给谁放在两张精灵卡下方正中
    expect(screen.getByTestId('mother-task-flow')).toHaveTextContent('账号乙 → 账号甲');
    // 母本线也画进摆位图（黄线图例）
    expect(screen.getByTestId('nest-layout')).toBeInTheDocument();
    expect(screen.getByText(/黄线 = 母本配窝/)).toBeInTheDocument();
    // 本号内的母本线要占窝：种公 0 + 母本 2 = 2/11
    expect(screen.getByTestId('breed-account-name')).toHaveTextContent('用 2/11 个窝');
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
