import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, test } from 'vitest';
import { species } from '../data/catalog';
import { eggNatures } from '../domain/recommendedNatures';
import type { OwnedPet } from '../domain/types';
import { setTargetGrade } from './coverageFilterStore';
import { setTargetMode } from './targetModeStore';
import { useMotherSuggestions } from './useMotherSuggestions';

const NATURE = eggNatures(species, 3001, {})[0] ?? '固执';

const pet = (
  gender: '公' | '母',
  account: string,
  overrides: Partial<OwnedPet> = {},
): OwnedPet => ({
  gameId: 3001,
  name: '喵喵',
  gender,
  nature: NATURE,
  voiceDb: 100,
  medalBody: '大块头',
  account,
  isShiny: false,
  ...overrides,
});

beforeEach(() => {
  setTargetMode('perfect');
  setTargetGrade('大婉');
});

describe('母本建议的账号范围', () => {
  test('单选一个号时，仍用全部账号算跨号传蛋（2026-11-24 用户口径）', () => {
    // 甲只有公，乙有这只蛋的母 + 公：单选甲时仍然要看到「乙 → 甲」的 30% 线，
    // 否则母本页会说「本号、跨号都无法配对」，其他号明明能补。
    const allOwned = [pet('公', '甲'), pet('母', '乙'), pet('公', '乙')];
    const selected = ['甲'];
    const summary = {
      owned: allOwned.filter((item) => item.account === '甲'),
      allOwned,
      mode: 'perfect' as const,
      coverageByAccount: new Map(),
      plans: [],
    };

    const { result } = renderHook(() => useMotherSuggestions(summary, selected));

    // 只把选中号作为「目标号」返回，其他号只作为来源
    expect([...result.current.suggestions.keys()]).toEqual(['甲']);
    const task = result.current.suggestions
      .get('甲')!
      .tasks.find((item) => item.eggGameId === 3001);
    expect(task?.sourceAccount).toBe('乙');
    expect(task?.chance).toBeCloseTo(0.3);
  });

  test('已按母本页达标条件判为收集的蛋，不再被推成跨号缺口', () => {
    // 母本页默认按体型/声音判（小不点 +100 也算收集），配窝目标档位却是大婉。
    // 如果“怎么补”又按大婉判，就会把页面已经算已收集的蛋推成缺口（实测差 1 条）。
    const allOwned = [
      pet('母', '甲', { medalBody: '小不点' }),
      pet('母', '乙'),
      pet('公', '乙'),
    ];
    const summary = {
      owned: allOwned.filter((item) => item.account === '甲'),
      allOwned,
      mode: 'perfect' as const,
      coverageByAccount: new Map(),
      plans: [],
    };

    const { result } = renderHook(() => useMotherSuggestions(summary, ['甲']));
    expect(
      result.current.suggestions
        .get('甲')!
        .tasks.find((item) => item.eggGameId === 3001),
    ).toBeUndefined();
  });
});
