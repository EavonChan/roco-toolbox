import { demandKeyOf } from '../shared/collectionGroups';

/**
 * 「已上窝」本机记忆（需求中心二期）。
 *
 * 只记本机：不改云端需求状态，结单仍然在小组的需求中心做。
 * 键带「接单时间」——服务端撤回是整行删除、重发后版本号从 0 重计，
 * 只有每次接单刷新的 claimedAt 能保证同款需求重发不继承旧的勾选。
 */
export interface PlacementRow {
  groupId: string;
  demanderAccountId: string;
  eggGameId: number;
  nature: string;
  gender: string;
  body: string;
  voice: string;
  /** 我接下这单的时间（即单上的 updatedAt）；持有期间不变，每次重接都刷新。 */
  claimedAt?: number;
}

export type PlacementMarks = Record<string, boolean>;

const KEY_PREFIX = 'roco.demandPlacements:';
const COLLAPSED_KEY = 'roco.demandCollapsedAccounts';

export function placementRowKey(row: PlacementRow): string {
  const base = demandKeyOf({
    eggGameId: row.eggGameId,
    nature: row.nature,
    gender: row.gender as never,
    body: row.body as never,
    voice: row.voice as never,
  });
  return `${row.groupId}|${row.demanderAccountId}|${base}|${row.claimedAt ?? 0}`;
}

export function readPlacementMarks(accountId: string | null): PlacementMarks {
  if (!accountId || typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(KEY_PREFIX + accountId);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return parsed && typeof parsed === 'object' ? (parsed as PlacementMarks) : {};
  } catch {
    return {};
  }
}

export function togglePlacementMark(
  accountId: string,
  rowKey: string,
  placed: boolean,
): PlacementMarks {
  const marks = readPlacementMarks(accountId);
  if (placed) marks[rowKey] = true;
  else delete marks[rowKey];
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(KEY_PREFIX + accountId, JSON.stringify(marks));
    } catch {
      // 隐私模式 / 配额满：记不住不影响本次勾选（同 lastTab.ts / demandPickStore.ts）
    }
  }
  return { ...marks };
}

/** 接单上窝页里手动收起的账号（accountKey），下次打开仍然收起。 */
export function readCollapsedAccounts(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(COLLAPSED_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
}

export function writeCollapsedAccounts(accountKeys: readonly string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...new Set(accountKeys)]));
  } catch {
    // 存不下只是下次打开不再收起
  }
}
