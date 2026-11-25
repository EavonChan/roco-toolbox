import { EggArt } from './EggStockPanel';
import { formatEggObtainedAt } from './eggTime';
import type { EggGroup } from './eggStockGroups';

/**
 * 同类蛋聚合卡（2026-11-25 U5，口径 = 同物种）。
 *
 * 主卡只回答两件事：**这是什么蛋、有几颗**；外加必要状态（已挂出数、待认领数、自产、绿窝）。
 * 性格 / 体型 / 声音的差异**不在卡上展开**——点开卡片，由 `EggGroupRows` 按性格分组展示。
 * `×N` 做在蛋图右下角，像「一堆蛋」的计数，不占名字宽度。
 */
export function EggGroupCard({ group, total, name, expanded, onToggle }: {
  group: EggGroup;
  /** 当前筛选/搜索下该物种总颗数；大于卡上颗数时写 `×N/M`。 */
  total: number;
  name: (eggGameId: number) => string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const partial = total > group.count;
  const latest = group.latestObtainedAt ? formatEggObtainedAt(group.latestObtainedAt) : '';
  const latestConfirmed = !latest && group.home === group.count && group.latestConfirmedAt > 0
    ? formatEggObtainedAt(new Date(group.latestConfirmedAt).toISOString())
    : '';
  return <button
    type="button"
    data-testid="stock-group-card"
    data-group-key={group.key}
    data-egg-count={group.count}
    aria-expanded={expanded}
    onClick={onToggle}
    className={`relative flex min-w-0 flex-col items-center overflow-hidden rounded-lg border bg-white ${group.greenNest > 0 ? 'border-emerald-500' : 'border-slate-200'}`}
  >
    <div className="flex h-4 w-full shrink-0 items-center justify-between gap-0.5 px-1">
      <span className="flex min-w-0 items-center gap-0.5">
        {group.greenNest > 0 ? <GreenNestIcon /> : null}
      </span>
      <span className="flex min-w-0 shrink-0 items-center justify-end">
        {group.selfProduced === group.count
          ? <span className="truncate rounded bg-emerald-50 px-1 py-px text-[8.5px] font-semibold leading-none text-emerald-700">自产</span>
          : group.selfProduced > 0
            ? <span className="truncate rounded bg-emerald-50 px-1 py-px text-[8.5px] font-semibold leading-none text-emerald-700">{`自产${group.selfProduced}/${group.count}`}</span>
            : null}
      </span>
    </div>
    <div className="flex w-full min-w-0 flex-1 flex-col items-center px-0.5 pb-0.5">
      <span className="relative my-0.5 inline-flex">
        <EggArt eggGameId={group.eggGameId} name={name(group.eggGameId)} />
        <span
          title={partial ? `共 ${total} 颗，当前筛选命中 ${group.count} 颗` : `共 ${group.count} 颗`}
          className="absolute -bottom-1 -right-1 rounded bg-emerald-600 px-1 text-[9px] font-bold leading-4 text-white tabular-nums shadow-sm"
        >{`×${group.count}${partial ? `/${total}` : ''}${expanded ? ' ▴' : ''}`}</span>
      </span>
      <strong className="w-full truncate px-0.5 text-center text-[10.5px]">{name(group.eggGameId)}</strong>
      {latest
        ? <span className="text-[10px] leading-4 tabular-nums text-slate-400" title="最新获得时间">{latest}</span>
        : latestConfirmed
          ? <span className="text-[10px] leading-4 tabular-nums text-emerald-700" title="最后确认时间">{latestConfirmed}</span>
          : null}
      <div className="mt-auto flex w-full flex-col pt-0.5">
        {group.listed > 0
          ? <span className="w-full bg-emerald-50 text-center text-[9.5px] leading-[15px] text-emerald-700 tabular-nums">{`${group.listed}/${group.count} 已挂出`}</span>
          : group.availableBag > 0
            ? <span className="w-full bg-slate-50 text-center text-[9.5px] leading-[15px] text-slate-500">未挂出</span>
            : null}
        {group.claimPending > 0
          ? <span className="w-full bg-amber-50 text-center text-[9.5px] leading-[15px] text-amber-700">{`${group.claimPending} 待认领`}</span>
          : null}
      </div>
    </div>
  </button>;
}

/** 绿窝图标：`public/ui/nest/green-nest.png`（与面板同一张）。 */
export function GreenNestIcon() {
  return <img src="/ui/nest/green-nest.png" alt="绿窝" className="size-3.5 shrink-0 object-contain" />;
}
