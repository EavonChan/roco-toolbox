import { describe, expect, test } from 'vitest';
import {
  DEMAND_LIMIT_PER_ACCOUNT,
  DEMAND_LIMIT_PER_GROUP,
  DEMAND_LIMIT_PER_MEMBER_CAP,
  demandLimitPerMember,
} from './collectionGroups';

describe('需求额度（2026-11-06 翻倍）', () => {
  test('每个账号 10 条，多号累加', () => {
    expect(DEMAND_LIMIT_PER_ACCOUNT).toBe(10);
    expect(demandLimitPerMember(1)).toBe(10);
    expect(demandLimitPerMember(3)).toBe(30);
  });

  test('单成员上限 40 条', () => {
    expect(DEMAND_LIMIT_PER_MEMBER_CAP).toBe(40);
    expect(demandLimitPerMember(5)).toBe(40);
    expect(demandLimitPerMember(99)).toBe(40);
  });

  test('账号数缺失按 1 算；小组总量上限 400', () => {
    expect(demandLimitPerMember(0)).toBe(10);
    expect(demandLimitPerMember(Number.NaN)).toBe(10);
    expect(DEMAND_LIMIT_PER_GROUP).toBe(400);
  });
});
