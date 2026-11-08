import { describe, expect, test } from 'vitest';
import {
  mergeEncounterDetail,
  mergeSeasonEncounterUnit,
  type OwnedPetDetailRaw,
  type SeasonEncounterRaw,
} from '../pcap-decoder/tools/pcap-json-app/src/core';

/**
 * 2026-11-08 线上反馈：奇遇奖励「深蓝鲸」抓到后仍显示「性格未知」。
 * 抓包里这只个体（3381 / 41 级 / 239 / 677450 / 母 / 血 24 / 声 71）出现 8 次，
 * field7 全是 30 占位 —— 那份抓包在捕获后只多录了 45 帧、没有背包同步，属于客观缺失。
 * 但顺带发现真漏洞：捕获记录里带真实性格时，我们没有回填到奇遇卡。下面锁住这条回填规则。
 */

const encounter = (overrides: Partial<SeasonEncounterRaw> = {}): SeasonEncounterRaw => ({
  formId: 1646,
  guardName: '龙棋士',
  unitId: 9006,
  level: 41,
  natureId: 30,
  natureConfirmed: false,
  genderId: 2,
  height: 239,
  weight: 677450,
  bloodId: 24,
  voiceDb: 71,
  ...overrides,
});

const detail = (overrides: Partial<OwnedPetDetailRaw> = {}): OwnedPetDetailRaw => ({
  petId: 3381,
  level: 41,
  height: 239,
  weight: 677450,
  natureId: 30,
  genderId: 2,
  bloodId: 24,
  voiceDb: 71,
  ...overrides,
});

describe('奇遇卡的性格回填', () => {
  test('捕获记录带真实性格时补到奇遇卡，并换成真实 petId', () => {
    const merged = mergeEncounterDetail(encounter(), detail({ natureId: 6 }));
    expect(merged).toMatchObject({ unitId: 3381, natureId: 6, natureConfirmed: true, voiceDb: 71 });
  });

  test('记录里还是 30 占位时保持「未确认」，不把占位当性格', () => {
    const merged = mergeEncounterDetail(encounter(), detail());
    expect(merged).toMatchObject({ unitId: 3381, natureId: 30, natureConfirmed: false });
  });

  test('已确认的性格不会被之后的占位记录冲掉', () => {
    const confirmed = encounter({ natureId: 6, natureConfirmed: true });
    const merged = mergeEncounterDetail(confirmed, detail());
    expect(merged).toMatchObject({ natureId: 6, natureConfirmed: true });
  });

  test('不是同一只个体（等级/身高/体重不同）时不回填', () => {
    const original = encounter();
    expect(mergeEncounterDetail(original, detail({ level: 43 }))).toBe(original);
    expect(mergeEncounterDetail(original, detail({ weight: 681680 }))).toBe(original);
  });

  test('同场战斗的重复帧不会把真实性格冲回占位', () => {
    const previous = encounter({ unitId: 3381, natureId: 6, natureConfirmed: true });
    const merged = mergeSeasonEncounterUnit(previous, encounter());
    expect(merged).toMatchObject({ natureId: 6, natureConfirmed: true });
  });

  test('换个体时整张卡替换', () => {
    const previous = encounter({ natureId: 6, natureConfirmed: true });
    const next = encounter({ unitId: 3011, level: 52, height: 200, weight: 645561, natureId: 14, natureConfirmed: true });
    expect(mergeSeasonEncounterUnit(previous, next)).toMatchObject({ unitId: 3011, natureId: 14, level: 52 });
  });
});
