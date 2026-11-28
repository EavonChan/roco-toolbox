/**
 * 头像偏好（2026-11-28 用户拍板：只做「从图鉴选一只精灵」+ 云端存储 + 点头像直接换）。
 *
 * 存储口径：
 * - 只用一个偏好键 `roco.profileAvatar`，跟着 `api/sync` 的偏好机制上传；
 * - 值里带**账号 id**：同一台设备换账号时，上一个人的头像不算数，也不会被上传到
 *   下一个账号的云端快照里（云端快照本身是「一个账号一份」）；
 * - 没有这个键（或值坏了）= 没设置，显示「用户名首字 + 稳定底色」。
 */
import { readAccountId } from './session';

export const PROFILE_AVATAR_KEY = 'roco.profileAvatar';

/** 目前只有「图鉴精灵」一种来源；第二期加照片时在这里扩 kind。 */
export interface ProfileAvatarPet {
  kind: 'pet';
  gameId: number;
}

const VERSION = 1;

interface StoredAvatar {
  v: number;
  accountId: string;
  kind: string;
  gameId: number;
}

/** 把存储值解出来（不管账号）；坏数据一律 null，调用方不用 try/catch。 */
function decode(raw: string | null | undefined): StoredAvatar | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<StoredAvatar> | null;
    if (!value || value.v !== VERSION || value.kind !== 'pet') return null;
    if (typeof value.accountId !== 'string' || value.accountId === '') return null;
    if (typeof value.gameId !== 'number' || !Number.isInteger(value.gameId) || value.gameId <= 0) return null;
    return { v: VERSION, accountId: value.accountId, kind: 'pet', gameId: value.gameId };
  } catch {
    return null;
  }
}

export function serializeProfileAvatar(accountId: string, avatar: ProfileAvatarPet): string {
  return JSON.stringify({ v: VERSION, accountId, kind: 'pet', gameId: avatar.gameId });
}

/** 解析成「当前账号的头像」；不是当前账号（或没登录）就当没设置。 */
export function parseProfileAvatar(
  raw: string | null | undefined,
  accountId: string | null,
): ProfileAvatarPet | null {
  if (!accountId) return null;
  const stored = decode(raw);
  if (!stored || stored.accountId !== accountId) return null;
  return { kind: 'pet', gameId: stored.gameId };
}

/** 云端合并用：这个值能不能算作当前账号的头像。 */
export function avatarValueBelongsTo(raw: string | null | undefined, accountId: string | null): boolean {
  if (!accountId) return false;
  return decode(raw)?.accountId === accountId;
}

export function readProfileAvatar(accountId: string | null): ProfileAvatarPet | null {
  if (typeof window === 'undefined') return null;
  const current = accountId ?? readAccountId();
  if (!current) return null;
  return parseProfileAvatar(window.localStorage.getItem(PROFILE_AVATAR_KEY), current);
}

/** 写 null 等于清掉（回到默认首字）。 */
export function writeProfileAvatar(accountId: string, avatar: ProfileAvatarPet | null): void {
  if (typeof window === 'undefined') return;
  if (!avatar) {
    window.localStorage.removeItem(PROFILE_AVATAR_KEY);
    return;
  }
  window.localStorage.setItem(PROFILE_AVATAR_KEY, serializeProfileAvatar(accountId, avatar));
}
