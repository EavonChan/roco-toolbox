import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  test('指向「采集 / 登录同步」，而不是没有入口的「看板」或已删除的文件导入', () => {
    render(<EmptyState onGoImport={() => {}} />);
    const panel = screen.getByTestId('empty-state');
    expect(panel).toHaveTextContent('采集');
    expect(panel).toHaveTextContent('登录同一账号同步');
    expect(panel).not.toHaveTextContent('看板');
    expect(panel).not.toHaveTextContent('导入');
  });

  test('点「去采集 / 同步」触发跳转回调', () => {
    const onGoImport = vi.fn();
    render(<EmptyState onGoImport={onGoImport} />);
    expect(screen.getByTestId('empty-go-import')).toHaveTextContent('去采集 / 同步');
    fireEvent.click(screen.getByTestId('empty-go-import'));
    expect(onGoImport).toHaveBeenCalledTimes(1);
  });

  test('不给回调时不渲染跳转按钮（无法导航的场景只显示文案）', () => {
    render(<EmptyState />);
    expect(screen.queryByTestId('empty-go-import')).toBeNull();
    expect(screen.getByTestId('empty-state')).toHaveTextContent('还没有数据');
  });
});
