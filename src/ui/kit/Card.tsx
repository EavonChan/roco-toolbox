import type { HTMLAttributes, ReactNode } from 'react';

/**
 * Card —— 容器原语（DESIGN1，2026-11-28）。
 *
 * 负责：圆角 / 描边 / 底色 / 阴影 / 内边距 / 标题行。
 * 不负责：业务文案、数据、点击（需要整卡可点时用 Row 或自己包一层 button）。
 * 只用 tokens：圆角 `rounded-card`、间距 `p-s3`、颜色 `bg-surface` / `border-line`。
 */
export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** 标题行左侧文案；不传则没有标题行 */
  title?: ReactNode;
  /** 标题行右侧动作（按钮 / 计数 / 链接） */
  action?: ReactNode;
  /** 密集模式：内边距 12px → 8px，用于列表或并排小卡 */
  dense?: boolean;
  /** 标题语义层级，默认 h3（页面里 h1 是应用名，h2 留给页面） */
  headingLevel?: 2 | 3 | 4;
  /** 测试用 id，落到 data-testid */
  testId?: string;
}

export function Card({
  title,
  action,
  dense = false,
  headingLevel = 3,
  testId,
  children,
  className = '',
  ...rest
}: CardProps) {
  const hasHeader = title != null || action != null;
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';

  return (
    <div
      {...rest}
      data-kit="card"
      data-testid={testId}
      data-dense={dense ? 'true' : undefined}
      className={`rounded-card border border-line bg-surface shadow-card ${
        dense ? 'p-s2' : 'p-s3'
      } ${className}`}
    >
      {hasHeader ? (
        <div className="flex items-center justify-between gap-s2">
          {title != null ? (
            <Heading className="min-w-0 text-title font-semibold text-ink-strong">{title}</Heading>
          ) : (
            <span />
          )}
          {action != null ? (
            <div className="shrink-0 text-meta text-ink-muted">{action}</div>
          ) : null}
        </div>
      ) : null}
      {children != null ? <div className={hasHeader ? 'mt-s2' : ''}>{children}</div> : null}
    </div>
  );
}
