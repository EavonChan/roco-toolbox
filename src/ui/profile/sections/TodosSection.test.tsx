import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { TodosSection } from './TodosSection';
import { makeCtx } from '../testContext';
import type { ProfileTodos } from '../useProfileTodos';

afterEach(cleanup);

/** 待办数字（2026-11-28 用户口径）：只显示 >0 的项；全 0 收成一句话；收集进度不在这里。 */
const todos = (overrides: Partial<ProfileTodos> = {}): ProfileTodos => ({
  loaded: true,
  known: true,
  claims: 2,
  confirm: 1,
  nearbyTargets: 3,
  syncedAt: Date.UTC(2026, 10, 28, 4, 30),
  ...overrides,
});

describe('待处理数字区块', () => {
  test('有 >0 的项才显示，并且能解释「谁的数据 / 什么标准 / 什么时候」', () => {
    render(<TodosSection ctx={makeCtx({ todos: todos() })} />);

    expect(screen.getByTestId('profile-todo-claims')).toHaveTextContent('2 颗');
    expect(screen.getByTestId('profile-todo-claims')).toHaveTextContent('蛋仓');
    expect(screen.getByTestId('profile-todo-confirm')).toHaveTextContent('1 单');
    expect(screen.getByTestId('profile-todo-confirm')).toHaveTextContent('我这一侧还没确认');
    expect(screen.getByTestId('profile-todo-nearby')).toHaveTextContent('3 只');
    expect(screen.getByTestId('profile-todo-nearby')).toHaveTextContent('蹲守名单');
    // 收集进度已经移出「我的」
    expect(screen.queryByText('收集进度')).toBeNull();
  });

  test('0 的项不显示（不拿 0 占位）', () => {
    render(
      <TodosSection
        ctx={makeCtx({ todos: todos({ claims: 0, confirm: 0, nearbyTargets: 2 }) })}
      />,
    );

    expect(screen.queryByTestId('profile-todo-claims')).toBeNull();
    expect(screen.queryByTestId('profile-todo-confirm')).toBeNull();
    expect(screen.getByTestId('profile-todo-nearby')).toBeTruthy();
  });

  test('三项全为 0：收成一句「暂时没有需要处理的」', () => {
    render(
      <TodosSection
        ctx={makeCtx({ todos: todos({ claims: 0, confirm: 0, nearbyTargets: 0 }) })}
      />,
    );

    expect(screen.getByTestId('profile-todos-empty')).toHaveTextContent('暂时没有需要处理的');
  });

  test('每个数字都能点到对应位置', () => {
    const onGoEggStock = vi.fn();
    const onGoGroups = vi.fn();
    const onGoNearby = vi.fn();
    render(
      <TodosSection
        ctx={makeCtx({ todos: todos(), onGoEggStock, onGoGroups, onGoNearby })}
      />,
    );

    fireEvent.click(screen.getByTestId('profile-todo-claims'));
    fireEvent.click(screen.getByTestId('profile-todo-confirm'));
    fireEvent.click(screen.getByTestId('profile-todo-nearby'));

    expect(onGoEggStock).toHaveBeenCalledTimes(1);
    expect(onGoGroups).toHaveBeenCalledTimes(1);
    expect(onGoNearby).toHaveBeenCalledTimes(1);
  });

  test('服务端数字取不到（known=false）时只显示已知项，不编造 0', () => {
    render(
      <TodosSection
        ctx={makeCtx({ todos: todos({ known: false, claims: null, confirm: null, nearbyTargets: 1 }) })}
      />,
    );

    expect(screen.getByTestId('profile-todo-nearby')).toBeTruthy();
    expect(screen.queryByTestId('profile-todo-claims')).toBeNull();
    expect(screen.queryByTestId('profile-todos-empty')).toBeNull();
  });
});
