import { useEffect, useRef, useState } from 'react';
import type { SpeciesEntry } from '../../domain/types';
import type { WorkflowEgg } from '../../shared/eggWorkflow';
import { canCirculateEgg, type EggParentInfo } from '../../shared/eggMatching';
import { eggWeightOf } from '../../domain/eggWeight';
import { DEMAND_NATURE_MAX, type DemandBody, type DemandVoice } from '../../shared/collectionGroups';
import { bodyMedalIconByLabel, voiceMedalIconByLabel } from '../../domain/petIcons';
import { BODY_LABELS, PICKABLE_BODIES, PICKABLE_VOICES, VOICE_LABELS } from '../DemandPublishSheet';
import { formatEggObtainedAt, formatEggObtainedAtFull } from './eggTime';
import { ModalSurface } from '../primitives/ModalSurface';
import { PairingPetCard, type PairCardPet } from '../NestPlanCard';
import { useLandscape } from '../useWideLandscape';
import { SearchField } from '../primitives/SearchField';
import { Button } from '../primitives/Button';
import { EggCharacterSelect } from './EggCharacterSelect';
import type { EggCharacter } from './eggCharacter';
import eggIconUrls from '../../data/eggIconUrls.json';
import { allNatureNames, eggGroupNames, targetNatureNames } from '../../data/catalog';

const GREEN_NEST_ICON='/ui/nest/green-nest.png';
/** 横屏右侧筛选栏是否收起（2026-11-22 用户口径：收起后蛋卡多排几列）。 */
const EGG_RAIL_KEY='roco.eggStockRailCollapsed';
function readEggRailCollapsed():boolean{
  if(typeof window==='undefined')return false;
  try{return window.localStorage.getItem(EGG_RAIL_KEY)==='1';}catch{return false;}
}
function saveEggRailCollapsed(collapsed:boolean):void{
  if(typeof window==='undefined')return;
  try{window.localStorage.setItem(EGG_RAIL_KEY,collapsed?'1':'0');}catch{/* 隐私模式 / 配额满：本次照样生效 */}
}
const SPECIAL_CATEGORY_LABELS={shiny:'异色蛋',boss:'首领蛋',activity:'活动蛋',rare:'稀有蛋',special:'特殊蛋'} as const;
type StockFilter='全部'|'已标注'|'未标注'|'自产'|'不可交换';

export function formatEggNature(value:string):string {
  return eggNatureNames(value).join(' / ');
}
function eggNatureNames(value:string):string[] {
  return value.split(/[·/、,，]+/)
    .map(part=>part.replace(/^\s*\d+(?:\.\d+)?%\s*/,'').trim())
    .filter(Boolean);
}
/**
 * 父母能给出的性格（2026-11-25）：绿窝只遗传学院小窝那只，优先按它（它没采到性格就留空，
 * 不能拿另一只亲本的性格顶替）；普通窝取双亲去重后的可能值。
 * 抓包入口（`homeEggAdapter`）只在「绿窝一只」或「双亲同性格」时把性格落库，
 * 父母性格不一致的普通窝蛋 `nature` 是空串——展示层要自己按父母补上，不能显示成「—」。
 */
function possibleEggNatures(e:WorkflowEgg):string[] {
  const parents=[e.parents?.mother,...(e.parents?.fathers??[])].filter((p):p is EggParentInfo=>!!p);
  const academy=parents.filter(p=>p.academy===true);
  if(academy.length===1)return academy[0].nature?[academy[0].nature]:[];
  return [...new Set(parents.map(p=>p.nature).filter((nature):nature is string=>!!nature))];
}
/** 蛋的性格展示值：已落库的具体值优先；没有就按父母拼成 `冷静/平和`（再由 formatEggNature 拆成 `冷静 / 平和`）。 */
function eggNatureText(e:WorkflowEgg):string {
  return formatEggNature(e.nature)||formatEggNature(possibleEggNatures(e).join('/'));
}
/**
 * 绿窝标记（2026-11-25）：蛋自己标了绿窝，或任一亲本住在学院小窝。
 * 抓包入口把绿窝和「学院那只的性格」绑在一起、机器人入库又漏写 `greenNest`，
 * 所以只要父母里有一只 `academy`，展示与标注都按绿窝算，不能只认 `e.greenNest`。
 * 显式 `false`（用户手动取消过）优先，不拿父母覆盖人的判断。
 */
function isGreenNestEgg(e:WorkflowEgg):boolean {
  if(e.greenNest!==undefined)return e.greenNest;
  return [e.parents?.mother,...(e.parents?.fathers??[])].some(p=>p?.academy===true);
}
function formatEggHeight(heightCm?:number):string {
  if(typeof heightCm!=='number'||!Number.isFinite(heightCm)||heightCm<=0)return '未采集';
  return `${Number((heightCm/100).toFixed(3))} m`;
}
function formatEggWeight(weightGrams?:number):string {
  if(typeof weightGrams!=='number'||!Number.isFinite(weightGrams)||weightGrams<=0)return '未采集';
  return `${Number((weightGrams/1000).toFixed(3))} kg`;
}

export function EggArt({ eggGameId, name, size=43, kind='ordinary', itemConfId }: {
  eggGameId:number; name:string; size?:number; kind?:WorkflowEgg['kind']; itemConfId?:number;
}) {
  const [failed,setFailed]=useState<string[]>([]);
  const ordinary=(eggIconUrls as Record<string,string>)[eggGameId];
  const special=kind!=='ordinary'&&itemConfId
    ? `https://wiki.biligame.com/nrc/Special:Redirect/file/Item_${itemConfId}.png`
    : undefined;
  const url=[...new Set([special,ordinary].filter((value):value is string=>!!value))].find(value=>!failed.includes(value));
  const fail=()=>{const current=url;if(current)setFailed(values=>values.includes(current)?values:[...values,current]);};
  return url ? <img src={url} alt={name+'的蛋'} onError={fail} width={size} height={size} className="shrink-0 object-contain"/> : <span role="img" aria-label={name+'的蛋（暂无图片）'} style={{width:size,height:size}} className="inline-flex shrink-0 items-center justify-center text-[10px] text-slate-400">暂无蛋图</span>;
}
export function EggMedals({body,voice}:{body:string;voice:string}) {
  return <span className="inline-flex items-center justify-center gap-0.5">{[[body,bodyMedalIconByLabel(body)],[voice,voiceMedalIconByLabel(voice)]].map(([label,src],i)=>src?<img key={i} src={src} alt={label??''} className="size-4 object-contain"/>:null)}</span>;
}
export function EggStockPanel({ eggs, species, busy, mutate, collapsibleFilterRail=false, railBack, character, characters, onCharacterChange }: { eggs:readonly WorkflowEgg[];species:readonly SpeciesEntry[];busy:boolean;mutate:(action:unknown)=>Promise<unknown>;/** 横屏把搜索与条件收进右侧折叠栏（家园页蛋仓屏用） */collapsibleFilterRail?:boolean;/** 横屏标题栏里的返回动作（家园页传入「返回家园」） */railBack?:{label?:string;onClick:()=>void};/** 游戏角色筛选：'' = 全部角色（家园蛋仓屏传入，组内广场不传就不出这一项） */character?:string;characters?:readonly EggCharacter[];onCharacterChange?:(key:string)=>void }) {
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState<StockFilter>('全部');
  const [selected,setSelected]=useState<string|null>(null);
  const [labeling,setLabeling]=useState(false);
  const [natures,setNatures]=useState<string[]>([]);
  const [moreNatures,setMoreNatures]=useState(false);
  const [body,setBody]=useState<DemandBody>('大块头');
  const [voice,setVoice]=useState<DemandVoice>('婉转声');
  const [greenNest,setGreenNest]=useState(false);
  const [error,setError]=useState('');
  /** 横屏右侧筛选栏：只有 opt-in 且确实横屏时出现，竖屏保持原来的上下排布。 */
  const landscape=useLandscape();
  const rail= collapsibleFilterRail && landscape;
  const [railCollapsed,setRailCollapsed]=useState(readEggRailCollapsed);
  const toggleRail=()=>setRailCollapsed(collapsed=>{saveEggRailCollapsed(!collapsed);return !collapsed;});
  const labelEditorRef=useRef<HTMLDivElement>(null);
  const name=(id:number)=>species.find(s=>s.gameId===id)?.name??'未收录精灵';
  // 实际父母直接用家园 / 配窝建议那张精灵卡（个体测量没采到，先不写分贝 / 身高 / 体重）
  const NO_GROUPS = new Set<number>();
  const pairCardOf = (p: EggParentInfo, gender: '母' | '公'): PairCardPet => ({
    key: `${gender}-${p.id}`,
    gameId: p.gameId,
    name: p.name || name(p.gameId),
    gender,
    nature: p.nature,
    medalBody: p.body === '满体重' ? '大块头' : p.body === '零体重' ? '小不点' : p.body,
    voiceDb: p.voice === '+100' ? 100 : p.voice === '-100' ? -100 : p.voice === '婉转声' ? 96 : p.voice === '粗嗓门' ? -96 : null,
    weightPercent: p.body === '满体重' ? 100 : p.body === '零体重' ? 0 : null,
    // 学院小窝 100% 传性格：文字补回卡底，不能只靠绿框暗示
    box: `${p.nestName || '窝未知'}${p.academy ? ' · 100%性格' : ''}`,
  });
  const fullness=(e:WorkflowEgg)=>{ if(e.location!=='home'||e.body!=='大块头')return ''; const entry=eggWeightOf(name(e.eggGameId));
    if(!entry||typeof entry.big!=='number')return ''; const total=Math.round(entry.max*1000)-Math.round(entry.big*1000)+1;
    return total>0&&total<1000?`约 1/${total}`:''; };
  const special=(e:WorkflowEgg)=>e.kind==='special'||e.kind==='shiny';
  /**
   * 自产 = 自己孵出来的：带 self-bred 来源，或**目前还躺在家园地上**（2026-11-24 用户口径）。
   * 「在地家园」这个说法不再出现；家园状态只在机器人取蛋那边有用，界面上一律按自产算。
   */
  const selfProduced=(e:WorkflowEgg)=>e.provenance==='self-bred'||e.location==='home';
  const annotated=(e:WorkflowEgg)=>!!eggNatureText(e)&&
    ['大块头','小不点','满体重','零体重'].includes(e.body)&&
    ['+100','-100','婉转声','粗嗓门'].includes(e.voice);
  const unavailableLabel=(e:WorkflowEgg)=>SPECIAL_CATEGORY_LABELS[e.specialCategory??'special'];
  const status=(e:WorkflowEgg)=>special(e)?unavailableLabel(e):e.location==='home'?'':e.status==='reserved'?'换蛋中':e.listed?'已挂出':'未挂出';
  const matchesFilter=(e:WorkflowEgg)=>filter==='不可交换'?special(e):!special(e)&&(
    filter==='全部'||filter==='已标注'&&annotated(e)||filter==='未标注'&&!annotated(e)||filter==='自产'&&selfProduced(e));
  const visible=eggs.filter(e=>e.status!=='transferred'&&(!character||e.gameAccountKey===character)&&(!query||name(e.eggGameId).includes(query))&&matchesFilter(e))
    .sort((a,b)=>Number(selfProduced(b))-Number(selfProduced(a))||Number(isGreenNestEgg(b))-Number(isGreenNestEgg(a)));
  const egg=eggs.find(e=>e.id===selected);
  const selectedExtraNatures=natures.filter(value=>!targetNatureNames.includes(value));
  const visibleNatures=moreNatures?allNatureNames:targetNatureNames;
  const moreNatureCount=allNatureNames.length-targetNatureNames.length;
  const toggleNature=(value:string)=>setNatures(current=>current.includes(value)
    ? current.filter(item=>item!==value)
    : current.length>=DEMAND_NATURE_MAX?current:[...current,value]);
  const optionRow=<T extends string>(
    label:string,
    values:readonly T[],
    current:T,
    labels:Record<T,string>,
    onPick:(value:T)=>void,
    testPrefix:string,
  )=><div className="flex flex-wrap items-center gap-0.5">
    <span className="w-7 shrink-0 text-[9px] text-slate-400">{label}</span>
    {values.map(value=><button key={`${testPrefix}:${value}`} type="button" aria-pressed={current===value} onClick={()=>onPick(value)} data-testid={`${testPrefix}-${value}`} className={`min-h-[26px] rounded border px-1 text-[10px] ${current===value?'border-emerald-500 bg-emerald-50 font-medium text-emerald-700':'border-slate-200 bg-white text-slate-500'}`}>{labels[value]}</button>)}
  </div>;
  useEffect(()=>{
    if(labeling)requestAnimationFrame(()=>labelEditorRef.current?.scrollIntoView({block:'nearest'}));
  },[labeling,selected]);
  const run=(action:unknown,done?:()=>void)=>{setError('');void mutate(action).then(done).catch(e=>setError(e instanceof Error?e.message:'操作失败'));};
  const beginLabeling=(target:WorkflowEgg)=>{
    const stored=eggNatureNames(target.nature);
    setNatures(stored.length?stored:possibleEggNatures(target));
    setMoreNatures(false);
    setBody(target.body==='unknown'||!target.body?'大块头':target.body);
    setVoice(target.voice==='unknown'||!target.voice?'婉转声':target.voice);
    setGreenNest(isGreenNestEgg(target));
    setLabeling(true);
  };
  const labelValues=(target:WorkflowEgg)=>labeling
    ? {nature:natures.join(' / '),body,voice,greenNest}
    : {
        nature:eggNatureText(target),
        body:(target.body==='unknown'||!target.body?'大块头':target.body),
        voice:(target.voice==='unknown'||!target.voice?'婉转声':target.voice),
        greenNest:isGreenNestEgg(target),
      };
  const characterBlock=characters&&characters.length>1&&onCharacterChange
    ? <EggCharacterSelect compact testId="egg-stock-character-rail" value={character??''} characters={characters} onChange={onCharacterChange}/>
    : null;
  const searchBlock=<SearchField label="搜索蛋名" value={query} onValueChange={setQuery} placeholder="搜索蛋名" className="[&_input]:text-left"/>;
  const filterBlock=<div className="flex flex-wrap gap-1" data-testid="egg-stock-filter-chips">{(['全部','已标注','未标注','自产','不可交换'] as const).map(f=><button key={f} type="button" aria-pressed={filter===f} onClick={()=>setFilter(f)} className={'min-h-7 rounded-md px-2 text-[11px] '+(filter===f?'bg-emerald-50 font-semibold text-emerald-700':'text-slate-500')}>{f}</button>)}</div>;
  const cards=visible.length?<div className="egg-stock-grid grid grid-cols-4 gap-1.5" data-testid="egg-stock-grid">{visible.map(e=>{
      const border=isGreenNestEgg(e)?'border-emerald-500':'border-slate-200';
      return <button data-testid="stock-card" data-egg-id={e.id} key={e.id} type="button" onClick={()=>{setSelected(e.id);setLabeling(false);setError('');}} className={`relative flex min-w-0 flex-col items-center overflow-hidden rounded-lg border bg-white ${border}`}>
        <div data-testid="stock-card-labels" className="flex h-4 w-full shrink-0 items-center justify-between gap-1 px-1">
          <span className="flex min-w-0 items-center gap-0.5">
            {isGreenNestEgg(e)?<img data-testid="stock-green-nest" src={GREEN_NEST_ICON} alt="绿窝" className="size-3.5 shrink-0 object-contain"/>:null}
          </span>
          <span className="flex min-w-0 items-center justify-end">
            {selfProduced(e)?<span data-testid="stock-self-badge" className="truncate rounded bg-emerald-50 px-1 py-px text-[8.5px] font-semibold leading-none text-emerald-700">自产</span>:null}
          </span>
        </div>
        <div data-testid="stock-card-body" className="flex w-full min-w-0 flex-col items-center px-0.5 pb-0.5">
          <EggArt eggGameId={e.eggGameId} name={name(e.eggGameId)} kind={e.kind} itemConfId={e.itemConfId}/>
          <strong className="w-full truncate px-0.5 text-[10.5px]">{name(e.eggGameId)}</strong>
          <span className="min-h-4 text-[10px] leading-4 text-slate-500">{eggNatureText(e)||'—'}</span>
          <span className="h-5"><EggMedals body={e.body} voice={e.voice}/></span>
          {e.location==='home'&&e.lastConfirmedAt?<span data-testid="stock-confirmed" className="text-[10px] leading-4 tabular-nums text-emerald-700">{formatEggObtainedAt(new Date(e.lastConfirmedAt).toISOString())}</span>:formatEggObtainedAt(e.obtainedAt)?<span data-testid="stock-time" className="text-[10px] leading-4 tabular-nums text-slate-400">{formatEggObtainedAt(e.obtainedAt)}</span>:null}
          {status(e)?<span className={'mt-0.5 w-full text-center text-[10px] leading-5 '+(special(e)?'bg-slate-100 text-slate-500':e.provenance==='self-bred'?'bg-emerald-50 text-emerald-700':e.listed?'bg-emerald-50 text-emerald-700':'bg-slate-50 text-slate-500')}>{status(e)}</span>:null}
        </div>
      </button>;
    })}</div>:<div className="py-6 text-center text-xs text-slate-500">{eggs.length?(character&&!eggs.some(e=>e.gameAccountKey===character)?'这个角色还没有蛋':'没有符合的蛋'):'暂无已采集的蛋'}</div>;
  return <div
    className={'flex flex-col gap-2'+(rail?' egg-stock-scope':'')}
    data-rail-collapsed={rail?(railCollapsed?'true':'false'):undefined}
    data-testid={rail?'egg-stock-scope':undefined}
  >
    {rail?<div className="egg-stock-layout" data-collapsed={railCollapsed?'true':'false'}>
      <div className="egg-stock-main flex min-w-0 flex-col gap-2" data-testid="egg-stock-main">
        {cards}
      </div>
      {railCollapsed?null:<div className="egg-stock-filters flex min-w-0 flex-col gap-2" data-testid="egg-stock-filters">{characterBlock}{searchBlock}{filterBlock}</div>}
      <aside className="egg-stock-rail" data-testid="egg-stock-rail" aria-label="蛋仓标题栏">
        {railBack?<button
          type="button"
          onClick={railBack.onClick}
          title={railBack.label ?? '返回家园'}
          className="egg-stock-rail-back"
          data-testid="egg-stock-rail-back"
        >{railBack.label ?? '返回家园'}</button>:null}
        <h2 className="egg-stock-rail-title" data-testid="egg-stock-rail-title">我的蛋仓</h2>
        <button
          type="button"
          onClick={toggleRail}
          aria-expanded={!railCollapsed}
          aria-label={railCollapsed?'展开筛选':'收起筛选'}
          title={railCollapsed?'展开筛选':'收起筛选'}
          className="egg-stock-rail-toggle"
          data-testid="egg-stock-rail-toggle"
        >
          {railCollapsed?'展开筛选':'收起筛选'}
        </button>
      </aside>
    </div>:<>
      {searchBlock}
      {filterBlock}
      {cards}
    </>}
    {egg?<ModalSurface open title="蛋详情" size="xl" onClose={()=>setSelected(null)} footer={<div className="w-full">{canCirculateEgg(egg)?<>
    <div className="grid grid-cols-3 gap-2">
      <Button variant="secondary" size="sm" busy={busy} onClick={()=>labeling?run({type:'label',id:egg.id,...labelValues(egg)},()=>setLabeling(false)):beginLabeling(egg)}>标注此蛋</Button>
      <Button variant="secondary" size="sm" busy={busy} onClick={()=>run({type:'label-many',eggGameId:egg.eggGameId,...labelValues(egg)},()=>setLabeling(false))}>标注所有同类蛋</Button>
      <Button size="sm" busy={busy} disabled={egg.location==='home'} title={egg.location==='home'?'收进背包后才能挂出':undefined} onClick={()=>run({type:'list',id:egg.id,listed:!egg.listed})}>{egg.listed?'取消挂出':'挂出'}</Button>
    </div>{egg.location==='home'?<p className="mt-1 text-center text-[11px] text-slate-500">收进背包后才能挂出</p>:null}
    </>:<span className="text-sm text-slate-500">{status(egg)}</span>}</div>}>
      <div className={`grid gap-1.5 p-2.5 text-sm ${landscape ? 'grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-start' : 'grid-cols-1'}`}>
        <div className="flex min-w-0 flex-col gap-1.5">
        {/* 概览压成三行：名称 / 性格+奖牌 / 账号+来源 */}
        <div className="flex items-center gap-2">
          <EggArt eggGameId={egg.eggGameId} name={name(egg.eggGameId)} size={40} kind={egg.kind} itemConfId={egg.itemConfId}/>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1">
              <strong className="truncate text-sm leading-5">{name(egg.eggGameId)}的蛋</strong>
              {isGreenNestEgg(egg)?<img src={GREEN_NEST_ICON} alt="绿窝" className="size-3.5 shrink-0 object-contain"/>:null}
              {status(egg)?<span className="ml-auto shrink-0 rounded bg-slate-100 px-1 text-[9px] leading-4 text-slate-500">{status(egg)}</span>:null}
            </div>
            <div className="flex min-w-0 items-center gap-1 text-[11px] leading-4 text-slate-600">
              <span className="truncate">{eggNatureText(egg)||'性格未标注'}</span>
              <EggMedals body={egg.body} voice={egg.voice}/>
            </div>
            <div className="truncate text-[10px] leading-4 text-slate-400">
              {egg.accountName||egg.gameAccountKey} · {selfProduced(egg)?'自产':egg.provenance==='external'?'外部':'来源未知'}
            </div>
          </div>
        </div>

        {/* 关键数值；横屏左栏两列，竖屏三列；时间保留完整值，长文本截断但悬停可看全 */}
        <div className={`grid ${landscape ? 'grid-cols-2' : 'grid-cols-3'} gap-x-2 gap-y-1 rounded-lg bg-slate-50 px-2 py-1.5`}>
          <div className="col-span-2 min-w-0">
            <span className="block text-[9px] leading-3 text-slate-400">获得时间</span>
            <span className="block truncate text-[11px] leading-4 tabular-nums text-slate-700" title={formatEggObtainedAtFull(egg.obtainedAt)||'采集数据里没有获得时间'} data-testid="detail-obtained-at">{formatEggObtainedAtFull(egg.obtainedAt)||'采集数据里没有获得时间'}</span>
          </div>
          {egg.location==='home'?<div className="min-w-0">
            <span className="block text-[9px] leading-3 text-slate-400">最后确认</span>
            <span className="block truncate text-[11px] leading-4 tabular-nums text-slate-700" title={egg.lastConfirmedAt?formatEggObtainedAtFull(new Date(egg.lastConfirmedAt).toISOString()):'暂无'} data-testid="detail-confirmed-at">{egg.lastConfirmedAt?formatEggObtainedAtFull(new Date(egg.lastConfirmedAt).toISOString()):'暂无'}</span>
          </div>:null}
          <div className="min-w-0">
            <span className="block text-[9px] leading-3 text-slate-400">蛋高</span>
            <span className="block truncate text-[11px] leading-4 tabular-nums text-slate-700" data-testid="detail-egg-height">{formatEggHeight(egg.heightCm)}</span>
          </div>
          <div className="min-w-0">
            <span className="block text-[9px] leading-3 text-slate-400">蛋重</span>
            <span className="block truncate text-[11px] leading-4 tabular-nums text-slate-700" data-testid="detail-egg-weight">{formatEggWeight(egg.weightGrams)}</span>
          </div>
          <div className="min-w-0">
            <span className="block text-[9px] leading-3 text-slate-400">蛋组</span>
            <span className="block truncate text-[11px] leading-4 text-slate-700" title={species.find(s=>s.gameId===egg.eggGameId)?.eggGroups.map(g=>eggGroupNames[g]??String(g)).join(' / ')||'暂无记录'}>{species.find(s=>s.gameId===egg.eggGameId)?.eggGroups.map(g=>eggGroupNames[g]??String(g)).join(' / ')||'暂无记录'}</span>
          </div>
        </div>
        </div>

        <div className="flex min-w-0 flex-col gap-1.5">
        {/* 亲本压成两行小卡；可能性格 / 满重只占一行小字 */}
        <div className="rounded-lg bg-slate-50 px-2 py-1.5" data-testid="stock-parents">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h4 className="text-[11px] font-semibold leading-4 text-slate-700">实际父母</h4>
            {egg.parents?<span className="shrink-0 text-[9px] text-slate-400">{egg.parents.stale?'采集期间有精灵进出，配对可能已经过期':'按采集时配对推算'}</span>:null}
          </div>
          {egg.parents?<>
            <div className="egg-parent-grid">
              {[egg.parents.mother, ...(egg.parents.fathers ?? [])].filter((parent): parent is EggParentInfo => Boolean(parent))
                .map((parent) => <PairingPetCard key={pairCardOf(parent, parent === egg.parents?.mother ? '母' : '公').key} pet={pairCardOf(parent, parent === egg.parents?.mother ? '母' : '公')} collectedGroupIds={NO_GROUPS} academy={parent.academy} hideMeasurements />)}
            </div>
            {!egg.nature&&possibleEggNatures(egg).length?<p className="mt-1 text-[10px] leading-4 text-slate-500">可能性格：{possibleEggNatures(egg).join(' / ')}（各 30%，其余随机）</p>:null}
            {fullness(egg)?<p className="mt-0.5 text-[10px] leading-4 text-slate-500">满重 {fullness(egg)}（收进背包后确定）</p>:null}
          </>:<p className="text-[10px] text-slate-400">暂无亲本记录</p>}
        </div>
        </div>

        {/* 原来父母卡下面那句说明不能省：游戏未确认亲子关系，以实物为准 */}
        <p className={`text-[9px] leading-3 text-slate-400 ${landscape ? 'col-span-2' : ''}`}>按采集时的当前配对与父母属性推算；游戏未确认亲子关系，收进背包后以实物为准。</p>

        {/* 标注编辑器：四列性格、两行体型 / 声音，尽量少占高度 */}
        {labeling?<div ref={labelEditorRef} data-testid="egg-label-editor" className={`flex flex-col gap-1 rounded-lg bg-slate-50 p-2 ${landscape ? 'col-span-2' : ''}`}>
          <div className="flex items-center justify-between text-[10px] text-slate-500"><span>性格</span><span>最多选 {DEMAND_NATURE_MAX} 个</span></div>
          <div className="grid grid-cols-4 gap-0.5" data-testid="egg-label-natures">
            {visibleNatures.map(value=><button key={value} type="button" aria-pressed={natures.includes(value)} onClick={()=>toggleNature(value)} className={`min-h-[26px] rounded border px-0.5 text-[10px] leading-tight ${natures.includes(value)?'border-emerald-500 bg-emerald-50 font-medium text-emerald-700':'border-slate-200 bg-white text-slate-500'}`}>{value}</button>)}
            {moreNatureCount>0?<button type="button" aria-label={`更多 +${moreNatureCount}`} aria-pressed={selectedExtraNatures.length>0||moreNatures} aria-expanded={moreNatures} onClick={()=>setMoreNatures(value=>!value)} className={`min-h-[26px] rounded border border-dashed px-0.5 text-[10px] ${selectedExtraNatures.length>0||moreNatures?'border-emerald-500 bg-emerald-50 font-medium text-emerald-700':'border-slate-300 bg-white text-slate-500'}`}>{moreNatures?`收起 +${moreNatureCount} ▴`:`更多 +${moreNatureCount}`}</button>:null}
          </div>
          <div className="flex flex-col gap-0.5">
            {optionRow('体型',PICKABLE_BODIES,body,BODY_LABELS,setBody,'egg-label-body')}
            {optionRow('声音',PICKABLE_VOICES,voice,VOICE_LABELS,setVoice,'egg-label-voice')}
          </div>
          <label className="flex min-h-[24px] items-center gap-1.5 text-[11px] text-slate-500"><input type="checkbox" checked={greenNest} onChange={e=>setGreenNest(e.target.checked)} className="size-3.5 accent-emerald-600"/>绿窝蛋</label>
        </div>:null}
        {error?<p role="alert" className={`text-xs text-rose-600 ${landscape ? 'col-span-2' : ''}`}>{error}</p>:null}
      </div>
    </ModalSurface>:null}
  </div>;
}
