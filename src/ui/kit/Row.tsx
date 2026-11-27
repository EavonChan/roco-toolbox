import type { ReactNode } from 'react';

/**
 * Row —— 列表行原语（DESIGN1，2026-11-28）。
 *
 * 左图标 / 主文案 / 副文案 / 右侧值；高度不小于 32px（移动端触区）。
 * 长文案截断：主副文案都 `truncate`，容器 `min-w-0`，右侧值不参与压缩。
 * 有 onClick 时渲染成 button（带点击态 / 禁用态 / 键盘可达），没有时是纯展示行。
 */
export interface RowProps {
  /** 左侧图标（装饰性，读屏跳过） */
  icon?: ReactNode;
  /** 主文案；超长省略 */
  primary: ReactNode;
  /** 副文案；超长省略 */
  secondary?: ReactNode;
  /** 右侧值：计数 / 状态 / 数值 */
  value?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  testId?: string;
}

export function Row({
  icon,
  primary,
  secondary,
  value,
  onClick,
  disabled = false,
  className = '',
  testId,
}: RowProps) {
  const body = (
    <>
      {icon != null ? (
        <span className="shrink-0 text-ink-muted" aria-hidden="true" data-slot="icon">
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body text-ink" data-slot="primary">
          {primary}
        </span>
        {secondary != null ? (
          <span className="block truncate text-caption text-ink-muted" data-slot="secondary">
            {secondary}
          </span>
        ) : null}
      </span>
      {value != null ? (
        <span className="shrink-0 text-meta tabular-nums text-ink-muted" data-slot="value">
          {value}
        </span>
      ) : null}
    </>
  );

  const base = 'flex w-full min-h-touch items-center gap-s2 px-s3 py-s1 text-left';
  const disabledClass = disabled ? 'cursor-not-allowed opacity-50' : '';

  if (onClick == null) {
    return (
      <div
        data-kit="row"
        data-testid={testId}
        data-disabled={disabled ? 'true' : undefined}
        className={`${base} ${disabledClass} ${className}`}
      >
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      data-kit="row"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      className={`${base} transition-colors active:bg-surface-sunken disabled:cursor-not-allowed disabled:opacity-50 disabled:active:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${className}`}
    >
      {body}
    </button>
  );
}
