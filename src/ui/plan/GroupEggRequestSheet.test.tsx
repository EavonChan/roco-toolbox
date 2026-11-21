import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { GroupEggRequestSheet } from './GroupEggRequestSheet';

const common = {
  open: true,
  eggGameId: 3227,
  name: '菊花梨',
  number: '027',
  eggGroups: ['植物组', '妖精组'],
  initialNatures: ['固执', '踏实'],
  publishedNatures: [],
  targetBody: '大块头' as const,
  targetVoice: '+100' as const,
  groups: [
    { id: 'g1', name: '周末互换' },
    { id: 'g2', name: '满重互助组' },
  ],
  groupId: 'g1',
  busy: false,
  error: '',
  onClose: vi.fn(),
  onGroupChange: vi.fn(),
  onPublish: vi.fn(),
};

test('小组求蛋自动带入声音和缺口性格，删除我的需求与性别', () => {
  render(<GroupEggRequestSheet {...common} />);
  expect(screen.getByRole('heading', { name: '小组求蛋' })).toBeTruthy();
  expect(screen.queryByText(/我的需求/)).toBeNull();
  expect(screen.queryByText('性别')).toBeNull();
  expect(screen.getByRole('button', { name: '+100' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button', { name: '固执' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('button', { name: '踏实' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByTestId('group-request-target-natures')).toHaveClass('flex-col');
});

test('大块头显示可选满体重，小不点显示可选零体重且默认不选', () => {
  const view = render(<GroupEggRequestSheet {...common} />);
  expect(screen.getByRole('button', { name: /满体重 100%/ }).getAttribute('aria-pressed')).toBe('false');
  view.rerender(<GroupEggRequestSheet {...common} targetBody="小不点" />);
  expect(screen.getByRole('button', { name: /零体重 0%/ }).getAttribute('aria-pressed')).toBe('false');
});

test('发布时带回已选性格、声音、可选体重和绿窝', () => {
  render(<GroupEggRequestSheet {...common} />);
  fireEvent.click(screen.getByRole('button', { name: /满体重 100%/ }));
  fireEvent.click(screen.getByRole('checkbox', { name: '绿窝' }));
  fireEvent.click(screen.getByRole('button', { name: /发布 2 条需求/ }));
  expect(common.onPublish).toHaveBeenCalledWith(
    ['固执', '踏实'],
    {
      body: '满体重',
      voice: '+100',
      requireGreenNest: true,
      groupId: 'g1',
    },
  );
});
