import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { createDemand } from '../../shared/eggMatching';
import { MotherCollectingView } from './MotherCollectingView';

vi.mock('../useSnapshots', () => ({
  useSnapshots: () => ({ snapshots: [] }),
}));

vi.mock('../motherPlanStore', () => ({
  useMotherPlan: () => ['egg:3227'],
}));

vi.mock('../useCollectionGroups', () => ({
  useCollectionGroups: () => ({
    accountId: 'me',
    currentGroupId: 'g1',
    currentGroup: {
      group: { id: 'g1', name: '周末互换' },
      members: [
        { accountId: 'me', displayName: '我' },
        { accountId: 'b', displayName: '小布' },
      ],
    },
    groups: [{ id: 'g1', name: '周末互换' }],
    selectGroup: vi.fn(),
  }),
}));

vi.mock('./useEggMatching', () => ({
  useEggMatching: () => ({
    data: {
      version: 1,
      state: {
        demands: [
          createDemand({
            id: 'd1',
            groupId: 'g1',
            demanderAccountId: 'me',
            eggGameId: 3227,
            natures: ['固执'],
            body: '大块头',
            voice: '+100',
            quantity: 1,
          }),
        ],
        trades: [],
        eggs: [],
        lines: [],
      },
    },
    loading: false,
    busy: false,
    error: null,
    refresh: vi.fn(),
    mutate: vi.fn(),
  }),
}));

const groups = [{
  chainKey: 'egg:3227',
  eggGameId: 3227,
  collected: false,
  quality: false,
  motherClass: null,
  formLabel: '菊花梨',
  number: '027',
  eggGroups: [2],
  memberIndexes: [],
}];

test('收集中使用四列母本卡，不按蛋组聚合，并可打开小组求蛋', () => {
  render(
    <MotherCollectingView
      motherGroups={groups}
      missingNaturesByEgg={new Map([[3227, ['固执']]])}
      eggGroupNames={{ 2: '植物组' }}
      targetBody="大块头"
      targetVoice="+100"
      mode="perfect"
      onNavigate={vi.fn()}
    />,
  );
  const list = screen.getByTestId('mother-collecting-cards');
  expect(list).toHaveClass('grid-cols-4');
  expect(screen.queryByTestId('mother-chain-group-2')).toBeNull();
  expect(screen.getByText('已发布')).toBeTruthy();
  fireEvent.click(screen.getByTestId('mother-collecting-card'));
  expect(screen.getByRole('heading', { name: '小组求蛋' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '+100' }).getAttribute('aria-pressed')).toBe('true');
});

test('收集中卡整卡白底，底条按状态上色（不再一律天蓝）', () => {
  render(
    <MotherCollectingView
      motherGroups={groups}
      missingNaturesByEgg={new Map([[3227, ['固执']]])}
      eggGroupNames={{ 2: '植物组' }}
      targetBody="大块头"
      targetVoice="+100"
      mode="perfect"
      onNavigate={vi.fn()}
    />,
  );
  const card = screen.getByTestId('mother-collecting-card');
  // testId 落在卡片本体（article）上
  expect(card.tagName).toBe('ARTICLE');
  expect(card.className).toContain('bg-white');
  expect(card.className).not.toContain('bg-sky-50');
  // 已发布 = 天蓝底条（底条颜色是状态通道，整卡底色不再是）
  const footer = within(card).getByTestId('pet-card-footer');
  expect(footer.firstElementChild!.className).toContain('bg-sky-50');
});

test('小组筛选在上、状态快速筛选在下，状态项自带数字', () => {
  render(
    <MotherCollectingView
      motherGroups={groups}
      missingNaturesByEgg={new Map([[3227, ['固执']]])}
      eggGroupNames={{ 2: '植物组' }}
      targetBody="大块头"
      targetVoice="+100"
      mode="perfect"
      onNavigate={vi.fn()}
    />,
  );
  const groupBar = screen.getByTestId('mother-collecting-groups');
  const statusBar = screen.getByTestId('mother-collecting-status');
  // 小组筛选必须排在状态筛选前面（用户 2026-11-22 口径）
  expect(groupBar.compareDocumentPosition(statusBar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(within(statusBar).getByTestId('collecting-status-all')).toHaveTextContent('全部 1');
  expect(within(statusBar).getByTestId('collecting-status-published')).toHaveTextContent('已发布 1');
});
