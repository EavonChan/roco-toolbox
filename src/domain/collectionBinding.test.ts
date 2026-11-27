import { describe, expect, test } from 'vitest';
import { bindingStateOf, unbindConfirmText } from './collectionBinding';

describe('绑定选号四态（2026-11-27）', () => {
  test('已发布的号：勾着是「已绑定」，取消是「将解绑」', () => {
    expect(bindingStateOf({ selected: true, published: true })).toBe('已绑定');
    expect(bindingStateOf({ selected: false, published: true })).toBe('将解绑');
  });

  test('没发布过的号：勾上是「将绑定」，没勾是「未绑定」', () => {
    expect(bindingStateOf({ selected: true, published: false })).toBe('将绑定');
    expect(bindingStateOf({ selected: false, published: false })).toBe('未绑定');
  });

  test('解绑确认文案要把号名列出来，并写明机器人认不到', () => {
    const text = unbindConfirmText(['主号', '小号']);
    expect(text).toContain('主号、小号');
    expect(text).toContain('2 个号');
    expect(text).toContain('认不到');
  });
});
