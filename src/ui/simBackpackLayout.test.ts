import { describe, expect, test } from 'vitest';
import type { OwnedPet } from '../domain/types';
import { buildSimBackpack, SIM_BAG_SLOTS } from './simBackpackLayout';

function pet(overrides: Partial<OwnedPet> & { name: string }): OwnedPet {
  return {
    gameId: 1,
    gender: '母',
    nature: '开朗',
    voiceDb: 0,
    medalBody: '',
    isShiny: false,
    account: '账号甲',
    ...overrides,
  };
}

describe('buildSimBackpack（仿真背包分页 / 落位）', () => {
  test('一页 30 格，按 slotOrder 落位，空位保留', () => {
    const pages = buildSimBackpack(
      [
        pet({ name: '一号', boxGroup: '盒子01', boxNumber: 1, slotOrder: 1 }),
        pet({ name: '七号', boxGroup: '盒子01', boxNumber: 1, slotOrder: 7 }),
        pet({ name: '三十号', boxGroup: '盒子01', boxNumber: 1, slotOrder: 30 }),
      ],
      ['账号甲'],
    )[0].pages;

    expect(pages).toHaveLength(1);
    expect(pages[0].label).toBe('盒子01');
    expect(pages[0].slots).toHaveLength(SIM_BAG_SLOTS);
    expect(pages[0].slots[0]).toMatchObject({ slot: 1, pet: { name: '一号' } });
    expect(pages[0].slots[6]).toMatchObject({ slot: 7, pet: { name: '七号' } });
    expect(pages[0].slots[29]).toMatchObject({ slot: 30, pet: { name: '三十号' } });
    expect(pages[0].slots[1].pet).toBeNull();
    expect(pages[0].filled).toBe(3);
  });

  test('盒子按序号升序，盒外精灵排在最后', () => {
    const pages = buildSimBackpack(
      [
        pet({ name: '外一', boxGroup: '盒外精灵' }),
        pet({ name: '二盒', boxGroup: '盒子02', boxNumber: 2, slotOrder: 1 }),
        pet({ name: '一盒', boxGroup: '盒子01', boxNumber: 1, slotOrder: 1 }),
      ],
      ['账号甲'],
    )[0].pages;

    expect(pages.map((page) => page.label)).toEqual(['盒子01', '盒子02', '盒外精灵']);
    expect(pages.map((page) => page.kind)).toEqual(['box', 'box', 'offbox']);
    expect(pages[2].slots[0].pet?.name).toBe('外一');
  });

  test('格号缺失 / 越界 / 重复时不丢精灵，退回第一个空格', () => {
    const pages = buildSimBackpack(
      [
        pet({ name: '五号', boxGroup: '盒子01', boxNumber: 1, slotOrder: 5 }),
        pet({ name: '重复五号', boxGroup: '盒子01', boxNumber: 1, slotOrder: 5 }),
        pet({ name: '越界', boxGroup: '盒子01', boxNumber: 1, slotOrder: 99 }),
        pet({ name: '无格号', boxGroup: '盒子01', boxNumber: 1 }),
      ],
      ['账号甲'],
    )[0].pages;

    const filled = pages[0].slots.flatMap((slot) => (slot.pet ? [slot.pet.name] : []));
    expect(pages[0].filled).toBe(4);
    // 五号占住真实格号 5；其余三只按顺序补 1 / 2 / 3
    expect(pages[0].slots[4].pet?.name).toBe('五号');
    expect(filled).toEqual(['重复五号', '越界', '无格号', '五号']);
  });

  test('多账号分开生成，顺序按传入的账号顺序', () => {
    const bags = buildSimBackpack(
      [
        pet({ name: '甲的精灵', account: '账号甲', boxGroup: '盒子01', boxNumber: 1, slotOrder: 1 }),
        pet({ name: '乙的精灵', account: '账号乙', boxGroup: '盒子01', boxNumber: 1, slotOrder: 1 }),
      ],
      ['账号乙', '账号甲'],
    );

    expect(bags.map((bag) => bag.account)).toEqual(['账号乙', '账号甲']);
    expect(bags[0].pages[0].slots[0].pet?.name).toBe('乙的精灵');
    expect(bags[1].pages[0].slots[0].pet?.name).toBe('甲的精灵');
  });

  test('盒外精灵超过 30 只自动续页', () => {
    const offbox = Array.from({ length: 31 }, (_, index) =>
      pet({ name: `外${index + 1}`, boxGroup: '盒外精灵' }),
    );
    const pages = buildSimBackpack(offbox, ['账号甲'])[0].pages;

    expect(pages.map((page) => page.label)).toEqual(['盒外精灵', '盒外精灵 2']);
    expect(pages[0].filled).toBe(30);
    expect(pages[1].filled).toBe(1);
    expect(pages[1].slots[0].pet?.name).toBe('外31');
  });

  test('没有精灵的账号返回空页列表', () => {
    expect(buildSimBackpack([], ['账号甲'])[0].pages).toEqual([]);
  });
});
