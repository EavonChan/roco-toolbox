/**
 * 「我的」页的三个高频入口（2026-11-25 U2 方案 A；2026-11-28 按 DESIGN1 tokens 重做）。
 *
 * 采集 / 蛋仓 / 小组是每天会点的三件事，放在首屏数字下面。
 * 三个入口**外观同权重**（RUI-04：不能把「推荐入口」画成选中态，那会让人以为已经在采集页）。
 */
export interface ProfileQuickEntriesProps {
  /** 蛋仓入口的副标题：未登录写「需登录」，登录后写清它去哪 */
  eggStockHint: string;
  onCollect: () => void;
  onEggStock: () => void;
  onGroups: () => void;
}

const TILE =
  'flex min-h-24 w-full flex-col items-start justify-between gap-s1 rounded-card border border-line bg-surface p-s3 text-left shadow-card transition-colors active:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

export function ProfileQuickEntries({
  eggStockHint,
  onCollect,
  onEggStock,
  onGroups,
}: ProfileQuickEntriesProps) {
  return (
    <div className="grid grid-cols-3 gap-s2" data-testid="profile-quick-entries">
      <button type="button" onClick={onCollect} data-testid="profile-entry-collect" className={TILE}>
        <span className="flex size-7 items-center justify-center rounded-tile bg-accent-soft text-accent-strong">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 4v10" />
            <path d="m8 11 4 4 4-4" />
            <path d="M5 19h14" />
          </svg>
        </span>
        <span className="text-body font-semibold leading-tight text-ink-strong">采集数据</span>
        <span className="text-caption leading-tight text-ink-muted">导入 / 本机采集</span>
      </button>

      <button type="button" onClick={onEggStock} data-testid="profile-entry-egg-stock" className={TILE}>
        <span className="flex size-7 items-center justify-center rounded-tile bg-accent-soft text-accent-strong">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 3.5c3.6 3 6 6.4 6 9.5a6 6 0 0 1-12 0c0-3.1 2.4-6.5 6-9.5Z" />
          </svg>
        </span>
        <span className="text-body font-semibold leading-tight text-ink-strong">我的蛋仓</span>
        <span className="text-caption leading-tight text-ink-muted">{eggStockHint}</span>
      </button>

      <button type="button" onClick={onGroups} data-testid="profile-section-groups" className={TILE}>
        <span className="flex size-7 items-center justify-center rounded-tile bg-accent-soft text-accent-strong">
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="9" cy="8" r="3" />
            <path d="M3.5 19c.6-2.6 2.9-4 5.5-4s4.9 1.4 5.5 4" />
            <path d="M16 5.5a3 3 0 0 1 0 5.8" />
            <path d="M17.5 15c1.7.4 2.8 1.7 3.2 3.5" />
          </svg>
        </span>
        <span className="text-body font-semibold leading-tight text-ink-strong">我的小组</span>
        <span className="text-caption leading-tight text-ink-muted">换蛋与共享</span>
      </button>
    </div>
  );
}
