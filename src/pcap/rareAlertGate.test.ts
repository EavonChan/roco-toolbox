import { describe, expect, test } from 'vitest';
import { LEAVE_TTL_MS, MAX_TTL_MS, RareAlertGate } from './rareAlertGate';

interface Item { key: string; hit: boolean }
const keyOf = (item: Item) => item.key;
const isHit = (item: Item) => item.hit;
const item = (key: string, hit = true): Item => ({ key, hit });

describe('稀有提醒去重闸门', () => {
  test('首次满足条件才进提醒队列，重复命中不重复提醒', () => {
    const gate = new RareAlertGate<Item>();
    const t0 = 1000;
    expect(gate.scan([item('a'), item('b')], keyOf, isHit, t0)).toEqual([item('a'), item('b')]);
    expect(gate.scan([item('a'), item('b')], keyOf, isHit, t0 + 1000)).toEqual([]);
    expect(gate.size).toBe(2);
  });

  test('还在附近但已经不稀有：立刻放开，再次稀有可重新提醒', () => {
    const gate = new RareAlertGate<Item>();
    expect(gate.scan([item('a')], keyOf, isHit, 1000)).toHaveLength(1);
    expect(gate.scan([item('a', false)], keyOf, isHit, 2000)).toHaveLength(0);
    expect(gate.scan([item('a')], keyOf, isHit, 3000)).toHaveLength(1);
  });

  test('从附近消失后超过 10 分钟才清理条目', () => {
    const gate = new RareAlertGate<Item>();
    gate.scan([item('a')], keyOf, isHit, 1000);
    gate.scan([], keyOf, isHit, 1000 + LEAVE_TTL_MS - 1);
    expect(gate.size).toBe(1);
    gate.scan([], keyOf, isHit, 1000 + LEAVE_TTL_MS + 1);
    expect(gate.size).toBe(0);
  });

  test('任何条目最多保留 30 分钟，即使一直在视野内', () => {
    const gate = new RareAlertGate<Item>();
    gate.scan([item('a')], keyOf, isHit, 1000);
    gate.scan([item('a')], keyOf, isHit, 1000 + MAX_TTL_MS - 1);
    expect(gate.size).toBe(1);
    gate.scan([item('a')], keyOf, isHit, 1000 + MAX_TTL_MS + 1);
    expect(gate.size).toBe(0);
    // 清理后再出现仍能提醒
    expect(gate.scan([item('a')], keyOf, isHit, 1000 + MAX_TTL_MS + 2)).toHaveLength(1);
  });

  test('空 key 跳过，不会污染去重表', () => {
    const gate = new RareAlertGate<Item>();
    expect(gate.scan([item('')], keyOf, isHit, 1000)).toEqual([]);
    expect(gate.size).toBe(0);
  });

  test('reset 清空全部记录', () => {
    const gate = new RareAlertGate<Item>();
    gate.scan([item('a')], keyOf, isHit, 1000);
    gate.reset();
    expect(gate.size).toBe(0);
  });
});
