import { describe, expect, test } from 'vitest';
import type { LiveNearbyPet } from '../collector/captureProgress';
import { composeNearbyRows, isHighValuePet, pruneRetained, retainablePets } from './nearbyRetain';

const pet = (key: string, rare = false): LiveNearbyPet => ({
  key, cfgId: 10000, petId: 3001, name: key, level: 10, voiceDb: 0,
  weightPct: 50, kinds: rare ? ['big'] : [], rare, alertReason: null, distanceM: null,
});

const classify = (item: LiveNearbyPet) => ({
  highValue: item.rare,
});

const TTL = 10 * 60 * 1000;

describe('常驻列表清理', () => {
  test('当前精灵全部入列，普通精灵也保留（仍在视野内）', () => {
    const rows = pruneRetained([], [pet('normal'), pet('rare', true)], 1000, classify, { ttlMs: TTL });
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.present)).toBe(true);
  });

  test('离开视野后普通精灵立刻清理，高价值精灵保留并标为已离开', () => {
    const first = pruneRetained([], [pet('normal'), pet('rare', true)], 1000, classify, { ttlMs: TTL });
    const second = pruneRetained(first, [], 2000, classify, { ttlMs: TTL });
    expect(second.map((row) => row.key)).toEqual(['rare']);
    expect(second[0].present).toBe(false);
  });

  test('高价值精灵离开超过 10 分钟后清理', () => {
    const first = pruneRetained([], [pet('rare', true)], 1000, classify, { ttlMs: TTL });
    const justInTime = pruneRetained(first, [], 1000 + TTL, classify, { ttlMs: TTL });
    expect(justInTime).toHaveLength(1);
    const expired = pruneRetained(justInTime, [], 1000 + TTL + 1, classify, { ttlMs: TTL });
    expect(expired).toHaveLength(0);
  });

  test('再次出现时保留 firstSeenAt 并刷新 lastSeenAt', () => {
    const first = pruneRetained([], [pet('rare', true)], 1000, classify, { ttlMs: TTL });
    const second = pruneRetained(first, [pet('rare', true)], 5000, classify, { ttlMs: TTL });
    expect(second[0]).toMatchObject({ firstSeenAt: 1000, lastSeenAt: 5000, present: true });
  });

  test('条目上限防止无限增长', () => {
    const many = Array.from({ length: 80 }, (_, index) => pet(`p${index}`, true));
    const rows = pruneRetained([], many, 1000, classify, { ttlMs: TTL, maxEntries: 60 });
    expect(rows).toHaveLength(60);
  });
});

describe('列表 = 当前全部精灵 ∪ 已离开的高价值常驻', () => {
  test('当前快照里的普通精灵也进列表，已离开的高价值按「已离开」追加', () => {
    const retained = pruneRetained([], [pet('rare', true)], 1000, classify, { ttlMs: TTL });
    // rare 已离开视野，current 里只剩普通精灵
    const rows = composeNearbyRows([], retained, [pet('normal')], 2000, classify);
    expect(rows.map((row) => [row.key, row.present])).toEqual([
      ['normal', true],
      ['rare', false],
    ]);
  });

  test('普通精灵离开视野后不会留在列表里', () => {
    const shown = composeNearbyRows([], [], [pet('normal')], 1000, classify);
    const retained = pruneRetained([], [], 2000, classify, { ttlMs: TTL });
    expect(composeNearbyRows(shown, retained, [], 2000, classify)).toEqual([]);
  });

  test('普通精灵的首次出现时间沿用上一轮展示，不会每次刷新都变成 now', () => {
    const first = composeNearbyRows([], [], [pet('normal')], 1000, classify);
    const second = composeNearbyRows(first, [], [pet('normal')], 5000, classify);
    expect(second[0]).toMatchObject({ firstSeenAt: 1000, lastSeenAt: 5000, present: true });
  });

  test('已离开的高价值超过 10 分钟后不再出现在列表里', () => {
    const retained = pruneRetained([], [pet('rare', true)], 1000, classify, { ttlMs: TTL });
    const expired = pruneRetained(retained, [], 1000 + TTL + 1, classify, { ttlMs: TTL });
    expect(expired).toEqual([]);
    expect(composeNearbyRows([], expired, [], 1000 + TTL + 1, classify)).toEqual([]);
  });

  test('常驻表只收高价值：普通精灵不写进常驻', () => {
    const current = [pet('normal'), pet('rare', true)];
    expect(retainablePets(current, classify).map((item) => item.key)).toEqual(['rare']);
  });
});

describe('高价值判定', () => {
  test('可主动提醒、稀有、炫彩/异色/污染都算高价值', () => {
    expect(isHighValuePet({ ...pet('a'), alertReason: '-100dB 粗嗓门' })).toBe(true);
    expect(isHighValuePet(pet('b'))).toBe(false);
    // 稀有：附近页「稀有」筛选看得到的，列表也必须有
    expect(isHighValuePet({ ...pet('rare'), rare: true })).toBe(true);
    const shiny = { ...pet('c'), kinds: ['shiny'], rare: true };
    expect(isHighValuePet(shiny)).toBe(true);
    const polluted = { ...pet('d'), kinds: ['pollution'], rare: true };
    expect(isHighValuePet(polluted)).toBe(true);
  });

  test('只有体重牌或单声音牌的普通精灵不算高价值', () => {
    const big = { ...pet('big'), kinds: ['big'], rare: false };
    expect(isHighValuePet(big)).toBe(false);
    const voice = { ...pet('voice'), kinds: ['high'], rare: false };
    expect(isHighValuePet(voice)).toBe(false);
  });
});
