import type { ReactNode } from 'react';

/**
 * Chip —— 状态 / 筛选标签原语（DESIGN1，2026-11-28）。
 *
 * 三种用法：
 * - 筛选：传 `selected` + `onToggle`（渲染 button，带 aria-pressed）；
 * - 状态：传 `tone`（accent / warn / danger / info），只做展示；
 * - 可关闭：传 `onRemove`，右侧出现 ×（外层退成 span，避免 button 套 button）。
 * 高度不小于 32px（移动端触区）。
 */
export type ChipTone = 'neutral' | 'accent' | 'warn' | 'danger' | 'info';

export interface ChipProps {
  children: ReactNode;
  /** 状态色；neutral 时由 selected 决定选中样式 */
  tone?: ChipTone;
  /** 筛选标签的选中态 */
  selected?: boolean;
  disabled?: boolean;
  /** 点击切换（筛选） */
  onToggle?: () => void;
  /** 点击关闭 */
  onRemove?: () => void;
  /** 关闭按钮的读屏名，默认「移除」 */
  removeLabel?: string;
  className?: string;
  testId?: string;
}

const OFF = 'border-line bg-surface text-ink-soft';
const ON = 'border-accent-line bg-accent-soft font-medium text-accent-strong';

const TONE: Record<Exclude<ChipTone, 'neutral'>, string> = {
  accent: 'border-accent-line bg-accent-soft font-medium text-accent-strong',
  warn: 'border-warn-line bg-warn-soft font-medium text-warn',
  danger: 'border-danger-line bg-danger-soft font-medium text-danger',
  info: 'border-info-line bg-info-soft font-medium text-info',
};

const BASE =
  'inline-flex max-w-full min-h-touch items-center gap-s1 rounded-chip border px-s2 text-meta focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

export function Chip({
  children,
  tone = 'neutral',
  selected = false,
  disabled = false,
  onToggle,
  onRemove,
  removeLabel = '移除',
  className = '',
  testId,
}: ChipProps) {
  const toneClass = tone === 'neutral' ? (selected ? ON : OFF) : TONE[tone];
  const disabledClass = disabled ? 'cursor-not-allowed opacity-50' : '';
  const rootClass = `${BASE} ${toneClass} ${disabledClass} ${className}`;
  const isPressed = onToggle != null ? selected : undefined;

  if (onRemove == null) {
    if (onToggle == null) {
      return (
        <span
          data-kit="chip"
          data-testid={testId}
          data-tone={tone}
          data-selected={selected ? 'true' : undefined}
          data-disabled={disabled ? 'true' : undefined}
          className={rootClass}
        >
          <span className="truncate">{children}</span>
        </span>
      );
    }
    return (
      <button
        type="button"
        data-kit="chip"
        data-testid={testId}
        data-tone={tone}
        data-selected={selected ? 'true' : undefined}
        aria-pressed={isPressed}
        disabled={disabled}
        onClick={onToggle}
        className={`${rootClass} transition-colors active:bg-surface-sunken disabled:active:bg-transparent`}
      >
        <span className="truncate">{children}</span>
      </button>
    );
  }

  return (
    <span
      data-kit="chip"
      data-testid={testId}
      data-tone={tone}
      data-selected={selected ? 'true' : undefined}
      data-disabled={disabled ? 'true' : undefined}
      className={rootClass}
    >
      {onToggle != null ? (
        <button
          type="button"
          aria-pressed={isPressed}
          disabled={disabled}
          onClick={onToggle}
          className="min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <span className="truncate">{children}</span>
        </button>
      ) : (
        <span className="min-w-0 truncate">{children}</span>
      )}
      <button
        type="button"
        aria-label={removeLabel}
        disabled={disabled}
        onClick={onRemove}
        data-slot="remove"
        className="-mr-s1 shrink-0 rounded-chip px-s1 text-ink-faint hover:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed"
      >
        ×
      </button>
    </span>
  );
}
