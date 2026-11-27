import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { Card } from './Card';

describe('Card', () => {
  test('标题行：标题 + 右侧动作 + 内容都在', () => {
    render(
      <Card title="今日配窝" action={<span>3 窝</span>} testId="card">
        内容
      </Card>,
    );
    expect(screen.getByRole('heading', { name: '今日配窝' })).toBeInTheDocument();
    expect(screen.getByText('3 窝')).toBeInTheDocument();
    expect(screen.getByText('内容')).toBeInTheDocument();
  });

  test('没有标题也没有动作时不出标题行，只留内容', () => {
    render(<Card testId="card">只有内容</Card>);
    const card = screen.getByTestId('card');
    expect(card.querySelector('h3')).toBeNull();
    expect(screen.getByText('只有内容')).toBeInTheDocument();
  });

  test('dense 只改内边距，用 data-dense 标记', () => {
    const { rerender } = render(<Card testId="card">内容</Card>);
    expect(screen.getByTestId('card')).not.toHaveAttribute('data-dense');
    expect(screen.getByTestId('card').className).toContain('p-s3');

    rerender(
      <Card testId="card" dense>
        内容
      </Card>,
    );
    expect(screen.getByTestId('card')).toHaveAttribute('data-dense', 'true');
    expect(screen.getByTestId('card').className).toContain('p-s2');
  });

  test('headingLevel 决定标题语义层级', () => {
    render(
      <Card title="二级" headingLevel={2}>
        内容
      </Card>,
    );
    expect(screen.getByRole('heading', { level: 2, name: '二级' })).toBeInTheDocument();
  });

  test('视觉只引 tokens：圆角/描边/底色/阴影来自 class，不写死像素', () => {
    render(<Card testId="card">内容</Card>);
    const className = screen.getByTestId('card').className;
    expect(className).toContain('rounded-card');
    expect(className).toContain('border-line');
    expect(className).toContain('bg-surface');
    expect(className).toContain('shadow-card');
    expect(className).not.toMatch(/\d+px/);
  });
});
