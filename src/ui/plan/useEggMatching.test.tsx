import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import {
  EGG_MATCHING_FRESH_MS,
  clearEggMatchingCache,
  clearEggMatchingMemoryForTests,
  useEggMatching,
} from './useEggMatching';
import { emptyEggWorkflow } from '../../shared/eggWorkflow';
import { EggMatchingError, getEggMatching,mutateEggMatching } from '../../api/eggMatching';
import { getPlanAlertBadge, publishPlanAlertBadge } from './planAlertsStore';
vi.mock('../../api/eggMatching',async original=>({...await original<typeof import('../../api/eggMatching')>(),getEggMatching:vi.fn(),mutateEggMatching:vi.fn()}));
const response=()=>({version:0,state:emptyEggWorkflow()});
beforeEach(()=>{clearEggMatchingCache();vi.mocked(getEggMatching).mockReset().mockResolvedValue(response());vi.mocked(mutateEggMatching).mockReset();});
afterEach(()=>{vi.restoreAllMocks();});

test('60 秒内再次进入：直接用上次数据，不再请求',async()=>{
  vi.mocked(getEggMatching).mockResolvedValueOnce({...response(),version:3});
  const first=renderHook(()=>useEggMatching('g','a'));
  await waitFor(()=>expect(first.result.current.data?.version).toBe(3));
  first.unmount();
  const second=renderHook(()=>useEggMatching('g','a'));
  expect(second.result.current.data?.version).toBe(3);
  expect(second.result.current.loading).toBe(false);
  await new Promise(r=>setTimeout(r,20));
  expect(getEggMatching).toHaveBeenCalledTimes(1);
});

test('刷新页面后：先用 localStorage 的蛋仓出内容，不等网络',async()=>{
  vi.mocked(getEggMatching).mockResolvedValueOnce({...response(),version:7});
  const first=renderHook(()=>useEggMatching('g','a'));
  await waitFor(()=>expect(first.result.current.data?.version).toBe(7));
  first.unmount();
  // 模拟刷新：内存缓存没了，localStorage 还在
  clearEggMatchingMemoryForTests();
  const now=Date.now();
  vi.spyOn(Date,'now').mockReturnValue(now+EGG_MATCHING_FRESH_MS+1000);
  let resolve!:(value:ReturnType<typeof response>)=>void;
  vi.mocked(getEggMatching).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
  const second=renderHook(()=>useEggMatching('g','a'));
  expect(second.result.current.data?.version).toBe(7);
  expect(second.result.current.loading).toBe(false);
  expect(getEggMatching).toHaveBeenCalledTimes(2);
  await act(async()=>{resolve({...response(),version:8});});
  expect(second.result.current.data?.version).toBe(8);
});

test('缓存超过 60 秒：先用缓存出内容，再后台刷新；旧响应不覆盖新数据',async()=>{
  vi.mocked(getEggMatching).mockResolvedValueOnce({...response(),version:5});
  const first=renderHook(()=>useEggMatching('g','a'));
  await waitFor(()=>expect(first.result.current.data?.version).toBe(5));
  first.unmount();
  vi.spyOn(Date,'now').mockReturnValue(Date.now()+EGG_MATCHING_FRESH_MS+1000);
  let resolve!:(value:ReturnType<typeof response>)=>void;
  vi.mocked(getEggMatching).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
  const second=renderHook(()=>useEggMatching('g','a'));
  expect(second.result.current.data?.version).toBe(5);
  expect(second.result.current.loading).toBe(false);
  expect(getEggMatching).toHaveBeenCalledTimes(2);
  await act(async()=>{resolve({...response(),version:4});});
  expect(second.result.current.data?.version).toBe(5);
});

test('changing identity cannot leave the new group busy or install an old mutation response',async()=>{
  let resolve!:(value:ReturnType<typeof response>)=>void;
  vi.mocked(mutateEggMatching).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));
  const hook=renderHook(({group,me})=>useEggMatching(group,me),{initialProps:{group:'g',me:'a'}});
  await waitFor(()=>expect(hook.result.current.data).toBeTruthy());
  let writing!:Promise<unknown>;
  act(()=>{writing=hook.result.current.mutate({type:'order',ids:[]});});
  expect(hook.result.current.busy).toBe(true);
  hook.rerender({group:'h',me:'b'});
  await waitFor(()=>expect(getEggMatching).toHaveBeenCalledWith('h'));
  await act(async()=>{resolve({...response(),version:9});await writing;});
  await waitFor(()=>expect(hook.result.current.loading).toBe(false));
  expect(hook.result.current.busy).toBe(false);
  expect(hook.result.current.data?.version).toBe(0);
});

test('committed mutations immediately clear resolved task alerts',async()=>{
  const ready={...response(),state:{...emptyEggWorkflow(),trades:[{id:'t',groupId:'g',demandId:'d',supplierAccountId:'b',demanderAccountId:'a',give:{id:'e',accountId:'b',eggGameId:3227,nature:'',body:'' as const,voice:'' as const,status:'reserved' as const,confidence:'manual' as const,provenance:'unknown' as const},receive:null,type:'spot' as const,status:'accepted' as const,placed:false,createdAt:1}]}};
  vi.mocked(getEggMatching).mockResolvedValue(ready);
  vi.mocked(mutateEggMatching).mockResolvedValue({...response(),version:1});
  const hook=renderHook(()=>useEggMatching('g','a'));
  await waitFor(()=>expect(hook.result.current.data).toBeTruthy());
  publishPlanAlertBadge(1);
  await act(async()=>{await hook.result.current.mutate({type:'receive',id:'t'});});
  expect(getPlanAlertBadge()).toBe(0);
});

test('没有小组时不发请求，也不停在加载中',async()=>{
  const hook=renderHook(()=>useEggMatching('','a'));
  await new Promise(r=>setTimeout(r,20));
  expect(getEggMatching).not.toHaveBeenCalled();
  expect(hook.result.current.loading).toBe(false);
  expect(hook.result.current.data).toBeNull();
});

/* ------------------------------------------------------------------ *
 * 版本冲突自动重试（2026-11-26，D3 / R2+R3）
 *
 * 服务端 409 会回带当前 version，客户端直接用它重试一次；没回带才补拉。
 * 409 时服务端保证这次没有落库，所以重试一次不会重复执行。
 * ------------------------------------------------------------------ */
test('409 用服务端回带的 version 自动重试一次，成功就不报错', async () => {
  clearEggMatchingCache();
  vi.mocked(getEggMatching).mockReset().mockResolvedValue({ ...response(), version: 7 });
  vi.mocked(mutateEggMatching).mockReset()
    .mockRejectedValueOnce(new EggMatchingError('小组数据已变化，请刷新后重试', 409, 'REVISION_CONFLICT', 9))
    .mockResolvedValueOnce({ ...response(), version: 10 });
  const hook = renderHook(() => useEggMatching('g', 'a'));
  await waitFor(() => expect(hook.result.current.data?.version).toBe(7));
  let result: unknown;
  await act(async () => { result = await hook.result.current.mutate({ type: 'list', id: 'e', listed: true }); });
  expect(vi.mocked(mutateEggMatching).mock.calls.map(call => call[1])).toEqual([7, 9]);
  expect(vi.mocked(getEggMatching)).toHaveBeenCalledTimes(1);   // 只有进页面那次，没有补拉
  expect(hook.result.current.data?.version).toBe(10);
  expect(hook.result.current.error).toBeNull();
  expect(result).toMatchObject({ version: 10 });
});

test('409 没回带 version 时先补拉再重试', async () => {
  clearEggMatchingCache();
  vi.mocked(getEggMatching).mockReset()
    .mockResolvedValueOnce({ ...response(), version: 7 })
    .mockResolvedValueOnce({ ...response(), version: 8 });
  vi.mocked(mutateEggMatching).mockReset()
    .mockRejectedValueOnce(new EggMatchingError('小组数据已变化，请刷新后重试', 409))
    .mockResolvedValueOnce({ ...response(), version: 9 });
  const hook = renderHook(() => useEggMatching('g', 'a'));
  await waitFor(() => expect(hook.result.current.data?.version).toBe(7));
  await act(async () => { await hook.result.current.mutate({ type: 'list', id: 'e', listed: true }); });
  expect(vi.mocked(getEggMatching)).toHaveBeenCalledTimes(2);   // 进页面 + 补拉
  expect(vi.mocked(mutateEggMatching).mock.calls.map(call => call[1])).toEqual([7, 8]);
  expect(hook.result.current.error).toBeNull();
});

test('自动重试只做一次：仍然冲突才报错', async () => {
  clearEggMatchingCache();
  vi.mocked(getEggMatching).mockReset().mockResolvedValue({ ...response(), version: 7 });
  vi.mocked(mutateEggMatching).mockReset().mockRejectedValue(new EggMatchingError('小组数据已变化，请刷新后重试', 409, 'REVISION_CONFLICT', 9));
  const hook = renderHook(() => useEggMatching('g', 'a'));
  await waitFor(() => expect(hook.result.current.data?.version).toBe(7));
  await act(async () => {
    await expect(hook.result.current.mutate({ type: 'list', id: 'e', listed: true })).rejects.toBeInstanceOf(EggMatchingError);
  });
  expect(vi.mocked(mutateEggMatching)).toHaveBeenCalledTimes(2);
  expect(hook.result.current.error).toBe('小组数据已变化，请刷新后重试');
});

test('stock-sync 的失败不写进 api.error（交给蛋仓同步横幅，只弹一条）', async () => {
  clearEggMatchingCache();
  vi.mocked(getEggMatching).mockReset().mockResolvedValue({ ...response(), version: 7 });
  vi.mocked(mutateEggMatching).mockReset().mockRejectedValue(new EggMatchingError('小组数据已变化，请刷新后重试', 409, 'SYNC_BUSY', 9));
  const hook = renderHook(() => useEggMatching('g', 'a'));
  await waitFor(() => expect(hook.result.current.data?.version).toBe(7));
  await act(async () => {
    await expect(hook.result.current.mutate({ type: 'stock-sync', gameAccountKey: 'uid:1' })).rejects.toBeInstanceOf(EggMatchingError);
  });
  expect(hook.result.current.error).toBeNull();
});
