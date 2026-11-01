import { describe, expect, test } from 'vitest';
import { eggWeightOf, requiredEggWeight } from './eggWeight';

describe('蛋重', () => {
  test('按蛋物种名取到区间与实际大小蛋重量，形态后缀自动去掉', () => {
    expect(eggWeightOf('火花')).toEqual({ min: 2.66, max: 3.4, small: 2.675, big: 3.385 });
    expect(eggWeightOf('火花_春节的样子')?.big).toBe(3.385);
    expect(eggWeightOf('还没收录的蛋')).toBeNull();
    expect(eggWeightOf(null)).toBeNull();
  });

  test('满体重要最大蛋重（区间上限）、零体重要最小蛋重（区间下限）；其他体型不写蛋重', () => {
    expect(requiredEggWeight('满体重', '火花')).toEqual({ kind: 'max', weight: 3.4 });
    expect(requiredEggWeight('零体重', '火花')).toEqual({ kind: 'min', weight: 2.66 });
    expect(requiredEggWeight('大块头', '火花')).toBeNull();
    expect(requiredEggWeight('满体重', '还没收录的蛋')).toBeNull();
  });

  test('水蓝蓝的区间上下限同样直接落地', () => {
    expect(requiredEggWeight('满体重', '水蓝蓝')?.weight).toBe(1.36);
    expect(requiredEggWeight('零体重', '水蓝蓝')?.weight).toBe(0.998);
  });
});
