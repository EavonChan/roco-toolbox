import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { AccountSnapshot } from '../domain/parseBackup';
import { applySnapshot, buildSnapshot } from './sync';
import {
  PROFILE_AVATAR_KEY,
  parseProfileAvatar,
  readProfileAvatar,
  serializeProfileAvatar,
  writeProfileAvatar,
} from './profileAvatar';

/**
 * 头像偏好（2026-11-28 拍板：A + 云端 + 点头像直接换）。
 *
 * 头像值里带账号 id：同一台设备换账号时，旧账号的头像不算数；
 * 同步只上传/接受「属于当前账号」的值，避免把 A 的头像塞进 B 的云端快照。
 */
const pet = (gameId: number) => ({ kind: 'pet' as const, gameId });

const snapshotWith = (accountName: string, gameId: number, exportedAt: string): AccountSnapshot => ({
  accountName,
  gameId,
  exportedAt,
  importedAt: exportedAt,
  pets: [
    {
      gameId: 3001,
      name: '喵喵',
      gender: '母',
      nature: '开朗',
      voiceDb: 100,
      medalBody: '',
      isShiny: false,
      account: accountName,
    },
  ],
  eggs: [],
});

describe('头像偏好的账号归属', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('序列化带账号 id；同一份值只对写入时的账号有效', () => {
    const raw = serializeProfileAvatar('acc-1', pet(3007));
    expect(parseProfileAvatar(raw, 'acc-1')).toEqual(pet(3007));
    // 换账号后旧值不算数（本机不显示别人的头像）
    expect(parseProfileAvatar(raw, 'acc-2')).toBeNull();
    expect(parseProfileAvatar(raw, null)).toBeNull();
  });

  test('坏值 / 其它形态一律当成没设置，不抛错', () => {
    expect(parseProfileAvatar(null, 'acc-1')).toBeNull();
    expect(parseProfileAvatar('', 'acc-1')).toBeNull();
    expect(parseProfileAvatar('not-json', 'acc-1')).toBeNull();
    expect(parseProfileAvatar(JSON.stringify({ v: 1, accountId: 'acc-1', kind: 'photo' }), 'acc-1')).toBeNull();
    expect(parseProfileAvatar(JSON.stringify({ v: 1, accountId: 'acc-1', kind: 'pet', gameId: 0 }), 'acc-1')).toBeNull();
  });

  test('本机读写：写 null 等于清掉', () => {
    writeProfileAvatar('acc-1', pet(3007));
    expect(readProfileAvatar('acc-1')).toEqual(pet(3007));
    writeProfileAvatar('acc-1', null);
    expect(readProfileAvatar('acc-1')).toBeNull();
    expect(window.localStorage.getItem(PROFILE_AVATAR_KEY)).toBeNull();
  });

  test('上传：另一个账号的头像不会进当前账号的云端快照', async () => {
    window.localStorage.setItem('roco.accountId', 'acc-1');
    writeProfileAvatar('acc-2', pet(3007));

    const built = await buildSnapshot();
    expect(built.prefs[PROFILE_AVATAR_KEY]).toBeUndefined();

    writeProfileAvatar('acc-1', pet(3007));
    const again = await buildSnapshot();
    expect(again.prefs[PROFILE_AVATAR_KEY]).toBe(serializeProfileAvatar('acc-1', pet(3007)));
  });

  test('下载合并：只接受当前账号的云端头像，且以云端为准', async () => {
    window.localStorage.setItem('roco.accountId', 'acc-1');
    writeProfileAvatar('acc-1', pet(3001));

    const cloud = (avatar: string) => ({
      type: 'roco-toolbox-cloud' as const,
      version: 2,
      savedAt: '',
      catalogVersion: 's4',
      accounts: [snapshotWith('甲', 1, '2026-10-01T00:00:00.000Z')],
      prefs: { [PROFILE_AVATAR_KEY]: avatar },
    });

    // 云端是另一个账号的头像：不采信，本机保持不变
    await applySnapshot(cloud(serializeProfileAvatar('acc-2', pet(3007))), undefined, { merge: true });
    expect(readProfileAvatar('acc-1')).toEqual(pet(3001));

    // 云端是当前账号的头像：以云端为准（换设备/换回账号时靠它恢复）
    await applySnapshot(cloud(serializeProfileAvatar('acc-1', pet(3007))), undefined, { merge: true });
    expect(readProfileAvatar('acc-1')).toEqual(pet(3007));
  });
});
