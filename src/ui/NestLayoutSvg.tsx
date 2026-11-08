import { NEST_SIZE } from '../domain/nestGeometry';

/**
 * 小窝摆位图（2026-10-06 起）：看板「配窝建议」与家园现状「配窝卡片」共用同一张画法。
 *
 * 坐标单位是**家园地板最小移动单元**（1 窝 = 8 单元），整数；图按 viewBox 等比缩放铺满宽度，
 * 所以不管多少对配对都只占一行、很紧凑（与配窝建议完全一致）。
 * 图层顺序 = 窝块 → 连线 → 名字：线画在窝块之上（否则会被方块盖住），名字再压在线上。
 */
export interface NestSvgSlot {
  key: string;
  name: string;
  gender: '公' | '母' | '未知';
  academy: boolean;
  position: { x: number; y: number };
  /** 测试 / 无障碍用的附加标记（如「公本未知」占位） */
  missing?: boolean;
}

export interface NestSvgLine {
  key: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
  dashed?: boolean;
}

export interface NestLayoutSvgProps {
  slots: readonly NestSvgSlot[];
  lines: readonly NestSvgLine[];
  label?: string;
  testId?: string;
  /** 每个窝块上的 data-testid（家园配窝图用；配窝建议不传） */
  slotTestId?: string;
  className?: string;
  /**
   * 四周留白（单位：地板单元，1 窝 = 8 单元）。默认留 1 窝，最外圈描边不会被裁。
   * 家园配窝卡片留得更小，让同样宽的格子里方块更大（2026-11-01 用户口径：要放大）。
   */
  padding?: number;
}

/** 摆位图里每个小窝的边长（像素）。 */
const CELL = 11;
/** 坐标单位是「地板单元」、1 窝 = NEST_SIZE 单元，所以一个单元只有 CELL / NEST_SIZE 像素。 */
const UNIT = CELL / NEST_SIZE;

/** 窝块里只画得下 4 个字：先把形态名（下划线后的部分）去掉，再截断 */
const shortName = (name: string): string => name.split('_')[0].slice(0, 4);

export function NestLayoutSvg({
  slots,
  lines,
  label = '小窝摆位图',
  testId = 'nest-layout',
  slotTestId,
  className = 'mt-1 max-h-36 w-full rounded-lg bg-slate-50',
  padding = NEST_SIZE,
}: NestLayoutSvgProps) {
  if (slots.length === 0) return null;
  const xs = slots.map((slot) => slot.position.x);
  const ys = slots.map((slot) => slot.position.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  // 图形本身 = 跨度 + 1 窝（最后一个窝自己占的宽/高），四周再各留 `padding`
  // （不留的话最外圈方块的描边会被 viewBox 裁掉）
  const width = Math.max(...xs) - minX + NEST_SIZE + 2 * padding;
  const height = Math.max(...ys) - minY + NEST_SIZE + 2 * padding;
  const px = (value: number, base: number): number => (value - base + padding) * UNIT;
  const at = (slot: NestSvgSlot) => ({
    x: px(slot.position.x, minX),
    y: px(slot.position.y, minY),
  });

  return (
    <svg
      viewBox={`0 0 ${width * UNIT} ${height * UNIT}`}
      className={className}
      role="img"
      aria-label={label}
      data-testid={testId}
    >
      {slots.map((slot) => {
        const { x, y } = at(slot);
        return (
          <rect
            key={`nest-${slot.key}`}
            x={x}
            y={y}
            width={CELL}
            height={CELL}
            rx={2}
            fill={slot.academy ? '#059669' : '#ffffff'}
            stroke={slot.academy ? '#047857' : '#cbd5e1'}
            strokeWidth={0.6}
            strokeDasharray={slot.missing ? '1.6 1.2' : undefined}
          />
        );
      })}
      {lines.map((line) => (
        <line
          key={`line-${line.key}`}
          x1={px(line.from.x, minX) + CELL / 2}
          y1={px(line.from.y, minY) + CELL / 2}
          x2={px(line.to.x, minX) + CELL / 2}
          y2={px(line.to.y, minY) + CELL / 2}
          stroke={line.color}
          strokeDasharray={line.dashed ? '2 1.6' : undefined}
          strokeWidth={0.7}
          strokeLinecap="round"
        />
      ))}
      {slots.map((slot) => {
        const { x, y } = at(slot);
        const genderText = slot.gender === '公' ? '♂' : slot.gender === '母' ? '♀' : '?';
        return (
          <g
            key={`label-${slot.key}`}
            data-testid={slotTestId}
            data-name={slot.name}
            data-academy={slot.academy ? 'true' : undefined}
            data-missing={slot.missing ? 'true' : undefined}
          >
            <text
              x={x + CELL / 2}
              y={y + CELL / 2 - 0.5}
              textAnchor="middle"
              fontSize={2.3}
              fill={slot.academy ? '#ffffff' : '#334155'}
            >
              {shortName(slot.name)}
            </text>
            <text
              x={x + CELL / 2}
              y={y + CELL / 2 + 2.8}
              textAnchor="middle"
              fontSize={2.4}
              fill={slot.academy ? '#a7f3d0' : slot.gender === '公' ? '#0284c7' : slot.gender === '母' ? '#db2777' : '#94a3b8'}
            >
              {genderText}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
