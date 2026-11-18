import { describe, expect, test } from 'vitest';
import { buildMotherNestSuggestions } from './motherNest';
import type { MotherCriteria } from './motherCriteria';
import type { CoverageCell, StudCoverageResult } from './studCoverage';
import type { OwnedPet, SpeciesEntry } from './types';

const species: SpeciesEntry[] = [
  { key: 'a', gameId: 801, name: '喵喵', number: '801', eggGameId: 801, eggGroups: [6, 9], maleCapable: true, genderRatio: { male: 5, female: 5 } },
  { key: 'b', gameId: 802, name: '火苗', number: '802', eggGameId: 802, eggGroups: [12, 2], maleCapable: true, genderRatio: { male: 8, female: 2 } },
  { key: 'c', gameId: 803, name: '火神', number: '803', eggGameId: 802, eggGroups: [12, 2], maleCapable: true, genderRatio: { male: 8, female: 2 } },
];

const mk = (
  gameId: number,
  gender: '公' | '母',
  nature: string,
  account: string,
  overrides: Partial<OwnedPet> = {},
): OwnedPet => ({
  gameId,
  name: species.find((entry) => entry.gameId === gameId)!.name,
  gender,
  nature,
  voiceDb: 100,
  medalBody: '大块头',
  account,
  isShiny: false,
  ...overrides,
});

const cell = (
  groupId: number,
  natureName: string,
  state: CoverageCell['state'] = 'breedable',
): CoverageCell => ({ groupId, natureId: 2, natureName, grade: '大婉', state });

const coverage = (...cells: CoverageCell[]): StudCoverageResult => ({
  total: cells.length,
  covered: 0,
  cells,
  groupSummary: [],
  passedGroups: 0,
  groupCount: cells.length,
});

const criteria: MotherCriteria = {
  grades: ['大婉'],
  targetMode: 'perfect',
  recommendedNatures: true,
  bodies: [],
  voices: [],
};

const naturesOf = (gameId: number): readonly string[] =>
  gameId === 801 ? ['踏实'] : gameId === 802 ? ['固执'] : [];

const plan = (account: string, nestsUsed = 0, slots: Array<{ key: string }> = []) => ({
  account,
  slots: slots.map((slot) => ({ pet: slot })),
  nestsUsed,
  nestsTotal: 11,
});

describe('母本配窝建议', () => {
  test('同种双收：本号母本只差性格，公同种且带推荐性格 → 母本 + 种公共有', () => {
    const mother = mk(801, '母', '开朗', '甲');
    const father = mk(801, '公', '踏实', '甲');
    const result = buildMotherNestSuggestions({
      species,
      owned: [mother, father],
      mode: 'perfect',
      grade: '大婉',
      criteria,
      naturesOf,
      coverageByAccount: new Map([
        ['甲', coverage(cell(6, '踏实'), cell(9, '踏实'))],
      ]),
      plans: [plan('甲')],
    });
    const pairings = result.get('甲')!.pairings;
    expect(pairings).toHaveLength(1);
    const pairing = pairings[0];
    expect(pairing.eggName).toBe('喵喵');
    expect(pairing.sameSpecies).toBe(true);
    // 母带开朗、公带踏实 → 30% 踏实；出母 50% → 母本 0.15
    expect(pairing.natureChance).toBeCloseTo(0.3);
    expect(pairing.femaleChance).toBeCloseTo(0.5);
    expect(pairing.motherGain).toBeCloseTo(0.15);
    // 同种公补两个未覆盖的种公格：0.3 × 2 组 × 1 = 0.6
    expect(pairing.studGain).toBeCloseTo(0.6);
    expect(pairing.expectedValue).toBeCloseTo(0.75);
    expect(pairing.nestsNeeded).toBe(2);
    expect(result.get('甲')!.nestsUsed).toBe(2);
  });

  test('母本体型不达标 → 本号内不给线（换公也补不回来）', () => {
    const smallMother = mk(801, '母', '开朗', '甲', { medalBody: '小不点', voiceDb: 60 });
    const father = mk(802, '公', '固执', '甲');
    const result = buildMotherNestSuggestions({
      species,
      owned: [smallMother, father],
      mode: 'perfect',
      grade: '大婉',
      criteria,
      naturesOf,
      coverageByAccount: new Map([['甲', coverage(cell(6, '踏实'))]]),
      plans: [plan('甲')],
    });
    expect(result.get('甲')!.pairings).toEqual([]);
  });

  test('本号已有达标母本 → 不再给这一颗蛋的母本线', () => {
    const qualifiedMother = mk(801, '母', '踏实', '甲');
    const father = mk(801, '公', '踏实', '甲');
    const result = buildMotherNestSuggestions({
      species,
      owned: [qualifiedMother, father],
      mode: 'perfect',
      grade: '大婉',
      criteria,
      naturesOf,
      coverageByAccount: new Map([['甲', coverage(cell(6, '踏实'))]]),
      plans: [plan('甲')],
    });
    expect(result.get('甲')!.pairings).toEqual([]);
  });

  test('跨号：本号没有目标档位母本 → 取每源号最高概率的一对，按对性母概率排', () => {
    // 甲只有火苗公（同种），没有火苗母；乙有火苗母（开朗）× 火苗公（固执）
    const receiver = mk(802, '公', '固执', '甲');
    const donorMother = mk(802, '母', '开朗', '乙');
    const donorFather = mk(802, '公', '固执', '乙');
    const result = buildMotherNestSuggestions({
      species,
      owned: [receiver, donorMother, donorFather],
      mode: 'perfect',
      grade: '大婉',
      criteria,
      naturesOf,
      coverageByAccount: new Map([
        ['甲', coverage(cell(12, '固执'))],
        ['乙', coverage()],
      ]),
      plans: [plan('甲'), plan('乙')],
    });
    const tasks = result.get('甲')!.tasks;
    const task = tasks.find((item) => item.eggGameId === 802)!;
    expect(task.sourceAccount).toBe('乙');
    expect(task.sameSpecies).toBe(true);
    // 30% 固执 × 出母 20% = 6%
    expect(task.chance).toBeCloseTo(0.06);
    expect(task.femaleChance).toBeCloseTo(0.2);
  });

  test('跨号源号有更稳的一对（双方同性格 60%）→ 排在 30% 那对前面', () => {
    const receiver = mk(802, '公', '固执', '甲');
    const weakMother = mk(802, '母', '开朗', '乙');
    const weakFather = mk(802, '公', '固执', '乙');
    const strongMother = mk(802, '母', '固执', '丙');
    const strongFather = mk(802, '公', '固执', '丙');
    const result = buildMotherNestSuggestions({
      species,
      owned: [receiver, weakMother, weakFather, strongMother, strongFather],
      mode: 'perfect',
      grade: '大婉',
      criteria,
      naturesOf,
      coverageByAccount: new Map([['甲', coverage()]]),
      plans: [plan('甲'), plan('乙'), plan('丙')],
    });
    const task = result.get('甲')!.tasks.find((item) => item.eggGameId === 802)!;
    expect(task.sourceAccount).toBe('丙');
    expect(task.natureChance).toBeCloseTo(0.6);
    expect(task.chance).toBeCloseTo(0.12);
  });

  test('不要求推荐性格 → 本号内不排母本线；跨号只按出母率算', () => {
    const mother = mk(801, '母', '开朗', '甲');
    const father = mk(801, '公', '踏实', '甲');
    const receiver = mk(802, '公', '固执', '甲');
    const donorMother = mk(802, '母', '开朗', '乙');
    const donorFather = mk(802, '公', '固执', '乙');
    const result = buildMotherNestSuggestions({
      species,
      owned: [mother, father, receiver, donorMother, donorFather],
      mode: 'perfect',
      grade: '大婉',
      criteria: { ...criteria, recommendedNatures: false },
      naturesOf,
      coverageByAccount: new Map([['甲', coverage()]]),
      plans: [plan('甲'), plan('乙')],
    });
    expect(result.get('甲')!.pairings).toEqual([]);
    const task = result.get('甲')!.tasks.find((item) => item.eggGameId === 802)!;
    expect(task.natureChance).toBe(1);
    expect(task.chance).toBeCloseTo(0.2);
  });
});
