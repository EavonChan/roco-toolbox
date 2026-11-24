import { expect, test } from 'vitest';
import type { AccountSnapshot } from '../../domain/parseBackup';
import { eggCharactersOf } from './eggCharacter';

const snapshotOf = (gameId: number, accountName: string): AccountSnapshot => ({
  accountName,
  gameId,
  accountKey: `uid:${gameId}`,
  exportedAt: '2026-11-24T00:00:00.000Z',
  importedAt: '2026-11-24T00:00:00.000Z',
  pets: [],
  eggs: [],
});

const egg = (gameAccountKey: string, accountName?: string) => ({
  gameAccountKey,
  ...(accountName ? { accountName } : {}),
});

test('角色顺序以本机账号列表为准（第一个是主号），每个角色的蛋数全算', () => {
  const eggs = [egg('uid:2'), egg('uid:2'), egg('uid:2'), egg('uid:2')];
  expect(eggCharactersOf(eggs, [snapshotOf(1, '阿甲'), snapshotOf(2, '阿乙')])).toEqual([
    { key: 'uid:1', name: '阿甲', count: 0 },
    { key: 'uid:2', name: '阿乙', count: 4 },
  ]);
});

test('蛋上出现、账号列表里没有的角色补在后面，名字用蛋上带的', () => {
  const eggs = [egg('uid:3', '阿丙'), egg('uid:1')];
  expect(eggCharactersOf(eggs, [snapshotOf(1, '阿甲')])).toEqual([
    { key: 'uid:1', name: '阿甲', count: 1 },
    { key: 'uid:3', name: '阿丙', count: 1 },
  ]);
});

test('账号列表里重名同 UID 只出现一次，也不会把蛋算丢', () => {
  const eggs = [egg('uid:1'), egg('uid:1')];
  expect(eggCharactersOf(eggs, [snapshotOf(1, '阿甲'), snapshotOf(1, '阿甲')])).toEqual([
    { key: 'uid:1', name: '阿甲', count: 2 },
  ]);
});
