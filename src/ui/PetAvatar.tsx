import { useEffect, useRef, useState } from 'react';
import { petAvatarUrl } from '../domain/petAvatar';

/** 尺寸只允许这几档，用静态类名（Tailwind 不能拼字符串） */
export type PetAvatarSize = 20 | 24 | 32 | 36 | 40 | 44 | 52 | 56 | 62 | 64 | 66 | 72;

const SIZE_CLASS: Record<PetAvatarSize, string> = {
  20: 'h-5 w-5 text-[10px]',
  24: 'h-6 w-6 text-[11px]',
  32: 'h-8 w-8 text-sm',
  36: 'h-9 w-9 text-sm',
  40: 'h-10 w-10 text-sm',
  44: 'h-11 w-11 text-sm',
  52: 'h-[52px] w-[52px] text-base',
  56: 'h-14 w-14 text-lg',
  62: 'h-[62px] w-[62px] text-lg',
  64: 'h-16 w-16 text-lg',
  66: 'h-[66px] w-[66px] text-lg',
  72: 'h-[4.5rem] w-[4.5rem] text-xl',
};

export interface PetAvatarProps {
  gameId: number | null | undefined;
  /** 加载失败时用它的首字占位 */
  name: string;
  /** 异色 / 异色炫彩 → 异色图（`icon_yise.png`）；炫彩不传（官方没有炫彩立绘） */
  shiny?: boolean;
  size?: PetAvatarSize;
  className?: string;
}

/** 提前多少像素开始请求：约等于再往下滚一两张卡片，滚动时不至于看到空白 */
const LAZY_ROOT_MARGIN = '240px 0px';

type LazyCallback = () => void;
/** 一个共享的 IntersectionObserver 服务整页头像，避免每张头像各建一个观察器 */
const lazyCallbacks = new WeakMap<Element, LazyCallback>();
let lazyObserver: IntersectionObserver | null = null;

function sharedObserver(): IntersectionObserver | null {
  if (typeof IntersectionObserver === 'undefined') return null;
  if (lazyObserver) return lazyObserver;
  lazyObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const callback = lazyCallbacks.get(entry.target);
      if (!callback) continue;
      lazyCallbacks.delete(entry.target);
      lazyObserver?.unobserve(entry.target);
      callback();
    }
  }, { rootMargin: LAZY_ROOT_MARGIN });
  return lazyObserver;
}

/** 元素接近视口时回调一次；IntersectionObserver 不可用（老浏览器 / 单测）时立即回调 */
function observeOnce(element: Element, callback: LazyCallback): () => void {
  const observer = sharedObserver();
  if (!observer) {
    callback();
    return () => {};
  }
  lazyCallbacks.set(element, callback);
  observer.observe(element);
  return () => {
    lazyCallbacks.delete(element);
    observer.unobserve(element);
  };
}

/**
 * 精灵头像（官方 CDN，透明 PNG）。纯装饰（`alt=""`），可访问名称由旁边的文字承担。
 *
 * 懒加载：头像接近视口时才挂 `src`。浏览器原生的 `loading="lazy"` 在长页面里会
 * 提前抓一大段（一屏能带出上百个请求），这里用 IntersectionObserver 控制，
 * 滚到附近才真正下载。
 *
 * 兜底两段：异色图 404 → 先退回普通头像；普通头像也失败（官方未收录的新精灵）
 * → 名字首字占位，不留破图。所有列表/卡片统一用它，不要各处自己拼 URL。
 */
export function PetAvatar({ gameId, name, shiny = false, size = 32, className = '' }: PetAvatarProps) {
  const [stage, setStage] = useState<'primary' | 'normal' | 'fallback'>('primary');
  /** 头像是否已进入过视口附近（一旦进入就不再退回，避免来回滚动反复加载） */
  const [nearViewport, setNearViewport] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  // 换精灵 / 换异色状态时重置兜底阶段：否则上一张的失败结果会带到新头像
  useEffect(() => { setStage('primary'); }, [gameId, shiny]);
  const sizeClass = SIZE_CLASS[size];
  const url =
    stage === 'fallback'
      ? null
      : petAvatarUrl(gameId, stage === 'primary' && shiny ? 'shiny' : 'normal');

  // 接近视口时才真正下载头像；一旦进入过就保持加载，来回滚动不会反复下载
  useEffect(() => {
    if (!url || nearViewport) return;
    const node = imageRef.current;
    if (!node) return;
    return observeOnce(node, () => setNearViewport(true));
  }, [url, nearViewport]);

  if (!url) {
    return (
      <span
        data-testid="pet-avatar-fallback"
        aria-hidden="true"
        className={`flex shrink-0 items-center justify-center rounded-md bg-slate-100 font-semibold text-slate-500 ${sizeClass} ${className}`}
      >
        {name.slice(0, 1)}
      </span>
    );
  }

  return (
    <img
      ref={imageRef}
      data-testid="pet-avatar"
      src={nearViewport ? url : undefined}
      alt=""
      loading="lazy"
      decoding="async"
      className={`shrink-0 object-contain ${sizeClass} ${className}`}
      onError={() => setStage((current) => (current === 'primary' && shiny ? 'normal' : 'fallback'))}
    />
  );
}
