import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { EntriesSection } from './EntriesSection';
import { makeCtx } from '../testContext';

afterEach(cleanup);

describe('三个入口区块', () => {
  test('三个入口同权重：采集 / 蛋仓 / 小组都在，且没有「选中态」强调', () => {
    render(<EntriesSection ctx={makeCtx()} />);

    const collect = screen.getByTestId('profile-entry-collect');
    const eggs = screen.getByTestId('profile-entry-egg-stock');
    const groups = screen.getByTestId('profile-section-groups');
    for (const entry of [collect, eggs, groups]) {
      expect(entry.className).toContain('border-line');
      expect(entry.className).not.toContain('bg-accent-soft');
    }
  });

  test('点每个入口都交给上层', () => {
    const onCollect = vi.fn();
    const onGoEggStock = vi.fn();
    const onGoGroups = vi.fn();
    render(<EntriesSection ctx={makeCtx({ onCollect, onGoEggStock, onGoGroups })} />);

    fireEvent.click(screen.getByTestId('profile-entry-collect'));
    fireEvent.click(screen.getByTestId('profile-entry-egg-stock'));
    fireEvent.click(screen.getByTestId('profile-section-groups'));

    expect(onCollect).toHaveBeenCalledTimes(1);
    expect(onGoEggStock).toHaveBeenCalledTimes(1);
    expect(onGoGroups).toHaveBeenCalledTimes(1);
  });

  test('蛋仓入口在未登录时写明「需登录」', () => {
    render(<EntriesSection ctx={makeCtx({ accountId: null })} />);
    expect(screen.getByTestId('profile-entry-egg-stock')).toHaveTextContent('需登录');
  });
});
