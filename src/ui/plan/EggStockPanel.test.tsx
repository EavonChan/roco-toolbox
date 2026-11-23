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
  await waitFor(()=>expect(mutate).toHaveBeenCalledWith({
    type:'label-many', eggGameId:3227, nature:'固执', body:'大块头', voice:'婉转声', greenNest:false,
  }));
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

test('home eggs show only the self-bred badge, keep confirmation time and parents, and disable listing',()=>{
  const home={...ordinary,id:'h',provenance:'self-bred' as const,location:'home' as const,greenNest:true,lastConfirmedAt:Date.parse('2026-11-17T23:02:00+08:00'),
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
  expect(screen.queryByText('在地家园')).toBeNull();
  expect(screen.getByTestId('stock-confirmed').textContent).toBe('11-17 23:02');
  fireEvent.click(screen.getByTestId('stock-card'));
  expect(screen.getByTestId('detail-confirmed-at').textContent).toBe('2026-11-17 23:02');
  expect(screen.getByText('海豹战士')).toBeTruthy();
  expect(screen.getByText('可能性格：保守 / 胆小（各 30%，其余随机）')).toBeTruthy();
  expect(screen.getByText('满重 约 1/18（收进背包后确定）')).toBeTruthy();
  // 实际父母用配窝精灵卡渲染，而不是另画一种小卡
  expect(screen.getByTestId('stock-parents').querySelectorAll('[data-testid="breed-pet-card"]')).toHaveLength(2);
  expect(screen.getByRole('button',{name:'挂出'})).toBeDisabled();
  expect(screen.getByText('在地家园，收进背包后才能挂出')).toBeTruthy();
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

test('横屏：右侧筛选栏能按游戏角色筛选，选中后只留该角色的蛋', () => {
  setOrientation(true);
  window.localStorage.clear();
  const onCharacterChange = vi.fn();
  const characters = [{ key: 'uid:1', name: '阿甲' }, { key: 'uid:2', name: '阿乙' }];
  const props = { eggs: [
    { ...ordinary, id: 'a1', gameAccountKey: 'uid:1', accountName: '阿甲' },
    { ...ordinary, id: 'a2', gameAccountKey: 'uid:1', accountName: '阿甲' },
    { ...ordinary, id: 'b1', gameAccountKey: 'uid:2', accountName: '阿乙' },
  ], species: stockSpecies, busy: false, mutate: vi.fn(), collapsibleFilterRail: true, characters, onCharacterChange };
  const view = render(<EggStockPanel {...props} character="" />);
  const filters = screen.getByTestId('egg-stock-filters');
  const select = within(filters).getByRole('combobox', { name: '按游戏角色筛选' });
  expect(within(select).getAllByRole('option').map((option) => option.textContent))
    .toEqual(['全部角色', '阿甲', '阿乙']);
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
