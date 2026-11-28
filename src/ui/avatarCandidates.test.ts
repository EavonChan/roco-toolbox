import { describe, expect, test } from 'vitest';
import type { AccountSnapshot } from '../domain/parseBackup';
import { collectAvatarCandidates } from './avatarCandidates';

/**
 * 头像候选（2026-11-28）：只列本机已导入的精灵，不列全图鉴。
 * 蛋与母本都可能出现同一种，按 gameId 去重，先出现的名字优先。
 */
const owned = (gameId: number, name: string) => ({
  gameId,
  name,
  gender: '母' as const,
  nature: '开朗',
  voiceDb: 100,
  medalBody: '',
  isShiny: false,
  account: '甲',
});

const snapshot = (overrides: Partial<AccountSnapshot> = {}): AccountSnapshot => ({
  accountName: '甲',
  gameId: 1,
  exportedAt: '2026-11-28T00:00:00.000Z',
  importedAt: '2026-11-28T00:00:00.000Z',
  pets: [],
  eggs: [],
  ...overrides,
});

describe('头像候选：只来自本机已导入的精灵', () => {
  test('母本与蛋都算，按 gameId 去重、保留先出现的名字', () => {
    const candidates = collectAvatarCandidates([
      snapshot({ pets: [owned(3007, '魔力猫'), owned(3001, '喵喵')] }),
      snapshot({
        gameId: 2,
        pets: [owned(3003, '火花')],
        eggs: [{ petName: '喵喵（蛋）', weightGrams: 1, obtainedAt: '', speciesPetId: 3001 }],
      }),
    ]);

    expect(candidates).toEqual([
      { gameId: 3007, name: '魔力猫' },
      { gameId: 3001, name: '喵喵' },
      { gameId: 3003, name: '火花' },
    ]);
  });

  test('蛋没有名字时用图鉴名兜底；非法 gameId 跳过', () => {
    const candidates = collectAvatarCandidates([
      snapshot({
        pets: [owned(0, '坏数据')],
        eggs: [
          { petName: '', weightGrams: 1, obtainedAt: '', speciesPetId: 3001 },
          { petName: '无 id 蛋', weightGrams: 1, obtainedAt: '' },
        ],
      }),
    ]);

    expect(candidates).toEqual([{ gameId: 3001, name: '喵喵' }]);
  });

  test('没导入数据时是空列表（由面板给空态，不列全图鉴）', () => {
    expect(collectAvatarCandidates([])).toEqual([]);
  });
});
