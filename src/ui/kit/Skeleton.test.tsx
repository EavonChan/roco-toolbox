import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { Skeleton } from './Skeleton';

describe('Skeleton', () => {
  test('默认一行，读屏只念一次「加载中」，占位条对读屏隐藏', () => {
    render(<Skeleton testId="sk" />);
    expect(screen.getByRole('status', { name: '加载中' })).toHaveAttribute('aria-busy', 'true');
    const bars = screen.getByTestId('sk').querySelectorAll('[data-slot="bar"]');
    expect(bars).toHaveLength(1);
    expect(bars[0]).toHaveAttribute('aria-hidden', 'true');
  });

  test('多行时最后一行自动半宽，像真实段落', () => {
    render(<Skeleton lines={3} testId="sk" />);
    expect(screen.getByTestId('sk')).toHaveAttribute('data-lines', '3');
    const bars = Array.from(screen.getByTestId('sk').querySelectorAll('[data-slot="bar"]'));
    expect(bars).toHaveLength(3);
    expect(bars[0].className).toContain('w-full');
    expect(bars[2].className).toContain('w-1/2');
  });

  test('高度来自 token：行 / 列表行 / 卡片', () => {
    const { rerender } = render(<Skeleton height="line" testId="sk" />);
    expect(screen.getByTestId('sk').querySelector('[data-slot="bar"]')?.className).toContain('h-s3');

    rerender(<Skeleton height="row" testId="sk" />);
    expect(screen.getByTestId('sk').querySelector('[data-slot="bar"]')?.className).toContain(
      'min-h-touch',
    );

    rerender(<Skeleton height="card" testId="sk" />);
    expect(screen.getByTestId('sk').querySelector('[data-slot="bar"]')?.className).toContain(
      'min-h-skeleton-card',
    );
  });

  test('显式 width 覆盖最后一行的半宽规则', () => {
    render(<Skeleton lines={2} width="three-quarters" testId="sk" />);
    const bars = Array.from(screen.getByTestId('sk').querySelectorAll('[data-slot="bar"]'));
    expect(bars.every((bar) => bar.className.includes('w-3/4'))).toBe(true);
  });

  test('lines 至少 1 行（0 或负数不会出现空骨架）', () => {
    render(<Skeleton lines={0} testId="sk" />);
    expect(screen.getByTestId('sk').querySelectorAll('[data-slot="bar"]')).toHaveLength(1);
  });
});
