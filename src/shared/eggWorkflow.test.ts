import { expect, test } from 'vitest';
import { createDemand } from './eggMatching';
import { applyEggAction, emptyEggWorkflow, type EggWorkflowState } from './eggWorkflow';

const initial = (): EggWorkflowState => ({ ...emptyEggWorkflow(), demands: [createDemand({
  id: 'd', groupId: 'g', demanderAccountId: 'a', eggGameId: 3227, natures: ['固执'], body: '', voice: '', quantity: 1 })] });
const stock = (id: string, game: number) => ({ id, eggGameId: game, nature: '固执', body: '', voice: '', kind: 'ordinary', gameAccountKey: 'uid:1' });
const sync = (state: EggWorkflowState, actor: string, id: string, game: number) =>
  applyEggAction(state, 'g', actor, { type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 1, complete: true, eggs: [stock(id, game)] }, 1);
test('authenticated spot flow reserves only after accepting and receipt is demander-only/idempotent', () => {
  let state = sync(sync(initial(), 'a', 'back', 3436), 'b', 'give', 3227);
  state = applyEggAction(state, 'g', 'a', { type: 'list', id: 'back', listed: true }, 2);
  state = applyEggAction(state, 'g', 'b', { type: 'propose', id: 't', demandId: 'd', giveId: 'give', receiveId: 'back' }, 3);
  expect(state.eggs.every(e => e.status === 'available')).toBe(true);
  expect(() => applyEggAction(state, 'g', 'b', { type: 'accept', id: 't' }, 4)).toThrow();
  state = applyEggAction(state, 'g', 'a', { type: 'accept', id: 't' }, 4);
  expect(state.eggs.every(e => e.status === 'reserved')).toBe(true);
  expect(() => applyEggAction(state, 'g', 'b', { type: 'receive', id: 't' }, 5)).toThrow();
  state = applyEggAction(state, 'g', 'a', { type: 'receive', id: 't' }, 5);
  // 双向确认：需求方点完只记自己那侧，单子停在「交接中」，不结单、不发次数。
  expect(state.trades[0]).toMatchObject({ status: 'accepted', giveConfirmedAt: 5 });
  expect(state.demands[0].fulfilled).toBe(0);
  state = applyEggAction(state, 'g', 'b', { type: 'confirm-return', id: 't' }, 6);
  expect(state.demands[0].fulfilled).toBe(1);
  expect(applyEggAction(state, 'g', 'a', { type: 'receive', id: 't' }, 7).demands[0].fulfilled).toBe(1);
});
test('custom offer carries actual parent IDs; no receipt before placement, no special return egg', () => {
  let state = sync(initial(), 'a', 'back', 3436);
  state = applyEggAction(state, 'g', 'a', { type: 'list', id: 'back', listed: true }, 2);
  state = applyEggAction(state, 'g', 'b', { type: 'propose', id: 't', demandId: 'd', receiveId: 'back',
    line: { eggGameId: 3227, nature: '固执', body: '', voice: '', gameAccountKey: 'uid:2', motherId: 'm', fatherId: 'f' } }, 3);
  state = applyEggAction(state, 'g', 'a', { type: 'accept', id: 't' }, 4);
  expect(() => applyEggAction(state, 'g', 'a', { type: 'receive', id: 't' }, 5)).toThrow(/上窝/);
  state = applyEggAction(state, 'g', 'b', { type: 'place', id: 't' }, 5);
  state=sync(state,'b','hatched',3227);
  state=applyEggAction(state,'g','b',{type:'allocate',id:'t',eggId:'hatched'},6);
  state = applyEggAction(state, 'g', 'a', { type: 'receive', id: 't' }, 6);
  expect(state.trades[0].status).toBe('accepted');
  state = applyEggAction(state, 'g', 'b', { type: 'confirm-return', id: 't' }, 6);
  expect(state.demands[0].status).toBe('fulfilled');
});
test('cross-group actions, special eggs and spoofed owners cannot mutate state', () => {
  const state = sync(sync(initial(), 'a', 'back', 3436), 'b', 'give', 3227);
  const action = { type: 'propose', id: 't', demandId: 'd', giveId: 'give', receiveId: 'back' };
  expect(() => applyEggAction(state, 'other', 'b', action, 2)).toThrow(/小组/);
  expect(() => applyEggAction(state, 'g', 'c', { type: 'list', id: 'back', listed: true }, 2)).toThrow();
  const special = applyEggAction(state, 'g', 'b', { type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 2, complete: true,
    eggs: [{ ...stock('give', 3227), kind: 'shiny' }] }, 2);
  expect(() => applyEggAction(special, 'g', 'b', { type: 'list', id: 'give', listed: true }, 3)).toThrow();
});
test('cancelling a competing proposal never unlocks stock reserved by an accepted task', () => {
  let state = sync(sync(initial(), 'a', 'back', 3436), 'b', 'give', 3227);
  state.demands[0].quantity = 2;
  state = applyEggAction(state, 'g', 'a', { type: 'list', id: 'back', listed: true }, 2);
  for (const id of ['t1', 't2']) state = applyEggAction(state, 'g', 'b', { type: 'propose', id, demandId: 'd', giveId: 'give', receiveId: 'back' }, 3);
  state = applyEggAction(state, 'g', 'a', { type: 'accept', id: 't1' }, 4);
  state = applyEggAction(state, 'g', 'b', { type: 'cancel', id: 't2' }, 5);
  expect(state.eggs.every(e => e.status === 'reserved')).toBe(true);
});
test('the exact same parent pair is not reserved twice', () => {
  let state = sync(initial(), 'a', 'back', 3436);
  state.demands[0].quantity = 2;
  state.eggs.push({ ...state.eggs[0], id: 'back2' });
  for (const id of ['back', 'back2']) state = applyEggAction(state, 'g', 'a', { type: 'list', id, listed: true }, 2);
  const line = { eggGameId: 3227, nature: '固执', body: '', voice: '', gameAccountKey: 'uid:2', motherId: 'm', fatherId: 'f' };
  for (const [id, receiveId] of [['t1', 'back'], ['t2', 'back2']]) state = applyEggAction(state, 'g', 'b', { type: 'propose', id, demandId: 'd', receiveId, line }, 3);
  state = applyEggAction(state, 'g', 'a', { type: 'accept', id: 't1' }, 4);
  expect(() => applyEggAction(state, 'g', 'a', { type: 'accept', id: 't2' }, 5)).toThrow(/亲本/);
});

test('bilateral custom trades wait for both owners to place and only the demander receives',()=>{
  let state=initial();
  state.demands.push(createDemand({id:'return',groupId:'g',demanderAccountId:'b',eggGameId:3436,natures:['固执'],body:'',voice:'',quantity:1}));
  const line={eggGameId:3227,nature:'固执',body:'',voice:'',gameAccountKey:'uid:2',motherId:'m',fatherId:'f'};
  const returnLine={...line,eggGameId:3436,gameAccountKey:'uid:1',motherId:'m1',fatherId:'f1'};
  state=applyEggAction(state,'g','a',{type:'line-sync',lines:[{...returnLine,id:'offer-a'}]},1);
  state=applyEggAction(state,'g','b',{type:'propose',id:'t',demandId:'d',line,returnLineId:'offer-a',returnDemandId:'return'},2);
  state=applyEggAction(state,'g','a',{type:'accept',id:'t'},3);
  state=applyEggAction(state,'g','b',{type:'place',id:'t'},4);
  expect(()=>applyEggAction(state,'g','a',{type:'receive',id:'t'},5)).toThrow(/上窝/);
  state=applyEggAction(state,'g','a',{type:'place',id:'t'},5);
  expect(()=>applyEggAction(state,'g','b',{type:'receive',id:'t'},6)).toThrow(/需求方/);
  state=sync(state,'b','hatched-b',3227);state=sync(state,'a','hatched-a',3436);
  state=applyEggAction(state,'g','b',{type:'allocate',id:'t',eggId:'hatched-b'},6);state=applyEggAction(state,'g','a',{type:'allocate',id:'t',eggId:'hatched-a'},6);
  state=applyEggAction(state,'g','a',{type:'receive',id:'t'},6);
  expect(state.demands.map(d=>d.status)).toEqual(['open','open']);
  state=applyEggAction(state,'g','b',{type:'confirm-return',id:'t'},6);
  expect(state.demands.map(d=>d.status)).toEqual(['fulfilled','fulfilled']);
});

test('a demander requests a published custom line and stale line withdrawals invalidate proposals',()=>{
  let state=sync(initial(),'a','back',3436);
  const line={eggGameId:3227,nature:'固执',body:'',voice:'',gameAccountKey:'uid:2',motherId:'m',fatherId:'f'};
  state=applyEggAction(state,'g','b',{type:'line-sync',lines:[{...line,id:'offer'}]},1);
  state=applyEggAction(state,'g','a',{type:'request',id:'t',demandId:'d',supplierAccountId:'b',lineId:'offer',receiveId:'back'},2);
  const before=state;
  state=applyEggAction(state,'g','b',{type:'accept',id:'t'},3);
  expect(state.trades[0].line?.motherId).toBe('m');
  const removed=applyEggAction(before,'g','b',{type:'line-sync',lines:[]},3);
  expect(()=>applyEggAction(removed,'g','b',{type:'accept',id:'t'},4)).toThrow(/产线/);
});

test('one academy parent supports two distinct partners, a second academy parent is rejected',()=>{
  let state=sync(initial(),'a','back',3436);state.demands[0].quantity=4;
  state.eggs.push(...['2','3','4'].map(i=>({...state.eggs[0],id:'back'+i})));
  state.eggs.forEach(e=>e.listed=true);
  const line={eggGameId:3227,nature:'固执',body:'',voice:'',gameAccountKey:'uid:2',motherId:'m',fatherId:'f',greenParentId:'f'};
  for(const [id,receiveId,motherId,fatherId] of [['t1','back','m1','f'],['t2','back2','m2','f'],['t3','back3','m3','f'],['t4','back4','m4','other']]){
    state=applyEggAction(state,'g','b',{type:'propose',id,demandId:'d',receiveId,line:{...line,motherId,fatherId,greenParentId:fatherId}},2);
  }
  state=applyEggAction(state,'g','a',{type:'accept',id:'t1'},3);
  state=applyEggAction(state,'g','a',{type:'accept',id:'t2'},4);
  expect(()=>applyEggAction(state,'g','a',{type:'accept',id:'t3'},5)).toThrow(/亲本|配对/);
  expect(()=>applyEggAction(state,'g','a',{type:'accept',id:'t4'},5)).toThrow(/学院/);
});
test('accepting rejects either egg changed since proposal', () => {
  let state = sync(sync(initial(), 'a', 'back', 3436), 'b', 'give', 3227);
  state = applyEggAction(state, 'g', 'a', { type: 'list', id: 'back', listed: true }, 2);
  state = applyEggAction(state, 'g', 'b', { type: 'propose', id: 't', demandId: 'd', giveId: 'give', receiveId: 'back' }, 3);
  state = applyEggAction(state, 'g', 'a', { type: 'label', id: 'back', nature: '开朗', body: '', voice: '' }, 4);
  expect(() => applyEggAction(state, 'g', 'a', { type: 'accept', id: 't' }, 5)).toThrow(/属性/);
});

test('a demander can request listed supply; only the other member accepts and the demander receives', () => {
  let state = sync(sync(initial(), 'a', 'back', 3436), 'b', 'give', 3227);
  state = applyEggAction(state, 'g', 'b', { type: 'list', id: 'give', listed: true }, 2);
  state = applyEggAction(state, 'g', 'a', { type: 'request', id: 't', demandId: 'd', supplierAccountId: 'b', giveId: 'give', receiveId: 'back' }, 3);
  expect(() => applyEggAction(state, 'g', 'a', { type: 'accept', id: 't' }, 4)).toThrow();
  state = applyEggAction(state, 'g', 'b', { type: 'accept', id: 't' }, 4);
  expect(state.eggs.every(e => e.status === 'reserved')).toBe(true);
  state = applyEggAction(state, 'g', 'a', { type: 'receive', id: 't' }, 5);
  expect(state.demands[0].fulfilled).toBe(0);
  state = applyEggAction(state, 'g', 'b', { type: 'confirm-return', id: 't' }, 5);
  expect(state.demands[0].fulfilled).toBe(1);
});

test('a request must match the supplier return demand when one is selected', () => {
  let state = sync(sync(initial(), 'a', 'back', 3436), 'b', 'give', 3227);
  state.demands.push(createDemand({ id: 'peer', groupId: 'g', demanderAccountId: 'b', eggGameId: 3001, natures: [], body: '', voice: '', quantity: 1 }));
  state = applyEggAction(state, 'g', 'b', { type: 'list', id: 'give', listed: true }, 2);
  expect(() => applyEggAction(state, 'g', 'a', { type: 'request', id: 't', demandId: 'd', supplierAccountId: 'b', giveId: 'give', receiveId: 'back', returnDemandId: 'peer' }, 3)).toThrow(/需求/);
});

test('a special egg cannot be downgraded by a later ordinary import', () => {
  let state = sync(initial(), 'a', 'e', 3227);
  state.eggs[0].kind = 'special';
  state = applyEggAction(state, 'g', 'a', { type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 2, complete: true, eggs: [stock('e',3227)] }, 2);
  expect(state.eggs[0].kind).toBe('special');
});

test('stock sync cannot erase self-bred provenance or concrete egg labels', () => {
  let state = applyEggAction(initial(), 'g', 'a', {
    type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 1, complete: true,
    eggs: [{ ...stock('e', 3227), provenance: 'self-bred', greenNest: true, heightCm: 23, weightGrams: 1234 }],
  }, 1);
  expect(state.eggs[0]).toMatchObject({
    provenance: 'self-bred', greenNest: true, heightCm: 23, weightGrams: 1234,
  });

  state = applyEggAction(state, 'g', 'a', {
    type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 2, complete: true,
    eggs: [{ ...stock('e', 3227), provenance: 'unknown', greenNest: false }],
  }, 2);
  expect(state.eggs[0]).toMatchObject({ provenance: 'self-bred', greenNest: true });
});

test('stock sync backfills green nest from parents without overriding manual opt-out', () => {
  const parents = {
    mother: { id: 'm', gameId: 3124, name: '脆筒甜甜', nature: '胆小', body: '大块头', voice: '+100', nestName: '学院小窝', academy: true },
    fathers: [{ id: 'f', gameId: 3124, name: '脆筒甜甜', nature: '胆小', body: '大块头', voice: '婉转声', nestName: '普通小窝' }],
    confirmed: false,
  };
  const syncEgg = (at: number) => applyEggAction(initial(), 'g', 'a', {
    type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: at, complete: true,
    eggs: [{ ...stock('e', 3124), parents }],
  }, at);
  // 历史蛋：父母里有学院小窝、蛋上没 greenNest → 回填
  let state = syncEgg(1);
  expect(state.eggs[0].greenNest).toBe(true);
  // 走一遍手动取消，再同步（父母仍是学院小窝）→ 保持 false
  state = applyEggAction(state, 'g', 'a', {
    type: 'label', id: 'e', nature: '胆小', body: '大块头', voice: '婉转声', greenNest: false,
  }, 2);
  expect(state.eggs[0].greenNest).toBe(false);
  const resynced = applyEggAction(state, 'g', 'a', {
    type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 3, complete: true,
    eggs: [{ ...stock('e', 3124), parents }],
  }, 3);
  expect(resynced.eggs[0].greenNest).toBe(false);
}, 10_000);

test('manual labels include green nest and preserve concrete unavailable category', () => {
  let state = applyEggAction(initial(), 'g', 'a', {
    type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 1, complete: true,
    eggs: [{ ...stock('e', 3227), specialCategory: 'activity' }],
  }, 1);
  state.eggs[0].kind = 'ordinary';
  state = applyEggAction(state, 'g', 'a', {
    type: 'label', id: 'e', nature: '冷静/平和', body: '大块头', voice: '婉转声', greenNest: true,
  }, 2);
  expect(state.eggs[0]).toMatchObject({
    nature: '冷静/平和', body: '大块头', voice: '婉转声', greenNest: true, labelSource: 'manual',
  });
});

test('one action labels every available egg of the same species but leaves other species alone', () => {
  let state = applyEggAction(initial(), 'g', 'a', {
    type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 1, complete: true,
    eggs: [stock('one', 3227), stock('two', 3227), stock('other', 3436)],
  }, 1);
  state = applyEggAction(state, 'g', 'a', {
    type: 'label-many', eggGameId: 3227, gameAccountKey: 'uid:1', nature: '冷静/平和', body: '大块头', voice: '婉转声', greenNest: true,
  }, 2);
  expect(state.eggs.filter(egg => egg.eggGameId === 3227)).toMatchObject([
    { nature: '冷静/平和', body: '大块头', voice: '婉转声', labelSource: 'manual' },
    { nature: '冷静/平和', body: '大块头', voice: '婉转声', labelSource: 'manual' },
  ]);
  // 绿窝是逐颗事实：批量动作即使带了 greenNest 也不写（R4-10）。
  expect(state.eggs.filter(egg => egg.eggGameId === 3227).every(egg => egg.greenNest === undefined)).toBe(true);
  expect(state.eggs.find(egg => egg.id === 'other')).toMatchObject({ nature: '固执', labelSource: 'unknown' });
});

test('批量标注只改指定游戏角色的同种蛋，另一个角色的同种蛋不动（R4-10）', () => {
  let state = applyEggAction(initial(), 'g', 'a', {
    type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 1, complete: true, eggs: [stock('r1', 3227)],
  }, 1);
  state = applyEggAction(state, 'g', 'a', {
    type: 'stock-sync', gameAccountKey: 'uid:2', capturedAt: 1, complete: true, eggs: [stock('r2', 3227)],
  }, 1);
  state = applyEggAction(state, 'g', 'a', {
    type: 'label-many', eggGameId: 3227, gameAccountKey: 'uid:1',
    nature: '冷静/平和', body: '大块头', voice: '婉转声',
  }, 2);
  expect(state.eggs.find(egg => egg.id === 'r1')).toMatchObject({ nature: '冷静/平和', labelSource: 'manual' });
  expect(state.eggs.find(egg => egg.id === 'r2')).toMatchObject({ nature: '固执', labelSource: 'unknown' });
});

test('同种蛋里有一颗在换蛋中时，批量标注跳过它而不是整批失败（R4-10）', () => {
  let state = applyEggAction(initial(), 'g', 'a', {
    type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 1, complete: true,
    eggs: [stock('free', 3227), stock('busy', 3227)],
  }, 1);
  state.eggs.find(egg => egg.id === 'busy')!.status = 'reserved';
  state = applyEggAction(state, 'g', 'a', {
    type: 'label-many', eggGameId: 3227, gameAccountKey: 'uid:1',
    nature: '冷静/平和', body: '大块头', voice: '婉转声',
  }, 2);
  expect(state.eggs.find(egg => egg.id === 'free')).toMatchObject({ nature: '冷静/平和', labelSource: 'manual' });
  expect(state.eggs.find(egg => egg.id === 'busy')).toMatchObject({ nature: '固执', status: 'reserved', labelSource: 'unknown' });
});

test('同类蛋全都不可流通时批量标注是空操作，不推进状态（R4-10）', () => {
  const state = applyEggAction(initial(), 'g', 'a', {
    type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 1, complete: true, eggs: [stock('busy', 3227)],
  }, 1);
  state.eggs[0]!.status = 'reserved';
  expect(applyEggAction(state, 'g', 'a', {
    type: 'label-many', eggGameId: 3227, gameAccountKey: 'uid:1',
    nature: '冷静/平和', body: '大块头', voice: '婉转声',
  }, 2)).toBe(state);
});

test('批量标注不写绿窝：两颗同种蛋各自保留自己的绿窝标记（R4-10）', () => {
  let state = applyEggAction(initial(), 'g', 'a', {
    type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 1, complete: true,
    eggs: [{ ...stock('green', 3227), greenNest: true }, stock('plain', 3227)],
  }, 1);
  state = applyEggAction(state, 'g', 'a', {
    type: 'label-many', eggGameId: 3227, gameAccountKey: 'uid:1',
    nature: '冷静/平和', body: '大块头', voice: '婉转声', greenNest: true,
  }, 2);
  expect(state.eggs.find(egg => egg.id === 'green')?.greenNest).toBe(true);
  expect(state.eggs.find(egg => egg.id === 'plain')?.greenNest).toBeUndefined();
});

test('背包与家园各自记水印：较晚导入的旧家园快照不再被背包时间挡掉', () => {
  const bagEgg = { ...stock('bag1', 3227), location: 'bag' as const, lastConfirmedAt: 12 * 3600_000 };
  const homeEgg = { ...stock('home1', 3436), location: 'home' as const, lastConfirmedAt: 11 * 3600_000 + 50 * 60_000 };
  let state = applyEggAction(initial(), 'g', 'a', {
    type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 12 * 3600_000, complete: true, eggs: [bagEgg],
  }, 1);
  expect(state.eggs.map(egg => egg.id)).toEqual(['bag1']);
  // 家园快照比背包旧：只影响家园这一侧，家园蛋仍要入库
  state = applyEggAction(state, 'g', 'a', {
    type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 11 * 3600_000 + 50 * 60_000,
    complete: false, homeComplete: true, eggs: [bagEgg, homeEgg],
  }, 2);
  expect(state.eggs.map(egg => egg.id).sort()).toEqual(['bag1', 'home1']);
  // 再回放同一份旧家园快照：家园水印已推进，整批忽略
  expect(applyEggAction(state, 'g', 'a', {
    type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 11 * 3600_000 + 50 * 60_000,
    complete: false, homeComplete: true, eggs: [bagEgg, homeEgg],
  }, 3)).toBe(state);
});

test('batch publishing is atomic and marks green nest only with a chosen nature',()=>{
  const draft={id:'one',eggGameId:3227,natures:['固执'],body:'大块头',voice:'婉转声',quantity:2,greenNest:true};
  const state=applyEggAction(emptyEggWorkflow(),'g','a',{type:'publish-batch',demands:[draft,{...draft,id:'two',eggGameId:3436}]},1);
  expect(state.demands).toHaveLength(2);
  expect(state.demands[0].greenNest).toBe(true);
  expect(()=>applyEggAction(emptyEggWorkflow(),'g','a',{type:'publish-batch',demands:[draft,{...draft,id:'two',natures:[]}]},1)).toThrow(/性格/);
});

test('accepted obligations lock either linked demand against edits and cancelling requires a fresh capture before relisting removed eggs',()=>{
  let state=sync(sync(initial(),'a','back',3436),'b','give',3227);
  state.demands.push(createDemand({id:'return',groupId:'g',demanderAccountId:'b',eggGameId:3436,natures:[],body:'',voice:'',quantity:1}));
  state=applyEggAction(state,'g','a',{type:'list',id:'back',listed:true},2);
  state=applyEggAction(state,'g','b',{type:'propose',id:'t',demandId:'d',giveId:'give',receiveId:'back',returnDemandId:'return'},3);
  state=applyEggAction(state,'g','a',{type:'accept',id:'t'},4);
  expect(()=>applyEggAction(state,'g','b',{type:'withdraw',id:'return'},5)).toThrow();
});

test('raw special-item evidence overrides an ordinary kind claim',()=>{
  const state=applyEggAction(initial(),'g','a',{type:'stock-sync',gameAccountKey:'uid:1',capturedAt:1,complete:true,eggs:[{...stock('s',3227),itemConfId:150727,preciousEggType:2}]},1);
  expect(()=>applyEggAction(state,'g','a',{type:'list',id:'s',listed:true},2)).toThrow();
});

test('a reserved egg absent from a full capture is removed on cancellation, not resurrected',()=>{
  let state=sync(sync(initial(),'a','back',3436),'b','give',3227);
  state=applyEggAction(state,'g','a',{type:'list',id:'back',listed:true},2);
  state=applyEggAction(state,'g','b',{type:'propose',id:'t',demandId:'d',giveId:'give',receiveId:'back'},3);
  state=applyEggAction(state,'g','a',{type:'accept',id:'t'},4);
  state=applyEggAction(state,'g','b',{type:'stock-sync',gameAccountKey:'uid:1',capturedAt:5,complete:true,eggs:[]},5);
  state=applyEggAction(state,'g','a',{type:'cancel',id:'t'},6);
  expect(state.eggs.find(e=>e.id==='give')).toBeUndefined();
  expect(state.eggs.find(e=>e.id==='back')?.status).toBe('available');
});

test('a hatched egg is allocated once and cannot circulate again after custom receipt',()=>{
  let state=sync(initial(),'a','back',3436);
  state=applyEggAction(state,'g','a',{type:'list',id:'back',listed:true},2);
  state=applyEggAction(state,'g','b',{type:'propose',id:'t',demandId:'d',receiveId:'back',line:{eggGameId:3227,nature:'固执',body:'',voice:'',gameAccountKey:'uid:2',motherId:'m',fatherId:'f'}},3);
  state=applyEggAction(state,'g','a',{type:'accept',id:'t'},4);
  state=applyEggAction(state,'g','b',{type:'place',id:'t'},5);
  state=sync(state,'b','hatched',3227);
  state=applyEggAction(state,'g','b',{type:'allocate',id:'t',eggId:'hatched'},6);
  expect(state.eggs.find(e=>e.id==='hatched')?.status).toBe('reserved');
  expect(state.trades[0].give.id).toBe('hatched');
  state=applyEggAction(state,'g','a',{type:'receive',id:'t'},7);
  expect(state.eggs.find(e=>e.id==='hatched')?.status).toBe('reserved');
  state=applyEggAction(state,'g','b',{type:'confirm-return',id:'t'},7);
  expect(state.eggs.find(e=>e.id==='hatched')?.status).toBe('transferred');
  expect(()=>applyEggAction(state,'g','b',{type:'list',id:'hatched',listed:true},8)).toThrow();
});

test('a custom task waits for actual egg allocation and rejects mismatched or special eggs',()=>{
  let state=sync(initial(),'a','back',3436);
  state=applyEggAction(state,'g','a',{type:'list',id:'back',listed:true},2);
  state=applyEggAction(state,'g','b',{type:'propose',id:'t',demandId:'d',receiveId:'back',line:{eggGameId:3227,nature:'固执',body:'',voice:'',gameAccountKey:'uid:2',motherId:'m',fatherId:'f'}},3);
  state=applyEggAction(state,'g','a',{type:'accept',id:'t'},4);
  state=applyEggAction(state,'g','b',{type:'place',id:'t'},5);
  expect(()=>applyEggAction(state,'g','a',{type:'receive',id:'t'},6)).toThrow(/现蛋/);
  state=sync(state,'b','wrong',3436);
  expect(()=>applyEggAction(state,'g','b',{type:'allocate',id:'t',eggId:'wrong'},6)).toThrow(/不符合/);
  state=applyEggAction(state,'g','b',{type:'stock-sync',gameAccountKey:'uid:1',capturedAt:2,complete:true,eggs:[stock('special',3227)]},6);state.eggs.find(e=>e.id==='special')!.kind='shiny';
  expect(()=>applyEggAction(state,'g','b',{type:'allocate',id:'t',eggId:'special'},6)).toThrow();
});

test('fulfilling a linked return demand cancels its obsolete proposals',()=>{
  let state=sync(sync(initial(),'a','back',3436),'b','give',3227);
  state.demands.push(createDemand({id:'return',groupId:'g',demanderAccountId:'b',eggGameId:3436,natures:[],body:'',voice:'',quantity:1}));
  state=applyEggAction(state,'g','a',{type:'list',id:'back',listed:true},2);
  for(const id of ['t1','t2'])state=applyEggAction(state,'g','b',{type:'propose',id,demandId:'d',giveId:'give',receiveId:'back',returnDemandId:'return'},3);
  state=applyEggAction(state,'g','a',{type:'accept',id:'t1'},4);
  state=applyEggAction(state,'g','a',{type:'receive',id:'t1'},5);
  // 单边确认还没结单：竞争提案此时不能解散
  expect(state.trades.find(t=>t.id==='t2')?.status).toBe('proposed');
  state=applyEggAction(state,'g','b',{type:'confirm-return',id:'t1'},6);
  expect(state.trades.find(t=>t.id==='t2')?.status).toBe('cancelled');
});


test('manual reminders allow exactly the half-hour boundary and never renew themselves', () => {
  let state = sync(sync(initial(), 'a', 'back', 3436), 'b', 'give', 3227);
  state = applyEggAction(state, 'g', 'a', { type: 'list', id: 'back', listed: true }, 2);
  state = applyEggAction(state, 'g', 'b', { type: 'propose', id: 't', demandId: 'd', giveId: 'give', receiveId: 'back' }, 3);
  state = applyEggAction(state, 'g', 'a', { type: 'remind', id: 't' }, 1000);
  expect(() => applyEggAction(state, 'g', 'b', { type: 'remind', id: 't' }, 1800999)).toThrow(/已经催过/);
  const next = applyEggAction(state, 'g', 'b', { type: 'remind', id: 't' }, 1801000);
  expect(next.trades[0].reminderAt).toBe(1801000);
  expect(next.trades[0].reminderBy).toBe('b');
  expect(state.trades[0].reminderAt).toBe(1000);
});

test('captured obtained time is kept by stock sync and survives a later capture without it', () => {
  let state = applyEggAction(emptyEggWorkflow(), 'g', 'a', { type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 1, complete: true,
    eggs: [{ ...stock('e', 3227), obtainedAt: '2026-11-17T22:31:00' }] }, 1);
  expect(state.eggs[0].obtainedAt).toBe('2026-11-17T22:31:00');
  state = applyEggAction(state, 'g', 'a', { type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 2, complete: true, eggs: [stock('e', 3227)] }, 2);
  expect(state.eggs[0].obtainedAt).toBe('2026-11-17T22:31:00');
});

test('a merged home egg moves to the bag without leaving a second row under the same id', () => {
  let state = applyEggAction(emptyEggWorkflow(), 'g', 'a', { type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 1,
    complete: false, homeComplete: true, eggs: [{ ...stock('home1', 3227), location: 'home', provenance: 'self-bred' }] }, 1);
  state = applyEggAction(state, 'g', 'a', { type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 2,
    complete: true, homeComplete: false,
    eggs: [{ ...stock('home1', 3227), location: 'bag', provenance: 'unknown', capturedEggId: 'bag1', obtainedAt: '2026-11-17T22:31:00' }] }, 2);
  expect(state.eggs).toHaveLength(1);
  expect(state.eggs[0]).toMatchObject({ id: 'home1', location: 'bag', provenance: 'self-bred',
    capturedEggId: 'bag1', obtainedAt: '2026-11-17T22:31:00' });
});

test('a home egg keeps its bag merge link through stock sync even when a later capture omits it', () => {
  let state = applyEggAction(emptyEggWorkflow(), 'g', 'a', { type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 1,
    complete: true, eggs: [{ ...stock('home1', 3227), location: 'bag', capturedEggId: 'bag1' }] }, 1);
  expect(state.eggs[0]).toMatchObject({ id: 'home1', capturedEggId: 'bag1' });
  state = applyEggAction(state, 'g', 'a', { type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 2,
    complete: true, eggs: [{ ...stock('home1', 3227), location: 'bag' }] }, 2);
  expect(state.eggs).toHaveLength(1);
  expect(state.eggs[0].capturedEggId).toBe('bag1');
});

test('old records without obtained time stay valid and unusable values are dropped', () => {
  const old = applyEggAction(emptyEggWorkflow(), 'g', 'a', { type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 1, complete: true, eggs: [stock('e', 3227)] }, 1);
  expect(old.eggs[0].obtainedAt).toBeUndefined();
  const bad = applyEggAction(emptyEggWorkflow(), 'g', 'a', { type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 1, complete: true,
    eggs: [{ ...stock('e', 3227), obtainedAt: '不是时间' }] }, 1);
  expect(bad.eggs[0].obtainedAt).toBeUndefined();
});

const parents = { mother: { id: 'm', gameId: 3227, name: '菊花梨', nature: '保守', body: '大块头', voice: '+100', nestName: '普通小窝' },
  fathers: [{ id: 'f', gameId: 3215, name: '海豹战士', nature: '胆小', body: '大块头', voice: '婉转声' }], confirmed: false };
const homeEgg = (over: Record<string, unknown>) => ({ ...stock('home1', 3227), location: 'home', labelSource: 'system',
  parents, lastConfirmedAt: 1763391600000, ...over });

test('homeComplete removes only home eggs and keeps bag stock', () => {
  let state = sync(initial(), 'a', 'bag1', 3436);
  state = applyEggAction(state, 'g', 'a', { type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 2, complete: false, homeComplete: true,
    eggs: [stock('bag1', 3436), homeEgg({})] }, 2);
  expect(state.eggs).toHaveLength(2);
  expect(state.eggs.find(e => e.id === 'home1')).toMatchObject({ location: 'home', labelSource: 'system', confidence: 'system', lastConfirmedAt: 1763391600000 });
  state = applyEggAction(state, 'g', 'a', { type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 3, complete: false, homeComplete: true,
    eggs: [stock('bag1', 3436)] }, 3);
  expect(state.eggs.map(e => e.id)).toEqual(['bag1']);
});

test('bag complete never deletes home eggs, and a home egg without parents cannot claim system', () => {
  let state = applyEggAction(emptyEggWorkflow(), 'g', 'a', { type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 1, complete: false,
    homeComplete: true, eggs: [homeEgg({})] }, 1);
  state = applyEggAction(state, 'g', 'a', { type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 2, complete: true, homeComplete: false,
    eggs: [] }, 2);
  expect(state.eggs.map(e => e.id)).toEqual(['home1']);
  const bare = applyEggAction(emptyEggWorkflow(), 'g', 'a', { type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 1, complete: true,
    eggs: [homeEgg({ parents: undefined })] }, 1);
  expect(bare.eggs[0].labelSource).toBe('unknown');
  expect(bare.eggs[0].confidence).toBe('unknown');
});

test('待认领的家蛋行随库存同步保留，并带上待认领标记（不再当失效蛋删掉）', () => {
  let state = applyEggAction(emptyEggWorkflow(), 'g', 'a', { type: 'stock-sync', gameAccountKey: 'uid:1',
    capturedAt: 1, complete: false, homeComplete: true, eggs: [homeEgg({ provenance: 'self-bred' })] }, 1);
  expect(state.eggs).toHaveLength(1);
  // 下一次同步：家园完整快照已经空了，客户端按「保底」把这一行带着 claimPending 一起发上来。
  state = applyEggAction(state, 'g', 'a', { type: 'stock-sync', gameAccountKey: 'uid:1',
    capturedAt: 2, complete: false, homeComplete: true, eggs: [homeEgg({ claimPending: true })] }, 2);
  expect(state.eggs).toHaveLength(1);
  expect(state.eggs[0]).toMatchObject({ id: 'home1', location: 'home', claimPending: true,
    provenance: 'self-bred', labelSource: 'system', listed: false, parents });
  // 关键：绝不能落 missingFromCapture —— 自动挂出、allocate / cancel、库清理都按它删「失效蛋」。
  expect(state.eggs[0].missingFromCapture).toBeUndefined();
});

test('manual labels survive later home captures and stay manual', () => {
  let state = applyEggAction(emptyEggWorkflow(), 'g', 'a', { type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 1, complete: false,
    homeComplete: true, eggs: [homeEgg({})] }, 1);
  state = applyEggAction(state, 'g', 'a', { type: 'label', id: 'home1', nature: '保守', body: '大块头', voice: '婉转声' }, 2);
  state = applyEggAction(state, 'g', 'a', { type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 3, complete: false,
    homeComplete: true, eggs: [homeEgg({ nature: '' })] }, 3);
  expect(state.eggs[0]).toMatchObject({ nature: '保守', labelSource: 'manual', confidence: 'manual' });
});

const measured = (id: string, over: Record<string, unknown> = {}) => ({
  ...stock(id, 3227), location: 'bag', weightGrams: 2320, heightCm: 34, obtainedAt: '2026-11-17T22:31:00',
  voice: '婉转声', ...over,
});
const bagSync = (state: EggWorkflowState, actor: string, capturedAt: number, eggs: unknown[]) =>
  applyEggAction(state, 'g', actor, { type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt, complete: true, eggs }, capturedAt);

test('a bag egg with weight height and obtained time is listed automatically', () => {
  const state = bagSync(emptyEggWorkflow(), 'a', 1, [measured('bag1')]);
  expect(state.eggs[0]).toMatchObject({ location: 'bag', listed: true, weightGrams: 2320, heightCm: 34,
    obtainedAt: '2026-11-17T22:31:00' });
});

test('a home egg is never listed automatically even with full measurements', () => {
  const state = applyEggAction(emptyEggWorkflow(), 'g', 'a', { type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 1,
    complete: false, homeComplete: true,
    eggs: [homeEgg({ voice: '婉转声', weightGrams: 2320, heightCm: 34, obtainedAt: '2026-11-17T22:31:00' })] }, 1);
  expect(state.eggs[0]).toMatchObject({ location: 'home', listed: false, voice: '婉转声', weightGrams: 2320, heightCm: 34,
    obtainedAt: '2026-11-17T22:31:00' });
});

test('a bag egg without voice is not listed', () => {
  let state = bagSync(emptyEggWorkflow(), 'a', 1, [measured('empty-voice', { voice: '' })]);
  expect(state.eggs[0].listed).toBe(false);
  state = bagSync(state, 'a', 2, [measured('empty-voice', { voice: 'unknown' })]);
  expect(state.eggs[0].listed).toBe(false);
});

test('a bag egg without nature is not listed', () => {
  let state = bagSync(emptyEggWorkflow(), 'a', 1, [measured('empty-nature', { nature: '' })]);
  expect(state.eggs[0].listed).toBe(false);
  state = bagSync(state, 'a', 2, [measured('empty-nature', { nature: '   ' })]);
  expect(state.eggs[0].listed).toBe(false);
});

test('a bag egg is listed once nature arrives', () => {
  // 声音等其余四项已经齐全，只差性格：不挂出；补上性格后同一颗蛋再同步 → 挂出。
  let state = bagSync(emptyEggWorkflow(), 'a', 1, [measured('later', { nature: '' })]);
  expect(state.eggs[0]).toMatchObject({ listed: false, voice: '婉转声' });
  state = bagSync(state, 'a', 2, [measured('later', { nature: '固执' })]);
  expect(state.eggs[0]).toMatchObject({ listed: true, nature: '固执' });
});

test('a bag egg missing weight height or obtained time is not listed automatically', () => {
  const state = bagSync(emptyEggWorkflow(), 'a', 1, [
    measured('no-time', { obtainedAt: undefined }),
    measured('no-height', { heightCm: undefined }),
    measured('no-weight', { weightGrams: undefined }),
  ]);
  expect(state.eggs.map(e => e.listed)).toEqual([false, false, false]);
});

test('a manual unlist is remembered and survives later captures', () => {
  let state = bagSync(emptyEggWorkflow(), 'a', 1, [measured('bag1')]);
  expect(state.eggs[0].listed).toBe(true);
  state = applyEggAction(state, 'g', 'a', { type: 'list', id: 'bag1', listed: false }, 2);
  expect(state.eggs[0]).toMatchObject({ listed: false, listingOptOut: true });
  state = bagSync(state, 'a', 3, [measured('bag1')]);
  expect(state.eggs[0].listed).toBe(false);
  // 之后哪怕抓到缺字段的同一颗蛋，也不该把它挂回去。
  state = bagSync(state, 'a', 4, [{ ...stock('bag1', 3227), location: 'bag' }]);
  expect(state.eggs[0].listed).toBe(false);
});

test('manually listing an egg again clears the opt-out', () => {
  let state = bagSync(emptyEggWorkflow(), 'a', 1, [measured('bag1')]);
  state = applyEggAction(state, 'g', 'a', { type: 'list', id: 'bag1', listed: false }, 2);
  state = applyEggAction(state, 'g', 'a', { type: 'list', id: 'bag1', listed: true }, 3);
  expect(state.eggs[0]).toMatchObject({ listed: true });
  expect(state.eggs[0].listingOptOut).toBeUndefined();
  state = bagSync(state, 'a', 4, [measured('bag1')]);
  expect(state.eggs[0].listed).toBe(true);
});

test('syncing the same payload twice changes no listing state', () => {
  const payload = [measured('bag1')];
  let state = bagSync(emptyEggWorkflow(), 'a', 1, payload);
  const first = state.eggs.map(e => ({ id: e.id, listed: e.listed, optOut: e.listingOptOut }));
  state = bagSync(state, 'a', 2, payload);
  expect(state.eggs.map(e => ({ id: e.id, listed: e.listed, optOut: e.listingOptOut }))).toEqual(first);
});

test('an accepted egg becomes reserved and is never auto-listed again', () => {
  let state = applyEggAction(initial(), 'g', 'a', { type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 1,
    complete: true, eggs: [measured('back', { eggGameId: 3436 })] }, 1);
  expect(state.eggs.find(e => e.id === 'back')?.listed).toBe(true);
  state = bagSync(state, 'b', 1, [stock('give', 3227)]);
  state = applyEggAction(state, 'g', 'b', { type: 'propose', id: 't', demandId: 'd', giveId: 'give', receiveId: 'back' }, 3);
  state = applyEggAction(state, 'g', 'a', { type: 'accept', id: 't' }, 4);
  expect(state.eggs.find(e => e.id === 'back')).toMatchObject({ status: 'reserved', listed: false });
  state = bagSync(state, 'a', 5, [measured('back', { eggGameId: 3436 })]);
  expect(state.eggs.find(e => e.id === 'back')).toMatchObject({ status: 'reserved', listed: false });
});

test('stock captured before the measurements existed is listed once the fields arrive', () => {
  let state = bagSync(emptyEggWorkflow(), 'a', 1, [{ ...stock('bag1', 3227), location: 'bag' }]);
  expect(state.eggs[0].listed).toBe(false);
  state = bagSync(state, 'a', 2, [measured('bag1')]);
  expect(state.eggs[0]).toMatchObject({ listed: true, obtainedAt: '2026-11-17T22:31:00', weightGrams: 2320, heightCm: 34 });
});

/**
 * R4-01（P1）：`listingOptOut` 是 2026-11-26 才加的字段。升级前用户手动下架过的蛋在旧数据里
 * 只有 `listed=false`、没有 `listingOptOut`，升级后第一次同步不能被当成「没下架」重新挂出去。
 *
 * 口径：自动挂出只对「本轮以后第一次被采集确认出现的蛋」生效（新行带 `autoListEligible`）；
 * 升级前就存在的历史行一律视为已下架，不批量回填（不回写 `listingOptOut`、不改 `listed`）。
 */
const legacyUnlisted = (): EggWorkflowState => ({
  ...emptyEggWorkflow(),
  eggs: [{
    id: 'old', accountId: 'a', gameAccountKey: 'uid:1', eggGameId: 3227, nature: '固执',
    body: 'unknown', voice: 'unknown', provenance: 'unknown', confidence: 'unknown',
    kind: 'ordinary', status: 'available', listed: false, location: 'bag',
  }],
});

test('升级前就存在且未挂出的历史蛋，升级后第一次同步仍不自动挂出（R4-01）', () => {
  const state = bagSync(legacyUnlisted(), 'a', 1, [measured('old')]);
  expect(state.eggs).toHaveLength(1);
  // 测量值照常合并进来（数据不能丢），但挂出状态保持用户原来的「未挂出」。
  expect(state.eggs[0]).toMatchObject({
    id: 'old', listed: false, weightGrams: 2320, heightCm: 34, obtainedAt: '2026-11-17T22:31:00',
  });
  // 不做批量回填：不给旧行补「已下架」标记，也不改任何用户可见状态。
  expect(state.eggs[0].listingOptOut).toBeUndefined();
  // 之后的每次采集同样不挂出。
  expect(bagSync(state, 'a', 2, [measured('old')]).eggs[0].listed).toBe(false);
});

test('历史蛋手动挂出后照常生效，且后续采集不会把它降回去（R4-01）', () => {
  let state = applyEggAction(legacyUnlisted(), 'g', 'a', { type: 'list', id: 'old', listed: true }, 2);
  expect(state.eggs[0]).toMatchObject({ listed: true });
  expect(state.eggs[0].listingOptOut).toBeUndefined();
  state = bagSync(state, 'a', 3, [measured('old')]);
  expect(state.eggs[0].listed).toBe(true);
});

test('本次采集才出现的完整蛋仍然自动挂出（R4-01 反例）', () => {
  const state = bagSync(emptyEggWorkflow(), 'a', 1, [measured('fresh')]);
  expect(state.eggs[0]).toMatchObject({ id: 'fresh', listed: true, location: 'bag' });
});

/* ------------------------------------------------------------------ *
 * 广场送蛋 + 免费领蛋（方案 V8 一期：数据与规则）
 *
 * 口径（docs/方案-广场送蛋与免费领蛋-2026-11-25.md §10.1）：
 * - 结单 = 双向确认（receive + confirm-return → finalize），双方各 +1 次、每单 +1、无限累积；
 * - 同一对成员 24h 只给 1 次；同一笔结单不重复发；同账号不能互换；
 * - 老单（receive === null / legacy）单边结单但**不发**次数（R7）；
 * - 送蛋不要求五项齐全；领取先到先得、扣 1 次；放弃退次数；领到的蛋不写库存。
 * ------------------------------------------------------------------ */

const chance = (state: EggWorkflowState, accountId: string) =>
  state.chances?.[accountId] ?? { balance: 0, grantedTotal: 0, claimedTotal: 0 };

/** 一单已接受的点对点换蛋：需求方 a、换出方 b。 */
const acceptedSpot = (): EggWorkflowState => {
  let state = sync(sync(initial(), 'a', 'back', 3436), 'b', 'give', 3227);
  state = applyEggAction(state, 'g', 'a', { type: 'list', id: 'back', listed: true }, 2);
  state = applyEggAction(state, 'g', 'b', { type: 'propose', id: 't', demandId: 'd', giveId: 'give', receiveId: 'back' }, 3);
  return applyEggAction(state, 'g', 'a', { type: 'accept', id: 't' }, 4);
};

test('结单改成双向确认：两边各点一次才 done，双方各 +1 次免费领蛋', () => {
  let state = applyEggAction(acceptedSpot(), 'g', 'a', { type: 'receive', id: 't' }, 5);
  expect(state.trades[0]).toMatchObject({ status: 'accepted', giveConfirmedAt: 5 });
  expect(state.demands[0].fulfilled).toBe(0);
  expect(state.eggs.every(egg => egg.status === 'reserved')).toBe(true);
  expect(chance(state, 'a')).toMatchObject({ balance: 0, grantedTotal: 0 });
  expect(chance(state, 'b')).toMatchObject({ balance: 0, grantedTotal: 0 });

  state = applyEggAction(state, 'g', 'b', { type: 'confirm-return', id: 't' }, 6);
  expect(state.trades[0]).toMatchObject({ status: 'done', completedAt: 6, chanceGranted: true });
  expect(state.trades[0].returnConfirmedAt).toBe(6);
  expect(state.demands[0].fulfilled).toBe(1);
  expect(state.eggs.every(egg => egg.status === 'transferred')).toBe(true);
  expect(chance(state, 'a')).toMatchObject({ balance: 1, grantedTotal: 1 });
  expect(chance(state, 'b')).toMatchObject({ balance: 1, grantedTotal: 1 });
});

test('换出方先点也一样；重复点确认是幂等的，不会重复发次数', () => {
  let state = applyEggAction(acceptedSpot(), 'g', 'b', { type: 'confirm-return', id: 't' }, 5);
  expect(state.trades[0]).toMatchObject({ status: 'accepted', returnConfirmedAt: 5 });
  expect(state.demands[0].fulfilled).toBe(0);
  state = applyEggAction(state, 'g', 'a', { type: 'receive', id: 't' }, 6);
  expect(state.trades[0].status).toBe('done');
  expect(chance(state, 'a').balance).toBe(1);

  const done = state;
  expect(applyEggAction(done, 'g', 'a', { type: 'receive', id: 't' }, 7)).toBe(done);
  expect(applyEggAction(done, 'g', 'b', { type: 'confirm-return', id: 't' }, 7)).toBe(done);
  expect(chance(done, 'a')).toMatchObject({ balance: 1, grantedTotal: 1 });
  expect(chance(done, 'b')).toMatchObject({ balance: 1, grantedTotal: 1 });
});

test('同一对成员 24h 内第二单：照常结单但不发次数；过了 24h 才再发', () => {
  const state0: EggWorkflowState = { ...initial() };
  state0.demands[0].quantity = 3;
  let state = applyEggAction(state0, 'g', 'a', { type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 1, complete: true,
    eggs: [stock('back1', 3436), stock('back2', 3436), stock('back3', 3436)] }, 1);
  state = applyEggAction(state, 'g', 'b', { type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 1, complete: true,
    eggs: [stock('give1', 3227), stock('give2', 3227), stock('give3', 3227)] }, 1);
  for (const id of ['back1', 'back2', 'back3']) state = applyEggAction(state, 'g', 'a', { type: 'list', id, listed: true }, 2);
  const settle = (base: EggWorkflowState, n: number, at: number) => {
    let next = applyEggAction(base, 'g', 'b', { type: 'propose', id: 't' + n, demandId: 'd', giveId: 'give' + n, receiveId: 'back' + n }, at);
    next = applyEggAction(next, 'g', 'a', { type: 'accept', id: 't' + n }, at);
    next = applyEggAction(next, 'g', 'a', { type: 'receive', id: 't' + n }, at);
    return applyEggAction(next, 'g', 'b', { type: 'confirm-return', id: 't' + n }, at);
  };
  state = settle(state, 1, 10);
  expect(state.trades.find(t => t.id === 't1')).toMatchObject({ status: 'done', chanceGranted: true });
  expect(chance(state, 'a').balance).toBe(1);

  // 第 2 单：同一对成员、24h 内 → 结单照常、凭证照写，但不发次数
  state = settle(state, 2, 20);
  expect(state.trades.find(t => t.id === 't2')).toMatchObject({ status: 'done', chanceSuppressed: 'pair-24h' });
  expect(chance(state, 'a')).toMatchObject({ balance: 1, grantedTotal: 1 });
  expect(chance(state, 'b')).toMatchObject({ balance: 1, grantedTotal: 1 });

  // 第 3 单：距第 2 单满 24h（边界：正好 24h 不算「24h 内」，可以再发）
  state = settle(state, 3, 20 + 24 * 60 * 60 * 1000);
  expect(state.trades.find(t => t.id === 't3')).toMatchObject({ status: 'done', chanceGranted: true });
  expect(chance(state, 'a')).toMatchObject({ balance: 2, grantedTotal: 2 });
  expect(state.demands[0].fulfilled).toBe(3);
});

test('老单（单边 / 代孵迁移）仍单边结单，但绝不发免费领蛋次数（R7）', () => {
  const legacy: EggWorkflowState = { ...initial(), trades: [{
    id: 't', groupId: 'g', demandId: 'd', supplierAccountId: 'b', demanderAccountId: 'a',
    give: { id: 'give', accountId: 'b', eggGameId: 3227, nature: '固执', body: '', voice: '',
      provenance: 'unknown', confidence: 'unknown', status: 'reserved' },
    receive: null, type: 'spot', status: 'accepted', placed: true, createdAt: 1, legacy: true }] };
  const done = applyEggAction(legacy, 'g', 'a', { type: 'receive', id: 't' }, 5);
  expect(done.trades[0]).toMatchObject({ status: 'done', completedAt: 5 });
  expect(done.demands[0].fulfilled).toBe(1);
  expect(done.trades[0].chanceGranted).toBeUndefined();
  expect(chance(done, 'a').balance).toBe(0);
  expect(chance(done, 'b').balance).toBe(0);
  // 老单没有「换回的蛋」，换出方那一侧不存在确认
  expect(() => applyEggAction(legacy, 'g', 'b', { type: 'confirm-return', id: 't' }, 5)).toThrow();
  // 单边确认过的老单被别人点了第二下，也不会补发次数
  expect(applyEggAction(done, 'g', 'a', { type: 'receive', id: 't' }, 7)).toBe(done);
});

test('一方确认后取消：蛋不复活（直接 transferred）、次数不发也不退', () => {
  let state = applyEggAction(acceptedSpot(), 'g', 'a', { type: 'receive', id: 't' }, 5);
  const cancelled = applyEggAction(state, 'g', 'b', { type: 'cancel', id: 't' }, 6);
  expect(cancelled.trades[0].status).toBe('cancelled');
  expect(cancelled.eggs.every(egg => egg.status === 'transferred')).toBe(true);
  expect(chance(cancelled, 'a').balance).toBe(0);
  expect(chance(cancelled, 'b').balance).toBe(0);
  // 谁都没确认过才把蛋放回可流通
  const plain = applyEggAction(acceptedSpot(), 'g', 'b', { type: 'cancel', id: 't' }, 6);
  expect(plain.eggs.every(egg => egg.status === 'available')).toBe(true);
});

test('同一成员不能和自己换蛋（自换直接拒绝）', () => {
  let state = applyEggAction(initial(), 'g', 'a', { type: 'stock-sync', gameAccountKey: 'uid:1',
    capturedAt: 1, complete: true, eggs: [stock('one', 3436), stock('two', 3227)] }, 1);
  state = applyEggAction(state, 'g', 'a', { type: 'list', id: 'one', listed: true }, 2);
  expect(() => applyEggAction(state, 'g', 'a', { type: 'propose', id: 't', demandId: 'd', giveId: 'two', receiveId: 'one' }, 3)).toThrow();
  expect(() => applyEggAction(state, 'g', 'a', { type: 'request', id: 't', demandId: 'd', supplierAccountId: 'a', giveId: 'two', receiveId: 'one' }, 3)).toThrow();
});

test('送蛋：发布锁蛋（不要求五项齐全）、领取扣 1 次、先到先得、放弃退次数、撤回恢复挂出', () => {
  let state = sync(sync(initial(), 'a', 'back', 3436), 'b', 'give', 3227);
  state = applyEggAction(state, 'g', 'b', { type: 'list', id: 'give', listed: true }, 2);
  state = applyEggAction(state, 'g', 'b', { type: 'gift-publish', id: 'gift', eggId: 'give', note: '送你了' }, 3);
  expect(state.eggs.find(egg => egg.id === 'give')).toMatchObject({ status: 'reserved', listed: false });
  expect(state.gifts?.[0]).toMatchObject({
    id: 'gift', status: 'open', giverAccountId: 'b', eggId: 'give', wasListed: true, note: '送你了',
  });

  // 自己不能领自己的蛋
  expect(() => applyEggAction(state, 'g', 'b', { type: 'gift-claim', id: 'gift', claimId: 'c1' }, 4)).toThrow(/自己/);
  // 没有次数领不了
  expect(() => applyEggAction(state, 'g', 'a', { type: 'gift-claim', id: 'gift', claimId: 'c1' }, 4)).toThrow(/次数/);

  state.chances = { a: { balance: 1, grantedTotal: 1, claimedTotal: 0 } };
  state = applyEggAction(state, 'g', 'a', { type: 'gift-claim', id: 'gift', claimId: 'c1' }, 4);
  expect(state.chances?.a).toMatchObject({ balance: 0, claimedTotal: 1 });
  expect(state.gifts?.[0]).toMatchObject({ status: 'claimed', claimId: 'c1', claimerAccountId: 'a', claimedAt: 4 });
  // 领到的蛋不写库存：蛋还在送蛋人名下、只是锁着
  expect(state.eggs.find(egg => egg.id === 'give')).toMatchObject({ accountId: 'b', status: 'reserved' });
  expect(state.eggs.some(egg => egg.accountId === 'a' && egg.id === 'give')).toBe(false);

  // 同一笔领取重放：不重复扣次数
  const claimed = state;
  expect(applyEggAction(claimed, 'g', 'a', { type: 'gift-claim', id: 'gift', claimId: 'c1' }, 5)).toBe(claimed);
  expect(chance(claimed, 'a').balance).toBe(0);
  // 先到先得：已被领走，别人不能再领
  expect(() => applyEggAction(claimed, 'g', 'c', { type: 'gift-claim', id: 'gift', claimId: 'c2' }, 5)).toThrow(/领走/);

  // 放弃：次数退回、蛋回广场
  state = applyEggAction(claimed, 'g', 'a', { type: 'gift-cancel', id: 'gift' }, 5);
  expect(state.chances?.a).toMatchObject({ balance: 1, claimedTotal: 0 });
  expect(state.gifts?.[0]).toMatchObject({ status: 'open', releasedAt: 5 });
  expect(state.gifts?.[0].claimerAccountId).toBeUndefined();
  // 重复放弃不会二次退次数
  expect(() => applyEggAction(state, 'g', 'a', { type: 'gift-cancel', id: 'gift' }, 6)).toThrow();

  // 撤回：蛋回 available，恢复发布前的挂出状态
  state = applyEggAction(state, 'g', 'b', { type: 'gift-cancel', id: 'gift' }, 6);
  expect(state.gifts?.[0]).toMatchObject({ status: 'cancelled', cancelledAt: 6 });
  expect(state.eggs.find(egg => egg.id === 'give')).toMatchObject({ status: 'available', listed: true });
});

test('家园蛋与异色蛋不能送；被领走之后送蛋人不能单方撤回', () => {
  let state = applyEggAction(initial(), 'g', 'b', { type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 1,
    complete: false, homeComplete: true, eggs: [{ ...stock('home', 3227), location: 'home' }] }, 1);
  expect(() => applyEggAction(state, 'g', 'b', { type: 'gift-publish', id: 'g1', eggId: 'home' }, 2)).toThrow(/家园/);
  const shiny = applyEggAction(state, 'g', 'b', { type: 'stock-sync', gameAccountKey: 'uid:1', capturedAt: 2,
    complete: true, eggs: [{ ...stock('shiny', 3227), kind: 'shiny' }] }, 2);
  expect(() => applyEggAction(shiny, 'g', 'b', { type: 'gift-publish', id: 'g2', eggId: 'shiny' }, 3)).toThrow();

  let claimed = applyEggAction(applyEggAction(initial(), 'g', 'b', { type: 'stock-sync', gameAccountKey: 'uid:1',
    capturedAt: 1, complete: true, eggs: [stock('give', 3227)] }, 1), 'g', 'b',
  { type: 'gift-publish', id: 'gift', eggId: 'give' }, 2);
  claimed.chances = { a: { balance: 1, grantedTotal: 1, claimedTotal: 0 } };
  claimed = applyEggAction(claimed, 'g', 'a', { type: 'gift-claim', id: 'gift', claimId: 'c1' }, 3);
  expect(() => applyEggAction(claimed, 'g', 'b', { type: 'gift-cancel', id: 'gift' }, 4)).toThrow(/领走|回收/);
  expect(claimed.eggs.find(egg => egg.id === 'give')?.status).toBe('reserved');
});
