import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { TOUR_VERSION, TOUR_STEPS, markTourSeen, tourPending } from './tour';
import { TourOverlay } from './TourOverlay';

describe('新手引导', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.body.innerHTML = '';
  });

  test('首启待弹；标记已读后不再弹（按版本号记）', () => {
    expect(tourPending()).toBe(true);
    markTourSeen();
    expect(tourPending()).toBe(false);
    window.localStorage.setItem('roco.tourSeen', '0');
    expect(tourPending()).toBe(true);
    expect(TOUR_VERSION).not.toBe('0');
  });

  test('步骤覆盖主线：入口 / 看板 / 收集 / 小组 / 家园 / 导入 / 云同步', () => {
    const titles = TOUR_STEPS.map((step) => step.title).join('|');
    expect(titles).toContain('五个入口');
    expect(titles).toContain('目标档位');
    expect(titles).toContain('覆盖度');
    expect(titles).toContain('母本全收集');
    expect(titles).toContain('一起收集');
    expect(titles).toContain('需求中心');
    expect(titles).toContain('接单上窝');
    expect(titles).toContain('导入');
    expect(titles).toContain('云同步');
    // 12-15 步：太短讲不完主线，太长没人看完
    expect(TOUR_STEPS.length).toBeGreaterThanOrEqual(12);
    expect(TOUR_STEPS.length).toBeLessThanOrEqual(15);
  });

  test('下一步 / 上一步 / 最后一步收尾', () => {
    const onClose = vi.fn();
    render(<TourOverlay steps={TOUR_STEPS} onClose={onClose} />);

    expect(screen.getByTestId('tour-progress')).toHaveTextContent(`1 / ${TOUR_STEPS.length}`);
    fireEvent.click(screen.getByTestId('tour-next'));
    expect(screen.getByTestId('tour-progress')).toHaveTextContent('2 /');
    fireEvent.click(screen.getByTestId('tour-prev'));
    expect(screen.getByTestId('tour-progress')).toHaveTextContent('1 /');

    for (let guard = 0; guard < TOUR_STEPS.length && !screen.queryByTestId('tour-done'); guard += 1) {
      fireEvent.click(screen.getByTestId('tour-next'));
    }
    fireEvent.click(screen.getByTestId('tour-done'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('任意一步点「跳过」都直接关闭', () => {
    const onClose = vi.fn();
    render(<TourOverlay steps={TOUR_STEPS} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('tour-skip'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('找到锚点时画聚光方框；找不到时退化成居中说明卡', async () => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-tour', 'known-anchor');
    document.body.appendChild(anchor);

    const steps = [
      { id: 'a', title: '有锚点', body: '高亮真实控件', anchor: 'known-anchor' },
      { id: 'b', title: '没锚点', body: '退化成居中卡', anchor: 'missing-anchor' },
    ];
    render(<TourOverlay steps={steps} onClose={() => {}} />);

    await waitFor(() => expect(screen.getByTestId('tour-spotlight')).toBeTruthy());
    expect(screen.getByTestId('tour-title')).toHaveTextContent('有锚点');

    fireEvent.click(screen.getByTestId('tour-next'));
    await waitFor(() => expect(screen.getByTestId('tour-title')).toHaveTextContent('没锚点'));
    expect(screen.queryByTestId('tour-spotlight')).toBeNull();
    expect(screen.getByTestId('tour-card')).toBeTruthy();
  });

  test('目标中途被移除后退回居中卡，不再画到空位置', async () => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-tour', 'vanish-anchor');
    document.body.appendChild(anchor);

    render(
      <TourOverlay steps={[{ id: 'a', title: '有锚点', body: '高亮真实控件', anchor: 'vanish-anchor' }]} onClose={() => {}} />,
    );
    await waitFor(() => expect(screen.getByTestId('tour-spotlight')).toBeTruthy());

    anchor.remove();
    await waitFor(() => expect(screen.queryByTestId('tour-spotlight')).toBeNull(), { timeout: 2000 });
    expect(screen.getByTestId('tour-card')).toBeTruthy();
  });

  test('目标滑到屏幕外时，说明卡仍留在屏幕内', async () => {
    const anchor = document.createElement('div');
    anchor.setAttribute('data-tour', 'offscreen-anchor');
    anchor.getBoundingClientRect = () =>
      ({ top: -220, bottom: -170, left: 0, right: 100, width: 100, height: 50, x: 0, y: -220 }) as DOMRect;
    document.body.appendChild(anchor);

    render(
      <TourOverlay steps={[{ id: 'a', title: '离屏', body: '目标已经滑出屏幕', anchor: 'offscreen-anchor' }]} onClose={() => {}} />,
    );
    await waitFor(() => expect(screen.getByTestId('tour-spotlight')).toBeTruthy());

    const card = screen.getByTestId('tour-card');
    expect(Number.parseFloat(card.style.top)).toBeGreaterThanOrEqual(12);
  });

  test('打开时焦点落在卡片上，Esc 可关闭', () => {
    const onClose = vi.fn();
    render(<TourOverlay steps={TOUR_STEPS} onClose={onClose} />);

    expect(document.activeElement).toBe(screen.getByTestId('tour-card'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('进入每一步都会通知 App 切页面', () => {
    const onEnter = vi.fn();
    render(<TourOverlay steps={TOUR_STEPS} onClose={() => {}} onEnter={onEnter} />);
    expect(onEnter).toHaveBeenCalledWith(TOUR_STEPS[0]);
    fireEvent.click(screen.getByTestId('tour-next'));
    expect(onEnter).toHaveBeenCalledWith(TOUR_STEPS[1]);
  });
});
