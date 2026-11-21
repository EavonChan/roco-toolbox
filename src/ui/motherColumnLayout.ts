/**
 * 母本蛋组三列判定（2026-11-21 用户口径）。
 *
 * 收起筛选栏、屏幕够宽（≥1250px 横屏）时：
 * - 两列一屏就能展示完全部蛋组 → 保持两列大卡；
 * - 两列放不下 → 改三列，多塞一组。
 *
 * 这里只做纯计算，真实高度由 MotherView 在两列状态下量好再传进来。
 */
export function twoColumnContentHeight(
  sectionHeights: readonly number[],
  totalSections: number,
  gap: number,
): number {
  if (totalSections <= 0) return 0;
  const measured = sectionHeights.filter((height) => height > 0);
  const fallback = measured.length
    ? measured.reduce((sum, height) => sum + height, 0) / measured.length
    : 0;
  let height = 0;
  const rows = Math.ceil(totalSections / 2);
  for (let row = 0; row < rows; row += 1) {
    const left = sectionHeights[row * 2] || fallback;
    const right = sectionHeights[row * 2 + 1] || fallback;
    height += Math.max(left, right);
  }
  return height + Math.max(0, rows - 1) * gap;
}

export function shouldUseThreeColumns(input: {
  sectionHeights: readonly number[];
  totalSections: number;
  gap: number;
  viewportHeight: number;
}): boolean {
  return (
    twoColumnContentHeight(input.sectionHeights, input.totalSections, input.gap) >
    input.viewportHeight
  );
}
