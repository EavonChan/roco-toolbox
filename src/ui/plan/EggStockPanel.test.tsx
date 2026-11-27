import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { EggStockPanel, EggArt } from './EggStockPanel';
import type { WorkflowEgg } from '../../shared/eggWorkflow';
const ordinary: WorkflowEgg = { id:'e', accountId:'a', gameAccountKey:'uid:1', eggGameId:3227,nature:'固执',body:'大块头',voice:'婉转声',provenance:'external',confidence:'system',kind:'ordinary',status:'available',listed:false };
test('stock uses egg art, separates non-exchangeable eggs, and opens details in a dialog', () => {
  const mutate=vi.fn().mockResolvedValue(undefined);
  render(<EggStockPanel eggs={[{...ordinary,id:'s',kind:'special',specialCategory:'activity'},ordinary]} species={[{gameId:3227,key:'p',name:'菊花梨',number:'1',eggGroups:[2]}]} busy={false} mutate={mutate}/>);
  expect(screen.getAllByTestId('stock-card')).toHaveLength(1);
  expect(screen.queryByText('活动蛋')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'不可交换'}));
  const specialCards=screen.getAllByTestId('stock-card');
  expect(specialCards).toHaveLength(1);
  expect(specialCards[0].getAttribute('data-egg-id')).toBe('s');
  expect(within(specialCards[0]).getByText('活动蛋')).toBeTruthy();
  expect(within(specialCards[0]).queryByText('不可交换')).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'全部'}));
  fireEvent.click(screen.getByTestId('stock-card'));
  expect(screen.getByRole('dialog',{name:'蛋详情'})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'挂出'}));
  expect(mutate).toHaveBeenCalledWith({type:'list',id:'e',listed:true});
  expect(screen.queryByText('已失效')).toBeNull();
});

test('detail actions label this egg, all same-species eggs, or list it',async()=>{
  const incomplete={...ordinary,id:'i',nature:'',body:'unknown' as const};
  const mutate=vi.fn().mockResolvedValue(undefined);
  render(<EggStockPanel eggs={[ordinary,incomplete]} species={[{gameId:3227,key:'p',name:'菊花梨',number:'1',eggGroups:[2]}]} busy={false} mutate={mutate}/>);
  expect(screen.getAllByTestId('stock-card')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button',{name:'已标注'}));
  expect(screen.getAllByTestId('stock-card').map(card=>card.getAttribute('data-egg-id'))).toEqual(['e']);
  fireEvent.click(screen.getByRole('button',{name:'未标注'}));
  expect(screen.getAllByTestId('stock-card').map(card=>card.getAttribute('data-egg-id'))).toEqual(['i']);
  fireEvent.click(screen.getByTestId('stock-card'));
  expect(screen.getByRole('button',{name:'标注此蛋'})).toBeTruthy();
  expect(screen.getByRole('button',{name:'标注所有同类蛋'})).toBeTruthy();
  expect(screen.getByRole('button',{name:'挂出'})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'标注此蛋'}));
  const dialog=screen.getByRole('dialog',{name:'蛋详情'});
  expect(within(dialog).getByRole('button',{name:'大块头'})).toHaveAttribute('aria-pressed','true');
  fireEvent.click(within(dialog).getByRole('button',{name:'小不点'}));
  fireEvent.click(within(dialog).getByRole('button',{name:'+100'}));
  const greenNest=screen.getByRole('checkbox',{name:'绿窝蛋'});
  expect(greenNest).not.toBeChecked();
  fireEvent.click(greenNest);
  fireEvent.click(screen.getByRole('button',{name:'标注此蛋'}));
  await waitFor(()=>expect(mutate).toHaveBeenCalledWith({type:'label',id:'i',nature:'',body:'小不点',voice:'+100',greenNest:true}));
});

test('extra selected natures collapse under a selected more block',()=>{
  render(<EggStockPanel eggs={[{...ordinary,nature:'30%冷静·30%平和'}]} species={[{gameId:3227,key:'p',name:'菊花梨',number:'1',eggGroups:[2]}]} busy={false} mutate={vi.fn()}/>);
  expect(screen.getByText('冷静 / 平和')).toBeTruthy();
  expect(screen.queryByText('30%冷静·30%平和')).toBeNull();
  expect(screen.queryByText('待标注')).toBeNull();
  fireEvent.click(screen.getByTestId('stock-card'));
  fireEvent.click(screen.getByRole('button',{name:'标注此蛋'}));
  const dialog=screen.getByRole('dialog',{name:'蛋详情'});
  expect(within(dialog).queryByRole('button',{name:'冷静'})).toBeNull();
  expect(within(dialog).getByRole('button',{name:'平和'})).toHaveAttribute('aria-pressed','true');
  const more=within(dialog).getByRole('button',{name:'更多 +22'});
  expect(more).toHaveAttribute('aria-pressed','true');
  fireEvent.click(more);
  expect(within(dialog).getByRole('button',{name:'冷静'})).toHaveAttribute('aria-pressed','true');
  expect(within(dialog).queryByRole('textbox',{name:'蛋性格'})).toBeNull();
});

test('stock detail omits precise egg weight',()=>{
  render(<EggStockPanel eggs={[{...ordinary,weightGrams:123456}]} species={[{gameId:3227,key:'p',name:'菊花梨',number:'1',eggGroups:[2]}]} busy={false} mutate={vi.fn()}/>);
  fireEvent.click(screen.getByTestId('stock-card'));
  expect(screen.queryByText(/123456/)).toBeNull();
});

test('egg artwork recovers when the selected species changes',()=>{
  const view=render(<EggArt eggGameId={3227} name="菊花梨"/>);
  fireEvent.error(screen.getByRole('img'));
  expect(screen.getByText('暂无蛋图')).toBeTruthy();
  view.rerender(<EggArt eggGameId={3436} name="柴渣虫"/>);
  expect(screen.getByRole('img').tagName).toBe('IMG');
});

test('special egg artwork uses the captured item image instead of the ordinary egg image',()=>{
  render(<EggArt eggGameId={3198} name="异色粉粉星" kind="shiny" itemConfId={150109}/>);
  expect(screen.getByRole('img').getAttribute('src')).toBe('https://wiki.biligame.com/nrc/Special:Redirect/file/Item_150109.png');
  fireEvent.error(screen.getByRole('img'));
  expect(screen.getByRole('img').getAttribute('src')).toBe('https://patchwiki.biligame.com/images/nrc/d/d6/bz0zu7j1ypzmxjcrxga5lzaeistn0md.png');
  fireEvent.error(screen.getByRole('img'));
  expect(screen.getByText('暂无蛋图')).toBeTruthy();
});

test('stock details show egg groups and do not invent missing actual parents',()=>{
  render(<EggStockPanel eggs={[ordinary]} species={[{gameId:3227,key:'p',name:'菊花梨',number:'1',eggGroups:[2]}]} busy={false} mutate={vi.fn()}/>);
  fireEvent.click(screen.getByTestId('stock-card'));
  expect(screen.getByText('实际父母')).toBeTruthy();
  expect(screen.getByText('暂无亲本记录')).toBeTruthy();
  expect(screen.getByText('蛋组')).toBeTruthy();
});

test('stock details place egg height in metres and weight in kilograms below egg groups',()=>{
  render(<EggStockPanel eggs={[{...ordinary,heightCm:23,weightGrams:1234}]} species={[{gameId:3227,key:'p',name:'菊花梨',number:'1',eggGroups:[2]}]} busy={false} mutate={vi.fn()}/>);
  fireEvent.click(screen.getByTestId('stock-card'));
  expect(screen.getByText('0.23 m')).toBeTruthy();
  expect(screen.getByText('1.234 kg')).toBeTruthy();
});

test('same-species bulk labelling is available from the annotation form',async()=>{
  const mutate=vi.fn().mockResolvedValue(undefined);
  render(<EggStockPanel eggs={[ordinary,{...ordinary,id:'e2'}]} species={[{gameId:3227,key:'p',name:'菊花梨',number:'1',eggGroups:[2]}]} busy={false} mutate={mutate}/>);
  fireEvent.click(screen.getAllByTestId('stock-card')[0]);
  fireEvent.click(screen.getByRole('button',{name:'标注所有同类蛋'}));
  // 带上当前游戏角色（服务端只改这个角色）；绿窝是逐颗事实，不进批量载荷（R4-10）。
  await waitFor(()=>expect(mutate).toHaveBeenCalledWith({
    type:'label-many', eggGameId:3227, gameAccountKey:'uid:1', nature:'固执', body:'大块头', voice:'婉转声',
  }));
});

/** R4-10：同种蛋里有一颗在换蛋中时，批量标注不能整批失败；要告诉用户改了几颗、跳过几颗。 */
test('同种蛋里有换蛋中的蛋时，批量标注照常提交并说明跳过了几颗',async()=>{
  const mutate=vi.fn().mockResolvedValue(undefined);
  const busy={...ordinary,id:'busy',status:'reserved' as const};
  render(<EggStockPanel eggs={[ordinary,{...ordinary,id:'e2'},busy]} species={[{gameId:3227,key:'p',name:'菊花梨',number:'1',eggGroups:[2]}]} busy={false} mutate={mutate}/>);
  const cards=screen.getAllByTestId('stock-card');
  expect(cards).toHaveLength(3);
  fireEvent.click(cards.find(card=>card.getAttribute('data-egg-id')==='e')!);
  fireEvent.click(screen.getByRole('button',{name:'标注所有同类蛋'}));
  await waitFor(()=>expect(mutate).toHaveBeenCalledWith(expect.objectContaining({
    type:'label-many', eggGameId:3227, gameAccountKey:'uid:1',
  })));
  await waitFor(()=>expect(screen.getByTestId('egg-label-notice')).toHaveTextContent('已更新 2 颗，跳过 1 颗（换蛋中）'));
});

test('stock card shows the obtained time and the detail shows it in full',()=>{
  const egg={...ordinary,obtainedAt:'2026-11-17T22:31:00'};
  render(<EggStockPanel eggs={[egg]} species={[{gameId:3227,key:'p',name:'菊花梨',number:'1',eggGroups:[2]}]} busy={false} mutate={vi.fn()}/>);
  expect(screen.getByTestId('stock-time').textContent).toBe('11-17 22:31');
  fireEvent.click(screen.getByTestId('stock-card'));
  expect(screen.getByTestId('detail-obtained-at').textContent).toBe('2026-11-17 22:31');
});

test('eggs without a captured time omit the card row and say so in the detail',()=>{
  render(<EggStockPanel eggs={[ordinary]} species={[{gameId:3227,key:'p',name:'菊花梨',number:'1',eggGroups:[2]}]} busy={false} mutate={vi.fn()}/>);
  expect(screen.queryByTestId('stock-time')).toBeNull();
  fireEvent.click(screen.getByTestId('stock-card'));
  expect(screen.getByTestId('detail-obtained-at').textContent).toBe('采集数据里没有获得时间');
});

test('目前还在家园的蛋也标自产，不再出现「在地家园」说法',()=>{
  const home={...ordinary,id:'h',provenance:'unknown' as const,location:'home' as const,greenNest:true,lastConfirmedAt:Date.parse('2026-11-17T23:02:00+08:00'),
    nature:'',confidence:'system' as const,labelSource:'system' as const,
    parents:{mother:{id:'m',gameId:3227,name:'菊花梨',nature:'保守',body:'大块头',voice:'+100',nestName:'普通小窝'},
      fathers:[{id:'f',gameId:3215,name:'海豹战士',nature:'胆小',body:'大块头',voice:'婉转声'}],confirmed:false}};
  render(<EggStockPanel eggs={[home]} species={[{gameId:3227,key:'p',name:'菊花梨',number:'1',eggGroups:[2]},
    {gameId:3215,key:'s',name:'海豹战士',number:'2',eggGroups:[3]}]} busy={false} mutate={vi.fn()}/>);
  const card=screen.getByTestId('stock-card');
  expect(card.className).toContain('border-emerald-500');
  expect(within(card).getByTestId('stock-card-labels').parentElement).toBe(card);
  expect(within(card).getByTestId('stock-card-body').parentElement).toBe(card);
  expect(card.querySelector('[data-testid="stock-card-frame"]')).toBeNull();
  const selfBadge=screen.getByTestId('stock-self-badge');
  const labels=within(card).getByTestId('stock-card-labels');
  expect(selfBadge.textContent).toBe('自产');
  expect(labels.lastElementChild).toContainElement(selfBadge);
  expect(labels.firstElementChild).not.toContainElement(selfBadge);
  expect(screen.queryByTestId('stock-home-badge')).toBeNull();
  expect(screen.queryByText(/在地家园/)).toBeNull();
  expect(screen.getByTestId('stock-confirmed').textContent).toBe('11-17 23:02');
  // 「自产」筛选也要把还在家园的蛋算进去
  fireEvent.click(screen.getByRole('button',{name:'自产'}));
  expect(screen.getByTestId('stock-card')).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'全部'}));
  fireEvent.click(screen.getByTestId('stock-card'));
  expect(screen.getByTestId('detail-confirmed-at').textContent).toBe('2026-11-17 23:02');
  expect(screen.getByText('海豹战士')).toBeTruthy();
  expect(screen.getByText('可能性格：保守 / 胆小（各 30%，其余随机）')).toBeTruthy();
  expect(screen.getByText('满重 约 1/18（收进背包后确定）')).toBeTruthy();
  // 实际父母用配窝精灵卡渲染，而不是另画一种小卡
  expect(screen.getByTestId('stock-parents').querySelectorAll('[data-testid="breed-pet-card"]')).toHaveLength(2);
  expect(screen.getByRole('button',{name:'挂出'})).toBeDisabled();
  expect(screen.getByText('收进背包后才能挂出')).toBeTruthy();
});

/**
 * 2026-11-25 回归：普通窝、父母性格不一致的家园蛋，性格原本应显示两个可能值（`冷静 / 平和`），
 * 现在显示成「—」。抓包入口（homeEggAdapter）对这种蛋只留空 `nature`（双亲不同 → 30%+30%），
 * 展示层必须自己按父母推可能性格，不能把「没确定」当成「没标注」。
 */
test('普通窝父母性格不一致的家园蛋，性格显示两个可能值而不是「—」',()=>{
  const pair={...ordinary,id:'pair',eggGameId:3436,nature:'',provenance:'self-bred' as const,location:'home' as const,
    body:'大块头' as const,voice:'婉转声' as const,
    lastConfirmedAt:Date.parse('2026-11-24T20:10:00+08:00'),
    parents:{mother:{id:'m',gameId:3436,name:'柴渣虫',nature:'冷静',body:'大块头',voice:'+100',nestName:'普通小窝'},
      fathers:[{id:'f',gameId:3436,name:'柴渣虫',nature:'平和',body:'大块头',voice:'婉转声',nestName:'普通小窝'}],confirmed:false}};
  render(<EggStockPanel eggs={[pair]} species={[{gameId:3436,key:'bug',name:'柴渣虫',number:'325',eggGroups:[4,8]}]} busy={false} mutate={vi.fn()}/>);
  const card=screen.getByTestId('stock-card');
  expect(card.textContent).toContain('冷静 / 平和');
  expect(card.textContent).not.toContain('—');
  fireEvent.click(card);
  const dialog=screen.getByRole('dialog',{name:'蛋详情'});
  expect(within(dialog).getByText('冷静 / 平和')).toBeTruthy();
  // 打开标注编辑器时，两个可能性格要预选上：保存体型/声音时不能把性格又写回空
  fireEvent.click(within(dialog).getByRole('button',{name:'标注此蛋'}));
  expect(within(dialog).getByRole('button',{name:'平和'})).toHaveAttribute('aria-pressed','true');
  const more=within(dialog).getByRole('button',{name:/^更多 \+\d+$/});
  expect(more).toHaveAttribute('aria-pressed','true');
  fireEvent.click(more);
  expect(within(dialog).getByRole('button',{name:'冷静'})).toHaveAttribute('aria-pressed','true');
});

/**
 * 2026-11-25 回归二（按用户截图）：rc「生蛋了吗」自动入库的绿窝蛋，`greenNest` 没落库
 * （入库只写了父母 `academy`），蛋仓仍要显示绿窝标记——不能只认 `e.greenNest`，
 * 否则列表徽标/绿框/标注勾选全丢，而详情页的父母卡却写着「学院小窝 · 100%性格」。
 */
test('亲本在学院小窝的蛋，即使 greenNest 没落库也显示绿窝标记',async()=>{
  const greenParent={...ordinary,id:'green-parent',eggGameId:3124,nature:'胆小',
    body:'大块头' as const,voice:'婉转声' as const,provenance:'self-bred' as const,location:'home' as const,
    greenNest:undefined,lastConfirmedAt:Date.parse('2026-11-23T22:07:00+08:00'),
    parents:{mother:{id:'m',gameId:3124,name:'脆筒甜甜',nature:'胆小',body:'大块头',voice:'+100',nestName:'学院小窝',academy:true},
      fathers:[{id:'f',gameId:3124,name:'脆筒甜甜',nature:'胆小',body:'大块头',voice:'婉转声',nestName:'普通小窝'}],confirmed:false}};
  const mutate=vi.fn().mockResolvedValue(undefined);
  render(<EggStockPanel eggs={[greenParent]} species={[
    {gameId:3124,key:'c',name:'脆筒甜甜',number:'234',eggGroups:[10,12]},
  ]} busy={false} mutate={mutate}/>);
  const card=screen.getByTestId('stock-card');
  expect(within(card).getByTestId('stock-green-nest')).toBeTruthy();
  expect(card.className).toContain('border-emerald-500');
  fireEvent.click(card);
  const dialog=screen.getByRole('dialog',{name:'蛋详情'});
  // 详情页本来就能从父母卡看出学院小窝；列表徽标现在和它同源
  expect(within(dialog).getByText('学院小窝 · 100%性格')).toBeTruthy();
  fireEvent.click(within(dialog).getByRole('button',{name:'标注此蛋'}));
  expect(screen.getByRole('checkbox',{name:'绿窝蛋'})).toBeChecked();
  // 保存标注时要把绿窝写回数据，而不是用「没落库 = 不是绿窝」覆盖成 false
  fireEvent.click(within(dialog).getByRole('button',{name:'标注所有同类蛋'}));
  // 批量标注不带绿窝（绿窝逐颗写，见 R4-10），但单颗标注仍会带。
  await waitFor(()=>expect(mutate).toHaveBeenCalledWith({
    type:'label-many', eggGameId:3124, gameAccountKey:'uid:1', nature:'胆小', body:'大块头', voice:'婉转声',
  }));
  // 用户手动取消过（greenNest:false）时按显式值来，不被父母的 academy 覆盖
  cleanup();
  render(<EggStockPanel eggs={[{...greenParent,greenNest:false}]} species={[
    {gameId:3124,key:'c',name:'脆筒甜甜',number:'234',eggGroups:[10,12]},
  ]} busy={false} mutate={vi.fn()}/>);
  expect(screen.queryByTestId('stock-green-nest')).toBeNull();
  // 绿窝只认学院那只的性格：它没采到性格时留空，不能拿另一只亲本的性格顶替，但绿窝标记仍要在
  cleanup();
  const unknownAcademy={...greenParent,nature:'',parents:{mother:{id:'m',gameId:3124,name:'脆筒甜甜',nature:'',body:'大块头',voice:'+100',nestName:'学院小窝',academy:true},
    fathers:[{id:'f',gameId:3124,name:'脆筒甜甜',nature:'胆小',body:'大块头',voice:'婉转声',nestName:'普通小窝'}],confirmed:false}};
  render(<EggStockPanel eggs={[unknownAcademy]} species={[
    {gameId:3124,key:'c',name:'脆筒甜甜',number:'234',eggGroups:[10,12]},
  ]} busy={false} mutate={vi.fn()}/>);
  const unknownCard=screen.getByTestId('stock-card');
  expect(within(unknownCard).getByTestId('stock-green-nest')).toBeTruthy();
  expect(unknownCard.textContent).toContain('—');
});

test('没有父母性格可推的蛋仍显示「—」，不凭空补性格',()=>{
  render(<EggStockPanel eggs={[{...ordinary,id:'blank',nature:''}]} species={[{gameId:3227,key:'p',name:'菊花梨',number:'1',eggGroups:[2]}]} busy={false} mutate={vi.fn()}/>);
  expect(screen.getByTestId('stock-card').textContent).toContain('—');
});

test('ordinary self-bred eggs have no green frame while green-nest eggs do',()=>{
  render(<EggStockPanel eggs={[
    {...ordinary,id:'ordinary',provenance:'self-bred'},
    {...ordinary,id:'green',provenance:'self-bred',greenNest:true},
  ]} species={[{gameId:3227,key:'p',name:'菊花梨',number:'1',eggGroups:[2]}]} busy={false} mutate={vi.fn()}/>);
  const cards=screen.getAllByTestId('stock-card');
  const byId=(id:string)=>cards.find(card=>card.getAttribute('data-egg-id')===id)!;
  expect(byId('ordinary').className).not.toContain('border-emerald-500');
  expect(byId('green').className).toContain('border-emerald-500');
});

/** jsdom 没有 matchMedia：按用例给一份方向判定，供 useLandscape 用。 */
const setOrientation = (landscape: boolean) => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('landscape') ? landscape : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
};
const stockSpecies = [{ gameId: 3227, key: 'p', name: '菊花梨', number: '1', eggGroups: [2] }];

test('横屏蛋仓：搜索与条件在右侧折叠栏，收起后蛋卡加列', () => {
  setOrientation(true);
  window.localStorage.clear();
  const eggs = Array.from({ length: 6 }, (_, index) => ({ ...ordinary, id: `e${index}` }));
  const onBack = vi.fn();
  render(<EggStockPanel eggs={eggs} species={stockSpecies} busy={false} mutate={vi.fn()} collapsibleFilterRail railBack={{ onClick: onBack }} />);

  // 纵向标题栏：返回家园 / 我的蛋仓 / 收起筛选，竖着排在右边缘
  const rail = screen.getByTestId('egg-stock-rail');
  expect(within(rail).getByTestId('egg-stock-rail-title')).toHaveTextContent('我的蛋仓');
  fireEvent.click(within(rail).getByRole('button', { name: '返回家园' }));
  expect(onBack).toHaveBeenCalledTimes(1);
  const toggle = within(rail).getByTestId('egg-stock-rail-toggle');
  expect(toggle).toHaveAttribute('aria-expanded', 'true');
  // 搜索和条件在标题栏左边的筛选列里，不再占蛋卡上方一整行
  const filters = screen.getByTestId('egg-stock-filters');
  expect(within(filters).getByRole('searchbox', { name: '搜索蛋名' })).toBeTruthy();
  expect(within(filters).getByRole('button', { name: '已标注' })).toBeTruthy();
  expect(within(rail).queryByRole('searchbox')).toBeNull();
  fireEvent.click(toggle);
  expect(screen.getByTestId('egg-stock-scope')).toHaveAttribute('data-rail-collapsed', 'true');
  expect(toggle).toHaveAttribute('aria-expanded', 'false');
  expect(toggle).toHaveAccessibleName('展开筛选');
  expect(screen.queryByTestId('egg-stock-filters')).toBeNull();
  expect(window.localStorage.getItem('roco.eggStockRailCollapsed')).toBe('1');
  // 收起后标题栏还在（竖排），只是不再占一整行
  expect(screen.getByTestId('egg-stock-rail-title')).toBeTruthy();
  expect(screen.getByRole('button', { name: '返回家园' })).toBeTruthy();
  // 折叠状态要记住：下次进来还是折叠的
  cleanup();
  render(<EggStockPanel eggs={eggs} species={stockSpecies} busy={false} mutate={vi.fn()} collapsibleFilterRail />);
  expect(screen.getByTestId('egg-stock-scope')).toHaveAttribute('data-rail-collapsed', 'true');
});

test('横屏：右侧筛选栏能切换游戏角色，选项带蛋数、一次只留一个角色', () => {
  setOrientation(true);
  window.localStorage.clear();
  const onCharacterChange = vi.fn();
  const characters = [
    { key: 'uid:1', name: '阿甲', count: 2 },
    { key: 'uid:2', name: '阿乙', count: 1 },
  ];
  const props = { eggs: [
    { ...ordinary, id: 'a1', gameAccountKey: 'uid:1', accountName: '阿甲' },
    { ...ordinary, id: 'a2', gameAccountKey: 'uid:1', accountName: '阿甲' },
    { ...ordinary, id: 'b1', gameAccountKey: 'uid:2', accountName: '阿乙' },
  ], species: stockSpecies, busy: false, mutate: vi.fn(), collapsibleFilterRail: true, characters, onCharacterChange };
  const view = render(<EggStockPanel {...props} character="uid:1" />);
  expect(screen.getAllByTestId('stock-card')).toHaveLength(2);
  const filters = screen.getByTestId('egg-stock-filters');
  const select = within(filters).getByRole('combobox', { name: '按游戏角色筛选' });
  expect(within(select).getAllByRole('option').map((option) => option.textContent))
    .toEqual(['阿甲（2）', '阿乙（1）']);
  expect(within(select).queryByRole('option', { name: '全部角色' })).toBeNull();
  fireEvent.change(select, { target: { value: 'uid:2' } });
  expect(onCharacterChange).toHaveBeenCalledWith('uid:2');
  view.rerender(<EggStockPanel {...props} character="uid:2" />);
  expect(screen.getAllByTestId('stock-card')).toHaveLength(1);
});

test('竖屏不出现右侧折叠栏，搜索与条件仍在蛋卡上方', () => {
  setOrientation(false);
  window.localStorage.clear();
  render(<EggStockPanel eggs={[ordinary]} species={stockSpecies} busy={false} mutate={vi.fn()} collapsibleFilterRail />);
  expect(screen.queryByTestId('egg-stock-rail')).toBeNull();
  expect(screen.queryByTestId('egg-stock-rail-toggle')).toBeNull();
  expect(screen.getByRole('searchbox', { name: '搜索蛋名' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '自产' })).toBeTruthy();
});

/* ==================== F5/F6 待认领 · 手动认领（2026-11-27） ==================== */
/**
 * 口径来源：`docs/方案-同种多颗手动认领-2026-11-25.md` + 2026-11-27 用户拍板 5 条。
 * 关键约束：入口是蛋仓顶部琥珀横幅；待认领卡留在网格里；认领页左右各点一张；
 * 物种不同直接不显示；不作废横幅永远消不掉；合并后可拆开（两张都不删）。
 */
const claimSpecies = [
  { gameId: 3227, key: 'p', name: '菊花梨', number: '1', eggGroups: [2] },
  { gameId: 3436, key: 'bug', name: '柴渣虫', number: '325', eggGroups: [4, 8] },
];
const claimParents = {
  mother: { id: 'm1', gameId: 3227, name: '菊花梨', nature: '保守', body: '大块头' as const, voice: '+100' as const, nestName: '普通小窝' },
  fathers: [{ id: 'f1', gameId: 3215, name: '海豹战士', nature: '胆小', body: '大块头' as const, voice: '婉转声' as const, nestName: '普通小窝' }],
  confirmed: false,
};
/** 待认领的家蛋：已从家园完整快照消失，还没认出背包里是哪一颗。 */
const pendingClaim = (over: Partial<WorkflowEgg> = {}): WorkflowEgg => ({
  ...ordinary, id: 'home1', location: 'home', nature: '', body: 'unknown', voice: 'unknown',
  provenance: 'self-bred', claimPending: true,
  lastConfirmedAt: Date.parse('2026-11-25T08:40:00'), parents: claimParents, ...over,
});
/** 本次新进背包的蛋：有时间 / 蛋重 / 蛋高 / 性格，没有父母。 */
const freshBag = (over: Partial<WorkflowEgg> = {}): WorkflowEgg => ({
  ...ordinary, id: 'bag1', location: 'bag', obtainedAt: '2026-11-25T08:41:00',
  heightCm: 23, weightGrams: 12886, claimArrivedAt: Date.parse('2026-11-25T08:41:30'), ...over,
});
const renderStock = (eggs: WorkflowEgg[], mutate = vi.fn().mockResolvedValue(undefined), character?: string) =>
  render(<EggStockPanel eggs={eggs} species={claimSpecies} busy={false} mutate={mutate} character={character} />);
const enterClaim = () => fireEvent.click(screen.getByRole('button', { name: '去认领' }));

test('蛋仓顶部横幅：按当前角色的待认领数计数，0 颗时整条不出现', () => {
  const mutate = vi.fn();
  const { rerender } = renderStock(
    [pendingClaim(), pendingClaim({ id: 'home2' }), pendingClaim({ id: 'home3', gameAccountKey: 'uid:2' })],
    mutate, 'uid:1',
  );
  const banner = screen.getByTestId('claim-banner');
  expect(banner).toHaveTextContent('2 颗自产蛋待认领');
  expect(within(banner).getByRole('button', { name: '去认领' })).toBeTruthy();
  // 0 颗：整条不渲染（不占高度）。
  rerender(<EggStockPanel eggs={[freshBag()]} species={claimSpecies} busy={false} mutate={mutate} character="uid:1" />);
  expect(screen.queryByTestId('claim-banner')).toBeNull();
});

test('待认领的卡留在网格里：虚线琥珀框 + 「待认领」标，时间位写待认领', () => {
  renderStock([pendingClaim()], vi.fn(), 'uid:1');
  const card = screen.getByTestId('stock-card');
  expect(card.className).toContain('border-dashed');
  expect(card.className).toContain('border-amber-400');
  // 4 列网格一行放不下「绿窝 + 待认领 + 自产」三个标：待认领标放在时间位（原型同款）。
  expect(within(card).getByTestId('stock-pending-badge')).toHaveTextContent('待认领');
  expect(within(card).queryByTestId('stock-confirmed')).toBeNull();
  // 自产 / 绿窝标记照旧显示，父母只在详情里。
  expect(within(card).getByTestId('stock-self-badge')).toHaveTextContent('自产');
});

test('只有 1 颗待认领时点「去认领」直接进认领页，且左卡自动选中', () => {
  renderStock([pendingClaim(), freshBag()], vi.fn(), 'uid:1');
  enterClaim();
  expect(screen.getByTestId('claim-view')).toBeTruthy();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByTestId('claim-home-card')).toHaveAttribute('aria-pressed', 'true');
});

test('认领页两列：左列家园蛋有父母/自产/绿窝、无时间蛋重；右列背包蛋有时间/蛋重/蛋高/性格', () => {
  renderStock([pendingClaim({ greenNest: true }), freshBag()], vi.fn(), 'uid:1');
  enterClaim();
  const homeCard = screen.getByTestId('claim-home-card');
  expect(within(homeCard).getByTestId('claim-self-badge')).toHaveTextContent('自产');
  expect(within(homeCard).getByTestId('claim-green-nest')).toBeTruthy();
  expect(homeCard.querySelectorAll('[data-testid="breed-pet-card"]')).toHaveLength(2);
  expect(within(homeCard).getByText('无获得时间 · 无蛋重')).toBeTruthy();
  const bagCard = screen.getByTestId('claim-bag-card');
  expect(bagCard).toHaveTextContent('11-25 08:41');
  expect(bagCard).toHaveTextContent('12.886 kg');
  expect(bagCard).toHaveTextContent('0.23 m');
  expect(bagCard).toHaveTextContent('固执');
  fireEvent.click(bagCard);
  // 已选一行实时写清楚两边是谁。
  expect(screen.getByTestId('claim-selection')).toHaveTextContent('家园 菊花梨');
  expect(screen.getByTestId('claim-selection')).toHaveTextContent('背包 #bag1');
  expect(screen.getByTestId('claim-selection')).toHaveTextContent('12.886 kg');
});

test('左一张 + 右一张同种 → 「合并这两颗」走 claim-egg', async () => {
  const mutate = vi.fn().mockResolvedValue(undefined);
  renderStock([pendingClaim(), freshBag()], mutate, 'uid:1');
  enterClaim();
  fireEvent.click(screen.getByTestId('claim-bag-card'));
  expect(screen.getByTestId('claim-bag-card')).toHaveAttribute('aria-pressed', 'true');
  const merge = screen.getByRole('button', { name: '合并这两颗' });
  expect(merge).toBeEnabled();
  fireEvent.click(merge);
  await waitFor(() => expect(mutate).toHaveBeenCalledWith({ type: 'claim-egg', id: 'home1', capturedEggId: 'bag1' }));
});

test('选中家园蛋后右列只留同物种：不同物种的背包蛋不显示', () => {
  const different = freshBag({ id: 'bag2', eggGameId: 3436 });
  renderStock([pendingClaim(), pendingClaim({ id: 'home2' }), different, freshBag({ id: 'bag1' })], vi.fn(), 'uid:1');
  enterClaim();
  // 未选左卡：本次新进的两颗都列出来（选择还没收窄）。
  expect(screen.getAllByTestId('claim-bag-card').map((card) => card.getAttribute('data-claim-bag-id')).sort())
    .toEqual(['bag1', 'bag2']);
  fireEvent.click(screen.getAllByTestId('claim-home-card')[0]);
  // 选中「白发懒人」后，右列只剩同物种；柴渣虫那颗直接不出现，也没有灰态 / 红字。
  expect(screen.getAllByTestId('claim-bag-card').map((card) => card.getAttribute('data-claim-bag-id')))
    .toEqual(['bag1']);
  expect(screen.queryByTestId('claim-species-block')).toBeNull();
  expect(screen.queryByText('物种不同，不能合并')).toBeNull();
});

test('右列过滤成空时给「这次没有同物种的新蛋」，不白屏', () => {
  const different = freshBag({ id: 'bag2', eggGameId: 3436 });
  renderStock([pendingClaim(), different], vi.fn(), 'uid:1');
  enterClaim();
  // 只有 1 颗待认领 → 自动选中它，右列按物种收窄为空。
  expect(screen.getByTestId('claim-home-card')).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryAllByTestId('claim-bag-card')).toHaveLength(0);
  expect(screen.getByTestId('claim-bag-column')).toHaveTextContent('这次没有同物种的新蛋');
  expect(screen.getByRole('button', { name: '合并这两颗' })).toBeDisabled();
});

test('「✕ 这颗不在了」把该行标记为不再等待，走 claim-dismiss', async () => {
  const mutate = vi.fn().mockResolvedValue(undefined);
  renderStock([pendingClaim()], mutate, 'uid:1');
  enterClaim();
  fireEvent.click(screen.getByRole('button', { name: '这颗不在了' }));
  await waitFor(() => expect(mutate).toHaveBeenCalledWith({ type: 'claim-dismiss', id: 'home1' }));
});

test('「暂不认领」回蛋仓，不发任何写库动作', () => {
  const mutate = vi.fn();
  renderStock([pendingClaim(), freshBag()], mutate, 'uid:1');
  enterClaim();
  fireEvent.click(screen.getByRole('button', { name: '暂不认领' }));
  expect(screen.queryByTestId('claim-view')).toBeNull();
  expect(screen.getByTestId('claim-banner')).toBeTruthy();
  expect(mutate).not.toHaveBeenCalled();
});

test('认领后横幅计数递减，最后一颗认领完横幅消失', () => {
  const mutate = vi.fn();
  const { rerender } = renderStock([pendingClaim(), pendingClaim({ id: 'home2' })], mutate, 'uid:1');
  expect(screen.getByTestId('claim-banner')).toHaveTextContent('2 颗自产蛋待认领');
  rerender(<EggStockPanel eggs={[pendingClaim({ id: 'home2' })]} species={claimSpecies} busy={false} mutate={mutate} character="uid:1" />);
  expect(screen.getByTestId('claim-banner')).toHaveTextContent('1 颗自产蛋待认领');
  rerender(<EggStockPanel eggs={[freshBag()]} species={claimSpecies} busy={false} mutate={mutate} character="uid:1" />);
  expect(screen.queryByTestId('claim-banner')).toBeNull();
});

test('最后一颗认领完，认领页显示「都认领完了」而不是空的两列', () => {
  const mutate = vi.fn();
  const { rerender } = renderStock([pendingClaim(), freshBag()], mutate, 'uid:1');
  enterClaim();
  expect(screen.getByTestId('claim-columns')).toBeTruthy();
  // 服务端回包后 eggs 少掉那颗待认领的家蛋。
  rerender(<EggStockPanel eggs={[freshBag()]} species={claimSpecies} busy={false} mutate={mutate} character="uid:1" />);
  expect(screen.getByTestId('claim-view')).toBeTruthy();
  expect(screen.getByTestId('claim-done')).toHaveTextContent('都认领完了');
  expect(screen.queryByTestId('claim-columns')).toBeNull();
});

test('手动认领合并后的详情有「拆开认领」：确认后走 claim-split', async () => {
  const mutate = vi.fn().mockResolvedValue(undefined);
  const merged = { ...ordinary, id: 'home1', location: 'bag' as const, capturedEggId: 'bag1',
    obtainedAt: '2026-11-25T08:41:00', heightCm: 23, weightGrams: 12886,
    claimBackup: { nature: '', body: 'unknown' as const, voice: 'unknown' as const } };
  renderStock([merged], mutate, 'uid:1');
  fireEvent.click(screen.getByTestId('stock-card'));
  const dialog = screen.getByRole('dialog', { name: '蛋详情' });
  expect(within(dialog).getByTestId('claim-split-note')).toHaveTextContent('已与家园蛋');
  fireEvent.click(within(dialog).getByRole('button', { name: '拆开认领' }));
  expect(within(dialog).getByTestId('claim-split-confirm')).toHaveTextContent('两张都不删');
  fireEvent.click(within(dialog).getByRole('button', { name: '确认拆开' }));
  await waitFor(() => expect(mutate).toHaveBeenCalledWith({ type: 'claim-split', id: 'home1' }));
});
