import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
