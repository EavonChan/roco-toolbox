import { useEffect, useState } from 'react';

/**
 * 宽横屏判定（2026-11-21）：16:9 / 16:10 这类宽屏才并排两个面板；
 * 4:3 和竖屏仍走「点击切换」的老逻辑。抽成共享 hook，收集页的
 * 5 / 6 列切换也用同一份断点，避免两处写的宽度对不上。
 */
const QUERY = '(orientation: landscape) and (min-width: 1120px)';

export function useWideLandscape(): boolean {
  const [wide, setWide] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(QUERY).matches
      : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(QUERY);
    const onChange = () => setWide(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return wide;
}

/**
 * 是否处在横屏（任意宽度）：看板左栏折叠、收集页右栏折叠都只在横屏生效，
 * 竖屏保持原来的单列 / 上下顺序，避免把这些桌面式分栏带到手机上。
 */
const LANDSCAPE_QUERY = '(orientation: landscape)';

export function useLandscape(): boolean {
  const [landscape, setLandscape] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(LANDSCAPE_QUERY).matches
      : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(LANDSCAPE_QUERY);
    const onChange = () => setLandscape(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return landscape;
}

/**
 * 横屏且宽度 ≥1000px：收集页折叠右栏后加列只在这样的屏上生效。
 * 手机横屏（844 等）折叠后宽度仍有限，只加列会把精灵卡压得太窄。
 */
const TABLET_LANDSCAPE_QUERY = '(orientation: landscape) and (min-width: 1000px)';

export function useTabletLandscape(): boolean {
  const [wide, setWide] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(TABLET_LANDSCAPE_QUERY).matches
      : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(TABLET_LANDSCAPE_QUERY);
    const onChange = () => setWide(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return wide;
}

/**
 * 家园配窝卡「左侧两组三只 + 右侧竖排两只」断点（2026-11-22 用户口径）。
 *
 * 手机横屏（19.5:9，约 800~1080px）的可用宽放不下两个三只组（473×2 = 946），
 * 但放得下一组三只 + 一组竖排两只（473 + 约 170 = 约 650）。
 * 再宽到能并排两个三只组时就不该再拆，所以设了上限。
 */
const HOME_PAIR_SPLIT_QUERY =
  '(orientation: landscape) and (max-height: 600px) and (min-width: 800px) and (max-width: 1080px)';

export function useHomePairSplit(): boolean {
  const [split, setSplit] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(HOME_PAIR_SPLIT_QUERY).matches
      : false,
  );
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(HOME_PAIR_SPLIT_QUERY);
    const onChange = () => setSplit(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return split;
}
