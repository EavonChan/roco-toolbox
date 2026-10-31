import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TOUR_ANCHOR_ATTR, type TourStep } from './tour';

/**
 * 新手引导浮层：深色遮罩 + 目标位置的聚光方框 + 气泡说明。
 *
 * 只在视觉上压暗页面（`pointer-events-none`），不拦截真实点击：
 * 「下一步」由用户点气泡推进，页面本身仍可滚动。
 * 锚点元素找不到时（例如未入组、没有家园数据）退化成居中的说明卡，不卡住流程。
 */
export interface TourOverlayProps {
  steps: TourStep[];
  onClose: () => void;
  /** 进入某一步时切页面/子视图（由 App 执行导航） */
  onEnter?: (step: TourStep) => void;
}

const SPOT_PAD = 6;
const TOOLTIP_MAX_WIDTH = 320;
const TOOLTIP_ESTIMATED_HEIGHT = 172;

/** 等锚点挂载（切页/拉数据有延迟）最多等多少帧，约 1 秒 */
const MAX_WAIT_FRAMES = 60;

export function TourOverlay({ steps, onClose, onEnter }: TourOverlayProps) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const onEnterRef = useRef(onEnter);
  const step = steps[index];
  const last = index === steps.length - 1;

  useEffect(() => {
    onEnterRef.current = onEnter;
  });

  // 进步骤：先切页面，再等锚点出现、滚到视野中间并量位置
  useEffect(() => {
    onEnterRef.current?.(step);
    let cancelled = false;
    let frame = 0;
    let tries = 0;
    targetRef.current = null;
    setRect(null);

    const locate = () => {
      if (cancelled) return;
      const element = step.anchor
        ? (document.querySelector(`[${TOUR_ANCHOR_ATTR}="${step.anchor}"]`) as HTMLElement | null)
        : null;
      if (!element) {
        if (step.anchor && tries < MAX_WAIT_FRAMES) {
          tries += 1;
          frame = requestAnimationFrame(locate);
        }
        return;
      }
      targetRef.current = element;
      element.scrollIntoView?.({ block: 'center', inline: 'nearest' });
      frame = requestAnimationFrame(() => {
        if (!cancelled) setRect(element.getBoundingClientRect());
      });
    };

    locate();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
    // step 由 index 决定，无需单独列进依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // 滚动 / 旋转屏幕后重新量一次，方框不会错位
  useEffect(() => {
    const update = () => {
      const element = targetRef.current;
      if (element) setRect(element.getBoundingClientRect());
    };
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, []);

  const next = useCallback(() => {
    if (last) onClose();
    else setIndex((value) => value + 1);
  }, [last, onClose]);

  const tooltipStyle: CSSProperties = useMemo(() => {
    const width = Math.min(TOOLTIP_MAX_WIDTH, window.innerWidth - 24);
    if (!rect || rect.height === 0) {
      return { left: '50%', top: '50%', width, transform: 'translate(-50%, -50%)' };
    }
    const below = rect.bottom + 12;
    const above = rect.top - 12 - TOOLTIP_ESTIMATED_HEIGHT;
    const placeAbove = below + TOOLTIP_ESTIMATED_HEIGHT > window.innerHeight - 12 && above > 12;
    return {
      left: Math.min(Math.max(12, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 12),
      top: placeAbove ? above : Math.min(below, window.innerHeight - TOOLTIP_ESTIMATED_HEIGHT - 12),
      width,
    };
  }, [rect]);

  // 单独存数字（CSSProperties 的 left/top 是 string | number，直接取出来做四角定位会丢类型）
  const spot = rect
    ? {
        left: rect.left - SPOT_PAD,
        top: rect.top - SPOT_PAD,
        width: rect.width + SPOT_PAD * 2,
        height: rect.height + SPOT_PAD * 2,
      }
    : null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[80]" data-testid="tour-root">
      {spot ? (
        <div
          data-testid="tour-spotlight"
          className="absolute rounded-xl ring-2 ring-emerald-400"
          style={{ ...spot, boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.62)' }}
        />
      ) : (
        <div className="absolute inset-0 bg-slate-900/60" />
      )}

      {spot ? (
        <>
          <Corner className="-ml-0.5 -mt-0.5 border-l-2 border-t-2 rounded-tl-lg" left={spot.left} top={spot.top} />
          <Corner
            className="-mr-0.5 -mt-0.5 border-r-2 border-t-2 rounded-tr-lg"
            left={spot.left + spot.width - 12}
            top={spot.top}
          />
          <Corner
            className="-mb-0.5 -ml-0.5 border-b-2 border-l-2 rounded-bl-lg"
            left={spot.left}
            top={spot.top + spot.height - 12}
          />
          <Corner
            className="-mb-0.5 -mr-0.5 border-b-2 border-r-2 rounded-br-lg"
            left={spot.left + spot.width - 12}
            top={spot.top + spot.height - 12}
          />
        </>
      ) : null}

      <div
        role="dialog"
        aria-label="新手引导"
        data-testid="tour-card"
        className="pointer-events-auto absolute rounded-2xl bg-white p-4 shadow-2xl"
        style={tooltipStyle}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-emerald-600" data-testid="tour-progress">
            第 {index + 1} / {steps.length} 步
          </span>
          <button
            type="button"
            onClick={onClose}
            data-testid="tour-skip"
            className="min-h-[28px] px-1 text-xs text-slate-400"
          >
            跳过
          </button>
        </div>
        <h3 className="mt-1 text-base font-semibold text-slate-800" data-testid="tour-title">
          {step.title}
        </h3>
        <p className="mt-1 text-[13px] leading-relaxed text-slate-600" data-testid="tour-body">
          {step.body}
        </p>
        <div className="mt-3 flex items-center gap-2">
          {index > 0 ? (
            <button
              type="button"
              onClick={() => setIndex((value) => value - 1)}
              data-testid="tour-prev"
              className="min-h-[36px] rounded-xl border border-slate-200 px-3 text-sm font-medium text-slate-600"
            >
              上一步
            </button>
          ) : null}
          <button
            type="button"
            onClick={next}
            data-testid={last ? 'tour-done' : 'tour-next'}
            className="min-h-[36px] flex-1 rounded-xl bg-emerald-600 text-sm font-medium text-white active:bg-emerald-700"
          >
            {last ? '开始用' : '下一步'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Corner({
  className,
  left,
  top,
}: {
  className: string;
  left: number;
  top: number;
}) {
  return (
    <div
      aria-hidden
      className={`absolute h-3 w-3 border-emerald-400 ${className}`}
      style={{ left, top }}
    />
  );
}
