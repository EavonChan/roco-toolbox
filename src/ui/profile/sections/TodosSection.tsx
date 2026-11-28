import { Card } from '../../kit';
import type { SectionProps } from '../types';

/**
 * 待处理数字（2026-11-28 用户口径：放**待办型**数字，收集进度归看板）。
 *
 * - 只显示 >0 的项，每项可点、跳到对应位置；
 * - 三项全为 0（且都已知）时收成一句「暂时没有需要处理的」；
 * - 每项都带一行说明：谁的数据 / 什么标准 / 什么时候（§0.6）。
 */
function timeText(ms: number | null): string {
  if (ms == null) return '刚刚';
  return new Date(ms).toLocaleString('zh-CN', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TodosSection({ ctx }: SectionProps) {
  const { claims, confirm, nearbyTargets, syncedAt } = ctx.todos;

  const items = [
    claims != null && claims > 0
      ? {
          id: 'claims',
          label: '蛋仓待认领',
          value: `${claims} 颗`,
          hint: `蛋仓 · 同步于 ${timeText(syncedAt)}`,
          onClick: ctx.onGoEggStock,
        }
      : null,
    confirm != null && confirm > 0
      ? {
          id: 'confirm',
          label: '换蛋待确认',
          value: `${confirm} 单`,
          hint: '我这一侧还没确认',
          onClick: ctx.onGoGroups,
        }
      : null,
    nearbyTargets > 0
      ? {
          id: 'nearby',
          label: '附近目标',
          value: `${nearbyTargets} 只`,
          hint: '蹲守名单 · 本机',
          onClick: ctx.onGoNearby,
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item != null);

  if (items.length === 0) {
    return (
      <Card testId="profile-todos" className="!p-s3">
        <p className="text-body text-ink-soft" data-testid="profile-todos-empty">
          暂时没有需要处理的
        </p>
      </Card>
    );
  }

  return (
    <Card testId="profile-todos" className="!p-s3">
      <div className="grid grid-cols-3 gap-s2" data-testid="profile-todo-items">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            data-testid={`profile-todo-${item.id}`}
            className="min-h-touch min-w-0 rounded-tile px-s1 py-s1 text-left transition-colors active:bg-surface-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="block truncate text-meta text-ink-muted">{item.label}</span>
            <span className="mt-s1 block truncate text-hero font-semibold tabular-nums text-ink-strong">
              {item.value}
            </span>
            <span className="mt-s1 block truncate text-caption text-ink-muted" title={item.hint}>
              {item.hint}
            </span>
          </button>
        ))}
      </div>
    </Card>
  );
}
