import { beforeEach, describe, expect, test } from 'vitest';
import { clearDemandPicks, pickEggIdOf, readDemandPicks, writeDemandPicks } from './demandPickStore';

beforeEach(() => window.localStorage.clear());

describe('种公需求「用哪颗蛋接单」的本机记忆', () => {
  test('没选过时返回空表', () => {
    expect(readDemandPicks()).toEqual({});
  });

  test('同一需求重复 pick 幂等，只留最后一次', () => {
    writeDemandPicks({ 'g1|m1|100:固执:母': 200 });
    writeDemandPicks({ 'g1|m1|100:固执:母': 200 });
    expect(readDemandPicks()).toEqual({ 'g1|m1|100:固执:母': 200 });

    writeDemandPicks({ 'g1|m1|100:固执:母': 300 });
    expect(readDemandPicks()).toEqual({ 'g1|m1|100:固执:母': 300 });
  });

  test('记「某一对亲本」时原样读回，蛋 id 仍能取到', () => {
    writeDemandPicks({
      k: { eggGameId: 901, motherCaptureId: 'cap-m', fatherCaptureId: 'cap-f' },
    });
    expect(readDemandPicks()).toEqual({
      k: { eggGameId: 901, motherCaptureId: 'cap-m', fatherCaptureId: 'cap-f' },
    });
    expect(pickEggIdOf({ eggGameId: 901 })).toBe(901);
    expect(pickEggIdOf(902)).toBe(902);
    expect(pickEggIdOf(undefined)).toBeUndefined();
  });

  test('坏数据与非数字值被过滤，不影响接单', () => {
    window.localStorage.setItem(
      'roco.demandPick',
      JSON.stringify({ ok: 200, bad: '200', nan: Number.NaN }),
    );
    expect(readDemandPicks()).toEqual({ ok: 200 });

    window.localStorage.setItem('roco.demandPick', 'not-json');
    expect(readDemandPicks()).toEqual({});
  });

  test('重置导入数据时能清掉', () => {
    writeDemandPicks({ k: 200 });
    clearDemandPicks();
    expect(readDemandPicks()).toEqual({});
  });
});
