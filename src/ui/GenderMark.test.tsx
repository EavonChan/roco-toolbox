import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { GenderMark } from './GenderMark';

afterEach(cleanup);

describe('性别图标', () => {
  test('统一成 12px 小圆片：母粉 / 公蓝 / 未知灰（2026-11-01）', () => {
    const { container } = render(
      <>
        <GenderMark gender="母" />
        <GenderMark gender="公" />
        <GenderMark gender="未知" />
      </>,
    );
    const [female, male, unknown] = Array.from(container.querySelectorAll('span'));
    for (const node of [female, male, unknown]) {
      expect(node.className).toContain('h-3');
      expect(node.className).toContain('w-3');
      expect(node.className).toContain('rounded-full');
    }
    expect(female).toHaveTextContent('♀');
    expect(female.className).toContain('bg-pink-100');
    expect(male).toHaveTextContent('♂');
    expect(male.className).toContain('bg-sky-100');
    expect(unknown).toHaveTextContent('?');
    expect(unknown.className).toContain('bg-slate-100');
    expect(screen.getByTitle('性别未知')).toBeTruthy();
  });
});
