import { useId, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Section —— 区块外壳原语（DESIGN1，2026-11-28）。
 *
 * 结构：标题 + 说明 + 右侧动作 + 内容；没有内容时渲染 `empty`。
 * `collapsible` 打开后标题行右侧出现「展开 / 收起」，只折叠内容、标题行常驻。
 * 不带卡片底色/描边：外框交给 Card，区块只负责标题层级与留白。
 */
export interface SectionProps {
  title: string;
  description?: ReactNode;
  /** 标题右侧动作（按钮 / 计数） */
  action?: ReactNode;
  /** 没有 children 时显示的空态 */
  empty?: ReactNode;
  collapsible?: boolean;
  /** 可折叠时默认是否展开，默认展开 */
  defaultOpen?: boolean;
  headingLevel?: 2 | 3 | 4;
  children?: ReactNode;
  className?: string;
  testId?: string;
}

export function Section({
  title,
  description,
  action,
  empty,
  collapsible = false,
  defaultOpen = true,
  headingLevel = 2,
  children,
  className = '',
  testId,
}: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const headingId = useId();
  const bodyId = useId();
  const Heading = `h${headingLevel}` as 'h2' | 'h3' | 'h4';
  const body = children != null ? children : empty;

  return (
    <section
      data-kit="section"
      data-testid={testId}
      data-collapsible={collapsible ? 'true' : undefined}
      data-open={collapsible ? (open ? 'true' : 'false') : undefined}
      aria-labelledby={headingId}
      className={className}
    >
      <div className="flex items-start justify-between gap-s2">
        <div className="min-w-0">
          <Heading id={headingId} className="text-title font-semibold text-ink-strong">
            {title}
          </Heading>
          {description != null ? (
            <p className="mt-s1 text-caption text-ink-muted">{description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-s2">
          {action}
          {collapsible ? (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={bodyId}
              onClick={() => setOpen((value) => !value)}
              data-slot="toggle"
              className="inline-flex min-h-touch items-center rounded-tile px-s2 text-meta text-ink-muted transition-colors active:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {open ? '收起' : '展开'}
            </button>
          ) : null}
        </div>
      </div>
      {body != null ? (
        <div id={bodyId} hidden={collapsible && !open} className={collapsible && !open ? undefined : 'mt-s2'}>
          {body}
        </div>
      ) : null}
    </section>
  );
}
