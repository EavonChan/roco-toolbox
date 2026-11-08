import { describe, expect, test } from 'vitest';
import { transferPairsForCells } from './studTransfer';
import type { OwnedPet, SpeciesEntry } from './types';

/**
 * 跨号补缺（2026-11-02）：只回答「哪个号能出这颗蛋」，不估孵化成本。
 * 蛋组 2 = 巨灵组、6 = 动物组。
 */
const species: SpeciesEntry[] = [
  { key: 'fire', gameId: 101, name: '火花', number: '101', eggGameId: 101, eggGroups: [2], maleCapable: true, stage: 1 },
  { key: 'fire-evolved', gameId: 102, name: '火神', number: '102', eggGameId: 101, eggGroups: [2], stage: 3 },
  { key: 'sea', gameId: 201, name: '海枝枝', number: '201', eggGameId: 201, eggGroups: [2, 6], maleCapable: true, stage: 1 },
  { key: 'sea-evolved', gameId: 202, name: '海枝枝进化', number: '202', eggGameId: 201, eggGroups: [2, 6], stage: 2 },
  { key: 'female-only', gameId: 301, name: '纯母兽', number: '301', eggGameId: 301, eggGroups: [2], maleCapable: false, stage: 1 },
];

const pet = (over: Partial<OwnedPet> & { gameId: number }): OwnedPet => ({
  name: 'x',
  gender: '公',
  nature: '固执',
  voiceDb: 100,
  medalBody: '大块头',
  isShiny: false,
  account: '甲',
  ...over,
});

describe('transferPairsForCells', () => {
  test('每个源号只给概率最高的一对；都不带的号不出现', () => {
    const pets = [
      // 小号A：母 固执 × 公 开朗 = 30%，同号还有公 固执 → 应该选 60% 那对
      pet({ gameId: 101, gender: '母', nature: '固执', account: '小号A' }),
      pet({ gameId: 102, gender: '公', nature: '开朗', account: '小号A' }),
      pet({ gameId: 102, gender: '公', nature: '固执', account: '小号A' }),
      // 小号B：母 开朗 × 公 开朗，目标性格是固执 → 出不了，不算能补
      pet({ gameId: 101, gender: '母', nature: '开朗', account: '小号B' }),
      pet({ gameId: 102, gender: '公', nature: '开朗', account: '小号B' }),
    ];
    const map = transferPairsForCells(pets, [{ groupId: 2, natureName: '固执' }], '大婉', species);
    const pairs = map.get('2::固执')!;
    expect(pairs).toHaveLength(1);
    expect(pairs[0].account).toBe('小号A');
    expect(pairs[0].chance).toBe(0.6);
    expect(pairs[0].fatherNature).toBe('固执');
  });

  test('双蛋组物种能同时命中两个蛋组，返回的 groupIds 两个都在', () => {
    const pets = [
      pet({ gameId: 201, gender: '母', nature: '固执', account: '小号A' }),
      pet({ gameId: 101, gender: '公', nature: '固执', account: '小号A' }),
    ];
    const map = transferPairsForCells(
      pets,
      [
        { groupId: 2, natureName: '固执' },
        { groupId: 6, natureName: '固执' },
      ],
      '大婉',
      species,
    );
    expect(map.get('2::固执')?.[0]).toMatchObject({ account: '小号A', groupIds: [2, 6] });
    expect(map.get('6::固执')?.[0]).toMatchObject({ account: '小号A', groupIds: [2, 6] });
  });

  test('多号能补时按概率高的号排前面', () => {
    const pets = [
      pet({ gameId: 101, gender: '母', nature: '固执', account: '小号A' }),
      pet({ gameId: 102, gender: '公', nature: '开朗', account: '小号A' }),
      pet({ gameId: 101, gender: '母', nature: '固执', account: '小号B' }),
      pet({ gameId: 102, gender: '公', nature: '固执', account: '小号B' }),
    ];
    const pairs = transferPairsForCells(
      pets,
      [{ groupId: 2, natureName: '固执' }],
      '大婉',
      species,
    ).get('2::固执')!;
    expect(pairs.map((pair) => pair.account)).toEqual(['小号B', '小号A']);
  });

  test('同一个号的不同蛋都列出来；同一种蛋多只母本只计一条', () => {
    const pets = [
      // 火花（101）两只母本都能出，但同一种蛋只算一条
      pet({ gameId: 101, gender: '母', nature: '固执', account: '小号A' }),
      pet({ gameId: 101, gender: '母', nature: '固执', account: '小号A' }),
      pet({ gameId: 102, gender: '公', nature: '固执', account: '小号A' }),
      // 海枝枝（201，双蛋组）也能出 → 另算一条
      pet({ gameId: 201, gender: '母', nature: '固执', account: '小号A' }),
    ];
    const pairs = transferPairsForCells(
      pets,
      [{ groupId: 2, natureName: '固执' }],
      '大婉',
      species,
    ).get('2::固执')!;
    expect(pairs).toHaveLength(2);
    expect(pairs.map((pair) => pair.eggGameId).sort()).toEqual([101, 201]);
  });

  test('父母档位不达标不算；纯母物种也出不了公蛋', () => {
    const pets = [
      pet({ gameId: 101, gender: '母', nature: '固执', voiceDb: 0 }),
      pet({ gameId: 102, gender: '公', nature: '固执' }),
      pet({ gameId: 301, gender: '母', nature: '固执' }),
      pet({ gameId: 102, gender: '公', nature: '固执' }),
    ];
    expect(
      transferPairsForCells(pets, [{ groupId: 2, natureName: '固执' }], '大婉', species).size,
    ).toBe(0);
  });
});
