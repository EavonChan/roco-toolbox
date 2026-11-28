import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { Chip } from './Chip';

describe('Chip', () => {
  test('筛选态：未选中 / 选中 用 aria-pressed 与 data-selected 表达', () => {
    const onToggle = vi.fn();
    const { rerender } = render(
      <Chip onToggle={onToggle} testId="chip">
        蛋组
      </Chip>,
    );
    const chip = screen.getByTestId('chip');
    expect(chip.tagName).toBe('BUTTON');
    expect(chip).toHaveAttribute('aria-pressed', 'false');

    rerender(
      <Chip onToggle={onToggle} selected testId="chip">
        蛋组
      </Chip>,
    );
    expect(screen.getByTestId('chip')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('chip')).toHaveAttribute('data-selected', 'true');
    expect(screen.getByTestId('chip').className).toContain('border-accent-line');
  });

  test('点击切换一次', () => {
    const onToggle = vi.fn();
    render(
      <Chip onToggle={onToggle} testId="chip">
        蛋组
      </Chip>,
    );
    fireEvent.click(screen.getByTestId('chip'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  test('可关闭：关闭按钮有读屏名，点击只触发 onRemove', () => {
    const onToggle = vi.fn();
    const onRemove = vi.fn();
    render(
      <Chip onToggle={onToggle} onRemove={onRemove} testId="chip">
        草系
      </Chip>,
    );
    // 外层退成 span，里面是「标签按钮 + 关闭按钮」，不存在 button 套 button
    expect(screen.getByTestId('chip').tagName).toBe('SPAN');
    fireEvent.click(screen.getByRole('button', { name: '移除' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onToggle).not.toHaveBeenCalled();
  });

  test('状态色：tone 决定配色，且不依赖 selected', () => {
    render(
      <Chip tone="warn" testId="chip">
        缺数据
      </Chip>,
    );
    const chip = screen.getByTestId('chip');
    expect(chip).toHaveAttribute('data-tone', 'warn');
    expect(chip.className).toContain('border-warn-line');
    expect(chip.className).toContain('bg-warn-soft');
    expect(chip.className).toContain('text-warn');
  });

  test('禁用态：点击无效', () => {
    const onToggle = vi.fn();
    render(
      <Chip onToggle={onToggle} disabled testId="chip">
        禁用
      </Chip>,
    );
    const chip = screen.getByTestId('chip') as HTMLButtonElement;
    expect(chip.disabled).toBe(true);
    fireEvent.click(chip);
    expect(onToggle).not.toHaveBeenCalled();
  });

  test('触区 ≥ 32px：min-h-touch，且不写死像素字号', () => {
    render(<Chip testId="chip">标签</Chip>);
    const className = screen.getByTestId('chip').className;
    expect(className).toContain('min-h-touch');
    expect(className).toContain('rounded-chip');
    expect(className).not.toMatch(/\d+px/);
  });
});
