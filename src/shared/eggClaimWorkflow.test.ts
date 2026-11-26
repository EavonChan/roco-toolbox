import { expect, test } from 'vitest';
import { applyEggAction, emptyEggWorkflow, type EggWorkflowState } from './eggWorkflow';

/**
 * F5（2026-11-25）：待认领家蛋的四个出口——claim-egg / claim-dismiss / claim-split / label-parents。
 * 家蛋行认领之前不删（保底），所以这几个动作是它唯一的出口，必须能落库、能还原。
 */
const parents = {
  mother: { id: 'm', gameId: 3103, name: '布是石', nature: '平和', body: '大块头', voice: '婉转声',
    nestName: '普通小窝', individualBonuses: [{ name: '生命', value: 9 }, { name: '物攻', value: 8 }] },
  fathers: [{ id: 'f', gameId: 3754, name: '火豆丁', nature: '勇敢', body: '大块头', voice: '婉转声' }],
  confirmed: false,
};
const homeEgg = (over: Record<string, unknown> = {}) => ({ id: 'home1', eggGameId: 3103, nature: '', body: 'unknown',
  voice: 'unknown', kind: 'ordinary', gameAccountKey: 'uid:1', location: 'home', provenance: 'self-bred',
  labelSource: 'system', parents, claimPending: true, lastConfirmedAt: 1763391600000, ...over });
const bagEgg = (id: string, over: Record<string, unknown> = {}) => ({ id, eggGameId: 3103, nature: '固执',
  body: '', voice: '婉转声', kind: 'ordinary', gameAccountKey: 'uid:1', location: 'bag',
  weightGrams: 2320, heightCm: 34, obtainedAt: '2026-11-25T00:06:50', ...over });
const sync = (state: EggWorkflowState, at: number, eggs: unknown[], opts: { complete?: boolean; homeComplete?: boolean } = {}) =>
  applyEggAction(state, 'g', 'a', { type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: at,
    complete: opts.complete ?? false, homeComplete: opts.homeComplete ?? false, eggs }, at);

test('认领：保留家蛋 id / 父母 / 自产，补上背包的时间蛋重蛋高，删掉背包行', () => {
  let state = sync(emptyEggWorkflow(), 1, [homeEgg()], { homeComplete: true });
  state = sync(state, 2, [homeEgg(), bagEgg('bag9')], { complete: true, homeComplete: true });
  expect(state.eggs).toHaveLength(2);

  state = applyEggAction(state, 'g', 'a', { type: 'claim-egg', id: 'home1', capturedEggId: 'bag9' }, 3);
  expect(state.eggs).toHaveLength(1);
  const egg = state.eggs[0];
  expect(egg).toMatchObject({ id: 'home1', location: 'bag', capturedEggId: 'bag9', provenance: 'self-bred',
    weightGrams: 2320, heightCm: 34, obtainedAt: '2026-11-25T00:06:50', nature: '固执' });
  expect(egg.parents?.mother?.name).toBe('布是石');
  expect(egg.claimPending).toBeUndefined();
  expect(egg.claimBackup).toMatchObject({ nature: '' });
});

test('认领拒绝：物种不同 / 不是待认领 / 背包行不存在 / 换蛋中', () => {
  let state = sync(emptyEggWorkflow(), 1, [homeEgg()], { homeComplete: true });
  state = sync(state, 2, [homeEgg(), bagEgg('bag9'), bagEgg('other', { eggGameId: 3436 })],
    { complete: true, homeComplete: true });
  expect(() => applyEggAction(state, 'g', 'a', { type: 'claim-egg', id: 'home1', capturedEggId: 'other' }, 3))
    .toThrow(/物种/);
  expect(() => applyEggAction(state, 'g', 'a', { type: 'claim-egg', id: 'home1', capturedEggId: 'nope' }, 3))
    .toThrow(/不存在/);
  // 已合并过的行不是待认领
  const claimed = applyEggAction(state, 'g', 'a', { type: 'claim-egg', id: 'home1', capturedEggId: 'bag9' }, 3);
  expect(() => applyEggAction(claimed, 'g', 'a', { type: 'claim-egg', id: 'home1', capturedEggId: 'bag9' }, 4))
    .toThrow(/待认领/);
  // 背包蛋被换蛋任务占用
  const reserved = { ...claimed, eggs: claimed.eggs.map(e => e.id === 'other' ? { ...e, status: 'reserved' as const } : e) };
  const back = sync(emptyEggWorkflow(), 1, [homeEgg()], { homeComplete: true });
  const withBag = sync(back, 2, [homeEgg(), bagEgg('bag9')], { complete: true, homeComplete: true });
  const busy = { ...withBag, eggs: withBag.eggs.map(e => e.id === 'bag9' ? { ...e, status: 'reserved' as const } : e) };
  expect(() => applyEggAction(busy, 'g', 'a', { type: 'claim-egg', id: 'home1', capturedEggId: 'bag9' }, 3))
    .toThrow(/换蛋/);
  expect(reserved.eggs.length).toBeGreaterThan(0);
});

test('作废：只允许待认领的家蛋行', () => {
  let state = sync(emptyEggWorkflow(), 1, [homeEgg()], { homeComplete: true });
  state = sync(state, 2, [homeEgg(), bagEgg('bag9')], { complete: true, homeComplete: true });
  expect(() => applyEggAction(state, 'g', 'a', { type: 'claim-dismiss', id: 'bag9' }, 3)).toThrow(/待认领/);
  const gone = applyEggAction(state, 'g', 'a', { type: 'claim-dismiss', id: 'home1' }, 3);
  expect(gone.eggs.map(e => e.id)).toEqual(['bag9']);
});

test('拆开：家蛋行回待认领、背包行重建，时间蛋重留在背包行，父母不丢', () => {
  let state = sync(emptyEggWorkflow(), 1, [homeEgg()], { homeComplete: true });
  state = sync(state, 2, [homeEgg(), bagEgg('bag9')], { complete: true, homeComplete: true });
  state = applyEggAction(state, 'g', 'a', { type: 'claim-egg', id: 'home1', capturedEggId: 'bag9' }, 3);
  const split = applyEggAction(state, 'g', 'a', { type: 'claim-split', id: 'home1' }, 4);
  expect(split.eggs).toHaveLength(2);
  const home = split.eggs.find(e => e.id === 'home1')!;
  const bag = split.eggs.find(e => e.id === 'bag9')!;
  expect(home).toMatchObject({ location: 'home', claimPending: true });
  expect(home.capturedEggId).toBeUndefined();
  expect(home.obtainedAt).toBeUndefined();
  expect(home.parents?.mother?.name).toBe('布是石');
  expect(bag).toMatchObject({ location: 'bag', body: 'unknown', voice: 'unknown', provenance: 'unknown',
    weightGrams: 2320, obtainedAt: '2026-11-25T00:06:50' });
  expect(bag.parents).toBeUndefined();
});

test('标注父母本：写 manual、三维落库，重新同步不丢', () => {
  let state = sync(emptyEggWorkflow(), 1, [bagEgg('bag9')], { complete: true });
  expect(state.eggs[0].parents).toBeUndefined();
  state = applyEggAction(state, 'g', 'a',
    { type: 'label-parents', id: 'bag9', mother: parents.mother, father: parents.fathers[0] }, 2);
  expect(state.eggs[0].labelSource).toBe('manual');
  expect(state.eggs[0].parents?.mother?.individualBonuses).toEqual([{ name: '生命', value: 9 }, { name: '物攻', value: 8 }]);
  expect(state.eggs[0].parents?.fathers?.[0]?.name).toBe('火豆丁');
  const again = sync(state, 3, [bagEgg('bag9')], { complete: true });
  expect(again.eggs[0].parents?.mother?.individualBonuses).toHaveLength(2);
  expect(again.eggs[0].parents?.fathers?.[0]?.name).toBe('火豆丁');
  expect(again.eggs[0].labelSource).toBe('manual');
});
