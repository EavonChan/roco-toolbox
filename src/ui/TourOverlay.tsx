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
  /** 本机是否已有导入数据：`waitForImport` 那步据此放行 */
  importReady?: boolean;
}

const SPOT_PAD = 6;
const TOOLTIP_MAX_WIDTH = 320;
const TOOLTIP_ESTIMATED_HEIGHT = 172;

/** 等锚点挂载（切页/拉数据有延迟）最多等多少帧，约 1 秒 */
const MAX_WAIT_FRAMES = 60;

export function TourOverlay({ steps, onClose, onEnter, importReady = false }: TourOverlayProps) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const onEnterRef = useRef(onEnter);
  const onCloseRef = useRef(onClose);
  /** 进入「等导入」那步时本机是否已经有数据（有数据就不用自动跳，用户自己点下一步） */
  const readyAtEntryRef = useRef(importReady);
  const importReadyRef = useRef(importReady);
  importReadyRef.current = importReady;
  const step = steps[index];
  const last = index === steps.length - 1;
  /** 收尾「重看引导」步：跳过时先跳到这里，再点一次才关闭 */
  const hintIndex = useMemo(() => steps.findIndex((item) => item.hint === true), [steps]);
  const waitingForImport = step.waitForImport === true && !importReady;

  useEffect(() => {
    onEnterRef.current = onEnter;
    onCloseRef.current = onClose;
  });

  // 无障碍（对照 primitives/ModalSurface 的既有做法）：聚焦卡片、Esc 关闭、关闭后还原焦点
  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    return () => restoreFocusRef.current?.focus?.();
  }, []);

  useEffect(() => {
    cardRef.current?.focus();
  }, [index]);

  // 「先导入一次」那步：进入时先记住本机有没有数据，只有进入后才导入成功的才自动继续；
  // 本来就有数据的（重看引导）不抢跳，用户自己点下一步。
  useEffect(() => {
    readyAtEntryRef.current = importReadyRef.current;
  }, [index]);

  useEffect(() => {
    if (step.waitForImport !== true || !importReady || readyAtEntryRef.current || last) return;
    const timer = window.setTimeout(() => setIndex((value) => value + 1), 600);
    return () => window.clearTimeout(timer);
  }, [step.waitForImport, importReady, last]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // 上层还有模态弹层时让给它关，别一次 Esc 关两层
      if (document.querySelector('[aria-modal="true"]')) return;
      event.preventDefault();
      onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // 进步骤：先切页面，再等锚点出现、滚到视野中间并量位置
  useEffect(() => {
    onEnterRef.current?.(step);
    let cancelled = false;
    let frame = 0;
    let tries = 0;
    targetRef.current = null;
    setRect(null);

    const findAnchor = () =>
      step.anchor
        ? (document.querySelector(`[${TOUR_ANCHOR_ATTR}="${step.anchor}"]`) as HTMLElement | null)
        : null;

    const measure = (element: HTMLElement) => {
      targetRef.current = element;
      frame = requestAnimationFrame(() => {
        if (cancelled) return;
        // 量之前目标被卸载：清掉高亮，不画到错误位置
        setRect(element.isConnected ? element.getBoundingClientRect() : null);
      });
    };

    const locate = () => {
      if (cancelled) return;
      cancelAnimationFrame(frame);
      setRect(null);
      const element = findAnchor();
      if (!element) {
        if (step.anchor && tries < MAX_WAIT_FRAMES) {
          tries += 1;
          frame = requestAnimationFrame(locate);
        }
        return;
      }
      tries = 0;
      element.scrollIntoView?.({ block: 'center', inline: 'nearest' });
      measure(element);
    };

    locate();

    // 目标中途被卸载（用户点了别的页签）或晚挂载（数据还没回来）：每 0.6 秒补找一次
    const watchdog = step.anchor
      ? window.setInterval(() => {
          if (cancelled) return;
          const current = targetRef.current;
          if (current?.isConnected) return;
          const element = findAnchor();
          if (element) {
            tries = 0;
            element.scrollIntoView?.({ block: 'center', inline: 'nearest' });
            measure(element);
          } else if (current) {
            // 原来有目标、现在整个没了：退回居中说明卡，不指着空位置
            targetRef.current = null;
            setRect(null);
          }
        }, 600)
      : null;

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (watchdog !== null) window.clearInterval(watchdog);
    };
    // step 由 index 决定，无需单独列进依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // 滚动 / 旋转屏幕后重新量一次，方框不会错位
  useEffect(() => {
    const update = () => {
      const element = targetRef.current;
      // 目标已不在页面上：交给上面每步的补找逻辑，别把高亮量成 0×0
      if (!element?.isConnected) return;
      setRect(element.getBoundingClientRect());
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

  /**
   * 跳过：不直接消失，先跳到收尾的「教程入口」那一步（用户要求：跳过时也要告诉他能从教程再进）；
   * 已经在收尾步时再点才是真正关闭。
   */
  const skip = useCallback(() => {
    if (hintIndex >= 0 && index !== hintIndex) {
      setIndex(hintIndex);
      return;
    }
    onClose();
  }, [hintIndex, index, onClose]);

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
      // 目标滑到屏幕外时，卡片也要留在屏幕内（否则「下一步」会跟着滑出去，用户以为卡死）
      top: Math.max(
        12,
        placeAbove ? above : Math.min(below, window.innerHeight - TOOLTIP_ESTIMATED_HEIGHT - 12),
      ),
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
        ref={cardRef}
        role="dialog"
        aria-label="新手引导"
        aria-describedby="tour-card-body"
        tabIndex={-1}
        data-testid="tour-card"
        className="pointer-events-auto absolute rounded-2xl bg-white p-4 shadow-2xl focus:outline-none"
        style={tooltipStyle}
      >
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-emerald-600" data-testid="tour-progress">
            第 {index + 1} / {steps.length} 步
          </span>
          <button
            type="button"
            onClick={skip}
            data-testid="tour-skip"
            className="min-h-[28px] px-1 text-xs text-slate-400"
          >
            跳过
          </button>
        </div>
        <div aria-live="polite">
          <h3 className="mt-1 text-base font-semibold text-slate-800" data-testid="tour-title">
            {step.title}
          </h3>
          <p
            id="tour-card-body"
            className="mt-1 text-[13px] leading-relaxed text-slate-600"
            data-testid="tour-body"
          >
            {step.body}
          </p>
          {waitingForImport ? (
            <p
              className="mt-2 rounded-lg bg-slate-50 px-2 py-1.5 text-[11px] text-slate-500"
              data-testid="tour-wait"
            >
              导入成功后会自动继续；也可以先跳过
            </p>
          ) : null}
        </div>
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
            disabled={waitingForImport}
            data-testid={last ? 'tour-done' : 'tour-next'}
            className="min-h-[36px] flex-1 rounded-xl bg-emerald-600 text-sm font-medium text-white active:bg-emerald-700 disabled:opacity-50"
          >
            {last ? (step.hint ? '知道了' : '开始用') : '下一步'}
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
