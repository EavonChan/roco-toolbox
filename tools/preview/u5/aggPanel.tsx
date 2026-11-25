/**
 * U5 原型：**同类蛋聚合**的聚合卡与展开列表（只用于出方案截图，不是产品代码）。
 *
 * 为什么原型要重写一份渲染：本轮硬规则是「不改 `src/`」，而聚合卡 / 展开列表是新东西，
 * 线上还不存在。这里尽量复用真实零件，保证像素口径一致：
 * - 蛋图 / 奖牌：`src/ui/plan/EggStockPanel.tsx` 导出的 `EggArt` / `EggMedals`；
 * - 时间格式：`src/ui/plan/eggTime.ts`；
 * - 弹层：`src/ui/primitives/ModalSurface.tsx`（`placement="sheet"` 就是底部抽屉）；
 * - 搜索框：`src/ui/primitives/SearchField.tsx`。
 * 分组函数 `groupEggs` 是本方案的**参考实现**，落代码时原样搬进
 * `src/ui/plan/eggStockGroups.ts`（签名见方案 §4）。
 */
import { useState } from 'react';
import type { SpeciesEntry } from '../../../src/domain/types';
import type { WorkflowEgg } from '../../../src/shared/eggWorkflow';
import type { EggParentInfo } from '../../../src/shared/eggMatching';
import { academyParentsOf, hasAcademyParent } from '../../../src/shared/eggWorkflow';
import { EggArt, EggMedals, formatEggNature } from '../../../src/ui/plan/EggStockPanel';
import { formatEggObtainedAt } from '../../../src/ui/plan/eggTime';
import { ModalSurface } from '../../../src/ui/primitives/ModalSurface';
import { SearchField } from '../../../src/ui/primitives/SearchField';

const GREEN_NEST_ICON = '/ui/nest/green-nest.png';
export type GroupMode = 'species' | 'species-nature' | 'strict';
type StockFilter = '全部' | '已标注' | '未标注' | '自产' | '不可交换';

/* ── 与 EggStockPanel 同口径的纯函数（落代码时改为从面板传入回调，见方案 §9 边界） ── */
function eggNatureNames(value: string): string[] {
  return value.split(/[·/、,，]+/).map(part => part.replace(/^\s*\d+(?:\.\d+)?%\s*/, '').trim()).filter(Boolean);
}
function possibleEggNatures(e: WorkflowEgg): string[] {
  const parents = [e.parents?.mother, ...(e.parents?.fathers ?? [])].filter((p): p is EggParentInfo => !!p);
  const academy = academyParentsOf(e.parents);
  if (academy.length === 1) return academy[0].nature ? [academy[0].nature] : [];
  return [...new Set(parents.map(p => p.nature).filter((nature): nature is string => !!nature))];
}
function eggNatureText(e: WorkflowEgg): string {
  return formatEggNature(e.nature) || formatEggNature(possibleEggNatures(e).join('/'));
}
function isGreenNestEgg(e: WorkflowEgg): boolean {
  if (e.greenNest !== undefined) return e.greenNest;
  return hasAcademyParent(e.parents);
}
const selfProduced = (e: WorkflowEgg) => e.provenance === 'self-bred' || e.location === 'home';
const annotated = (e: WorkflowEgg) => !!eggNatureText(e)
  && ['大块头', '小不点', '满体重', '零体重'].includes(e.body)
  && ['+100', '-100', '婉转声', '粗嗓门'].includes(e.voice);
const special = (e: WorkflowEgg) => e.kind === 'special' || e.kind === 'shiny';

/* ── 分组（方案 §4 参考实现） ── */
export interface EggGroup {
  key: string;
  eggGameId: number;
  eggs: WorkflowEgg[];
  count: number;
  selfProduced: number;
  greenNest: number;
  listed: number;
  reserved: number;
  claimPending: number;
  bag: number;
  home: number;
  availableBag: number;
  annotated: number;
  natures: { text: string; count: number }[];
  /** 二级页面用：按性格分组（数量降序），组内按获得时间倒序。 */
  natureGroups: { text: string; eggs: WorkflowEgg[] }[];
  bodyKinds: number;
  voiceKinds: number;
  latestObtainedAt?: string;
  latestConfirmedAt: number;
}
const tally = (values: string[]): { text: string; count: number }[] => {
  const map = new Map<string, number>();
  for (const value of values) map.set(value, (map.get(value) ?? 0) + 1);
  return [...map.entries()].map(([text, count]) => ({ text, count })).sort((a, b) => b.count - a.count);
};
const distinctKnown = (values: string[]) => new Set(values.filter(v => !!v && v !== 'unknown')).size;

/**
 * 口径：
 * - `species`（推荐）：同物种一张卡；性格 / 体型 / 声音差异在卡上做分布摘要。
 * - `species-nature`：同物种 + 同性格（性格是换蛋的主字段，分开看更好挂出）。
 * - `strict`：同物种 + 同性格 + 同体型 + 同声音（一条都不一样就分卡）。
 * 特殊蛋（异色 / 首领）不参与聚合：每颗单独一张，和现状一致。
 */
export function groupEggs(eggs: readonly WorkflowEgg[], mode: GroupMode = 'species'): EggGroup[] {
  const map = new Map<string, WorkflowEgg[]>();
  for (const egg of eggs) {
    const key = special(egg)
      ? `special:${egg.id}`
      : mode === 'strict'
        ? [egg.eggGameId, eggNatureText(egg), egg.body, egg.voice].join('|')
        : mode === 'species-nature'
          ? [egg.eggGameId, eggNatureText(egg)].join('|')
          : String(egg.eggGameId);
    map.set(key, [...(map.get(key) ?? []), egg]);
  }
  const groups = [...map.entries()].map(([key, members]) => {
    const obtained = members.map(e => e.obtainedAt).filter((v): v is string => !!v).sort();
    const byNature = new Map<string, WorkflowEgg[]>();
    for (const egg of members) {
      const text = eggNatureText(egg);
      byNature.set(text, [...(byNature.get(text) ?? []), egg]);
    }
    const natureGroups = [...byNature.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([text, list]) => ({
        text,
        eggs: [...list].sort((a, b) => (b.obtainedAt ?? '').localeCompare(a.obtainedAt ?? '')),
      }));
    return {
      key,
      eggGameId: members[0].eggGameId,
      eggs: members,
      count: members.length,
      selfProduced: members.filter(selfProduced).length,
      greenNest: members.filter(isGreenNestEgg).length,
      listed: members.filter(e => e.listed).length,
      reserved: members.filter(e => e.status === 'reserved').length,
      claimPending: members.filter(e => e.claimPending).length,
      bag: members.filter(e => e.location === 'bag').length,
      home: members.filter(e => e.location === 'home').length,
      availableBag: members.filter(e => e.location === 'bag' && !e.listed && e.status === 'available').length,
      annotated: members.filter(annotated).length,
      natures: tally(members.map(eggNatureText)),
      natureGroups,
      bodyKinds: distinctKnown(members.map(e => e.body)),
      voiceKinds: distinctKnown(members.map(e => e.voice)),
      latestObtainedAt: obtained[obtained.length - 1],
      latestConfirmedAt: Math.max(...members.map(e => e.lastConfirmedAt || 0)),
    };
  });
  // 排序沿用现状两条：组内**任一**自产 → 组在前；任一绿窝 → 再在前；其余保持首次出现顺序（稳定）。
  const firstIndex = new Map(groups.map((group, index) => [group.key, index]));
  return groups.sort((a, b) =>
    Number(b.selfProduced > 0) - Number(a.selfProduced > 0)
    || Number(b.greenNest > 0) - Number(a.greenNest > 0)
    || (firstIndex.get(a.key) ?? 0) - (firstIndex.get(b.key) ?? 0));
}

const natureLine = (group: EggGroup): string => group.natures.length === 1
  ? group.natures[0].text || '—'
  : group.natures.map(n => `${n.text || '未标注'}${n.count}`).join(' · ');

/**
 * 聚合卡（主视图）：只回答「这是什么蛋、有几颗」+ 必要状态。
 * - `×N` 做在蛋图右下角（堆叠数），筛选命中小于全量时写 `×N/M`；
 * - 性格 / 体型 / 声音的差异**不在卡上展开**，进二级页面按性格分组看；
 * - `natureHint` 打开时补一行「性格 2 种」（只提示有几种，不列明细），用来做 A/B 对比。
 */
function GroupCard({ group, total, name, open, natureHint, onClick }: {
  group: EggGroup; total: number; name: (id: number) => string; open: boolean; natureHint: boolean; onClick: () => void;
}) {
  const partial = total > group.count;
  const latest = group.latestObtainedAt ? formatEggObtainedAt(group.latestObtainedAt) : '';
  return <button
    type="button"
    data-testid="stock-group-card"
    data-group-key={group.key}
    data-egg-count={group.count}
    aria-expanded={open}
    onClick={onClick}
    className={`relative flex min-w-0 flex-col items-center overflow-hidden rounded-lg border bg-white ${group.greenNest ? 'border-emerald-500' : 'border-slate-200'}`}
  >
    <div className="flex h-4 w-full shrink-0 items-center justify-between gap-0.5 px-1">
      <span className="flex min-w-0 items-center gap-0.5">
        {group.greenNest ? <img src={GREEN_NEST_ICON} alt="绿窝" className="size-3.5 shrink-0 object-contain" /> : null}
      </span>
      <span className="flex min-w-0 shrink-0 items-center justify-end">
        {group.selfProduced === group.count
          ? <span className="truncate rounded bg-emerald-50 px-1 py-px text-[8.5px] font-semibold leading-none text-emerald-700">自产</span>
          : group.selfProduced > 0
            ? <span className="truncate rounded bg-emerald-50 px-1 py-px text-[8.5px] font-semibold leading-none text-emerald-700" title={`${group.selfProduced} 颗自产`}>自产{group.selfProduced}/{group.count}</span>
            : null}
      </span>
    </div>
    <div className="flex w-full min-w-0 flex-1 flex-col items-center px-0.5 pb-0.5">
      <span className="relative my-0.5 inline-flex">
        <EggArt eggGameId={group.eggGameId} name={name(group.eggGameId)} />
        <span
          title={partial ? `共 ${total} 颗，当前筛选命中 ${group.count} 颗` : `共 ${group.count} 颗`}
          className="absolute -bottom-1 -right-1 rounded bg-emerald-600 px-1 text-[9px] font-bold leading-4 text-white tabular-nums shadow-sm"
        >{partial ? `×${group.count}/${total}` : `×${group.count}`}{open ? ' ▴' : ''}</span>
      </span>
      <strong className="w-full truncate px-0.5 text-center text-[10.5px]">{name(group.eggGameId)}</strong>
      {natureHint
        ? <span className="min-h-4 max-w-full truncate px-0.5 text-[9px] leading-4 text-slate-400" title={group.natures.map(n => `${n.text || '未标注'}×${n.count}`).join(' / ')}>
            {group.natures.length > 1 ? `性格 ${group.natures.length} 种` : natureLine(group)}
          </span>
        : null}
      {latest
        ? <span className="text-[10px] leading-4 tabular-nums text-slate-400" title="最新获得时间">{latest}</span>
        : group.home === group.count && group.latestConfirmedAt
          ? <span className="text-[10px] leading-4 tabular-nums text-emerald-700" title="最后确认时间">{formatEggObtainedAt(new Date(group.latestConfirmedAt).toISOString())}</span>
          : null}
      <div className="mt-auto flex w-full flex-col pt-0.5">
        {group.listed > 0
          ? <span className="w-full bg-emerald-50 text-center text-[9.5px] leading-[15px] text-emerald-700 tabular-nums">{group.listed}/{group.count} 已挂出</span>
          : group.availableBag > 0
            ? <span className="w-full bg-slate-50 text-center text-[9.5px] leading-[15px] text-slate-500">未挂出</span>
            : null}
        {group.claimPending > 0
          ? <span className="w-full bg-amber-50 text-center text-[9.5px] leading-[15px] text-amber-700">{group.claimPending} 待认领</span>
          : null}
      </div>
    </div>
  </button>;
}

const STATUS_CHIP: Record<string, string> = {
  已挂出: 'bg-emerald-50 text-emerald-700',
  未挂出: 'bg-slate-50 text-slate-500',
  在家园: 'bg-slate-50 text-slate-500',
  换蛋中: 'bg-sky-50 text-sky-700',
  待认领: 'bg-amber-50 text-amber-700',
};
function rowStatus(egg: WorkflowEgg): string {
  if (egg.claimPending) return '待认领';
  if (egg.status === 'reserved') return '换蛋中';
  if (egg.listed) return '已挂出';
  return egg.location === 'bag' ? '未挂出' : '在家园';
}

/** 二级页面：按性格分组（`平和 ×4` / `冷静 ×1`），组内按获得时间倒序；点行 = 现有「蛋详情」。 */
function NatureSections({ group, name, onPick }: { group: EggGroup; name: (id: number) => string; onPick: (egg: WorkflowEgg) => void }) {
  return <div className="flex flex-col" data-testid="stock-level2">
    {group.natureGroups.map(section => <section key={section.text || '未标注'} data-testid="stock-level2-section">
      <h4 className="flex items-center gap-1 border-y border-slate-100 bg-slate-50/80 px-2 py-1 text-[10px] leading-4">
        <span className="font-semibold text-slate-700">{section.text || '性格未标注'}</span>
        <span className="tabular-nums text-slate-400">×{section.eggs.length}</span>
      </h4>
      {section.eggs.map(egg => {
        const status = rowStatus(egg);
        const when = egg.obtainedAt ? formatEggObtainedAt(egg.obtainedAt)
          : egg.lastConfirmedAt ? formatEggObtainedAt(new Date(egg.lastConfirmedAt).toISOString()) : '';
        const hasMedal = ['大块头', '小不点', '满体重', '零体重'].includes(egg.body) || ['+100', '-100', '婉转声', '粗嗓门'].includes(egg.voice);
        return <button
          key={egg.id}
          type="button"
          data-testid="stock-group-row"
          data-egg-id={egg.id}
          onClick={() => onPick(egg)}
          className={`flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-slate-50 ${egg.claimPending ? 'bg-amber-50/40' : ''}`}
        >
          <EggArt eggGameId={egg.eggGameId} name={name(egg.eggGameId)} size={30} kind={egg.kind} itemConfId={egg.itemConfId} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex min-w-0 items-center gap-1">
              {hasMedal ? <EggMedals body={egg.body} voice={egg.voice} /> : <span className="truncate text-[10px] text-slate-400">体型/声音未标注</span>}
              {isGreenNestEgg(egg) ? <img src={GREEN_NEST_ICON} alt="绿窝" className="size-3.5 shrink-0 object-contain" /> : null}
              <span className="truncate text-[9.5px] text-slate-400">{selfProduced(egg) ? '自产' : '外部'}</span>
            </span>
            <span className="truncate text-[9.5px] leading-4 text-slate-400">
              {egg.location === 'home' ? '家园' : '背包'} · {when || '无时间'}
            </span>
          </span>
          <span className={`shrink-0 rounded px-1 text-[9.5px] leading-4 ${STATUS_CHIP[status] ?? 'bg-slate-50 text-slate-500'}`}>{status}</span>
          <span className="shrink-0 text-[10px] text-slate-300">›</span>
        </button>;
      })}
    </section>)}
  </div>;
}

/** 二级页面头部摘要（抽屉与就地展开共用）。 */
function LevelTwoSummary({ group, total }: { group: EggGroup; total: number }) {
  const partial = total > group.count;
  const summaryParts = [
    partial ? `共 ${total} 颗 · 当前筛选 ${group.count} 颗` : '',
    `${group.bag} 在背包`,
    `${group.home} 在家园`,
    `${group.annotated} 已标注`,
    group.listed ? `${group.listed} 已挂出` : '',
    group.reserved ? `${group.reserved} 换蛋中` : '',
    group.claimPending ? `${group.claimPending} 待认领` : '',
  ].filter(Boolean);
  return <p className="px-2 py-1 text-[9.5px] leading-4 text-slate-400">
    {summaryParts.map((part, index) => <span key={part} className="whitespace-nowrap">{part}{index < summaryParts.length - 1 ? ' · ' : ''}</span>)}
  </p>;
}

/** 备选：就地展开面板（占满整行，插在聚合卡那一行下面），内容同样是按性格分组。 */
function InlineGroup({ group, total, name, onCollapse, onPick }: {
  group: EggGroup; total: number; name: (id: number) => string; onCollapse: () => void; onPick: (egg: WorkflowEgg) => void;
}) {
  return <div style={{ gridColumn: '1 / -1' }} className="overflow-hidden rounded-lg border border-emerald-300 bg-white" data-testid="stock-group-inline">
    <div className="flex items-start justify-between gap-2 border-b border-slate-100 bg-emerald-50/60 px-2 py-1">
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[11px] font-semibold leading-4 text-slate-700">{name(group.eggGameId)} · {group.count} 颗</span>
        <LevelTwoSummary group={group} total={total} />
      </span>
      <button type="button" onClick={onCollapse} className="shrink-0 rounded px-1 text-[10px] leading-4 text-emerald-700">收起</button>
    </div>
    <NatureSections group={group} name={name} onPick={onPick} />
  </div>;
}

/** 聚合后的蛋仓面板（竖屏布局：搜索 → 筛选 → 四列网格；拍板：就地展开）。 */
export function AggPanel({ eggs, species, mode = 'species', initialFilter = '全部', initialInlineOpen, natureHint = false }: {
  eggs: readonly WorkflowEgg[]; species: readonly SpeciesEntry[]; mode?: GroupMode;
  initialFilter?: StockFilter; initialInlineOpen?: number | null; natureHint?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StockFilter>(initialFilter);
  const [inlineKey, setInlineKey] = useState<number | null>(initialInlineOpen ?? null);
  const [picked, setPicked] = useState<WorkflowEgg | null>(null);
  const name = (id: number) => species.find(s => s.gameId === id)?.name ?? '未收录精灵';
  const pool = eggs.filter(e => e.status !== 'transferred' && (!query || name(e.eggGameId).includes(query)));
  const visible = pool.filter(e => filter === '不可交换' ? special(e) : !special(e) && (
    filter === '全部' || filter === '已标注' && annotated(e) || filter === '未标注' && !annotated(e) || filter === '自产' && selfProduced(e)));
  const groups = groupEggs(visible, mode);
  const totals = new Map(groupEggs(pool, mode).map(group => [group.key, group.count]));
  const inlineGroup = inlineKey === null ? null : groups.find(g => g.eggGameId === inlineKey) ?? null;
  return <div className="flex flex-col gap-2">
    <SearchField label="搜索蛋名" value={query} onValueChange={setQuery} placeholder="搜索蛋名" className="[&_input]:text-left" />
    <div className="flex flex-wrap gap-1" data-testid="egg-stock-filter-chips">
      {(['全部', '已标注', '未标注', '自产', '不可交换'] as const).map(f => <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={'min-h-7 rounded-md px-2 text-[11px] ' + (filter === f ? 'bg-emerald-50 font-semibold text-emerald-700' : 'text-slate-500')}>{f}</button>)}
    </div>
    {groups.length ? <div className="egg-stock-grid grid grid-cols-4 gap-1.5" data-testid="egg-stock-grid">
      {groups.map(group => group.count === 1 ? (
        <SingleCard key={group.key} egg={group.eggs[0]} name={name} onPick={setPicked} />
      ) : [<GroupCard
        key={group.key}
        group={group}
        total={totals.get(group.key) ?? group.count}
        name={name}
        open={inlineGroup?.key === group.key}
        natureHint={natureHint}
        onClick={() => setInlineKey(current => current === group.eggGameId ? null : group.eggGameId)}
      />, inlineGroup?.key === group.key ? <InlineGroup
        key={`${group.key}-rows`}
        group={group}
        total={totals.get(group.key) ?? group.count}
        name={name}
        onCollapse={() => setInlineKey(null)}
        onPick={setPicked}
      /> : null])}
    </div> : <div className="py-6 text-center text-xs text-slate-500">没有符合的蛋</div>}
    {picked ? <ModalSurface open title="蛋详情" size="xl" onClose={() => setPicked(null)} footer={<p className="text-center text-[11px] text-slate-500">原型里只做外观：线上这里就是现有「蛋详情」，标注 / 挂出 / 标注所有同类蛋都在里面</p>}>
      <div className="flex flex-col gap-1.5 p-3 text-sm">
        <div className="flex items-center gap-2">
          <EggArt eggGameId={picked.eggGameId} name={name(picked.eggGameId)} size={40} kind={picked.kind} itemConfId={picked.itemConfId} />
          <div className="min-w-0">
            <strong className="block truncate text-sm">{name(picked.eggGameId)}的蛋</strong>
            <span className="text-[11px] text-slate-600">{eggNatureText(picked) || '性格未标注'}</span>
            <EggMedals body={picked.body} voice={picked.voice} />
          </div>
        </div>
        <p className="rounded-lg bg-slate-50 px-2 py-1.5 text-[10px] leading-4 text-slate-500">
          获得时间 {formatEggObtainedAt(picked.obtainedAt) || '采集数据里没有'} · {picked.location === 'home' ? '家园' : '背包'} · {selfProduced(picked) ? '自产' : '外部'}
        </p>
      </div>
    </ModalSurface> : null}
  </div>;
}

/** 只有一颗的组照旧渲染单卡（保持现有详情入口与测试口径）。 */
function SingleCard({ egg, name, onPick }: { egg: WorkflowEgg; name: (id: number) => string; onPick: (egg: WorkflowEgg) => void }) {
  const specialStatus = ({ shiny: '异色蛋', boss: '首领蛋', activity: '活动蛋', rare: '稀有蛋', special: '特殊蛋' } as const)[egg.specialCategory ?? 'special'];
  const status = special(egg) ? specialStatus : egg.location === 'home' ? '' : egg.status === 'reserved' ? '换蛋中' : egg.listed ? '已挂出' : '未挂出';
  return <button
    type="button"
    data-testid="stock-card"
    data-egg-id={egg.id}
    onClick={() => onPick(egg)}
    className={`relative flex min-w-0 flex-col items-center overflow-hidden rounded-lg border bg-white ${isGreenNestEgg(egg) ? 'border-emerald-500' : 'border-slate-200'}`}
  >
    <div className="flex h-4 w-full shrink-0 items-center justify-between gap-1 px-1">
      <span className="flex min-w-0 items-center gap-0.5">
        {isGreenNestEgg(egg) ? <img src={GREEN_NEST_ICON} alt="绿窝" className="size-3.5 shrink-0 object-contain" /> : null}
      </span>
      <span className="flex min-w-0 items-center justify-end">
        {selfProduced(egg) ? <span className="truncate rounded bg-emerald-50 px-1 py-px text-[8.5px] font-semibold leading-none text-emerald-700">自产</span> : null}
      </span>
    </div>
    <div className="flex w-full min-w-0 flex-1 flex-col items-center px-0.5 pb-0.5">
      <EggArt eggGameId={egg.eggGameId} name={name(egg.eggGameId)} kind={egg.kind} itemConfId={egg.itemConfId} />
      <strong className="w-full truncate px-0.5 text-[10.5px]">{name(egg.eggGameId)}</strong>
      <span className="min-h-4 text-[10px] leading-4 text-slate-500">{eggNatureText(egg) || '—'}</span>
      <span className="flex h-5 items-center"><EggMedals body={egg.body} voice={egg.voice} /></span>
      {egg.location === 'home' && egg.lastConfirmedAt
        ? <span className="text-[10px] leading-4 tabular-nums text-emerald-700">{formatEggObtainedAt(new Date(egg.lastConfirmedAt).toISOString())}</span>
        : formatEggObtainedAt(egg.obtainedAt) ? <span className="text-[10px] leading-4 tabular-nums text-slate-400">{formatEggObtainedAt(egg.obtainedAt)}</span> : null}
      {status ? <span className={`mt-auto w-full text-center text-[10px] leading-5 ${egg.listed ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-500'}`}>{status}</span> : null}
    </div>
  </button>;
}
