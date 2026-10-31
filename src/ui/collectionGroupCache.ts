/**
 * 小组页本地缓存（二期）：先出内容、再后台刷新。
 *
 * 信封带 `schemaVersion`，组列表与每组详情分开存：
 * - 组列表很小，存在 `roco.collectionGroupCache:<accountId>`；
 * - 组详情可能几百 KB，按组单独一个 key。
 *
 * 2026-10-31：原来详情也塞在同一份信封里，每 15 秒轮询都要 `JSON.parse` + `JSON.stringify`
 * 整份缓存（重度小组 1MB+），手机上就是明显掉帧。拆成单组 key 后，写入只碰这一组。
 *
 * 服务器仍是唯一真相；缓存只用于首屏与离线只读。
 */
import type {
  CollectionDemand,
  CollectionGroupDetail,
  CollectionGroupSummary,
} from '../shared/collectionGroups';

const KEY_PREFIX = 'roco.collectionGroupCache:';
const DETAIL_PREFIX = 'roco.collectionGroupDetail:';
/** 需求列表同样按组单独存：进页面先出缓存，不再空着等接口（2026-11-01）。 */
const DEMAND_PREFIX = 'roco.collectionGroupDemands:';
const SCHEMA_VERSION = 3;

export interface CollectionGroupCache {
  schemaVersion: number;
  groups: CollectionGroupSummary[];
  savedAt: number;
}

const listKeyOf = (accountId: string): string => `${KEY_PREFIX}${accountId}`;
const detailKeyOf = (accountId: string, groupId: string): string =>
  `${DETAIL_PREFIX}${accountId}:${groupId}`;
const demandKeyOf = (accountId: string, groupId: string): string =>
  `${DEMAND_PREFIX}${accountId}:${groupId}`;

const isSummary = (value: unknown): value is CollectionGroupSummary => {
  if (!value || typeof value !== 'object') return false;
  const group = value as Record<string, unknown>;
  return (
    typeof group.id === 'string' &&
    typeof group.name === 'string' &&
    typeof group.ownerAccountId === 'string' &&
    typeof group.memberCount === 'number' &&
    (group.groupType === 'mother' || group.groupType === 'stud') &&
    typeof group.targetRevision === 'number'
  );
};

const isDetail = (value: unknown): value is CollectionGroupDetail => {
  if (!value || typeof value !== 'object') return false;
  const detail = value as Record<string, unknown>;
  const group = detail.group as Record<string, unknown> | null;
  return (
    !!group &&
    typeof group.id === 'string' &&
    typeof group.name === 'string' &&
    typeof group.ownerAccountId === 'string' &&
    (group.groupType === 'mother' || group.groupType === 'stud') &&
    typeof group.targetRevision === 'number' &&
    Array.isArray(detail.members) &&
    detail.members.every((member) => {
      if (!member || typeof member !== 'object') return false;
      const item = member as Record<string, unknown>;
      return typeof item.accountId === 'string' && typeof item.displayName === 'string';
    })
  );
};

export function readCollectionGroupCache(accountId: string | null): CollectionGroupCache | null {
  if (!accountId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(listKeyOf(accountId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.schemaVersion !== SCHEMA_VERSION) return null;
    if (!Array.isArray(parsed.groups) || !parsed.groups.every(isSummary)) return null;
    if (typeof parsed.savedAt !== 'number') return null;
    return { schemaVersion: SCHEMA_VERSION, groups: parsed.groups, savedAt: parsed.savedAt };
  } catch {
    return null;
  }
}

/** 单组详情：切组时用来秒开，不再空屏等网络（2026-10-31）。 */
export function readCollectionGroupCacheDetail(
  accountId: string | null,
  groupId: string,
): CollectionGroupDetail | null {
  if (!accountId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(detailKeyOf(accountId, groupId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isDetail(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeList(accountId: string | null, cache: CollectionGroupCache): void {
  if (!accountId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(listKeyOf(accountId), JSON.stringify(cache));
  } catch {
    // 配额满：只是少了「先出内容」，不影响服务器数据
  }
}

const base = (accountId: string | null): CollectionGroupCache =>
  readCollectionGroupCache(accountId) ?? {
    schemaVersion: SCHEMA_VERSION,
    groups: [],
    savedAt: 0,
  };

export function saveCollectionGroupCacheGroups(
  accountId: string | null,
  groups: CollectionGroupSummary[],
): void {
  writeList(accountId, { ...base(accountId), groups, savedAt: Date.now() });
}

export function saveCollectionGroupCacheDetail(
  accountId: string | null,
  detail: CollectionGroupDetail,
): void {
  if (!accountId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      detailKeyOf(accountId, detail.group.id),
      JSON.stringify(detail),
    );
  } catch {
    // 配额满：跳过即可，服务器数据不受影响
  }
  const previous = base(accountId);
  const groups = previous.groups.some((group) => group.id === detail.group.id)
    ? previous.groups.map((group) =>
        group.id === detail.group.id
          ? {
              ...group,
              groupType: detail.group.groupType,
              targetRevision: detail.group.targetRevision,
              memberCount: detail.members.length,
            }
          : group,
      )
    : [
        ...previous.groups,
        {
          id: detail.group.id,
          name: detail.group.name,
          ownerAccountId: detail.group.ownerAccountId,
          memberCount: detail.members.length,
          groupType: detail.group.groupType,
          targetRevision: detail.group.targetRevision,
          targetReady: true,
        },
      ];
  writeList(accountId, { ...previous, groups, savedAt: Date.now() });
}

export function clearCollectionGroupCacheDetail(
  accountId: string | null,
  groupId: string,
): void {
  if (!accountId || typeof window === 'undefined') return;
  window.localStorage.removeItem(detailKeyOf(accountId, groupId));
}

const isDemand = (value: unknown): value is CollectionDemand => {
  if (!value || typeof value !== 'object') return false;
  const demand = value as Record<string, unknown>;
  return (
    typeof demand.groupId === 'string' &&
    typeof demand.demanderAccountId === 'string' &&
    typeof demand.eggGameId === 'number' &&
    typeof demand.nature === 'string' &&
    (demand.status === 'open' || demand.status === 'claimed' || demand.status === 'done') &&
    (demand.claimerAccountId === null || typeof demand.claimerAccountId === 'string') &&
    typeof demand.version === 'number' &&
    typeof demand.createdAt === 'number' &&
    typeof demand.updatedAt === 'number'
  );
};

/** 单组需求列表（已接 / 未接 / 已结单都在里面）：首屏直接用它，别空着等接口。 */
export function readCollectionGroupCacheDemands(
  accountId: string | null,
  groupId: string | null,
): CollectionDemand[] | null {
  if (!accountId || !groupId || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(demandKeyOf(accountId, groupId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.schemaVersion !== SCHEMA_VERSION) return null;
    if (!Array.isArray(parsed.demands) || !parsed.demands.every(isDemand)) return null;
    return parsed.demands;
  } catch {
    return null;
  }
}

export function saveCollectionGroupCacheDemands(
  accountId: string | null,
  groupId: string | null,
  demands: CollectionDemand[],
): void {
  if (!accountId || !groupId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      demandKeyOf(accountId, groupId),
      JSON.stringify({ schemaVersion: SCHEMA_VERSION, savedAt: Date.now(), demands }),
    );
  } catch {
    // 配额满：只是少了「先出内容」，不影响服务器数据
  }
}

export function clearCollectionGroupCacheDemands(
  accountId: string | null,
  groupId: string,
): void {
  if (!accountId || typeof window === 'undefined') return;
  window.localStorage.removeItem(demandKeyOf(accountId, groupId));
}

export function clearCollectionGroupCache(accountId: string | null): void {
  if (!accountId || typeof window === 'undefined') return;
  window.localStorage.removeItem(listKeyOf(accountId));
  // 详情与需求都按组分开存，退出登录要整片清掉（否则换号会读到别人的组）
  const prefixes = [`${DETAIL_PREFIX}${accountId}:`, `${DEMAND_PREFIX}${accountId}:`];
  const stale: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key && prefixes.some((prefix) => key.startsWith(prefix))) stale.push(key);
  }
  for (const key of stale) window.localStorage.removeItem(key);
}
