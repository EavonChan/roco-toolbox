import { describe, expect, test } from 'vitest';
import {
  accountTabColumns,
  compareAccountNames,
  sortAccountNames,
  sortByAccountName,
} from './accountOrder';

describe('账号名自然排序', () => {
  test('名字里的数字按数值排：账号2 在 账号10 前面', () => {
    const names = ['账号10', '账号2', '账号1'];
    expect([...names].sort(compareAccountNames)).toEqual(['账号1', '账号2', '账号10']);
  });

  test('名字里有数字的先按数字排，没有数字的排前面、彼此按拼音', () => {
    const names = ['小号B', '小号A10', '小号A2', '大号'];
    expect([...names].sort(compareAccountNames)).toEqual(['大号', '小号B', '小号A2', '小号A10']);
  });

  test('真实账号名：莱茵 → 2号 → 3号 → … → 6号，不被前缀拼音挤到后面', () => {
    const names = ['洛乌（6号）', '洛伞（4号）', '洛迩（3号）', '洛筱（2号）', '莱茵', '洛丝（5号）'];
    expect([...names].sort(compareAccountNames)).toEqual([
      '莱茵',
      '洛筱（2号）',
      '洛迩（3号）',
      '洛伞（4号）',
      '洛丝（5号）',
      '洛乌（6号）',
    ]);
  });

  test('不改原数组', () => {
    const names = ['账号2', '账号1'];
    [...names].sort(compareAccountNames);
    expect(names).toEqual(['账号2', '账号1']);
  });

  test('重名时补的 (UID) 后缀不当成账号号：小号(10086) 仍排在最前', () => {
    const names = ['3号', '小号(10086)', '2号'];
    expect(sortAccountNames(names)).toEqual(['小号(10086)', '2号', '3号']);
  });

  test('sortAccountNames 排序且不改原数组', () => {
    const names = ['10号', '2号'];
    expect(sortAccountNames(names)).toEqual(['2号', '10号']);
    expect(names).toEqual(['10号', '2号']);
  });

  test('sortByAccountName 给任意账号对象列表排序', () => {
    const accounts = [{ name: '洛乌（6号）' }, { name: '洛筱（2号）' }, { name: '莱茵' }];
    expect(sortByAccountName(accounts, (account) => account.name).map((account) => account.name)).toEqual([
      '莱茵',
      '洛筱（2号）',
      '洛乌（6号）',
    ]);
  });
});

describe('账号格一行放几个', () => {
  test('短名字放得下 → 一行 3 个', () => {
    expect(accountTabColumns(['账号甲 0 窝', '账号乙 0 窝', '账号丙 0 窝'], 327)).toBe(3);
  });

  test('有 6 个字的账号名，3 个放不下 → 一行 2 个', () => {
    expect(accountTabColumns(['我的小号一号 0 窝', '小号 0 窝'], 327)).toBe(2);
  });

  test('超长账号名连 2 个都放不下 → 一行 1 个，名字不换行', () => {
    expect(accountTabColumns(['这是一个非常非常长的账号名字 12 窝'], 327)).toBe(1);
  });

  test('还没量到宽度（0）时先按 3 个排，量完再收', () => {
    expect(accountTabColumns(['账号甲 0 窝'], 0)).toBe(3);
  });
});
