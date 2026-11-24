import { describe, expect, test } from 'vitest';
import { reminderSideText, reminderText } from './eggReminders';

describe('reminderText', () => {
  const sides = {
    requesterName: '石岚',
    targetName: '希恩',
    requesterLine: { eggGameId: 3266, nature: '聪明', body: '大块头', voice: '+100' },
    requesterEgg: { eggGameId: 3266, nature: '聪明', body: '大块头', voice: '+100' },
    targetLine: { eggGameId: 3003, nature: '开朗', body: '大块头', voice: '+100' },
    targetEgg: { eggGameId: 3003, nature: '开朗', body: '大块头', voice: '+100' },
  };

  test('发起人在前，两边各写档位 + 满分 + 性格 + 精灵名', () => {
    expect(reminderText(sides)).toBe(
      '大婉满分聪明胆小鳗鱼（石岚）换大婉满分开朗火花（希恩）的换蛋进度，请查看任务。',
    );
  });

  test('绿窝用 🟢绿窝 前缀，不加括号', () => {
    expect(reminderSideText(
      { eggGameId: 3266, nature: '聪明', body: '大块头', voice: '+100', greenParentId: 'p1' },
      null,
    )).toBe('🟢绿窝大婉满分聪明胆小鳗鱼');
  });

  test('满体重 / 零体重追加满重', () => {
    expect(reminderSideText(
      { eggGameId: 3266, nature: '聪明', body: '满体重', voice: '+100' },
      null,
    )).toBe('大婉满分满重聪明胆小鳗鱼');
    expect(reminderSideText(
      { eggGameId: 3266, nature: '聪明', body: '零体重', voice: '-100' },
      null,
    )).toBe('小粗满分满重聪明胆小鳗鱼');
  });

  test('没有档位时退回原始体型+声音，不编造', () => {
    expect(reminderSideText(
      { eggGameId: 3266, nature: '聪明', body: '', voice: '' },
      null,
    )).toBe('聪明胆小鳗鱼');
  });
});
