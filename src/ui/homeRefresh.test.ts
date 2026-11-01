import { afterEach, describe, expect, test } from 'vitest';
import type { AccountSnapshot } from '../domain/parseBackup';
import type { HomeSnapshot } from '../domain/types';
import { canRefreshHome, mergeHomeSnapshot } from './homeRefresh';

afterEach(() => {
  delete window.RocoCapture;
});

const home = (couples: number): HomeSnapshot => ({
  schemaVersion: 1,
  gameId: '1',
  capturedAt: '2026-11-01T00:00:00.000Z',
  residents: [],
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
});
