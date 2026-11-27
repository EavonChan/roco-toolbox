import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  test('一句事实 + 一个动作', () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        title="这个账号还没有蛋"
        action={{ label: '去导入数据', onClick }}
      />,
    );
    expect(screen.getByText('这个账号还没有蛋')).toBeInTheDocument();
    const button = screen.getByRole('button', { name: '去导入数据' });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  test('补充说明可选；不给就只有标题', () => {
    render(<EmptyState title="还没有配窝建议" description="换一个账号或等下次刷新" />);
    expect(screen.getByText('还没有配窝建议')).toBeInTheDocument();
    expect(screen.getByText('换一个账号或等下次刷新')).toBeInTheDocument();
  });

  test('没有动作时不出按钮（不硬塞「了解更多」）', () => {
    render(<EmptyState title="还没有数据" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  test('图标可选，且对读屏隐藏', () => {
    render(
      <EmptyState title="还没有数据" icon={<span data-testid="empty-icon">◇</span>} />,
    );
    expect(screen.getByTestId('empty-icon').parentElement).toHaveAttribute('aria-hidden', 'true');
  });

  test('样式只引 tokens，不写死像素', () => {
    render(<EmptyState title="还没有数据" testId="empty" />);
    const className = screen.getByTestId('empty').className;
    expect(className).toContain('rounded-tile');
    expect(className).toContain('border-line');
    expect(className).toContain('bg-surface-sunken');
    expect(className).not.toMatch(/\d+px/);
  });
});
