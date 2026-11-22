import { describe, expect, test } from 'vitest';
import { shouldUseThreeColumns, twoColumnContentHeight } from './motherColumnLayout';

describe('motherColumnLayout', () => {
  test('按两列逐行取较高的一节，加上行间距', () => {
    expect(twoColumnContentHeight([160, 140, 120, 180], 4, 8)).toBe(160 + 180 + 8);
  });

  test('两列一屏放得下就保持两列', () => {
    expect(
      shouldUseThreeColumns({
        sectionHeights: [160, 140, 120, 180],
        totalSections: 4,
        gap: 8,
        viewportHeight: 720,
      }),
    ).toBe(false);
  });

  test('两列超过一屏时改三列', () => {
    expect(
      shouldUseThreeColumns({
        sectionHeights: [160, 160, 160, 160, 160, 160],
        totalSections: 6,
        gap: 8,
        viewportHeight: 400,
      }),
    ).toBe(true);
  });

  test('没量到高度时用已量到的平均值补齐，空列表不报错', () => {
    expect(twoColumnContentHeight([], 0, 8)).toBe(0);
    expect(twoColumnContentHeight([200], 4, 8)).toBe(200 + 200 + 8);
  });
});
