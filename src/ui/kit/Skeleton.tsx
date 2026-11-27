import type { ReactNode } from 'react';

/**
 * Skeleton —— 加载占位原语（DESIGN1，2026-11-28）。
 *
 * 高度来自 token（`min-h-touch` / `min-h-skeleton-card`），替换内容前后高度不变，
 * 不会把下面的内容顶开；读屏只念一次「加载中」，占位条本身 aria-hidden。
 */
export interface SkeletonProps {
  /** 文本行数，默认 1；多行时最后一行自动缩短，像真实段落 */
  lines?: number;
  /** 块高度：一行文本 / 列表行 / 卡片 */
  height?: 'line' | 'row' | 'card';
  /** 宽度；不传时多行骨架的最后一行自动半宽 */
  width?: 'full' | 'three-quarters' | 'half';
  className?: string;
  testId?: string;
}

const HEIGHT: Record<NonNullable<SkeletonProps['height']>, string> = {
  line: 'h-s3',
  row: 'min-h-touch',
  card: 'min-h-skeleton-card',
};

const WIDTH: Record<NonNullable<SkeletonProps['width']>, string> = {
  full: 'w-full',
  'three-quarters': 'w-3/4',
  half: 'w-1/2',
};

export function Skeleton({
  lines = 1,
  height = 'line',
  width,
  className = '',
  testId,
}: SkeletonProps): ReactNode {
  const count = Math.max(1, Math.trunc(lines));
  return (
    <div
      role="status"
      aria-label="加载中"
      aria-busy="true"
      data-kit="skeleton"
      data-testid={testId}
      data-lines={count}
      className={`flex flex-col gap-s2 ${className}`}
    >
      {Array.from({ length: count }, (_, index) => {
        const isLast = index === count - 1;
        const widthClass = width
          ? WIDTH[width]
          : count > 1 && isLast
            ? WIDTH.half
            : WIDTH.full;
        return (
          <span
            key={index}
            aria-hidden="true"
            data-slot="bar"
            className={`block animate-pulse rounded-chip bg-surface-raised ${HEIGHT[height]} ${widthClass}`}
          />
        );
      })}
    </div>
  );
}
