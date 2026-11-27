import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { RecommendedNatureEditor } from './RecommendedNatureEditor';
import { resetNatureOverridesForTest } from './natureOverrideStore';

/**
 * 推荐性格编辑器常挂在母本页，`open=false` 时**不该**计算任何一颗蛋（2026-11-25 P3b）。
 *
 * 旧实现把列表直接写在 `RecommendedNatureEditor` 的渲染里，而 `ModalSurface` 是
 * 「`open=false` 就返回 null」，但传进去的子元素**早已求值完毕** —— 结果是弹层关着，
 * 全图鉴 209 颗蛋的 `eggNatures` + `defaultEggNatures` 每次都算一遍（含每次输入）。
 * 这里锁的是调用次数，不是时间。
 */
const { natureCalls } = vi.hoisted(() => ({ natureCalls: [] as number[] }));

vi.mock('../domain/recommendedNatures', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../domain/recommendedNatures')>();
  return {
    ...actual,
    eggNatures: (
      speciesList: Parameters<typeof actual.eggNatures>[0],
      eggGameId: number,
      overrides?: Parameters<typeof actual.eggNatures>[2],
    ) => {
      natureCalls.push(eggGameId);
      return actual.eggNatures(speciesList, eggGameId, overrides);
    },
  };
});

beforeEach(() => {
  natureCalls.length = 0;
  resetNatureOverridesForTest();
});

describe('推荐性格编辑器', () => {
  test('关闭状态下不算任何一颗蛋，也不渲染弹层；打开后才算全图鉴', () => {
    const { rerender } = render(<RecommendedNatureEditor open={false} onClose={() => {}} />);
    expect(screen.queryByTestId('nature-editor')).toBeNull();
    expect(natureCalls).toHaveLength(0);

    rerender(<RecommendedNatureEditor open onClose={() => {}} />);
    expect(screen.getByTestId('nature-editor-grid')).toBeTruthy();
    // 打开时才把「可孵蛋」逐颗算一遍（全图鉴 200+ 颗）
    expect(natureCalls.length).toBeGreaterThan(200);
  });

  test('名字带形态，搜索能按形态命中', () => {
    render(<RecommendedNatureEditor open onClose={() => {}} />);
    fireEvent.change(screen.getByTestId('nature-editor-search'), {
      target: { value: '雪绒鸟' },
    });
    const rows = screen.getAllByTestId('nature-editor-row');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((row) => row.textContent?.includes('春天的样子'))).toBe(true);
  });

  test('卡片紧凑：窄屏三列、宽屏四列，长名字完整显示不截断', () => {
    render(<RecommendedNatureEditor open onClose={() => {}} />);
    const grid = screen.getByTestId('nature-editor-grid');
    expect(grid.className).toContain('grid-cols-3');
    expect(grid.className).toContain('sm:grid-cols-4');

    const longName = screen
      .getAllByTestId('nature-editor-row')
      .find((row) => row.textContent?.includes('小星光_月光能量的样子'));
    expect(longName).toBeTruthy();
    expect(longName?.querySelector('.truncate')).toBeNull();
  });

  test('改一颗蛋的性格会写入覆盖并标「已改」，恢复默认清掉', () => {
    render(<RecommendedNatureEditor open onClose={() => {}} />);
    fireEvent.click(screen.getAllByTestId(/nature-editor-toggle-\d+/)[0]);
    fireEvent.click(screen.getAllByTestId(/nature-option-\d+-胆小/)[0]);
    const row = screen.getAllByTestId('nature-editor-row').find((item) =>
      item.textContent?.includes('已改'),
    );
    expect(row).toBeTruthy();
    expect(row).toHaveTextContent('胆小');
    // 本机改动要记下修改时刻，云同步才能判断「本机比云端新」
    expect(Number(window.localStorage.getItem('roco.natureOverridesUpdatedAt'))).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByTestId(/nature-editor-reset-\d+/)[0]);
    expect(
      screen.queryAllByTestId('nature-editor-row').some((item) => item.textContent?.includes('已改')),
    ).toBe(false);
  });
});
