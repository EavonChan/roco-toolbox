import type { ReactNode } from 'react';

/**
 * EmptyState —— 空态原语（DESIGN1，2026-11-28）。
 *
 * 只写一句事实（为什么这里是空的）+ 一个动作（下一步去哪）。
 * 不写教学文案：操作步骤属于引导（tour.ts），不常驻页面。
 */
export interface EmptyStateProps {
  /** 可选图标（装饰性，读屏跳过） */
  icon?: ReactNode;
  /** 一句事实，例如「这个账号还没有蛋」 */
  title: string;
  /** 可选补充，仍是一句事实 */
  description?: string;
  /** 一个动作；不传则只有文案 */
  action?: { label: string; onClick: () => void };
  className?: string;
  testId?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
  testId,
}: EmptyStateProps) {
  return (
    <div
      data-kit="empty-state"
      data-testid={testId}
      className={`flex flex-col items-center gap-s2 rounded-tile border border-dashed border-line bg-surface-sunken p-s4 text-center ${className}`}
    >
      {icon != null ? (
        <span className="text-ink-faint" aria-hidden="true" data-slot="icon">
          {icon}
        </span>
      ) : null}
      <p className="text-body font-medium text-ink" data-slot="title">
        {title}
      </p>
      {description != null ? (
        <p className="text-caption text-ink-muted" data-slot="description">
          {description}
        </p>
      ) : null}
      {action != null ? (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-s1 inline-flex min-h-touch items-center rounded-tile border border-line bg-surface px-s3 text-meta font-medium text-accent-strong transition-colors active:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
