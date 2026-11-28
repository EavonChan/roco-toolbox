import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { Row } from './Row';

describe('Row', () => {
  test('四段都在：图标 / 主文案 / 副文案 / 右侧值', () => {
    render(
      <Row
        icon={<span data-testid="row-icon">◆</span>}
        primary="白髮懶人"
        secondary="保守 · 大块头"
        value="12"
      />,
    );
    expect(screen.getByText('白髮懶人')).toBeInTheDocument();
    expect(screen.getByText('保守 · 大块头')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByTestId('row-icon').parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  test('长文案截断：主副文案带 truncate，容器允许收缩', () => {
    render(<Row primary={'很长的名字'.repeat(12)} secondary={'很长的副文案'.repeat(12)} value="9" />);
    const primary = document.querySelector('[data-slot="primary"]') as HTMLElement;
    const secondary = document.querySelector('[data-slot="secondary"]') as HTMLElement;
    expect(primary.className).toContain('truncate');
    expect(secondary.className).toContain('truncate');
    expect(primary.parentElement?.className).toContain('min-w-0');
  });

  test('有 onClick 时是 button，点击回调一次', () => {
    const onClick = vi.fn();
    render(<Row primary="点我" onClick={onClick} testId="row" />);
    const row = screen.getByTestId('row');
    expect(row.tagName).toBe('BUTTON');
    fireEvent.click(row);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('禁用态：不可点击且带禁用标记', () => {
    const onClick = vi.fn();
    render(<Row primary="点我" onClick={onClick} disabled testId="row" />);
    const row = screen.getByTestId('row') as HTMLButtonElement;
    expect(row.disabled).toBe(true);
    fireEvent.click(row);
    expect(onClick).not.toHaveBeenCalled();
  });

  test('没有 onClick 时是纯展示行，不产生多余按钮', () => {
    render(<Row primary="只展示" testId="row" />);
    expect(screen.getByTestId('row').tagName).toBe('DIV');
    expect(screen.queryByRole('button')).toBeNull();
  });

  test('触区高度来自 token（min-h-touch）', () => {
    render(<Row primary="触区" testId="row" />);
    expect(screen.getByTestId('row').className).toContain('min-h-touch');
  });
});
