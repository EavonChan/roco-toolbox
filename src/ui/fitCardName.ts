/**
 * 卡名字号自适应（2026-11-25 性能改造）。
 *
 * **旧实现**（`PetCardLayout` 里每张卡一个 `useLayoutEffect`）：
 * 改内联样式 → `text.getBoundingClientRect()` → `heading.clientWidth`，一次进页面
 * 165 张卡 = 495 次强制布局、约 80ms，单帧被拖到 200ms 以上
 * （测量见 `docs/分析-收集页卡顿-2026-11-25.md`）。
 *
 * **现在**：
 * 1. 卡片只登记任务（`scheduleCardNameFit`），不做任何 DOM 读写；
 * 2. 所有登记的任务在**同一个微任务**里一次处理完：先统一读可用宽度（读之间不写样式，
 *    浏览器只需一次布局），再用 canvas 量文字宽度（完全不碰布局），最后统一写字号
 *    （写之间不读，只触发一次样式重算）；
 * 3. 容器变宽变窄由**一个共享的 ResizeObserver** 统一重排，不再每张卡一个观察器。
 *
 * canvas 量宽度时把元素计算出来的字体族/字重一起带上，和 DOM 排版同字体同字重，
 * 因此缩字号的判定结果与旧实现一致；量不到（无 canvas 的环境，例如 jsdom）时保持基准字号，
 * 与旧实现「量不到就不缩」的行为相同。
 */

export interface CardNameFitTask {
  /** 名字所在的标题元素（可用宽度的来源） */
  heading: HTMLElement;
  /** 真正写字号的 span */
  text: HTMLElement;
  /** 基准字号（px） */
  base: number;
  /** 最小字号（px） */
  min: number;
}

/** 字号计算：放得下用基准字号，放不下按比例缩到 0.5px 档，但不小于下限。 */
export function fitFontSize(natural: number, available: number, base: number, min: number): number {
  if (!(natural > 0) || !(available > 0) || natural <= available) return base;
  return Math.max(min, Math.floor(((base * available) / natural) * 2) / 2);
}

type TextMeasurer = (text: string, fontSize: number) => number;

/** 测试用：替换文字宽度来源（jsdom 没有 canvas，也没有排版） */
let measurerOverride: TextMeasurer | null = null;

let canvasContext: CanvasRenderingContext2D | null = null;
let canvasUnavailable = false;
/** 字体族/字重按元素读一次就够（同一批卡片样式一致） */
let fontFamily = '';
let fontWeight = '';

const widthCache = new Map<string, number>();
const MAX_CACHE_ENTRIES = 2000;

const tasks = new Set<CardNameFitTask>();
/** 每张卡上一次量到的可用宽度：ResizeObserver 初次回调（宽度没变）不该再触发一次重排 */
const knownWidths = new Map<HTMLElement, number>();
let flushScheduled = false;
let sharedObserver: ResizeObserver | null = null;

function getCanvasContext(): CanvasRenderingContext2D | null {
  if (canvasUnavailable) return null;
  if (canvasContext) return canvasContext;
  try {
    // jsdom（单测）有 HTMLCanvasElement 但没有 CanvasRenderingContext2D，
    // 也没有真正的 canvas 实现：先看全局再取 context，避免刷一堆 Not implemented 噪声
    if (
      typeof document === 'undefined' ||
      typeof HTMLCanvasElement === 'undefined' ||
      typeof CanvasRenderingContext2D === 'undefined'
    ) {
      canvasUnavailable = true;
      return null;
    }
    const canvas = document.createElement('canvas');
    canvasContext = canvas.getContext('2d');
  } catch {
    canvasContext = null;
  }
  if (!canvasContext) canvasUnavailable = true;
  return canvasContext;
}

function fontOf(element: HTMLElement): { family: string; weight: string } {
  if (fontFamily && fontWeight) return { family: fontFamily, weight: fontWeight };
  try {
    const computed = window.getComputedStyle(element);
    fontFamily = computed.fontFamily || 'sans-serif';
    fontWeight = computed.fontWeight || '400';
  } catch {
    fontFamily = 'sans-serif';
    fontWeight = '400';
  }
  return { family: fontFamily, weight: fontWeight };
}

/** 文字在 `fontSize` 下的自然宽度（px）；量不到返回 0（= 不缩字号）。 */
function naturalWidth(text: string, fontSize: number, sample: HTMLElement): number {
  if (measurerOverride) return measurerOverride(text, fontSize);
  const { family, weight } = fontOf(sample);
  const key = `${fontSize}|${weight}|${family}|${text}`;
  const cached = widthCache.get(key);
  if (cached !== undefined) return cached;
  const context = getCanvasContext();
  if (!context) return 0;
  try {
    context.font = `${weight} ${fontSize}px ${family}`;
  } catch {
    return 0;
  }
  const width = context.measureText(text).width;
  if (!Number.isFinite(width)) return 0;
  if (widthCache.size >= MAX_CACHE_ENTRIES) widthCache.clear();
  widthCache.set(key, width);
  return width;
}

/**
 * 一次把所有登记的任务处理完：读可用宽度 → 量文字 → 写字号。
 * 导出只为测试与性能排查（`resetFitCardNameForTest` 之后手动跑一遍）。
 */
export function flushCardNameFit(): void {
  if (tasks.size === 0) return;
  const list = [...tasks];
  // 1) 读：先统一读可用宽度，读之间没有写样式，一次布局就够
  const available = list.map((task) => task.heading.clientWidth);
  // 2) 写：逐个算字号再写；写的中间不再读，避免「读一次排一次」
  for (let index = 0; index < list.length; index += 1) {
    const task = list[index];
    knownWidths.set(task.heading, available[index]);
    const natural = naturalWidth(task.text.textContent ?? '', task.base, task.text);
    const size = fitFontSize(natural, available[index], task.base, task.min);
    const css = `${size}px`;
    if (task.text.style.fontSize !== css) task.text.style.fontSize = css;
  }
}

function scheduleFlush(): void {
  if (flushScheduled) return;
  flushScheduled = true;
  // 微任务：所有卡片都已提交到 DOM、还没绘制，量出来的宽度就是首屏最终宽度
  queueMicrotask(() => {
    flushScheduled = false;
    flushCardNameFit();
  });
}

function ensureObserver(): ResizeObserver | null {
  if (typeof ResizeObserver === 'undefined') return null;
  if (!sharedObserver) {
    // 整页一个观察器：只有真的变宽变窄才重排；初次 observe 的回调宽度没变，直接跳过
    sharedObserver = new ResizeObserver((entries) => {
      let changed = false;
      for (const entry of entries) {
        const known = knownWidths.get(entry.target as HTMLElement);
        if (known === undefined || Math.abs(entry.contentRect.width - known) > 0.5) {
          changed = true;
          break;
        }
      }
      if (changed) scheduleFlush();
    });
  }
  return sharedObserver;
}

/**
 * 登记一张卡的名字自适应，返回注销函数（React 的 effect cleanup 直接用它）。
 * 本函数本身不读写 DOM，可以每张卡都调用。
 */
export function scheduleCardNameFit(task: CardNameFitTask): () => void {
  tasks.add(task);
  ensureObserver()?.observe(task.heading);
  scheduleFlush();
  return () => {
    tasks.delete(task);
    knownWidths.delete(task.heading);
    sharedObserver?.unobserve(task.heading);
  };
}

/** 测试用：换掉文字宽度来源（传 null 恢复 canvas）。 */
export function setTextMeasurerForTest(measurer: TextMeasurer | null): void {
  measurerOverride = measurer;
  widthCache.clear();
}

/** 测试用：清空登记表、缓存与共享观察器。 */
export function resetFitCardNameForTest(): void {
  tasks.clear();
  knownWidths.clear();
  widthCache.clear();
  measurerOverride = null;
  canvasContext = null;
  canvasUnavailable = false;
  fontFamily = '';
  fontWeight = '';
  flushScheduled = false;
  if (sharedObserver) {
    sharedObserver.disconnect();
    sharedObserver = null;
  }
}
