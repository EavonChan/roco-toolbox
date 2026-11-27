import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { Section } from './Section';

describe('Section', () => {
  test('标题 / 说明 / 右侧动作 / 内容都渲染', () => {
    render(
      <Section title="今日待办" description="每 4 小时刷新一次" action={<span>3 项</span>}>
        <p>内容一</p>
      </Section>,
    );
    expect(screen.getByRole('heading', { name: '今日待办' })).toBeInTheDocument();
    expect(screen.getByText('每 4 小时刷新一次')).toBeInTheDocument();
    expect(screen.getByText('3 项')).toBeInTheDocument();
    expect(screen.getByText('内容一')).toBeInTheDocument();
  });

  test('没有内容时渲染空态，空态不会在页面里留下空壳', () => {
    render(<Section title="配窝建议" empty={<p>还没有可配的窝</p>} />);
    expect(screen.getByText('还没有可配的窝')).toBeInTheDocument();
  });

  test('有内容时空态不出现', () => {
    render(
      <Section title="配窝建议" empty={<p>还没有可配的窝</p>}>
        <p>真实的窝</p>
      </Section>,
    );
    expect(screen.getByText('真实的窝')).toBeInTheDocument();
    expect(screen.queryByText('还没有可配的窝')).toBeNull();
  });

  test('可折叠：默认展开，点「收起」后内容隐藏，aria-expanded 同步', () => {
    render(
      <Section title="筛选" collapsible>
        <p>筛选内容</p>
      </Section>,
    );
    const toggle = screen.getByRole('button', { name: '收起' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('筛选内容')).toBeVisible();

    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: '展开' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('筛选内容')).not.toBeVisible();
    // 标题行常驻，不会整块消失
    expect(screen.getByRole('heading', { name: '筛选' })).toBeInTheDocument();
  });

  test('可折叠 + defaultOpen=false 时一开始就收起，但内容仍在 DOM 里（可被读屏定位）', () => {
    render(
      <Section title="筛选" collapsible defaultOpen={false}>
        <p>筛选内容</p>
      </Section>,
    );
    expect(screen.getByRole('button', { name: '展开' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('筛选内容')).not.toBeVisible();
  });

  test('不可折叠时没有展开/收起按钮', () => {
    render(<Section title="静态">内容</Section>);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
