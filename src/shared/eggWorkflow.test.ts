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
  expect(state.demands[0].fulfilled).toBe(1);
  expect(applyEggAction(state, 'g', 'a', { type: 'receive', id: 't' }, 6).demands[0].fulfilled).toBe(1);
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
  expect(applyEggAction(state, 'g', 'a', { type: 'receive', id: 't' }, 6).demands[0].status).toBe('fulfilled');
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
  expect(applyEggAction(state, 'g', 'a', { type: 'receive', id: 't' }, 5).demands[0].fulfilled).toBe(1);
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
    type: 'label-many', eggGameId: 3227, nature: '冷静/平和', body: '大块头', voice: '婉转声', greenNest: true,
  }, 2);
  expect(state.eggs.filter(egg => egg.eggGameId === 3227)).toMatchObject([
    { nature: '冷静/平和', body: '大块头', voice: '婉转声', greenNest: true, labelSource: 'manual' },
    { nature: '冷静/平和', body: '大块头', voice: '婉转声', greenNest: true, labelSource: 'manual' },
  ]);
  expect(state.eggs.find(egg => egg.id === 'other')).toMatchObject({ nature: '固执', labelSource: 'unknown' });
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

test('a bag egg without voice is not listed until the voice arrives', () => {
  let state = bagSync(emptyEggWorkflow(), 'a', 1, [measured('empty-voice', { voice: '' })]);
  expect(state.eggs[0].listed).toBe(false);
  state = bagSync(state, 'a', 2, [measured('empty-voice', { voice: 'unknown' })]);
  expect(state.eggs[0].listed).toBe(false);
  state = bagSync(state, 'a', 3, [measured('empty-voice', { voice: '婉转声' })]);
  expect(state.eggs[0]).toMatchObject({ listed: true, voice: '婉转声' });
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
