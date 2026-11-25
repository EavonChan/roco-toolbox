import { expect, test } from 'vitest';
import type { WorkflowEgg } from '../../shared/eggWorkflow';
import { groupEggStock, type EggGroupFacts } from './eggStockGroups';

/** 与面板同口径的判定（面板后续会把自己的私有函数作为 facts 传进来）。 */
const facts: EggGroupFacts = {
  natureText: (e) => e.nature,
  isGreenNest: (e) => e.greenNest === true,
  isSelfProduced: (e) => e.provenance === 'self-bred' || e.location === 'home',
  isAnnotated: (e) => Boolean(e.nature) && ['大块头', '小不点', '满体重', '零体重'].includes(e.body) && ['+100', '-100', '婉转声', '粗嗓门'].includes(e.voice),
  isSpecial: (e) => e.kind === 'special' || e.kind === 'shiny',
};

const egg = (id: string, patch: Partial<WorkflowEgg> = {}): WorkflowEgg => ({
  id,
  accountId: 'acc',
  gameAccountKey: 'uid:1',
  eggGameId: 3049,
  nature: '平和',
  body: '大块头',
  voice: '婉转声',
  provenance: 'self-bred',
  confidence: 'system',
  kind: 'ordinary',
  status: 'available',
  listed: false,
  location: 'bag',
  lastConfirmedAt: 1,
  ...patch,
});

test('同物种的蛋合成一组，并汇总自产 / 绿窝 / 挂出 / 换蛋中 / 待认领 / 位置', () => {
  const eggs = [
    egg('a', { listed: true }),
    egg('b'),
    egg('c', { status: 'reserved' }),
    egg('d', { location: 'home', claimPending: true }),
    egg('e', { location: 'home' }),
  ];
  const groups = groupEggStock(eggs, facts);
  expect(groups).toHaveLength(1);
  const [group] = groups;
  expect(group.key).toBe('species:3049');
  expect(group.count).toBe(5);
  expect(group.selfProduced).toBe(5);
  expect(group.listed).toBe(1);
  expect(group.reserved).toBe(1);
  expect(group.claimPending).toBe(1);
  expect(group.bag).toBe(3);
  expect(group.home).toBe(2);
  expect(group.availableBag).toBe(1);
  expect(group.items.map((item) => item.status)).toEqual(['已挂出', '未挂出', '换蛋中', '待认领', '在家园']);
});

test('异色 / 特殊蛋不进物种组，各自一张', () => {
  const groups = groupEggStock([
    egg('o'),
    egg('s', { kind: 'shiny', specialCategory: 'shiny' }),
    egg('x', { kind: 'special', specialCategory: 'activity' }),
  ], facts);
  expect(groups.map((group) => group.key)).toEqual(['species:3049', 'special:s', 'special:x']);
  expect(groups[1].count).toBe(1);
});

test('不同物种分开；组内任一自产、任一绿窝决定组的前后，其余保持首次出现顺序', () => {
  const groups = groupEggStock([
    egg('p2', { eggGameId: 2, provenance: 'external' }),
    egg('g1', { eggGameId: 1, greenNest: true }),
    egg('s3', { eggGameId: 3 }),
  ], facts);
  expect(groups.map((group) => group.eggGameId)).toEqual([1, 3, 2]);
});

test('二级分组：按性格颗数降序，组内按获得时间倒序，没有时间的排最后', () => {
  const [group] = groupEggStock([
    egg('a', { nature: '平和', obtainedAt: '2026-11-24T21:12:00+08:00' }),
    egg('b', { nature: '平和', obtainedAt: '2026-11-25T09:05:00+08:00' }),
    egg('c', { nature: '冷静', obtainedAt: '2026-11-24T23:40:00+08:00' }),
    egg('d', { nature: '平和' }),
  ], facts);
  expect(group.natureSections.map((section) => [section.text, section.items.length])).toEqual([['平和', 3], ['冷静', 1]]);
  expect(group.natureSections[0].items.map((item) => item.egg.id)).toEqual(['b', 'a', 'd']);
});

test('species-nature 口径只把同物种 + 同性格的蛋合在一起', () => {
  const groups = groupEggStock([egg('a'), egg('b'), egg('c', { nature: '冷静' })], facts, 'species-nature');
  expect(groups).toHaveLength(2);
  expect(groups.map((group) => group.count)).toEqual([2, 1]);
});
