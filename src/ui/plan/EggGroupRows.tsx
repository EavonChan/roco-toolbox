import type { WorkflowEgg } from '../../shared/eggWorkflow';
import { EggArt, EggMedals } from './EggStockPanel';
import { GreenNestIcon } from './EggGroupCard';
import { formatEggObtainedAt } from './eggTime';
import type { EggGroup, EggGroupRowStatus } from './eggStockGroups';

/** 行状态芯片：待认领琥珀、换蛋中蓝、已挂出绿、在家园 / 未挂出灰。 */
const ROW_STATUS_CLASS: Record<EggGroupRowStatus, string> = {
  待认领: 'bg-amber-50 text-amber-700',
  换蛋中: 'bg-sky-50 text-sky-700',
  已挂出: 'bg-emerald-50 text-emerald-700',
  在家园: 'bg-slate-50 text-slate-500',
  未挂出: 'bg-slate-50 text-slate-500',
};

/**
 * 聚合卡的展开面板（2026-11-25 U5，拍板：就地展开，不做抽屉 / 独立页）。
 *
 * 面板占满网格整行，插在聚合卡下面；内容按性格分组（`平和 ×4` / `冷静 ×1`，颗数降序），
 * 组内按获得时间倒序；每行末尾是这颗蛋自己的状态（挂出 / 换蛋中 / 待认领 / 在家园 / 未挂出）。
 * 点行交给面板打开现有「蛋详情」——聚合不复制第二套标注 / 挂出动作。
 */
export function EggGroupRows({ group, total, name, onPick, onCollapse }: {
  group: EggGroup;
  /** 当前筛选/搜索下该物种总颗数；大于面板颗数时在摘要里写「当前筛选」。 */
  total: number;
  name: (eggGameId: number) => string;
  onPick: (egg: WorkflowEgg) => void;
  onCollapse: () => void;
}) {
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
  return <div
    data-testid="stock-group-rows"
    style={{ gridColumn: '1 / -1', maxHeight: '60vh', overflowY: 'auto' }}
    className="overflow-hidden rounded-lg border border-emerald-300 bg-white"
  >
    <div className="flex items-start justify-between gap-2 border-b border-slate-100 bg-emerald-50/60 px-2 py-1">
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[11px] font-semibold leading-4 text-slate-700">{`${name(group.eggGameId)} · ${group.count} 颗`}</span>
        <span className="text-[9px] leading-4 text-slate-400">
          {summaryParts.map((part, index) => <span key={part} className="whitespace-nowrap">{part}{index < summaryParts.length - 1 ? ' · ' : ''}</span>)}
        </span>
      </span>
      <button type="button" onClick={onCollapse} className="shrink-0 rounded px-1 text-[10px] leading-4 text-emerald-700">收起</button>
    </div>
    {group.natureSections.map((section) => <section key={section.text || 'unknown'} data-testid="stock-group-section">
      <h4 data-testid="stock-group-section-title" className="border-y border-slate-100 bg-slate-50/80 px-2 py-1 text-[10px] leading-4">
        <span className="font-semibold text-slate-700">{section.text || '性格未标注'}</span>{' '}
        <span className="tabular-nums text-slate-400">{`×${section.items.length}`}</span>
      </h4>
      {section.items.map((item) => {
        const egg = item.egg;
        const measured = Boolean(egg.body && egg.body !== 'unknown') || Boolean(egg.voice && egg.voice !== 'unknown');
        const when = egg.obtainedAt
          ? formatEggObtainedAt(egg.obtainedAt)
          : egg.lastConfirmedAt ? formatEggObtainedAt(new Date(egg.lastConfirmedAt).toISOString()) : '';
        return <button
          key={egg.id}
          type="button"
          data-testid="stock-group-row"
          data-egg-id={egg.id}
          onClick={() => onPick(egg)}
          className={`flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-slate-50 ${item.status === '待认领' ? 'bg-amber-50/40' : ''}`}
        >
          <EggArt eggGameId={egg.eggGameId} name={name(egg.eggGameId)} size={30} kind={egg.kind} itemConfId={egg.itemConfId} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="flex min-w-0 items-center gap-1">
              {measured
                ? <EggMedals body={egg.body} voice={egg.voice} />
                : <span className="truncate text-[10px] text-slate-400">体型/声音未标注</span>}
              {item.greenNest ? <GreenNestIcon /> : null}
              <span className="truncate text-[9.5px] text-slate-400">{item.selfProduced ? '自产' : '外部'}</span>
            </span>
            <span className="truncate text-[9.5px] leading-4 text-slate-400">
              {`${egg.location === 'home' ? '家园' : '背包'} · ${when || '无时间'}`}
            </span>
          </span>
          <span className={`shrink-0 rounded px-1 text-[9.5px] leading-4 ${ROW_STATUS_CLASS[item.status]}`}>{item.status}</span>
          <span className="shrink-0 text-[10px] text-slate-300">›</span>
        </button>;
      })}
    </section>)}
  </div>;
}
