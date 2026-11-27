import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { compactPetName } from './petNameLabel';
import { scheduleCardNameFit } from './fitCardName';

export interface PetCardLayoutProps {
  name: string;
  number?: string;
  eggGroups?: readonly string[];
  natures?: readonly string[];
  /** 提供时按「该性格是否已收集」上色：已收集浅绿、未收集灰色；不提供保持原琥珀色 */
  natureCollected?: (nature: string) => boolean;
  naturePrefix?: ReactNode;
  natureAdornment?: ReactNode;
  /** 蛋组下方的小徽标（如稀有度图标，2026-11-17 用户口径） */
  badge?: ReactNode;
  avatar: ReactNode;
  details?: ReactNode;
  footer?: ReactNode;
  testId?: string;
  eggGroupsTestId?: string;
  naturesTestId?: string;
  title?: string;
  ariaLabel?: string;
  className?: string;
  academy?: boolean;
  /**
   * 卡片高度档位。
   * - `default`：98px，紧凑卡 / 家园用（文字 6px）；
   * - `tall`：104px，精灵背包与收集页母本卡共用（名字 / 身高体重 / 账号位置放大到 8px，头像略微上移）；
   * - `gap`：104px，看板「母本缺口 / 种公推荐」四列卡用（52px 头像、12px 名字，
   *   2026-11-19 原型口径：四列不变，头像 44 → 52、名字 6px → 12px）。
   */
  size?: PetCardSize;
  /** 收集页母本卡的三态底色：未收集白底 / 计划中淡蓝 / 已收集淡绿 */
  status?: PetCardStatus;
  /** 名字过长时从基准字号逐档缩小，避免长名字直接截断（母本卡 / 看板推荐卡用） */
  fitName?: boolean;
  /** 名字基准字号（默认 12；看板种公推荐卡传 9） */
  fitNameBase?: number;
  /** 名字最小字号（默认 9；看板种公推荐卡传 8） */
  fitNameMin?: number;
  /** 精灵背包传性别：母粉 / 公蓝 / 未知灰，底色与边框都和配窝卡一致 */
  gender?: '公' | '母' | '未知';
  onClick?: () => void;
  ariaPressed?: boolean;
}

export type PetCardSize = 'default' | 'tall' | 'gap' | 'suggest' | 'compact';

/** 收集页母本卡的收集状态：未收集 / 计划中 / 已收集（2026-11-21 用户口径）。 */
export type PetCardStatus = 'uncollected' | 'planned' | 'collected' | 'fillable';

/** Shared card frame for pet displays across the app. */
export function PetCardLayout({
  name,
  number,
  eggGroups = [],
  natures = [],
  natureCollected,
  naturePrefix,
  natureAdornment,
  badge,
  avatar,
  details,
  footer,
  testId,
  eggGroupsTestId = 'pet-card-egg-groups',
  naturesTestId = 'pet-card-natures',
  title,
  ariaLabel,
  className = '',
  academy,
  size = 'default',
  status,
  fitName = false,
  fitNameBase,
  fitNameMin,
  gender,
  onClick,
  ariaPressed,
}: PetCardLayoutProps) {
  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (!onClick || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    onClick();
  };
  const showDetails = details != null && details !== false;
  const showFooter = footer != null && footer !== false;
  /**
   * 紧凑卡（2026-11-22）：只有 `PetCompactCard` 用（固定 160px 宽，写在 家园配对 / 需求中心）。
   * 它要同时放「头像 + 名字 + dB/身高/体重 + 底注」，所以底注不放进融合条，
   * 其余几何（104 / 头像 48 / 名字 10px）与四列卡完全一致。
   */
  const compact = size === 'compact';
  /** 与配窝卡（NestPlanCard）同一套性别色：母粉、公蓝、未知灰；
   *  收集页母本卡传 status 时按收集状态上色（未收集白底 / 计划中淡蓝 / 已收集淡绿 /
   *  可补浅绿，2026-11-24） */
  const statusTone =
    status === 'uncollected'
      ? 'border-slate-200 bg-white'
      : status === 'planned'
        ? 'border-sky-200 bg-sky-50'
        : status === 'collected' || status === 'fillable'
          ? 'border-emerald-200 bg-emerald-50'
          : null;
  const genderTone = academy
    ? /* 学院小窝：整卡变绿，和普通窝区分（2026-11-21 用户口径） */
      'border-emerald-300 bg-emerald-50/60'
    : gender === '母'
      ? 'border-pink-200 bg-pink-50'
      : gender === '公'
        ? 'border-sky-200 bg-sky-50'
        : gender === '未知'
          ? 'border-slate-200 bg-slate-50'
          : /* 2026-11-22 用户口径：看板四列卡不再用绿底，统一白底 */
            'border-slate-200 bg-white';
  const tone = statusTone ?? genderTone;
  /** 未收集白卡用灰边 hover；计划中蓝卡、已收集绿卡沿用同色系 hover。 */
  const hoverBorder =
    status === 'uncollected'
      ? 'hover:border-slate-400'
      : status === 'planned'
        ? 'hover:border-sky-400'
        : 'hover:border-emerald-500';
  /** 卡片上显示精简名（乌达_极夜的样子 → 乌达·极夜），完整名在 title 里；字号恒为 10px */
  const displayName = compactPetName(name);
  const nameRef = useRef<HTMLHeadingElement | null>(null);
  const nameTextRef = useRef<HTMLSpanElement | null>(null);

  /**
   * 母本卡名字：默认 10px，只有超出卡片宽度时才逐档缩到 9px。
   * 这里只**登记**，不做任何 DOM 读写；读宽度、量文字、写字号全部在
   * `fitCardName` 的同一个微任务里批量完成（2026-11-25：原来每张卡一个
   * `useLayoutEffect` + 每卡一个 ResizeObserver，165 张卡 495 次强制布局，
   * 见 docs/分析-收集页卡顿-2026-11-25.md）。
   */
  useLayoutEffect(() => {
    if (!fitName) return;
    const heading = nameRef.current;
    const text = nameTextRef.current;
    if (!heading || !text) return;
    return scheduleCardNameFit({
      heading,
      text,
      base: fitNameBase ?? 10,
      min: fitNameMin ?? 10,
    });
  }, [fitName, name, size, fitNameBase, fitNameMin]);

  return (
    <article
      className={`relative h-[104px] min-w-0 overflow-hidden rounded-xl border ${tone} p-1 shadow-sm ${onClick ? `cursor-pointer ${hoverBorder} focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-500` : ''} ${className}`}
      data-testid={testId}
      data-academy={academy ? 'true' : undefined}
      title={title}
      aria-label={ariaLabel}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-pressed={onClick ? ariaPressed : undefined}
      onClick={onClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
    >
      <header className="absolute inset-x-1 top-1 z-10 grid max-h-[48px] grid-cols-[minmax(0,1fr)_2.75rem_minmax(0,1fr)] items-start overflow-hidden text-[7px] leading-[8px]">
        <div className="flex min-w-0 flex-col items-start gap-px">
          {number ? (
            <span className="truncate font-semibold text-slate-500">No.{number}</span>
          ) : (
            <span className="h-2" aria-hidden />
          )}
          <span className="flex min-w-0 flex-col items-start gap-px" data-testid={eggGroupsTestId}>
            {eggGroups.map((group) => (
              <span
                key={group}
                className="max-w-full truncate rounded bg-sky-100 px-0.5 py-0 text-sky-800"
                title={group}
              >
                {group}
              </span>
            ))}
          </span>
          {badge ? <span className="flex min-w-0 items-start">{badge}</span> : null}
        </div>
        <div className="col-start-3 row-start-1 flex min-w-0 flex-col items-end gap-px">
          <div className="flex min-w-0 items-center justify-end gap-px">
            {naturePrefix}
            <span className="flex min-w-0 flex-col items-end gap-px" data-testid={naturesTestId}>
              {natures.map((nature) => (
                <span
                  key={nature}
                  className={`inline-flex h-3 max-w-full items-center truncate rounded px-0.5 py-0 font-medium ${
                    natureCollected
                      ? natureCollected(nature)
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-400'
                      : 'bg-amber-100 text-amber-900'
                  }`}
                  data-nature-collected={
                    natureCollected ? (natureCollected(nature) ? 'true' : 'false') : undefined
                  }
                  title={nature}
                >
                  {nature}
                </span>
              ))}
            </span>
          </div>
          {natureAdornment}
        </div>
      </header>

      <div
        className={`absolute left-1/2 z-0 flex h-12 w-12 -translate-x-1/2 items-center justify-center ${
          showFooter ? 'top-[18px]' : 'top-[24px]'
        }`}
        data-testid="pet-card-avatar"
      >
        {avatar}
      </div>

      <h3
        ref={nameRef}
        className={`absolute inset-x-1 flex items-center justify-center truncate text-center text-[10px] font-bold leading-3 text-slate-900 ${
          showFooter ? 'top-[66px] h-3' : 'top-[72px] h-3'
        }`}
        title={title ?? name}
      >
        {fitName ? (
          <span
            ref={nameTextRef}
            className="inline-block max-w-full truncate whitespace-nowrap"
            data-testid="pet-card-name"
          >
            {displayName}
          </span>
        ) : (
          displayName
        )}
      </h3>

      {showDetails ? (
        <div
          className={`absolute inset-x-1 flex items-center justify-center overflow-hidden text-center ${
            showFooter ? 'top-[78px] h-2' : 'top-[84px] h-2'
          }`}
        >
          {details}
        </div>
      ) : null}

      {/*
        底部控件（2026-11-22 用户口径）：从「贴片小胶囊」改成**满宽融合条**——
        通栏、贴底、圆角跟着卡片的 overflow-hidden 走，和换蛋页需求卡底部那条一致。
        内容由调用方给（计划 / 收集中 / 已收集 / 查看），卡片只负责给出这条通栏槽位。
        紧凑卡（160px，带细节行 + 盒子底注）的底注不进条里，留在卡片最底一行。
      */}
      {showFooter ? (
        <div
          className={`absolute flex items-center justify-center overflow-hidden ${
            compact ? 'inset-x-1 bottom-1 h-1.5' : 'inset-x-0 bottom-0 h-[18px]'
          }`}
          data-testid="pet-card-footer"
        >
          {footer}
        </div>
      ) : null}
    </article>
  );
}






