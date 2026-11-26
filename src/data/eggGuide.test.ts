import { describe, expect, test } from 'vitest';
import eggGuide from './eggGuide.json';
import eggWeights from './eggWeights.json';

interface EggGuideEntry {
  tier: number;
  eggGroups: string[];
  genderRatio: string;
  big: number;
  max: number;
  small: number;
  min: number;
  ranges: number;
  hatchHours: number;
}

const guide = eggGuide as Record<string, EggGuideEntry>;

describe('蛋品种静态资料（eggGuide.json）', () => {
  test('覆盖率：攻略表 209 行，208 条按 gameId 落位', () => {
    // 唯一缺口是「雪绒鸟（冬鸟）」：analysis.json 里图鉴只有春/夏/秋与「本来的样子」，
    // 没有「冬天的样子」，DATA1 标为未匹配，这里不猜。
    expect(Object.keys(guide)).toHaveLength(208);
    expect(Object.keys(guide).every((key) => /^\d+$/.test(key))).toBe(true);
  });

  test('按 gameId 升序排列，便于 diff', () => {
    const ids = Object.keys(guide).map(Number);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });

  test('喵喵（3001）的档位 / 区间 / 孵蛋时间按攻略表落位', () => {
    expect(guide['3001']).toEqual({
      tier: 2,
      eggGroups: ['动物', '拟人'],
      genderRatio: '5:5',
      big: 1.829,
      max: 1.84,
      small: 1.278,
      min: 1.267,
      ranges: 12,
      hatchHours: 12,
    });
  });

  test('攻略表与 eggWeights 数值不一致时以攻略表为准（板板壳 3055）', () => {
    // eggWeights 是 4.169 / 2.657，攻略表大块头 4.168、小不点 2.656；生成时取攻略表。
    expect(eggWeights['板板壳']).toMatchObject({ big: 4.169, small: 2.657 });
    expect(guide['3055']).toMatchObject({ big: 4.168, max: 4.2, small: 2.656, min: 2.625 });
  });

  test('每条资料字段齐全，且满足 满轻 ≤ 小不点 ≤ 大块头 ≤ 满重', () => {
    for (const [gameId, entry] of Object.entries(guide)) {
      expect(entry.tier, gameId).toBeGreaterThanOrEqual(1);
      expect(entry.eggGroups.length, gameId).toBeGreaterThan(0);
      expect(entry.genderRatio, gameId).toMatch(/^\d+:\d+$/);
      expect(entry.min, gameId).toBeLessThanOrEqual(entry.small);
      expect(entry.small, gameId).toBeLessThanOrEqual(entry.big);
      expect(entry.big, gameId).toBeLessThanOrEqual(entry.max);
      expect(entry.ranges, gameId).toBeGreaterThan(0);
      expect(entry.hatchHours, gameId).toBeGreaterThan(0);
    }
  });
});
