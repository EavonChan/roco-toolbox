/**
 * 配对的线色（摆位图与配对卡片共用，2026-10-06 用户口径：一条配对一种颜色，便于对号入座）。
 *
 * 配窝建议（`NestPlanCard`）与家园现状的配对图都从这里取色：同一对/同一组的线色一致，
 * 超过一轮（12 条）时用**虚线**区分同色的两条。
 */
export const PAIRING_COLORS = [
  '#7c3aed',
  '#d97706',
  '#0d9488',
  '#65a30d',
  '#4f46e5',
  '#c026d3',
  '#e11d48',
  '#0891b2',
  '#b45309',
  '#1d4ed8',
  '#047857',
  '#a21caf',
];

/** 第 n 条配对的线色；超过一轮（12 条）时用**虚线/空心点**区分同色的两条 */
export const pairingColor = (index: number): string => PAIRING_COLORS[index % PAIRING_COLORS.length];
export const pairingDashed = (index: number): boolean => index >= PAIRING_COLORS.length;
