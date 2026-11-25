/**
 * 「我的」页的三个高频入口（2026-11-25 U2 方案 A）。
 *
 * 采集 / 蛋仓 / 小组是每天会点的三件事，放在概览卡正下方的一排；
 * 「采集数据」不跳页——它把视线带到下面的采集 / 导入块（导入仍是这一页的主动作）。
 */
export interface ProfileQuickEntriesProps {
  /** 蛋仓入口的副标题：未登录写「需登录」，登录后写清它去哪 */
  eggStockHint: string;
  onCollect: () => void;
  onEggStock: () => void;
  onGroups: () => void;
}

const TILE =
  'flex min-h-[86px] flex-col items-start justify-between gap-1 rounded-2xl border bg-white p-2.5 text-left shadow-sm';

export function ProfileQuickEntries({
  eggStockHint,
  onCollect,
  onEggStock,
  onGroups,
}: ProfileQuickEntriesProps) {
  return (
    <div className="grid grid-cols-3 gap-2" data-testid="profile-quick-entries">
      <button
        type="button"
        onClick={onCollect}
        data-testid="profile-entry-collect"
        className={`${TILE} border-emerald-500 bg-emerald-50`}
      >
        <span className="flex size-7 items-center justify-center rounded-lg bg-white text-emerald-700">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 4v10" />
            <path d="m8 11 4 4 4-4" />
            <path d="M5 19h14" />
          </svg>
        </span>
        <span className="text-[13px] font-semibold leading-tight text-slate-800">采集数据</span>
        <span className="text-[10.5px] leading-tight text-slate-500">导入 / 本机采集</span>
      </button>

      <button
        type="button"
        onClick={onEggStock}
        data-testid="profile-entry-egg-stock"
        className={`${TILE} border-slate-200`}
      >
        <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 3.5c3.6 3 6 6.4 6 9.5a6 6 0 0 1-12 0c0-3.1 2.4-6.5 6-9.5Z" />
          </svg>
        </span>
        <span className="text-[13px] font-semibold leading-tight text-slate-800">我的蛋仓</span>
        <span className="text-[10.5px] leading-tight text-slate-500">{eggStockHint}</span>
      </button>

      <button
        type="button"
        onClick={onGroups}
        data-testid="profile-section-groups"
        className={`${TILE} border-slate-200`}
      >
        <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="9" cy="8" r="3" />
            <path d="M3.5 19c.6-2.6 2.9-4 5.5-4s4.9 1.4 5.5 4" />
            <path d="M16 5.5a3 3 0 0 1 0 5.8" />
            <path d="M17.5 15c1.7.4 2.8 1.7 3.2 3.5" />
          </svg>
        </span>
        <span className="text-[13px] font-semibold leading-tight text-slate-800">我的小组</span>
        <span className="text-[10.5px] leading-tight text-slate-500">换蛋与共享</span>
      </button>
    </div>
  );
}
