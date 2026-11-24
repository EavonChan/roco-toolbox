import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { MotherGroup } from '../domain/petFilters';
import type { OwnedPet } from '../domain/types';
import { DEFAULT_MOTHER_CRITERIA } from '../domain/motherCriteria';
import { eggNatures } from '../domain/recommendedNatures';
import { species } from '../data/catalog';
import { MotherView } from './MotherView';
import { getMotherCriteria, setMotherCriteria } from './motherCriteriaStore';
import { setTargetMode } from './targetModeStore';
import { clearMotherPlan, mergeMotherPlan } from './motherPlanStore';
import { getCoverageFilter, setTargetGrade } from './coverageFilterStore';

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

  test('「计划收集」折叠区已下线，计划中的链只留在未收集清单里', () => {
    mergeMotherPlan(['egg:1', 'egg:2']);
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

    expect(screen.queryByTestId('mother-plan')).toBeNull();
    expect(screen.queryByTestId('mother-plan-row')).toBeNull();
    expect(screen.queryByTestId('mother-plan-clear-done')).toBeNull();
    const statuses = screen
      .getAllByTestId('mother-chain-row')
      .map((row) => row.getAttribute('data-mother-status'));
    expect(statuses).toContain('planned');
  });

  test('已收集分组标题只给只数，不再显示恒等于 N/N 的进度', () => {
    const nature = eggNatures(species, 3003, {})[0] ?? '固执';
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
    render(
      <MotherView
        owned={[
          {
            gameId: 3003,
            name: '火花',
            gender: '母',
            nature,
            voiceDb: 100,
            medalBody: '大块头',
            weightPercent: 100,
            isShiny: false,
            account: '账号甲',
          },
        ]}
        searchIndex={new Map()}
        eggGroupNames={{ 1: '巨灵组' }}
        motherGroups={[group]}
        mode="perfect"
        status="collected"
      />,
    );

    const section = screen.getByTestId('mother-chain-group-1');
    // 2026-11-22：已收集也用 分子/分母（分子=已收集数，分母=该蛋组精灵数）
    expect(section.textContent).toContain('已收集 1/1');
  });


/** 分母口径用的样本：一条真有推荐性格的链（3003 火花）+ 两条图鉴里没有推荐性格的链 */
const denominatorGroups: MotherGroup[] = [
  {
    chainKey: 'egg:3003',
    eggGameId: 3003,
    collected: true,
    quality: true,
    motherClass: '大婉',
    formLabel: '火花',
    number: '005',
    eggGroups: [1],
    memberIndexes: [0],
  },
  {
    chainKey: 'egg:9001',
    eggGameId: 9001,
    collected: false,
    quality: false,
    motherClass: null,
    formLabel: '无推荐甲',
    number: '901',
    eggGroups: [1],
    memberIndexes: [],
  },
  {
    chainKey: 'egg:9002',
    eggGameId: 9002,
    collected: false,
    quality: false,
    motherClass: null,
    formLabel: '无推荐乙',
    number: '902',
    eggGroups: [1],
    memberIndexes: [],
  },
];

const denominatorOwned: OwnedPet[] = [
  {
    gameId: 3003,
    name: '火花',
    gender: '母',
    nature: '固执',
    voiceDb: 100,
    medalBody: '大块头',
    weightPercent: 100,
    isShiny: false,
    account: '账号甲',
  },
];

test('没开只算推荐性格：分母是该蛋组全部精灵数，不随筛选变', () => {
  render(
    <MotherView
      owned={denominatorOwned}
      searchIndex={new Map()}
      eggGroupNames={{ 1: '巨灵组' }}
      motherGroups={denominatorGroups}
      mode="perfect"
      status="missing"
    />,
  );

  // 清单里只列未收集的 2 条，但分母是这一组全部 3 只精灵
  const section = screen.getByTestId('mother-chain-group-1');
  expect(section.textContent).toContain('已收集 1/3');
});

test('开了只算推荐性格：分母只算该蛋组内有推荐性格的精灵数', () => {
  setMotherCriteria({ ...DEFAULT_MOTHER_CRITERIA, recommendedNatures: true });
  render(
    <MotherView
      owned={denominatorOwned}
      searchIndex={new Map()}
      eggGroupNames={{ 1: '巨灵组' }}
      motherGroups={denominatorGroups}
      mode="perfect"
      status="missing"
    />,
  );

  const section = screen.getByTestId('mother-chain-group-1');
  expect(section.textContent).toContain('已收集 1/1');
});

test('开了只算推荐性格、该组没有推荐性格数据：分组头仍渲染并说明，分母不写非 0', () => {
  setMotherCriteria({ ...DEFAULT_MOTHER_CRITERIA, recommendedNatures: true });
  const noNatureGroups: MotherGroup[] = [
    {
      chainKey: 'egg:9001',
      eggGameId: 9001,
      collected: false,
      quality: false,
      motherClass: null,
      formLabel: '无推荐甲',
      number: '901',
      eggGroups: [1],
      memberIndexes: [],
    },
  ];
  render(
    <MotherView
      owned={[]}
      searchIndex={new Map()}
      eggGroupNames={{ 1: '巨灵组' }}
      motherGroups={noNatureGroups}
      mode="perfect"
      status="missing"
    />,
  );

  // 链还在清单里（不剔），只是没有推荐性格数据 → 分组头要说明，而不是被漏算
  const section = screen.getByTestId('mother-chain-group-1');
  expect(section.textContent).toContain('已收集 0/0');
  expect(section.textContent).toContain('本组暂无推荐性格数据');
  expect(section.textContent).not.toMatch(/已收集 0\/[1-9]/);
  expect(screen.getByTestId('mother-chain-row')).toBeTruthy();
});
test('已收集视图同口径：分子是已收集数，分母是该蛋组全部精灵数', () => {
  render(
    <MotherView
      owned={denominatorOwned}
      searchIndex={new Map()}
      eggGroupNames={{ 1: '巨灵组' }}
      motherGroups={denominatorGroups}
      mode="perfect"
      status="collected"
    />,
  );

  const section = screen.getByTestId('mother-chain-group-1');
  expect(section.textContent).toContain('已收集 1/3');
  expect(section.textContent).not.toContain('1 只');
});
  test('已收集空态给「清除筛选」和「去未收集挑计划」两个出口', () => {
    render(
      <MotherView
        owned={[]}
        searchIndex={new Map()}
        eggGroupNames={{ 1: '怪兽组' }}
        motherGroups={groups}
        mode="perfect"
        status="collected"
      />,
    );

    expect(screen.getByTestId('mother-chain-empty')).toBeTruthy();
    expect(screen.getByRole('button', { name: '清除筛选' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '去未收集挑计划' }));
    expect(
      screen.getByTestId('mother-chain-filter-uncollected').getAttribute('aria-pressed'),
    ).toBe('true');
  });
});

/**
 * 2026-11-22 用户口径：**判定跟所选档位走，覆盖度目标与母本判定互不影响**。
 * 母本页显示与判定必须同读母本 store；点档位不能顺手改看板 / 覆盖度的种公目标。
 */
describe('母本页奖牌显示与判定同源（R2-P1-01）', () => {
  beforeEach(() => {
    setTargetGrade('大婉');
  });

  const motherGradePressed = (grade: string) =>
    screen.getByTestId(`mother-criteria-grade-${grade}`).getAttribute('aria-pressed');

  test('显示读母本 store；点档位只写母本 store，不改覆盖度目标', () => {
    // 看板 / 覆盖度的种公目标 = 大粗，母本自己的档位 = 小粗：两处故意选不一样
    setTargetGrade('大粗');
    setMotherCriteria({ ...DEFAULT_MOTHER_CRITERIA, grades: ['小粗'] });

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

    // 高亮跟母本自己那份走，不再被看板目标顶掉
    expect(motherGradePressed('小粗')).toBe('true');
    expect(motherGradePressed('大粗')).toBe('false');

    fireEvent.click(screen.getByTestId('mother-criteria-grade-大婉'));

    expect(getMotherCriteria().grades).toEqual(['大婉']);
    expect(getCoverageFilter().grades).toEqual(['大粗']);
  });

  test('「已收集」按母本档位判定，不跟看板目标走', () => {
    // 一只大粗母本；看板目标恰好是大粗，母本档位是大婉 → 这条链不算已收集
    const owned: OwnedPet[] = [
      {
        gameId: 3003,
        name: '火花',
        gender: '母',
        nature: '固执',
        voiceDb: -100,
        medalBody: '大块头',
        weightPercent: 100,
        isShiny: false,
        account: '账号甲',
      },
    ];
    const group: MotherGroup = {
      chainKey: 'egg:3003',
      eggGameId: 3003,
      collected: false,
      quality: false,
      motherClass: null,
      formLabel: '火花',
      number: '005',
      eggGroups: [1],
      memberIndexes: [0],
    };
    setTargetGrade('大粗');
    setMotherCriteria({ ...DEFAULT_MOTHER_CRITERIA, grades: ['大婉'] });

    render(
      <MotherView
        owned={owned}
        searchIndex={new Map()}
        eggGroupNames={{ 1: '巨灵组' }}
        motherGroups={[group]}
        mode="perfect"
        status="missing"
      />,
    );

    expect(screen.getByTestId('mother-chain-summary').textContent).toContain('已收集 0');
  });
});





describe('单选账号时其他号能补的母本', () => {
  test('未收集卡显示“其他号可补”统计与角标，弹窗给出来源号', () => {
    const group: MotherGroup = {
      chainKey: 'egg:3003',
      eggGameId: 3003,
      collected: false,
      quality: false,
      motherClass: null,
      formLabel: '火花',
      number: '005',
      eggGroups: [1],
      memberIndexes: [],
    };
    const mother = {
      key: '洛丝（5号）#1',
      gameId: 3003,
      name: '火花',
      account: '洛丝（5号）',
      gender: '母' as const,
      nature: '固执',
      voiceDb: 100,
      medalBody: '大块头',
      box: '盒子1 第1位',
    };
    const father = {
      ...mother,
      key: '洛丝（5号）#2',
      gender: '公' as const,
      box: '盒子1 第2位',
    };
    const motherSuggestions = new Map([
      [
        '莱茵',
        {
          gapCount: 1,
          pairings: [],
          tasks: [
            {
              account: '莱茵',
              grade: '大婉' as const,
              eggGameId: 3003,
              eggName: '火花',
              groupIds: [1],
              recommendedNatures: ['固执'],
              sourceAccount: '洛丝（5号）',
              mother,
              father,
              natureChance: 0.6,
              femaleChance: 0.5,
              chance: 0.3,
              sameSpecies: true,
            },
          ],
          helps: [],
          lowPairings: [],
          nestsUsed: 0,
        },
      ],
    ]);

    render(
      <MotherView
        owned={[]}
        searchIndex={new Map()}
        eggGroupNames={{ 1: '巨灵组' }}
        motherGroups={[group]}
        mode="perfect"
        status="missing"
        motherSuggestions={motherSuggestions}
        accountNames={['莱茵']}
        gapTarget={{ label: '目标 满分大婉', bodyMedal: '大块头', voiceDb: 100, weightPercent: 100 }}
      />,
    );

    expect(screen.getByTestId('mother-fill-summary')).toHaveTextContent('未收集 1');
    expect(screen.getByTestId('mother-fill-summary')).toHaveTextContent('其他号可补 1');
    // 2026-11-24 用户口径：不再在右下角塞「可补 30%」，可补卡整卡浅绿，计划条保持原位
    const row = screen.getByTestId('mother-chain-row');
    expect(row).toHaveAttribute('data-mother-status', 'fillable');
    expect(row.querySelector('article')).toHaveClass('bg-emerald-50');
    expect(within(row).getByTestId('mother-plan-toggle')).toHaveTextContent('计划');
    expect(within(row).queryByTestId('mother-fill-badge')).toBeNull();

    fireEvent.click(within(row).getAllByRole('button')[0]);
    const transfer = screen.getByTestId('gap-route-transfer');
    expect(transfer).toHaveTextContent('洛丝（5号）');
    expect(transfer).toHaveTextContent('30%');
  });
});
