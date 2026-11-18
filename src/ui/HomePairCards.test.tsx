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
    // 三个窝：两母 + 一公
    const females = within(cards[0]).getByTestId('home-pair-females');
    const males = within(cards[0]).getByTestId('home-pair-males');
    expect(within(females).getAllByTestId('breed-pet-card')).toHaveLength(2);
    expect(within(males).getAllByTestId('breed-pet-card')).toHaveLength(1);
    // 学院 100%：卡头和第二个母本上方各一枚；声音只写一次
    // 每个母本上方都写性格% + 声音（第二只母本用 extra 那一行）
    const heads = [
      within(cards[0]).getByTestId('home-pair-head'),
      within(cards[0]).getByTestId('home-pair-head-extra'),
    ];
    for (const head of heads) {
      expect(head).toHaveTextContent('100%固执');
      expect(head).toHaveTextContent('99dB');
    }
    expect(within(cards[0]).getAllByTestId('home-pair-nature')).toHaveLength(2);
    // 学院那只（公）绿框
    expect(within(males).getByTestId('breed-pet-card').className).toContain('border-emerald-500');
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
