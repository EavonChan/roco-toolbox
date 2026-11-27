import { afterEach, describe, expect, test } from 'vitest';
import type { AccountSnapshot } from '../domain/parseBackup';
import type { HomeSnapshot, OwnedPet } from '../domain/types';
import { canRefreshHome, mergeHomeSnapshot } from './homeRefresh';

afterEach(() => {
  delete window.RocoCapture;
});

const home = (couples: number, residentIds: readonly string[] = []): HomeSnapshot => ({
  schemaVersion: 1,
  gameId: '1',
  capturedAt: '2026-11-01T00:00:00.000Z',
  residents: residentIds.map((instanceId) => ({
    instanceId,
    baseId: '3436',
    furnitureGuid: `nest_${instanceId}`,
    actorId: `actor_${instanceId}`,
    name: '',
  })),
  nests: [],
  layEggCouples: Array.from({ length: couples }, (_, index) => ({
    femaleActorId: `f${index}`,
    maleActorIds: [`m${index}`],
  })),
  sceneEggs: [],
  couplesStale: false,
});

const snapshot = (over: Partial<AccountSnapshot> = {}): AccountSnapshot => ({
  accountName: '账号A',
  gameId: 1,
  accountKey: 'uid:1',
  exportedAt: '2026-10-01T00:00:00.000Z',
  importedAt: '2026-10-01T00:00:00.000Z',
  pets: [
    {
      gameId: 3001,
      name: '喵喵',
      gender: '母',
      nature: '胆小',
      voiceDb: 100,
      medalBody: '大块头',
      weightPercent: 90,
      heightPercent: 90,
      isShiny: false,
      account: '账号A',
      captureId: 'cap_1',
    },
  ],
  eggs: [],
  ...over,
});

describe('家园轻量刷新', () => {
  /** 抓包里的一只精灵：`captureId` 是「capture_账号_实例号」，实例号正是家园住户的 instanceId。 */
  const pet = (instanceId: string, over: Partial<OwnedPet> = {}): OwnedPet => ({
    gameId: 3436,
    name: '柴渣虫',
    gender: '母',
    nature: '平和',
    voiceDb: 100,
    medalBody: '大块头',
    weightPercent: 98,
    heightPercent: 100,
    isShiny: false,
    account: '账号A',
    captureId: `capture_293143_${instanceId}`,
    ...over,
  });

  /** 旧快照里的 11 只：11-25 那份 613 只背包里的住户。 */
  const oldIds = Array.from({ length: 11 }, (_, index) => String(60001 + index));

  test('浏览器里没有采集桥时不可用', () => {
    expect(canRefreshHome()).toBe(false);
    window.RocoCapture = { getState: () => '{}' };
    expect(canRefreshHome()).toBe(false);
    window.RocoCapture = { getState: () => '{}', startCapture: () => '' };
    expect(canRefreshHome()).toBe(true);
  });

  test('只把家园合并进已有快照，宠物和蛋原样保留', () => {
    const existing = snapshot({ home: home(1) });
    const incoming = snapshot({ pets: [], home: home(3) });

    const merged = mergeHomeSnapshot(incoming, existing);
    expect(merged).not.toBeNull();
    expect(merged?.home?.layEggCouples).toHaveLength(3);
    expect(merged?.pets).toHaveLength(1);
    expect(merged?.accountName).toBe('账号A');
  });

  test('没读到家园（还没进场景）时不合并、也不覆盖旧数据', () => {
    const existing = snapshot({ home: home(1) });
    const incoming = snapshot({ home: undefined });
    expect(mergeHomeSnapshot(incoming, existing)).toBeNull();
  });

  test('本机没有这个账号时不凭空建号', () => {
    const incoming = snapshot({ pets: [], home: home(2) });
    expect(mergeHomeSnapshot(incoming, undefined)).toBeNull();
  });

  /**
   * 2026-11-27 用户报的「刷新家园后新住户的精灵信息丢失」：
   * 旧快照 11 只住户，这次家园有 13 只（新增 67284 / 67288 两只母本），
   * 刷新只并 home 时新住户查不到背包记录 → 卡片名字退化成「精灵 <actorId>」。
   */
  test('刷新时把这次抓到的背包并进来：新住户能匹配到 pet', () => {
    const newIds = ['67284', '67288'];
    const existing = snapshot({ home: home(6, oldIds), pets: oldIds.map((id) => pet(id)) });
    const incoming = snapshot({
      home: home(7, [...oldIds, ...newIds]),
      pets: newIds.map((id) => pet(id)),
    });

    const merged = mergeHomeSnapshot(incoming, existing);
    expect(merged?.pets).toHaveLength(13);
    // 旧快照原顺序在前、新追加的在后面：家园卡列表不会因为刷新跳序
    expect(merged?.pets.map((item) => item.captureId)).toEqual([
      ...oldIds.map((id) => `capture_293143_${id}`),
      ...newIds.map((id) => `capture_293143_${id}`),
    ]);
    // 新住户靠 instanceId（= captureId 最后一段）就能匹配到这只：名字 / 性格 / 身高体重都回来了
    const byInstance = new Map(
      merged?.pets.map((item) => [item.captureId?.split('_').pop() ?? '', item]) ?? [],
    );
    for (const resident of incoming.home?.residents ?? []) {
      expect(byInstance.get(resident.instanceId)?.name).toBe('柴渣虫');
    }
  });

  test('只增不减：这次没拍到的旧精灵仍然保留（不把已放生 / 短采集当删除）', () => {
    const existing = snapshot({ home: home(6, oldIds), pets: oldIds.map((id) => pet(id)) });
    const keptIds = oldIds.slice(0, 8);
    const incoming = snapshot({
      home: home(6, oldIds),
      pets: keptIds.map((id) => pet(id, { nature: '固执' })),
    });

    const merged = mergeHomeSnapshot(incoming, existing);
    expect(merged?.pets).toHaveLength(11);
    const byCaptureId = new Map(merged?.pets.map((item) => [item.captureId ?? '', item]) ?? []);
    for (const id of oldIds.slice(8)) {
      expect(byCaptureId.get(`capture_293143_${id}`)?.name).toBe('柴渣虫');
    }
    // 这次拍到的 8 只用新值
    expect(byCaptureId.get(`capture_293143_${keptIds[0]}`)?.nature).toBe('固执');
  });

  test('同一只精灵这次拍到了新属性：用新值覆盖旧值，不重复追加', () => {
    const existing = snapshot({
      home: home(1),
      pets: [pet('63748', { nature: '平和', voiceDb: 100 })],
    });
    const incoming = snapshot({
      home: home(1),
      pets: [pet('63748', { nature: '固执', voiceDb: 97 })],
    });

    const merged = mergeHomeSnapshot(incoming, existing);
    expect(merged?.pets).toHaveLength(1);
    expect(merged?.pets[0].nature).toBe('固执');
    expect(merged?.pets[0].voiceDb).toBe(97);
  });

  test('这次没采到三维时保留旧的三维（2026-11-24 口径：没采到 ≠ 没有）', () => {
    const existing = snapshot({
      home: home(1),
      pets: [pet('63748', { individualBonuses: [{ name: '生命', value: 9 }] })],
    });
    const incoming = snapshot({ home: home(1), pets: [pet('63748', { nature: '固执' })] });

    const merged = mergeHomeSnapshot(incoming, existing);
    expect(merged?.pets[0].individualBonuses).toEqual([{ name: '生命', value: 9 }]);
    expect(merged?.pets[0].nature).toBe('固执');
  });
});
