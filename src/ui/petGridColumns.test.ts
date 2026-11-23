import { describe, expect, test } from 'vitest';
import { columnsForCollapsedRail, MAX_COLLAPSED_COLUMNS } from './petGridColumns';

/** 四列 / 五列时，收起前后卡片区宽度来自真机实测（844×390、1120、1280×720 横屏）。 */
describe('columnsForCollapsedRail（收起筛选后加列，卡片宽度不变）', () => {
  test('844×390 横屏：四列收起后排九列，卡片宽度基本不变', () => {
    const columns = columnsForCollapsedRail({
      baseColumns: 4,
      expandedWidth: 297,
      collapsedWidth: 642,
      gap: 5.625,
    });
    expect(columns).toBe(9);
    const width = (642 - 5.625 * (columns - 1)) / columns;
    expect(width).toBeGreaterThan(60);
    expect(width).toBeLessThan(75);
  });

  test('1280×720 横屏：五列收起后排八列，卡片不被拉宽', () => {
    const columns = columnsForCollapsedRail({
      baseColumns: 5,
      expandedWidth: 695,
      collapsedWidth: 1064,
      gap: 6,
    });
    expect(columns).toBe(8);
    const width = (1064 - 6 * (columns - 1)) / columns;
    expect(width).toBeGreaterThan(120);
    expect(width).toBeLessThan(140);
  });

  test('1120 宽横屏：五列收起后排八列', () => {
    expect(
      columnsForCollapsedRail({
        baseColumns: 5,
        expandedWidth: 567,
        collapsedWidth: 915,
        gap: 5.68,
      }),
    ).toBe(8);
  });

  test('三列放大模式收起后同样只加列、不拉宽', () => {
    const columns = columnsForCollapsedRail({
      baseColumns: 3,
      expandedWidth: 297,
      collapsedWidth: 642,
      gap: 5.625,
    });
    expect(columns).toBe(6);
  });

  test('收起后不比原来宽（竖屏 / 没右栏）时保持用户选的列数', () => {
    expect(
      columnsForCollapsedRail({
        baseColumns: 4,
        expandedWidth: 642,
        collapsedWidth: 642,
        gap: 6,
      }),
    ).toBe(4);
    expect(
      columnsForCollapsedRail({
        baseColumns: 4,
        expandedWidth: 0,
        collapsedWidth: 642,
        gap: 6,
      }),
    ).toBe(4);
  });

  test('超宽屏也最多排 12 列', () => {
    expect(
      columnsForCollapsedRail({
        baseColumns: 6,
        expandedWidth: 600,
        collapsedWidth: 4000,
        gap: 6,
      }),
    ).toBe(MAX_COLLAPSED_COLUMNS);
  });
});
