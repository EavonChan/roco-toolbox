import { useState } from 'react';

export interface ProgressCardProps {
  title: string;
  numerator: number;
  denominator: number;
  hint?: string;
  /** 给了它就整卡可点，用作快速入口 */
  onClick?: () => void;
  /** 可点卡的 testid（页面里可能有多张可点卡，避免 strict mode 冲突） */
  actionTestId?: string;
}

export function ProgressCard({
  title,
  numerator,
  denominator,
  hint,
  onClick,
  actionTestId,
}: ProgressCardProps) {
  const percent = denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
  /** 说明默认收起：点标题右侧的圆圈问号再展开（2026-11-21 用户口径） */
  const [hintOpen, setHintOpen] = useState(false);
  const content = (
    <>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-slate-500">{title}</h2>
        {hint ? (
          <span
            role="button"
            tabIndex={0}
            aria-expanded={hintOpen}
            aria-label={hintOpen ? '收起说明' : '查看说明'}
            data-testid="progress-card-info"
            onClick={(event) => {
              event.stopPropagation();
              setHintOpen((open) => !open);
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return;
              event.preventDefault();
              event.stopPropagation();
              setHintOpen((open) => !open);
            }}
            className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-full border border-slate-200 text-[11px] text-slate-400"
          >
            ?
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-2xl font-semibold text-slate-900">
        {numerator} <span className="text-slate-400">/ {denominator}</span>
      </p>
      <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
      </div>
      {hint && hintOpen ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </>
  );

  // 卡片并排时等高（grid stretch），内容垂直居中避免矮卡下方留白（2026-10-05 修复）
  if (!onClick)
    return (
      <section className="flex flex-col justify-center rounded-2xl bg-white p-4 shadow-sm">
        {content}
      </section>
    );

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col justify-center rounded-2xl bg-white p-4 text-left shadow-sm"
      data-testid={actionTestId ?? 'progress-card-action'}
    >
      {content}
    </button>
  );
}
