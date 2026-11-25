import { describe, expect, test } from 'vitest';
import { emptyEggStock, reconcileEggStock as reconcileBase, setEggListed, sortEggStock,
  type EggObservation, type EggStockSnapshot, type EggStockState } from './eggStockModel';

const egg = (over: Partial<EggObservation> = {}): EggObservation => ({
  id: 'e1', eggGameId: 3227, nature: '固执', body: '大块头', voice: '婉转声',
  provenance: 'self-bred', confidence: 'system', ...over,
});
const part = (eggs: EggObservation[], complete = true) => ({ eggs, complete });

/**
 * 绝大多数用例只关心合并/删除，不关心具体游戏账号：默认补 `uid:1`。
 * 账号相关用例可以自己传 `gameAccountKey` 覆盖；缺字段的负例直接调 `reconcileBase`。
 */
const reconcile = (
  state: EggStockState,
  snapshot: Omit<EggStockSnapshot, 'gameAccountKey'> & { gameAccountKey?: string },
): EggStockState => reconcileBase(state, { gameAccountKey: 'uid:1', ...snapshot });

describe('egg stock snapshots', () => {
  test('merges bag and home once by actual instance; bag wins', () => {
    const state = reconcile(emptyEggStock(), { accountId: 'me', capturedAt: 10,
      bag: part([egg()]), home: part([egg({ nature: '开朗' }), egg({ id: 'e2' })]) });
    expect(state.eggs).toHaveLength(2);
    expect(state.eggs.find(e => e.id === 'e1')).toMatchObject({ nature: '固执', location: 'bag' });
    expect(state.eggs.find(e => e.id === 'e2')?.location).toBe('home');
  });
  test('complete empty snapshot removes only bag stock; home eggs stay as 待认领', () => {
    const state = reconcile(emptyEggStock(), { accountId: 'me', capturedAt: 10,
      bag: part([egg()]), home: part([egg({ id: 'h1' })]) });
    const partial = reconcile(state, { accountId: 'me', capturedAt: 11, bag: part([], false) });
    expect(partial.eggs).toHaveLength(2);
    const bagOnly = reconcile(partial, { accountId: 'me', capturedAt: 12, bag: part([]) });
    expect(bagOnly.eggs.map(e => e.id)).toEqual(['h1']);
    // 2026-11-25 保底：家园完整快照空了，家蛋行不再跟着删（协议里没有能对上背包蛋的字段，
    // 删掉会连父母 / 自产 / 性格一起没），改成「待认领」等用户手动认领。
    const empty = reconcile(bagOnly, { accountId: 'me', capturedAt: 13, bag: part([]), home: part([]) });
    expect(empty.eggs.map(e => e.id)).toEqual(['h1']);
    expect(empty.eggs[0]).toMatchObject({ location: 'home', provenance: 'self-bred', claimPending: true });
  });
  test('accounts and capture time are isolated; old data cannot resurrect removed eggs', () => {
    const one = reconcile(emptyEggStock(), { accountId: 'me', capturedAt: 20, bag: part([egg()]) });
    const two = reconcile(one, { accountId: 'other', capturedAt: 10, bag: part([egg()]) });
    expect(two.eggs).toHaveLength(2);
    const removed = reconcile(two, { accountId: 'me', capturedAt: 30, bag: part([]) });
    expect(reconcile(removed, { accountId: 'me', capturedAt: 25, bag: part([egg()]) })).toBe(removed);
    expect(removed.eggs.map(e => e.accountId)).toEqual(['other']);
  });
  test('unknown provenance is retained without blocking normal eggs from listing', () => {
    const state = reconcile(emptyEggStock(), { accountId: 'me', capturedAt: 1,
      bag: part([egg({ provenance: undefined, confidence: undefined }), egg({ id: 'manual', confidence: 'manual' })]) });
    expect(state.eggs[0].provenance).toBe('unknown');
    expect(setEggListed(state, 'me', 'e1', true).eggs[0].listed).toBe(true);
    expect(setEggListed(state, 'me', 'manual', true).eggs[1].listed).toBe(true);
  });
  test('listing is account scoped; source history is factual and no longer blocks circulation', () => {
    const initial = reconcile(emptyEggStock(), { accountId: 'me', capturedAt: 1, bag: part([egg()]) });
    expect(() => setEggListed(initial, 'other', 'e1', true)).toThrow(/不存在/);
    const listed = setEggListed(initial, 'me', 'e1', true);
    expect(initial.eggs[0].listed).toBe(false);
    expect(listed.eggs[0].listed).toBe(true);
    const external = reconcile(listed, { accountId: 'me', capturedAt: 2, bag: part([egg({ provenance: 'external' })]) });
    expect(external.eggs[0]).toMatchObject({ provenance: 'external', listed: true });
    const later = reconcile(external, { accountId: 'me', capturedAt: 3, bag: part([egg()]) });
    expect(later.eggs[0].provenance).toBe('external');
  });
  test('special and shiny eggs are sorted last and cannot be listed, including reclassification', () => {
    const initial = reconcile(emptyEggStock(), { accountId: 'me', capturedAt: 1,
      bag: part([egg({ id: 'special', kind: 'special' }), egg(), egg({ id: 'shiny', kind: 'shiny' }), egg({ id: 'external', provenance: 'external' })]) });
    expect(sortEggStock(initial.eggs).map(e => e.id)).toEqual(['e1', 'external', 'special', 'shiny']);
    expect(initial.eggs[0].id).toBe('special');
    expect(() => setEggListed(initial, 'me', 'special', true)).toThrow(/特殊|交换/);
    expect(() => setEggListed(initial, 'me', 'shiny', true)).toThrow(/异色|交换/);
    const listed = setEggListed(initial, 'me', 'e1', true);
    const refreshed = reconcile(listed, { accountId: 'me', capturedAt: 2, bag: part([egg({ kind: 'special' })], false) });
    expect(refreshed.eggs.find(e => e.id === 'e1')).toMatchObject({ kind: 'special', listed: false });
  });
  test('received source history survives an absent snapshot without showing ghost inventory', () => {
    const external = reconcile(emptyEggStock(), { accountId: 'me', capturedAt: 1, bag: part([egg({ provenance: 'external' })]) });
    const empty = reconcile(external, { accountId: 'me', capturedAt: 2, bag: part([]) });
    expect(empty.eggs).toEqual([]);
    expect(reconcile(empty, { accountId: 'me', capturedAt: 3, bag: part([egg()]) }).eggs[0].provenance).toBe('external');
  });
  test('self-bred provenance survives later bag snapshots that cannot identify the source', () => {
    const home = egg({ id: 'home1', provenance: 'self-bred', location: 'home' });
    const state = reconcile(emptyEggStock(), {
      accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 10,
      home: part([home]),
    });
    const bag = egg({ id: 'home1', provenance: 'unknown' });
    const next = reconcile(state, {
      accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 20,
      bag: part([bag]),
    });
    expect(next.eggs[0]).toMatchObject({ location: 'bag', provenance: 'self-bred' });
  });
  test('a partial home refresh cannot move an existing bag egg back to home', () => {
    const bag = reconcile(emptyEggStock(), { accountId: 'me', capturedAt: 1, bag: part([egg()]) });
    const home = reconcile(bag, { accountId: 'me', capturedAt: 2, home: part([egg()]) });
    expect(home.eggs[0].location).toBe('bag');
  });
  test('rejects invalid snapshots atomically rather than deleting current data', () => {
    const state = reconcile(emptyEggStock(), { accountId: 'me', capturedAt: 1, bag: part([egg()]) });
    expect(() => reconcile(state, { accountId: 'me', capturedAt: NaN, bag: part([]) })).toThrow();
    expect(() => reconcile(state, { accountId: 'me', capturedAt: 2, bag: part([egg({ id: '' })]) })).toThrow(/实例/);
    expect(() => reconcile(state, { accountId: 'me', capturedAt: 2, bag: part([egg(), egg()]) })).toThrow(/重复/);
    expect(state.eggs).toHaveLength(1);
  });

  test('bag and home keep their own capture time; complete removes only its own location', () => {
    const state = reconcile(emptyEggStock(), { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 20,
      bag: { eggs: [egg({ gameAccountKey: 'uid:1' })], complete: true, capturedAt: 10 },
      home: { eggs: [egg({ id: 'h1', gameAccountKey: 'uid:1' })], complete: true, capturedAt: 20 } });
    expect(state.eggs.find(e => e.id === 'e1')?.lastConfirmedAt).toBe(10);
    expect(state.eggs.find(e => e.id === 'h1')?.lastConfirmedAt).toBe(20);
    const next = reconcile(state, { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 30,
      home: { eggs: [], complete: true, capturedAt: 30 } });
    // 家蛋那一侧完整快照空了：只代表「地上没有了」，行留着当待认领（保底，见 2026-11-25 口径）。
    expect(next.eggs.map(e => e.id).sort()).toEqual(['e1', 'h1']);
    expect(next.eggs.find(e => e.id === 'h1')).toMatchObject({ location: 'home', claimPending: true });
    const kept = reconcile(state, { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 31,
      bag: { eggs: [], complete: true, capturedAt: 31 } });
    expect(kept.eggs.map(e => e.id)).toEqual(['h1']);
  });

  test('different game accounts keep separate watermarks and never delete each other', () => {
    const one = reconcile(emptyEggStock(), { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 10,
      bag: part([egg({ gameAccountKey: 'uid:1' })]) });
    const two = reconcile(one, { accountId: 'me', gameAccountKey: 'uid:2', capturedAt: 5,
      bag: part([egg({ id: 'b', gameAccountKey: 'uid:2' })]) });
    expect(two.eggs).toHaveLength(2);
    const cleared = reconcile(two, { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 11, bag: part([]) });
    expect(cleared.eggs.map(e => e.id)).toEqual(['b']);
  });

  test('home parents and system source survive re-sync', () => {
    const parents = { mother: { id: 'm', gameId: 3227, name: '菊花梨', nature: '保守', body: '大块头', voice: '+100', nestName: '普通小窝' },
      fathers: [{ id: 'f', gameId: 3215, name: '海豹战士', nature: '胆小', body: '大块头', voice: '婉转声' }], confirmed: false };
    const home = egg({ id: 'h1', nature: '', labelSource: 'system', parents });
    const state = reconcile(emptyEggStock(), { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 1, home: part([home]) });
    expect(state.eggs[0]).toMatchObject({ location: 'home', labelSource: 'system', parents });
  });

  test('captured obtained time height and weight reach the stock and are never cleared later', () => {
    const captured = reconcile(emptyEggStock(), { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 10,
      bag: part([egg({ provenance: 'unknown', obtainedAt: '2026-11-17T22:31:00Z', heightCm: 34, weightGrams: 2320 })]) });
    expect(captured.eggs[0]).toMatchObject({ obtainedAt: '2026-11-17T22:31:00Z', heightCm: 34, weightGrams: 2320 });
    const later = reconcile(captured, { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 20,
      bag: part([egg({ provenance: 'unknown' })]) });
    expect(later.eggs[0]).toMatchObject({ obtainedAt: '2026-11-17T22:31:00Z', heightCm: 34, weightGrams: 2320 });
  });

  test('采集进来的绿窝标记在合并进背包、再次同步后仍然保留', () => {
    const homeGreen = egg({ id: 'home-green', location: 'home', greenNest: true });
    const state = reconcile(emptyEggStock(), { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 10,
      home: part([homeGreen]) });
    expect(state.eggs[0]).toMatchObject({ location: 'home', greenNest: true });
    // 蛋收进背包：背包观测按唯一同种家园行合并（capturedEggId），绿窝不能掉
    const bagGreen = egg({ id: 'bag-green', provenance: 'unknown', obtainedAt: '2026-11-24T20:00:00Z' });
    const merged = reconcile(state, { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 20,
      bag: part([bagGreen]) });
    expect(merged.eggs).toHaveLength(1);
    expect(merged.eggs[0]).toMatchObject({ id: 'home-green', location: 'bag', greenNest: true, capturedEggId: 'bag-green' });
    // 再同步一次（背包观测再次到达）：标记还在
    const resynced = reconcile(merged, { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 30,
      bag: part([bagGreen]) });
    expect(resynced.eggs[0]).toMatchObject({ greenNest: true, capturedEggId: 'bag-green' });
    // 家园快照完整更新时，绿窝标记也不能被空观测冲掉
    const homeRefresh = reconcile(resynced, { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 40,
      home: part([egg({ id: 'home-green', location: 'home' })]) });
    expect(homeRefresh.eggs[0]).toMatchObject({ greenNest: true });
  });

  test('历史蛋缺绿窝标记时按父母回填：显式 false（手动取消）与普通小窝都不动', () => {
    const parents = {
      mother: { id: 'm', gameId: 3124, name: '脆筒甜甜', nature: '胆小', body: '大块头', voice: '+100', nestName: '学院小窝', academy: true },
      fathers: [{ id: 'f', gameId: 3124, name: '脆筒甜甜', nature: '胆小', body: '大块头', voice: '婉转声', nestName: '普通小窝' }],
      confirmed: false,
    };
    const backfilled = reconcile(emptyEggStock(), { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 10,
      home: part([egg({ id: 'h1', location: 'home', nature: '胆小', parents })]) });
    expect(backfilled.eggs[0].greenNest).toBe(true);
    const manualOptOut = reconcile(emptyEggStock(), { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 10,
      home: part([egg({ id: 'h2', location: 'home', nature: '胆小', greenNest: false, parents })]) });
    expect(manualOptOut.eggs[0].greenNest).toBe(false);
    const ordinaryParents = { ...parents,
      mother: { ...parents.mother, nestName: '普通小窝', academy: undefined },
      fathers: [{ ...parents.fathers[0] }] };
    const ordinary = reconcile(emptyEggStock(), { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 10,
      home: part([egg({ id: 'h3', location: 'home', nature: '胆小', parents: ordinaryParents })]) });
    expect(ordinary.eggs[0].greenNest).toBeUndefined();
  });

  test('a captured bag egg fills the unique self-bred home egg instead of replacing it', () => {
    const home = reconcile(emptyEggStock(), { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 10,
      home: part([egg({ id: 'home1', location: 'home' })]) });
    expect(home.eggs[0]).toMatchObject({ location: 'home', provenance: 'self-bred' });
    const bag = egg({ id: 'bag1', provenance: 'unknown', obtainedAt: '2026-11-17T22:31:00Z', heightCm: 34, weightGrams: 2320 });
    const merged = reconcile(home, { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 20, bag: part([bag]) });
    expect(merged.eggs).toHaveLength(1);
    expect(merged.eggs[0]).toMatchObject({ id: 'home1', location: 'bag', capturedEggId: 'bag1',
      provenance: 'self-bred', obtainedAt: '2026-11-17T22:31:00Z', heightCm: 34, weightGrams: 2320 });
    expect(reconcile(merged, { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 30, bag: part([bag]) }).eggs)
      .toHaveLength(1);
  });

  test('a complete capture adds its new egg without dropping the already merged stock', () => {
    const home = reconcile(emptyEggStock(), { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 10,
      home: part([egg({ id: 'home1', location: 'home' })]) });
    const bag = egg({ id: 'bag1', provenance: 'unknown', obtainedAt: '2026-11-17T22:31:00Z' });
    const merged = reconcile(home, { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 20, bag: part([bag]) });
    // 家园那边已经空了（蛋收进背包），完整快照里多出一颗新蛋：旧合并行要留，新蛋要进来。
    const next = reconcile(merged, { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 30, home: part([]),
      bag: part([bag, egg({ id: 'bag2', provenance: 'unknown', obtainedAt: '2026-11-18T09:00:00Z' })]) });
    expect(next.eggs.map(e => e.id).sort()).toEqual(['bag2', 'home1']);
    expect(next.eggs.find(e => e.id === 'home1')).toMatchObject({ capturedEggId: 'bag1', provenance: 'self-bred' });
  });

  test('an incomplete capture only adds stock and never deletes', () => {
    const kept = reconcile(emptyEggStock(), { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 10,
      bag: part([egg({ id: 'kept', provenance: 'unknown' })]) });
    const next = reconcile(kept, { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 20,
      bag: part([egg({ id: 'added', provenance: 'unknown', obtainedAt: '2026-11-18T09:00:00Z' })], false) });
    expect(next.eggs.map(e => e.id).sort()).toEqual(['added', 'kept']);
  });

  test('identical home eggs are not guessed when the capture has no stable link', () => {
    const home = reconcile(emptyEggStock(), { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 10,
      home: part([egg({ id: 'home1', location: 'home' }), egg({ id: 'home2', location: 'home' })]) });
    const next = reconcile(home, { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 20,
      bag: part([egg({ id: 'bag1', provenance: 'unknown', obtainedAt: '2026-11-17T22:31:00Z' })]) });
    expect(next.eggs).toHaveLength(3);
  });

  test('concrete non-exchangeable category and egg measurements survive re-sync', () => {
    const state = reconcile(emptyEggStock(), {
      accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 1,
      bag: part([egg({ id: 'special', kind: 'special', specialCategory: 'activity' })]),
    });
    expect(state.eggs[0].specialCategory).toBe('activity');
  });

  test('missing or blank game account key fails loudly instead of silently keeping ghost rows', () => {
    const state = reconcileBase(emptyEggStock(), { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 1,
      bag: part([egg({ id: 'bag1', gameAccountKey: 'uid:1' })]),
      home: part([egg({ id: 'home1', location: 'home', gameAccountKey: 'uid:1' })]) });
    expect(state.eggs).toHaveLength(2);
    // 缺字段：以前这一步会返回 2 行家蛋幽灵行 / 122 行那样的「静默降级」，现在必须报错。
    expect(() => reconcileBase(state, {
      accountId: 'me', capturedAt: 2, bag: part([], true),
    } as unknown as EggStockSnapshot)).toThrow(/gameAccountKey|游戏账号/);
    // 空串与纯空白同样不算有效账号。
    expect(() => reconcileBase(state, { accountId: 'me', gameAccountKey: '', capturedAt: 2, bag: part([]) }))
      .toThrow(/gameAccountKey|游戏账号/);
    expect(() => reconcileBase(state, { accountId: 'me', gameAccountKey: '   ', capturedAt: 2, bag: part([]) }))
      .toThrow(/gameAccountKey|游戏账号/);
    // 报错不能动已有库存。
    expect(state.eggs.map(e => e.id).sort()).toEqual(['bag1', 'home1']);
  });

  test('同种 2 颗从家园收进背包：行数不减少，父母与自产标记仍在（2026-11-25 保底）', () => {
    // 两颗同种家蛋：协议里唯一共有字段只有物种，`candidates.length !== 1` 因此不会自动合并。
    const parentsA = { mother: { id: 'm1', gameId: 3103, name: '布是石', nature: '平和', body: '大块头', voice: '婉转声' },
      fathers: [{ id: 'f1', gameId: 3754, name: '火豆丁', nature: '勇敢', body: '', voice: '' }], confirmed: false };
    const parentsB = { mother: { id: 'm2', gameId: 3103, name: '布是石', nature: '固执', body: '', voice: '' },
      fathers: [{ id: 'f2', gameId: 3754, name: '火豆丁', nature: '固执', body: '', voice: '' }], confirmed: false };
    const first = reconcile(emptyEggStock(), { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 10,
      home: part([
        egg({ id: 'home1', eggGameId: 3103, location: 'home', nature: '', parents: parentsA }),
        egg({ id: 'home2', eggGameId: 3103, location: 'home', nature: '', parents: parentsB }),
      ]) });
    expect(first.eggs).toHaveLength(2);

    const second = reconcile(first, { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 20,
      bag: part([
        egg({ id: 'bag1', eggGameId: 3103, provenance: 'unknown', obtainedAt: '2026-11-25T00:06:50Z' }),
        egg({ id: 'bag2', eggGameId: 3103, provenance: 'unknown', obtainedAt: '2026-11-25T00:06:56Z' }),
      ]),
      home: part([]) });

    // 4 行 = 2 行待认领家蛋 + 2 行背包蛋：一颗都没被删，也没被乱合并。
    expect(second.eggs).toHaveLength(4);
    expect(second.eggs.filter(e => e.claimPending).map(e => e.id).sort()).toEqual(['home1', 'home2']);
    expect(second.eggs.find(e => e.id === 'home1')).toMatchObject({
      location: 'home', provenance: 'self-bred', parents: parentsA, claimPending: true });
    expect(second.eggs.find(e => e.id === 'home2')).toMatchObject({
      location: 'home', provenance: 'self-bred', parents: parentsB, claimPending: true });
    // 待认领不能借 `missingFromCapture` 表达：那个标记会被自动挂出、任务动作和库清理当失效蛋删掉。
    expect(second.eggs.filter(e => 'missingFromCapture' in e)).toHaveLength(0);
    expect(second.eggs.find(e => e.id === 'bag1')).toMatchObject({ location: 'bag', provenance: 'unknown' });

    // 再同步一次同一份（背包完整、家园仍空）：待认领留着，不重复长行。
    const again = reconcile(second, { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 30,
      bag: part([
        egg({ id: 'bag1', eggGameId: 3103, provenance: 'unknown', obtainedAt: '2026-11-25T00:06:50Z' }),
        egg({ id: 'bag2', eggGameId: 3103, provenance: 'unknown', obtainedAt: '2026-11-25T00:06:56Z' }),
      ]),
      home: part([]) });
    expect(again.eggs).toHaveLength(4);
    expect(again.eggs.filter(e => e.claimPending)).toHaveLength(2);
  });

  test('家园完整快照里没了家蛋、背包也没有新蛋：行保留为待认领，不删', () => {
    const parents = { mother: { id: 'm', gameId: 3227, name: '菊花梨', nature: '保守', body: '大块头', voice: '+100' },
      fathers: [{ id: 'f', gameId: 3215, name: '海豹战士', nature: '胆小', body: '大块头', voice: '婉转声' }], confirmed: false };
    const home = reconcile(emptyEggStock(), { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 10,
      home: part([egg({ id: 'h1', location: 'home', nature: '', parents, greenNest: true })]) });
    const gone = reconcile(home, { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 20, home: part([]) });
    expect(gone.eggs.map(e => e.id)).toEqual(['h1']);
    expect(gone.eggs[0]).toMatchObject({
      location: 'home', provenance: 'self-bred', parents, greenNest: true, claimPending: true });
    // 背包那一侧完整快照空了，也不能顺手把待认领的家蛋删掉。
    const bagGone = reconcile(gone, { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 30, bag: part([]) });
    expect(bagGone.eggs.map(e => e.id)).toEqual(['h1']);
    expect(bagGone.eggs[0].claimPending).toBe(true);
  });

  test('待认领的家蛋重新出现在家园快照里：清掉待认领标记', () => {
    const home = reconcile(emptyEggStock(), { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 10,
      home: part([egg({ id: 'h1', location: 'home' })]) });
    const gone = reconcile(home, { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 20, home: part([]) });
    expect(gone.eggs[0].claimPending).toBe(true);
    const back = reconcile(gone, { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 30,
      home: part([egg({ id: 'h1', location: 'home', nature: '开朗' })]) });
    expect(back.eggs.map(e => e.id)).toEqual(['h1']);
    expect(back.eggs[0].claimPending).toBeUndefined();
    expect(back.eggs[0]).toMatchObject({ location: 'home', nature: '开朗' });
  });

  test('待认领行被自动合并（唯一候选，E2 已证口径）后不残留待认领标记', () => {
    const home = reconcile(emptyEggStock(), { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 10,
      home: part([egg({ id: 'h1', location: 'home' })]) });
    const pending = reconcile(home, { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 20, home: part([]) });
    expect(pending.eggs[0].claimPending).toBe(true);
    const merged = reconcile(pending, { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 30,
      bag: part([egg({ id: 'bag1', provenance: 'unknown', obtainedAt: '2026-11-25T00:06:50Z' })]) });
    expect(merged.eggs).toHaveLength(1);
    expect(merged.eggs[0]).toMatchObject({ id: 'h1', location: 'bag', capturedEggId: 'bag1', provenance: 'self-bred' });
    expect(merged.eggs[0].claimPending).toBeUndefined();
  });

  test('金标准形状：2 颗不同种的家蛋收进背包后仍是 2 行，并带上获得时间', () => {
    // 第一次：118 颗背包 + 2 颗不同物种的家蛋；第二次：120 颗背包 + 0 颗家蛋（2026-11-25 真实抓包）。
    const bagEgg = (id: string, eggGameId: number): EggObservation =>
      egg({ id, eggGameId, provenance: 'unknown', obtainedAt: '2026-11-17T22:31:00Z' });
    const oldBag = Array.from({ length: 118 }, (_, index) => bagEgg(`bag${index}`, 3000 + index));
    const homeEggs: EggObservation[] = [
      egg({ id: 'home3103', eggGameId: 3103, provenance: 'self-bred', location: 'home' }),
      egg({ id: 'home3436', eggGameId: 3436, provenance: 'self-bred', location: 'home' }),
    ];
    const first = reconcile(emptyEggStock(), { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 10,
      bag: part(oldBag), home: part(homeEggs) });
    expect(first.eggs).toHaveLength(120);
    expect(first.eggs.filter(e => e.obtainedAt)).toHaveLength(118);

    const second = reconcile(first, { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 20,
      bag: part([...oldBag, bagEgg('bag118', 3103), bagEgg('bag119', 3436)]), home: part([]) });
    // 2 行（不是 4 行）：家蛋行改成背包行，不产生第二份。
    expect(second.eggs).toHaveLength(120);
    expect(second.eggs.filter(e => e.location === 'home')).toHaveLength(0);
    expect(second.eggs.filter(e => !e.obtainedAt)).toHaveLength(0);
    expect(second.eggs.find(e => e.id === 'home3103')).toMatchObject({
      location: 'bag', capturedEggId: 'bag118', provenance: 'self-bred', obtainedAt: '2026-11-17T22:31:00Z' });
    expect(second.eggs.find(e => e.id === 'home3436')).toMatchObject({
      location: 'bag', capturedEggId: 'bag119', provenance: 'self-bred', obtainedAt: '2026-11-17T22:31:00Z' });
    // 再同步一次同一份背包：capturedEggId 链接生效，仍然 120 行。
    expect(reconcile(second, { accountId: 'me', gameAccountKey: 'uid:1', capturedAt: 30,
      bag: part([...oldBag, bagEgg('bag118', 3103), bagEgg('bag119', 3436)]), home: part([]) }).eggs).toHaveLength(120);
  });
});
