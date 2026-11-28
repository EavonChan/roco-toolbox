import { render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import type { HomePair, HomeResident, OwnedPet } from '../domain/types';
import { HomePairCards } from './HomePairCards';

const owned = (over: Partial<OwnedPet> & Pick<OwnedPet, 'name' | 'gender' | 'gameId'>): OwnedPet => ({
  nature: '固执',
  voiceDb: 100,
  medalBody: '大块头',
  weightPercent: 99,
  heightPercent: 100,
  isShiny: false,
  account: '测试甲',
  ...over,
});

const resident = (
  over: Partial<HomeResident> & Pick<HomeResident, 'actorId' | 'name' | 'gender'>,
): HomeResident => ({
  instanceId: `ins_${over.actorId}`,
  baseId: '3001',
  furnitureGuid: 'nest_1',
  ...over,
});

describe('家园配窝卡片（一个窝一只精灵）', () => {
  test('学院 1:2 = 一公两母三个窝、一张卡；公本只出现一次', () => {
    const residents = [
      resident({ actorId: 'f1', name: '喵喵', gender: '母', nature: '胆小' }),
      resident({ actorId: 'f2', name: '喵喵', gender: '母', nature: '开朗' }),
      resident({ actorId: 'm1', name: '火花', gender: '公', nature: '固执', nest: {
        furnitureGuid: 'nest_m1', configId: 1001072, nestType: 'academy', nestName: '学院小窝',
      } }),
    ];
    const pets = new Map<string, OwnedPet>([
      ['ins_f1', owned({ gameId: 3001, name: '喵喵', gender: '母', nature: '胆小', voiceDb: 97 })],
      ['ins_f2', owned({ gameId: 3001, name: '喵喵', gender: '母', nature: '开朗' })],
      ['ins_m1', owned({ gameId: 3003, name: '火花', gender: '公', nature: '固执' })],
    ]);
    const couples: HomePair[] = [
      { femaleActorId: 'f1', maleActorIds: ['m1'] },
      { femaleActorId: 'f2', maleActorIds: ['m1'] },
    ];

    render(<HomePairCards couples={couples} residents={residents} pets={pets} />);
    const cards = screen.getAllByTestId('home-pair-card');
    expect(cards).toHaveLength(1);
    // 三个窝：两母 + 一公，三只横排一行（2026-11-22 用户口径）
    const row = within(cards[0]).getByTestId('home-pair-triple');
    expect(row.children).toHaveLength(3);
    const petsInRow = within(cards[0]).getAllByTestId('breed-pet-card');
    expect(petsInRow).toHaveLength(3);
    expect(petsInRow[0].className).toContain('bg-pink-50');
    expect(petsInRow[1].className).toContain('bg-pink-50');
    expect(petsInRow[2].className).toContain('bg-sky-50');
    // 学院 100%：卡头和第二个母本上方各一枚
    // 声音按每个母本自己那一行算（f1 97 → 98dB，f2 100 → 100dB），不能把两位母本混成同一份
    const heads = [
      within(cards[0]).getByTestId('home-pair-head'),
      within(cards[0]).getByTestId('home-pair-head-extra'),
    ];
    expect(heads[0]).toHaveTextContent('100%固执');
    expect(heads[0]).toHaveTextContent('98dB');
    expect(heads[1]).toHaveTextContent('100%固执');
    expect(heads[1]).toHaveTextContent('100dB');
    expect(within(cards[0]).getAllByTestId('home-pair-nature')).toHaveLength(2);
    // 学院那只（公）绿框
    expect(petsInRow[2].className).toContain('border-emerald-500');
  });

  test('1 公 2 母中只有一只母本缺失时，只隐藏这一只的概率和声音', () => {
    const residents = [
      resident({ actorId: 'f1', name: '缺失喵', gender: '母', nature: '胆小' }),
      resident({ actorId: 'f2', name: '喵喵', gender: '母', nature: '开朗' }),
      resident({ actorId: 'm1', name: '火花', gender: '公', nature: '固执' }),
    ];
    const pets = new Map<string, OwnedPet>([
      ['ins_f2', owned({ gameId: 3001, name: '喵喵', gender: '母', nature: '开朗', voiceDb: 100 })],
      ['ins_m1', owned({ gameId: 3003, name: '火花', gender: '公', nature: '固执', voiceDb: 100 })],
    ]);

    render(
      <HomePairCards
        couples={[
          { femaleActorId: 'f1', maleActorIds: ['m1'] },
          { femaleActorId: 'f2', maleActorIds: ['m1'] },
        ]}
        residents={residents}
        pets={pets}
      />,
    );

    const card = screen.getByTestId('home-pair-card');
    expect(within(card).queryByTestId('home-pair-released')).toBeNull();
    expect(card).not.toHaveTextContent('放生');
    expect(within(card).queryByTestId('home-pair-head')).toBeNull();
    const extra = within(card).getByTestId('home-pair-head-extra');
    expect(extra).toHaveTextContent('30%固执');
    expect(extra).toHaveTextContent('30%开朗');
    expect(extra).toHaveTextContent('100dB');
  });

  test('母本在背包里缺失时仍按 femaleActorId 放左列，不冒充种公', () => {
    const residents = [
      resident({ actorId: 'f1', name: '胆小鳗鱼', gender: '未知', nature: '胆小', baseId: '3266' }),
      resident({ actorId: 'm1', name: '豆丁鱼', gender: '公', nature: '沉默', baseId: '3384' }),
    ];
    // 背包里没有母本实例（莱茵家园的真实情况）：只剩一只种公
    const pets = new Map<string, OwnedPet>([
      ['ins_m1', owned({ gameId: 3384, name: '豆丁鱼', gender: '公', nature: '沉默' })],
    ]);

    render(
      <HomePairCards
        couples={[{ femaleActorId: 'f1', maleActorIds: ['m1'] }]}
        residents={residents}
        pets={pets}
      />,
    );

    const card = screen.getByTestId('home-pair-card');
    expect(within(card).getByTestId('home-pair-females')).toHaveTextContent('胆小鳗鱼');
    expect(within(card).getByTestId('home-pair-males')).toHaveTextContent('豆丁鱼');
    // 2026-11-22 用户口径：背包里没有这只实例时，不再提示「已放生 / 不计算后代」
    expect(card).not.toHaveTextContent('放生');
    expect(card).not.toHaveTextContent('不计算后代');
    expect(within(card).queryByTestId('home-pair-released')).toBeNull();
    expect(within(card).queryByTestId('home-pair-head')).toBeNull();
  });

  test('1 公多母：种公置顶只出现一次，母本两列，各自只算自己的公本', () => {
    const residents = [
      resident({ actorId: 'm1', name: '豆丁鱼', gender: '公', nature: '沉默' }),
      resident({ actorId: 'f1', name: '胆小鳗鱼', gender: '母', nature: '胆小' }),
      resident({ actorId: 'f2', name: '优优', gender: '母', nature: '开朗' }),
      resident({ actorId: 'f3', name: '豆豆', gender: '母', nature: '踏实' }),
      resident({ actorId: 'f4', name: '叮叮卯', gender: '母', nature: '聪明' }),
    ];
    const pets = new Map<string, OwnedPet>([
      ['ins_m1', owned({ gameId: 3384, name: '豆丁鱼', gender: '公', nature: '沉默' })],
      ['ins_f1', owned({ gameId: 3266, name: '胆小鳗鱼', gender: '母', nature: '胆小' })],
      ['ins_f2', owned({ gameId: 3705, name: '优优', gender: '母', nature: '开朗' })],
      ['ins_f3', owned({ gameId: 3384, name: '豆豆', gender: '母', nature: '踏实' })],
      ['ins_f4', owned({ gameId: 3752, name: '叮叮卯', gender: '母', nature: '聪明' })],
    ]);
    const couples: HomePair[] = ['f1', 'f2', 'f3', 'f4'].map((femaleActorId) => ({
      femaleActorId,
      maleActorIds: ['m1'],
    }));

    render(<HomePairCards couples={couples} residents={residents} pets={pets} />);

    const card = screen.getByTestId('home-pair-card');
    const shared = within(card).getByTestId('home-pair-shared');
    // 共用种公只出现一次
    expect(within(shared).getAllByTestId('breed-pet-card')).toHaveLength(1);
    expect(shared).toHaveTextContent('共用');
    const mothers = within(card).getByTestId('home-pair-mothers');
    expect(within(mothers).getAllByTestId('breed-pet-card')).toHaveLength(4);
    const heads = within(mothers).getAllByTestId('home-pair-head');
    expect(heads[0]).toHaveTextContent('30%胆小');
    expect(heads[0]).toHaveTextContent('30%沉默');
    expect(heads[0]).toHaveTextContent('100dB');
    expect(heads[1]).toHaveTextContent('30%开朗');
    expect(heads[1]).not.toHaveTextContent('30%胆小');
  });

  test('2 公 3 母：每只母本只列自己实际配的种公；共用种公各出现一次', () => {
    const residents = [
      resident({ actorId: 'm1', name: '豆丁鱼', gender: '公', nature: '沉默' }),
      resident({ actorId: 'm2', name: '火花', gender: '公', nature: '胆小' }),
      resident({ actorId: 'f1', name: '优优', gender: '母', nature: '开朗' }),
      resident({ actorId: 'f2', name: '豆豆', gender: '母', nature: '踏实' }),
      resident({ actorId: 'f3', name: '叮叮卯', gender: '母', nature: '聪明' }),
    ];
    const pets = new Map<string, OwnedPet>([
      ['ins_m1', owned({ gameId: 3384, name: '豆丁鱼', gender: '公', nature: '沉默' })],
      ['ins_m2', owned({ gameId: 3003, name: '火花', gender: '公', nature: '胆小' })],
      ['ins_f1', owned({ gameId: 3705, name: '优优', gender: '母', nature: '开朗' })],
      ['ins_f2', owned({ gameId: 3384, name: '豆豆', gender: '母', nature: '踏实' })],
      ['ins_f3', owned({ gameId: 3752, name: '叮叮卯', gender: '母', nature: '聪明' })],
    ]);
    const couples: HomePair[] = [
      { femaleActorId: 'f1', maleActorIds: ['m1'] },
      { femaleActorId: 'f2', maleActorIds: ['m2'] },
      { femaleActorId: 'f3', maleActorIds: ['m1', 'm2'] },
    ];

    render(<HomePairCards couples={couples} residents={residents} pets={pets} />);

    const card = screen.getByTestId('home-pair-card');
    const shared = within(card).getByTestId('home-pair-shared');
    expect(within(shared).getAllByTestId('breed-pet-card')).toHaveLength(2);
    // 种公卡片上方不再写「配 N 只母本」
    expect(within(shared).queryByText('共用 · 配 2 只母本')).toBeNull();

    const heads = within(card).getAllByTestId('home-pair-head');
    expect(heads[0]).toHaveTextContent('30%开朗');
    expect(heads[0]).toHaveTextContent('30%沉默');
    expect(heads[0]).not.toHaveTextContent('30%胆小');
    expect(heads[1]).toHaveTextContent('30%踏实');
    expect(heads[1]).toHaveTextContent('30%胆小');
    expect(heads[1]).not.toHaveTextContent('30%沉默');
    expect(heads[2]).toHaveTextContent('30%聪明');
    expect(heads[2]).toHaveTextContent('30%沉默');
    expect(heads[2]).toHaveTextContent('30%胆小');
  });

  test('1 公 10 母不折叠：10 只母本全部显示', () => {
    const residents = [resident({ actorId: 'm1', name: '豆丁鱼', gender: '公', nature: '沉默' })];
    const pets = new Map<string, OwnedPet>([
      ['ins_m1', owned({ gameId: 3384, name: '豆丁鱼', gender: '公', nature: '沉默' })],
    ]);
    const couples: HomePair[] = [];
    for (let i = 1; i <= 10; i += 1) {
      residents.push(resident({ actorId: `f${i}`, name: `母本${i}`, gender: '母', nature: '胆小' }));
      pets.set(`ins_f${i}`, owned({ gameId: 3266, name: `母本${i}`, gender: '母', nature: '胆小' }));
      couples.push({ femaleActorId: `f${i}`, maleActorIds: ['m1'] });
    }

    render(<HomePairCards couples={couples} residents={residents} pets={pets} />);

    const card = screen.getByTestId('home-pair-card');
    expect(card.getAttribute('data-top')).toBe('male');
    expect(within(card).getByTestId('home-pair-shared')).toHaveTextContent('共用种公');
    expect(within(within(card).getByTestId('home-pair-shared')).getAllByTestId('breed-pet-card')).toHaveLength(1);
    expect(within(within(card).getByTestId('home-pair-mothers')).getAllByTestId('breed-pet-card')).toHaveLength(10);
    expect(within(card).queryByTestId('home-pair-more')).toBeNull();
  });

  test('10 公 1 母：母本置顶，10 只种公全部显示，不折叠', () => {
    const natures = ['开朗', '踏实', '聪明', '固执', '沉默', '平和', '急躁', '大胆', '认真', '冷静'];
    const residents = [
      resident({ actorId: 'f1', name: '胆小鳗鱼', gender: '母', nature: '胆小' }),
    ];
    const pets = new Map<string, OwnedPet>([
      ['ins_f1', owned({ gameId: 3266, name: '胆小鳗鱼', gender: '母', nature: '胆小' })],
    ]);
    const maleActorIds: string[] = [];
    for (let i = 0; i < 10; i += 1) {
      const actorId = `m${i + 1}`;
      maleActorIds.push(actorId);
      residents.push(resident({ actorId, name: `种公${i + 1}`, gender: '公', nature: natures[i] }));
      pets.set(`ins_${actorId}`, owned({ gameId: 3384, name: `种公${i + 1}`, gender: '公', nature: natures[i] }));
    }

    render(
      <HomePairCards
        couples={[{ femaleActorId: 'f1', maleActorIds }]}
        residents={residents}
        pets={pets}
      />,
    );

    const card = screen.getByTestId('home-pair-card');
    expect(card.getAttribute('data-top')).toBe('female');
    const shared = within(card).getByTestId('home-pair-shared');
    expect(shared).toHaveTextContent('共用母本');
    expect(within(shared).getAllByTestId('breed-pet-card')).toHaveLength(1);
    // 超过 3 只种公：卡头不显示后代性格和声音，只写配了几只
    const head = within(shared).getByTestId('home-pair-head');
    expect(head).toHaveTextContent('配 10 只种公');
    expect(head).not.toHaveTextContent('30%');
    expect(head).not.toHaveTextContent('dB');
    expect(within(shared).queryAllByTestId('home-pair-nature')).toHaveLength(0);
    expect(within(within(card).getByTestId('home-pair-males')).getAllByTestId('breed-pet-card')).toHaveLength(10);
    expect(within(card).queryByTestId('home-pair-more')).toBeNull();
  });

  test('3 只种公仍显示后代性格声音，4 只起隐藏', () => {
    const natures = ['开朗', '踏实', '聪明', '固执'];
    const make = (count: number) => {
      const residents = [
        resident({ actorId: 'f1', name: '胆小鳗鱼', gender: '母', nature: '胆小' }),
      ];
      const pets = new Map<string, OwnedPet>([
        ['ins_f1', owned({ gameId: 3266, name: '胆小鳗鱼', gender: '母', nature: '胆小' })],
      ]);
      const maleActorIds: string[] = [];
      for (let i = 0; i < count; i += 1) {
        const actorId = `m${i + 1}`;
        maleActorIds.push(actorId);
        residents.push(resident({ actorId, name: `种公${i + 1}`, gender: '公', nature: natures[i] }));
        pets.set(`ins_${actorId}`, owned({ gameId: 3384, name: `种公${i + 1}`, gender: '公', nature: natures[i] }));
      }
      return { residents, pets, couples: [{ femaleActorId: 'f1', maleActorIds }] };
    };

    const three = make(3);
    const first = render(
      <HomePairCards couples={three.couples} residents={three.residents} pets={three.pets} />,
    );
    const threeHead = screen.getByTestId('home-pair-head');
    expect(threeHead).toHaveTextContent('30%胆小');
    expect(threeHead).toHaveTextContent('dB');
    expect(threeHead.querySelectorAll('[data-testid="home-pair-nature"]')).toHaveLength(4);
    first.unmount();

    const four = make(4);
    render(<HomePairCards couples={four.couples} residents={four.residents} pets={four.pets} />);
    const fourHead = screen.getByTestId('home-pair-head');
    expect(fourHead).toHaveTextContent('配 4 只种公');
    expect(fourHead).not.toHaveTextContent('30%');
    expect(fourHead).not.toHaveTextContent('dB');
  });

  test('普通窝：母本上方写概率 + 声音，下面是母 × 公', () => {
    const residents = [
      resident({ actorId: 'f1', name: '喵喵', gender: '母', nature: '胆小' }),
      resident({ actorId: 'm1', name: '火花', gender: '公', nature: '固执' }),
    ];
    const pets = new Map<string, OwnedPet>([
      ['ins_f1', owned({ gameId: 3001, name: '喵喵', gender: '母', nature: '胆小', voiceDb: 97 })],
      ['ins_m1', owned({ gameId: 3003, name: '火花', gender: '公', nature: '固执' })],
    ]);
    render(
      <HomePairCards
        couples={[{ femaleActorId: 'f1', maleActorIds: ['m1'] }]}
        residents={residents}
        pets={pets}
      />,
    );
    const card = screen.getByTestId('home-pair-card');
    const head = within(card).getByTestId('home-pair-head');
    expect(head).toHaveTextContent('30%胆小');
    expect(head).toHaveTextContent('30%固执');
    expect(head).toHaveTextContent('98dB');
    // 标签不写性别图标
    expect(head.textContent).not.toContain('♀');
    expect(head.textContent).not.toContain('♂');
    expect(within(card).getAllByTestId('breed-pet-card')).toHaveLength(2);
    // 精灵卡信息：蛋组 / 分贝 / 身高 / 体重 都在，编号已移除
    const petsInCard = within(card).getAllByTestId('breed-pet-card');
    expect(petsInCard[0]).not.toHaveTextContent('No.');
    expect(petsInCard[0]).toHaveTextContent('动物组');
    expect(petsInCard[0]).toHaveTextContent('97dB');
    expect(petsInCard[0]).toHaveTextContent('高');
    expect(petsInCard[0]).toHaveTextContent('重');
    // 底色跟性别一致（母粉 / 公蓝），边框比底色深一点
    expect(petsInCard[0].className).toContain('bg-pink-50');
    expect(petsInCard[0].className).toContain('border-pink-200');
    expect(petsInCard[1].className).toContain('bg-sky-50');
    expect(petsInCard[1].className).toContain('border-sky-200');
  });

  test('精灵卡底部显示个体三维（物攻+8·生命+9·速度+10），卡高 70 → 84', () => {
    const residents = [
      resident({ actorId: 'f1', name: '喵喵', gender: '母', nature: '胆小' }),
      resident({ actorId: 'm1', name: '火花', gender: '公', nature: '固执' }),
    ];
    const pets = new Map<string, OwnedPet>([
      [
        'ins_f1',
        owned({
          gameId: 3001,
          name: '喵喵',
          gender: '母',
          individualBonuses: [
            { name: '物攻', value: 8 },
            { name: '生命', value: 9 },
            { name: '速度', value: 10 },
          ],
        }),
      ],
      ['ins_m1', owned({ gameId: 3003, name: '火花', gender: '公' })],
    ]);
    render(
      <HomePairCards
        couples={[{ femaleActorId: 'f1', maleActorIds: ['m1'] }]}
        residents={residents}
        pets={pets}
      />,
    );
    const cards = screen.getAllByTestId('breed-pet-card');
    // 固定三格一行：按实际三维填，缺的那格留空
    const stats = within(cards[0]).getByTestId('breed-pet-stats');
    expect(stats.children).toHaveLength(3);
    // 固定按 生命 → 物攻 → 魔攻 → 物防 → 魔防 → 速度 排
    expect(within(cards[0]).getByTestId('breed-pet-stat-0')).toHaveTextContent('生命+9');
    expect(within(cards[0]).getByTestId('breed-pet-stat-1')).toHaveTextContent('物攻+8');
    expect(within(cards[0]).getByTestId('breed-pet-stat-2')).toHaveTextContent('速度+10');
    expect(cards[0].className).toContain('h-[86px]');
    // 没有三维的那只：行仍在，三格显示「—」并带「该快照未采集个体三维」提示
    // （2026-11-24：区分「没采到」与「这三项真的没加成」，三格留白改为破折号）
    expect(cards[1].className).toContain('h-[86px]');
    expect(within(cards[1]).getByTestId('breed-pet-stats').children).toHaveLength(3);
    expect(within(cards[1]).getByTestId('breed-pet-stat-0').textContent).toBe('—');
    expect(within(cards[1]).getByTestId('breed-pet-stats').getAttribute('title')).toBe('该快照未采集个体三维');
  });

  test('公母同性格：只写一枚 60%', () => {
    const residents = [
      resident({ actorId: 'f1', name: '喵喵', gender: '母', nature: '固执' }),
      resident({ actorId: 'm1', name: '火花', gender: '公', nature: '固执' }),
    ];
    const pets = new Map<string, OwnedPet>([
      ['ins_f1', owned({ gameId: 3001, name: '喵喵', gender: '母' })],
      ['ins_m1', owned({ gameId: 3003, name: '火花', gender: '公' })],
    ]);
    render(
      <HomePairCards
        couples={[{ femaleActorId: 'f1', maleActorIds: ['m1'] }]}
        residents={residents}
        pets={pets}
      />,
    );
    const chips = within(screen.getByTestId('home-pair-card')).getAllByTestId('home-pair-nature');
    expect(chips).toHaveLength(1);
    expect(chips[0]).toHaveTextContent('60%固执');
  });

  test('缺少公本时降级成「公本未知」，不崩也不空白', () => {
    const residents = [resident({ actorId: 'f1', name: '喵喵', gender: '母' })];
    const pets = new Map<string, OwnedPet>([
      ['ins_f1', owned({ gameId: 3001, name: '喵喵', gender: '母' })],
    ]);
    render(
      <HomePairCards
        couples={[{ femaleActorId: 'f1', maleActorIds: ['missing'] }]}
        residents={residents}
        pets={pets}
      />,
    );
    expect(screen.getByTestId('home-pair-card-list')).toHaveTextContent('公本未知');
  });

  test('11 个窝 = 11 只精灵：4 对（8 窝）+ 学院 1:2（3 窝）', () => {
    const residents: HomeResident[] = [];
    const pets = new Map<string, OwnedPet>();
    const couples: HomePair[] = [];
    for (let i = 0; i < 4; i += 1) {
      const f = `f${i}`;
      const m = `m${i}`;
      residents.push(resident({ actorId: f, name: '喵喵', gender: '母' }));
      residents.push(resident({ actorId: m, name: '火花', gender: '公' }));
      pets.set(`ins_${f}`, owned({ gameId: 3001, name: '喵喵', gender: '母' }));
      pets.set(`ins_${m}`, owned({ gameId: 3003, name: '火花', gender: '公' }));
      couples.push({ femaleActorId: f, maleActorIds: [m] });
    }
    residents.push(resident({ actorId: 'fa', name: '喵喵', gender: '母' }));
    residents.push(resident({ actorId: 'fb', name: '喵喵', gender: '母' }));
    residents.push(resident({ actorId: 'ma', name: '火花', gender: '公' }));
    couples.push({ femaleActorId: 'fa', maleActorIds: ['ma'] });
    couples.push({ femaleActorId: 'fb', maleActorIds: ['ma'] });

    render(<HomePairCards couples={couples} residents={residents} pets={pets} />);
    expect(screen.getAllByTestId('home-pair-card')).toHaveLength(5);
    expect(screen.getAllByTestId('breed-pet-card')).toHaveLength(11);
  });
});

describe('住户信息缺失时的兜底（2026-11-27）', () => {
  const MOTHER_ACTOR_ID = '9511622085510695294';

  test('住户没有名字、背包里也没有这只：显示「未知精灵」，不把内部 actorId 当名字', () => {
    const residents = [
      resident({ actorId: MOTHER_ACTOR_ID, name: '', gender: '母', baseId: '9999' }),
      resident({ actorId: 'm1', name: '柴渣虫', gender: '公' }),
    ];
    const pets = new Map<string, OwnedPet>([
      ['ins_m1', owned({ gameId: 3436, name: '柴渣虫', gender: '公' })],
    ]);

    render(
      <HomePairCards
        couples={[{ femaleActorId: MOTHER_ACTOR_ID, maleActorIds: ['m1'] }]}
        residents={residents}
        pets={pets}
      />,
    );

    const card = screen.getByTestId('home-pair-card');
    const motherCard = within(card).getAllByTestId('breed-pet-card')[0];
    expect(motherCard).toHaveTextContent('未知精灵');
    // 19 位 actorId 是内部 id，不能出现在界面上
    expect(card).not.toHaveTextContent(MOTHER_ACTOR_ID);
    // 一句提示：完整采集一次抓包就能补全
    expect(within(card).getByTestId('home-pair-pet-hint')).toHaveTextContent('采集一次抓包');
  });

  test('住户没有名字但有 baseId：按图鉴物种名显示，并提示这次没匹配到背包', () => {
    const residents = [
      resident({ actorId: MOTHER_ACTOR_ID, name: '', gender: '母', baseId: '3436' }),
      resident({ actorId: 'm1', name: '柴渣虫', gender: '公' }),
    ];
    const pets = new Map<string, OwnedPet>([
      ['ins_m1', owned({ gameId: 3436, name: '柴渣虫', gender: '公' })],
    ]);

    render(
      <HomePairCards
        couples={[{ femaleActorId: MOTHER_ACTOR_ID, maleActorIds: ['m1'] }]}
        residents={residents}
        pets={pets}
      />,
    );

    const card = screen.getByTestId('home-pair-card');
    const motherCard = within(card).getAllByTestId('breed-pet-card')[0];
    expect(motherCard).toHaveTextContent('柴渣虫');
    expect(card).not.toHaveTextContent(MOTHER_ACTOR_ID);
    expect(within(card).getByTestId('home-pair-pet-hint')).toHaveTextContent('采集一次抓包');
  });
});

describe('三只组默认排在上方（2026-11-22 用户口径）', () => {
  test('输入顺序是 2 只在前、3 只在后时，也把三只组排到最上面', () => {
    const residents = [
      resident({ actorId: 'f1', name: '三只母', gender: '母' }),
      resident({ actorId: 'f2', name: '两只母', gender: '母' }),
    ];
    const couples: HomePair[] = [
      { femaleActorId: 'f2', maleActorIds: ['m2'] },
      { femaleActorId: 'f1', maleActorIds: ['m1a', 'm1b'] },
    ];
    const pets = new Map<string, OwnedPet>(
      residents.map((item) => [
        item.instanceId,
        owned({ gameId: 3001, name: item.name, gender: '母' }),
      ]),
    );
    render(<HomePairCards couples={couples} residents={residents} pets={pets} />);
    const cards = screen.getAllByTestId('home-pair-card');
    expect(cards[0].dataset.layout).toBe('triple');
    expect(cards[1].dataset.layout).toBeUndefined();
  });
});

describe('两列三只 + 右侧竖排两只（2026-11-22 用户口径）', () => {
  test('横屏窄屏时第一组两只改成竖排，放到第二列', () => {
    const original = window.matchMedia;
    // 测试环境没有真实视口：直接把这份媒体查询固定成匹配
    window.matchMedia = ((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    })) as unknown as typeof window.matchMedia;
    try {
      const mothers = ['f1', 'f2', 'f3', 'f4'];
      const residents = mothers.map((id) => resident({ actorId: id, name: `母${id}`, gender: '母' }));
      const couples: HomePair[] = mothers.map((id, index) => ({
        femaleActorId: id,
        maleActorIds: [`m${index}a`, `m${index}b`],
      }));
      couples[3].maleActorIds = ['m3a']; // 最后一组只配一只：竖排两只
      const pets = new Map<string, OwnedPet>(
        residents.map((item) => [
          item.instanceId,
          owned({ gameId: 3001, name: item.name, gender: '母' }),
        ]),
      );
      render(<HomePairCards couples={couples} residents={residents} pets={pets} />);

      const list = screen.getByTestId('home-pair-card-list');
      expect(list).toHaveAttribute('data-layout', 'split');
      const cards = screen.getAllByTestId('home-pair-card');
      expect(cards).toHaveLength(4);
      expect(cards.filter((card) => card.dataset.layout === 'triple')).toHaveLength(3);
      const vertical = cards.find((card) => card.dataset.layout === 'vertical');
      expect(vertical).toBeTruthy();
      expect(within(vertical!).getAllByTestId('breed-pet-card')).toHaveLength(2);
    } finally {
      window.matchMedia = original;
    }
  });
});
