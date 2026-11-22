import { describe, expect, test } from 'vitest';
import { compactPetName } from './petNameLabel';

describe('compactPetName（卡片精简名）', () => {
  test('没有形态时原样返回', () => {
    expect(compactPetName('布是石')).toBe('布是石');
    expect(compactPetName('')).toBe('');
  });

  test('去掉「的样子」尾巴，用中点接形态', () => {
    expect(compactPetName('乌达_极夜的样子')).toBe('乌达·极夜');
    expect(compactPetName('小狮鹫_崖间地的样子')).toBe('小狮鹫·崖间地');
    expect(compactPetName('梦游_穿旧睡衣的样子')).toBe('梦游·穿旧睡衣');
  });

  test('去掉「形态」尾巴', () => {
    expect(compactPetName('水滴蛇_海神形态')).toBe('水滴蛇·海神');
    // 超 7 字退到基础名（`蹦蹦种子·海神球` 8 字，84px 宽放不下）
    expect(compactPetName('蹦蹦种子_海神球形态')).toBe('蹦蹦种子');
  });

  test('形态不是固定尾巴时保留原文', () => {
    expect(compactPetName('丢丢_草地附近的样子')).toBe('丢丢·草地附近');
    expect(compactPetName('海盔虫_本来的样子')).toBe('海盔虫·本来');
  });

  test('下划线后为空时不留下多余的点', () => {
    expect(compactPetName('布是石_')).toBe('布是石');
    expect(compactPetName('布是石_的样子')).toBe('布是石');
  });

  test('精简后仍超长时退到基础名，保证 10px 下不截断', () => {
    // 8 个字：`鸭吉吉·急急急鸭` 在 84px 宽的卡上会被截断
    expect(compactPetName('鸭吉吉_急急急鸭的样子')).toBe('鸭吉吉');
    // 刚好 7 个字以内保留形态
    expect(compactPetName('乌达_极夜的样子')).toBe('乌达·极夜');
  });
});
