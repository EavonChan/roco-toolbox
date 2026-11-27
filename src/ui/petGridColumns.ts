/**
 * 收集 · 精灵背包：收起筛选右栏后，空出来的宽度换成更多列，
 * 让精灵卡保持收起前的宽度（比例不变），而不是被拉宽（2026-11-23 用户口径）。
 */

/** 收起后最多排多少列：超宽屏再宽也不会排成一条细缝 */
export const MAX_COLLAPSED_COLUMNS = 12;

export interface CollapsedRailColumnsInput {
  /** 收起前用户选的列数（三列 / 四列 / 五列 / 六列） */
  baseColumns: number;
  /** 收起前卡片区宽度（px，右栏还在时的可用宽度） */
  expandedWidth: number;
  /** 收起后卡片区宽度（px） */
  collapsedWidth: number;
  /** 卡片之间的横向间距（px） */
  gap: number;
}

const cardWidthOf = (width: number, columns: number, gap: number): number =>
  (width - gap * (columns - 1)) / columns;

/** 收起右栏后应排的列数：按「卡片宽度不变」反推，floor / ceil 选更接近原宽度的一个。 */
export function columnsForCollapsedRail({
  baseColumns,
  expandedWidth,
  collapsedWidth,
  gap,
}: CollapsedRailColumnsInput): number {
  if (!Number.isFinite(baseColumns) || baseColumns < 1) return 1;
  const safeGap = Number.isFinite(gap) && gap > 0 ? gap : 0;
  if (!(expandedWidth > 0) || !(collapsedWidth > 0)) return Math.round(baseColumns);

  const baseCardWidth = cardWidthOf(expandedWidth, baseColumns, safeGap);
  if (!(baseCardWidth > 0)) return Math.round(baseColumns);

  // 收起后宽度比原来还窄（竖屏等）：不加列，保持原样
  if (collapsedWidth <= expandedWidth) return Math.round(baseColumns);

  const ideal = (collapsedWidth + safeGap) / (baseCardWidth + safeGap);
  const clampCount = (count: number) =>
    Math.max(Math.round(baseColumns), Math.min(MAX_COLLAPSED_COLUMNS, count));
  const lower = clampCount(Math.floor(ideal));
  const upper = clampCount(Math.ceil(ideal));

  const distance = (count: number) =>
    Math.abs(cardWidthOf(collapsedWidth, count, safeGap) - baseCardWidth);
  // 两边一样接近时取列数少的那个，卡片不至于更窄、字更好读
  return distance(lower) <= distance(upper) ? lower : upper;
}
