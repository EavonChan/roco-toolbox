import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { PetCardLayout } from './PetCardLayout';
import { fitFontSize, resetFitCardNameForTest, setTextMeasurerForTest } from './fitCardName';

/**
 * 卡名字号自适应的性能锁（2026-11-25 优化）。
 *
 * 旧实现每张卡一个 `useLayoutEffect`：改内联样式 → 读 `getBoundingClientRect()` → 再读
 * `clientWidth`，165 张卡一次进页面 = 495 次强制布局、80ms（见
 * `docs/分析-收集页卡顿-2026-11-25.md`）。这里断言的指标是**渲染时的
 * `getBoundingClientRect` 调用次数**，不是时间阈值——时间阈值在 CI 上必然脆。
 */

let gbcrCalls = 0;
const originalGbcr = Element.prototype.getBoundingClientRect;

beforeEach(() => {
  gbcrCalls = 0;
  resetFitCardNameForTest();
  Element.prototype.getBoundingClientRect = function patched(this: Element, ...args) {
    gbcrCalls += 1;
    return originalGbcr.apply(this, args);
  };
});

afterEach(() => {
  Element.prototype.getBoundingClientRect = originalGbcr;
  setTextMeasurerForTest(null);
  resetFitCardNameForTest();
  vi.restoreAllMocks();
});

/** jsdom 没有布局：把可用宽度固定成 40px，好让「缩字号」这段逻辑可测 */
function stubClientWidth(width: number): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => width,
  });
  return () => {
    if (descriptor) Object.defineProperty(HTMLElement.prototype, 'clientWidth', descriptor);
    else delete (HTMLElement.prototype as unknown as Record<string, unknown>).clientWidth;
  };
}

function renderCards(count: number, fit?: { base?: number; min?: number }) {
  return render(
    <div>
      {Array.from({ length: count }, (_, index) => (
        <PetCardLayout
          key={index}
          name={index === 0 ? '火花' : '一个特别特别长的精灵名字'}
          number={String(index).padStart(3, '0')}
          eggGroups={['怪兽组']}
          natures={['固执']}
          avatar={<span data-testid="avatar-stub" />}
          fitName
          fitNameBase={fit?.base}
          fitNameMin={fit?.min}
        />
      ))}
    </div>,
  );
}

describe('fitFontSize（纯计算，口径与旧实现一致）', () => {
  test('放得下就保持基准字号', () => {
    expect(fitFontSize(40, 40, 10, 9)).toBe(10);
    expect(fitFontSize(20, 40, 10, 9)).toBe(10);
  });

  test('放不下时按可用宽度等比例缩小，并取 0.5px 档', () => {
    // 10 * 18 / 30 = 6 → 档位 6
    expect(fitFontSize(30, 18, 10, 5)).toBe(6);
    // 12 * 24 / 60 = 4.8 → 档位 4.5，被下限 8 挡住
    expect(fitFontSize(60, 24, 12, 8)).toBe(8);
  });

  test('量不到宽度（0）时不动字号', () => {
    expect(fitFontSize(0, 40, 10, 9)).toBe(10);
    expect(fitFontSize(200, 0, 10, 9)).toBe(10);
  });
});

describe('卡名字号自适应不再逐卡强制布局', () => {
  test('一次渲染 8 张卡，getBoundingClientRect 不超过 2 次（旧实现每张卡至少 1 次）', async () => {
    renderCards(8);
    await act(async () => {});

    expect(screen.getAllByTestId('pet-card-name')).toHaveLength(8);
    expect(gbcrCalls).toBeLessThanOrEqual(2);
  });

  /**
   * 现状口径（2026-11-25 核对）：所有调用方都只传 `fitName`，没传 `fitNameBase/Min`，
   * 而两个默认值都是 10 —— 也就是说旧实现「量了 495 次布局」但永远不会缩字号。
   * 这条锁住「默认档不改变视觉」，P2 因此是纯性能改造、不动画面。
   */
  test('默认档（基准=下限=10px）长名字也保持 10px，与改造前一致', async () => {
    const restore = stubClientWidth(40);
    setTextMeasurerForTest((text) => (text.length > 3 ? 200 : 10));
    try {
      renderCards(3);
      await act(async () => {});

      const names = screen.getAllByTestId('pet-card-name');
      expect(names[0].style.fontSize).toBe('10px');
      expect(names[1].style.fontSize).toBe('10px');
    } finally {
      restore();
    }
  });

  test('显式给了基准/下限时才按可用宽度缩（能力保留，供以后真要用）', async () => {
    const restore = stubClientWidth(40);
    setTextMeasurerForTest((text) => (text.length > 3 ? 200 : 10));
    try {
      renderCards(2, { base: 12, min: 9 });
      await act(async () => {});

      const names = screen.getAllByTestId('pet-card-name');
      // 12 * 40 / 200 = 2.4 → 档位 2 → 被下限 9 挡住
      expect(names[0].style.fontSize).toBe('12px');
      expect(names[1].style.fontSize).toBe('9px');
    } finally {
      restore();
    }
  });
});
