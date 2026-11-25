import { act, renderHook } from '@testing-library/react';
import { expect, test } from 'vitest';
import type { AccountSnapshot } from '../../domain/parseBackup';
import { eggCharactersOf } from './eggCharacter';
import { useEggStockCharacter } from './useEggStockCharacter';

/** 只要 accountKey + accountName：账号列表的顺序就是下拉的顺序（第一个主号）。 */
const snapshotsOf = (...names: string[]) => names.map((name, index) => ({
  accountKey: `uid:${index + 1}`, accountName: name,
})) as unknown as readonly AccountSnapshot[];

const eggOf = (key: string, id: string, accountName = '') => ({ id, gameAccountKey: key, accountName });

test('默认落在本机账号列表的第一个（主号），没有「全部角色」', () => {
  const { result } = renderHook(() => useEggStockCharacter({
    eggs: [eggOf('uid:1', 'a'), eggOf('uid:1', 'b'), eggOf('uid:2', 'c', '阿乙')],
    snapshots: snapshotsOf('阿甲', '阿乙'),
  }));
  expect(result.current.activeCharacter).toBe('uid:1');
  expect(result.current.characters).toEqual([
    { key: 'uid:1', name: '阿甲', count: 2 },
    { key: 'uid:2', name: '阿乙', count: 1 },
  ]);
});

test('主号一颗蛋都没有也不藏：仍在第一个、蛋数 0（「这个角色还没有蛋」靠它）', () => {
  const { result } = renderHook(() => useEggStockCharacter({
    eggs: [eggOf('uid:2', 'x', '阿乙')],
    snapshots: snapshotsOf('阿甲', '阿乙'),
  }));
  expect(result.current.characters).toEqual([
    { key: 'uid:1', name: '阿甲', count: 0 },
    { key: 'uid:2', name: '阿乙', count: 1 },
  ]);
  expect(result.current.activeCharacter).toBe('uid:1');
});

test('选中的角色从列表里消失（换号 / 换组）时回到第一个', () => {
  const { result, rerender } = renderHook(
    ({ snapshots, eggs }: { snapshots: readonly AccountSnapshot[]; eggs: ReturnType<typeof eggOf>[] }) =>
      useEggStockCharacter({ eggs, snapshots }),
    {
      initialProps: {
        snapshots: snapshotsOf('阿甲', '阿乙'),
        eggs: [eggOf('uid:1', 'a'), eggOf('uid:2', 'b', '阿乙')],
      },
    },
  );
  act(() => result.current.setCharacter('uid:2'));
  expect(result.current.activeCharacter).toBe('uid:2');
  // 换号后阿乙（uid:2）既不在账号列表里、蛋也没有了 → 回到主号
  rerender({ snapshots: snapshotsOf('阿甲'), eggs: [eggOf('uid:1', 'a')] });
  expect(result.current.activeCharacter).toBe('uid:1');
});

test('没有账号也没有蛋时列表为空、选中为空（标题行不出下拉）', () => {
  const { result } = renderHook(() => useEggStockCharacter({ eggs: [], snapshots: [] }));
  expect(result.current.characters).toEqual([]);
  expect(result.current.activeCharacter).toBe('');
});

test('和 eggCharactersOf 同一份口径（家园 / 广场两处调的是同一个函数）', () => {
  const snapshots = snapshotsOf('阿甲', '阿乙');
  const eggs = [eggOf('uid:1', 'a'), eggOf('uid:3', 'c', '阿丙')];
  const { result } = renderHook(() => useEggStockCharacter({ eggs, snapshots }));
  expect(result.current.characters).toEqual(eggCharactersOf(eggs, snapshots));
});
