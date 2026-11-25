import { beforeEach, describe, expect, test } from 'vitest';
import {
  clearNearbyTargets,
  getNearbyTargets,
  nearbyRangeAllows,
  nearbyTargetAllows,
  resetNearbyTargetsForTest,
  setNearbyTargets,
  toggleNearbyTarget,
} from './nearbyTargetStore';

const pet = (overrides: { petId?: number | null; rare?: boolean } = {}) => ({
  petId: 3001, rare: false, ...overrides,
});

describe('目标精灵（蹲守名单）store', () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetNearbyTargetsForTest();
  });

  test('默认空名单 = 关闭', () => {
    expect(getNearbyTargets()).toEqual([]);
  });

  test('写入时只留正整数 gameId，去重并保持勾选顺序', () => {
    setNearbyTargets([3002, 3001, 3002, -1, 0, 2.5]);
    expect(getNearbyTargets()).toEqual([3002, 3001]);
    expect(window.localStorage.getItem('roco.nearbyTargets')).toBe('[3002,3001]');
  });

  test('勾选 / 取消按 gameId 增删', () => {
    toggleNearbyTarget(3001);
    toggleNearbyTarget(3002);
    expect(getNearbyTargets()).toEqual([3001, 3002]);
    toggleNearbyTarget(3001);
    expect(getNearbyTargets()).toEqual([3002]);
  });

  test('清除后回到空名单', () => {
    setNearbyTargets([3001]);
    clearNearbyTargets();
    expect(getNearbyTargets()).toEqual([]);
  });

  test('按 petId 认目标：缺 petId 的认不出，不算命中', () => {
    expect(nearbyTargetAllows([3001], pet({ petId: 3001 }))).toBe(true);
    expect(nearbyTargetAllows([3001], pet({ petId: 3002 }))).toBe(false);
    expect(nearbyTargetAllows([3001], pet({ petId: null }))).toBe(false);
  });

  test('目标档是替换语义：名单外的精灵不放行', () => {
    expect(nearbyRangeAllows('target', pet({ petId: 3001 }), [3001])).toBe(true);
    expect(nearbyRangeAllows('target', pet({ petId: 3002 }), [3001])).toBe(false);
    expect(nearbyRangeAllows('target', pet({ petId: 3001 }), [])).toBe(false);
  });

  test('其它档位照旧走三档口径（三档语义不变）', () => {
    expect(nearbyRangeAllows('all', pet(), [3001])).toBe(true);
    expect(nearbyRangeAllows('rare', pet({ rare: true }), [])).toBe(true);
    expect(nearbyRangeAllows('rare', pet({ rare: false }), [])).toBe(false);
  });
});
