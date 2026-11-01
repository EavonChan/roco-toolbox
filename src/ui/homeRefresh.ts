import { accountKeyOf, parseBackup, type AccountSnapshot } from '../domain/parseBackup';
import { collectorAction, readCaptureSnapshot, readCollectorState, type CollectorState } from '../collector/nativeCollector';
import { decodeUrlInWorker } from '../pcap/decodeInWorker';
import { saveSnapshot } from '../storage/snapshots';
import { getCachedSnapshots, refreshSnapshots } from '../storage/snapshotStore';

/**
 * 家园 · 轻量刷新（2026-11-01 用户拍板）。
 *
 * 不接第三方 API，走本机采集：起一次短采集 → 用户在游戏里打开家园 →
 * 用壳的 `inspectCapture` 拿到**当前采集中**的 pcap 片段 → 前端解码 →
 * **只把 `home` 合并回该账号已有快照**（短采集通常没有背包数据，不能整包替换）。
 */

/** 采集开始后每隔多久试读一次家园（解码要起 Worker，别太频繁） */
export const HOME_REFRESH_POLL_MS = 6000;
/** 最多等多久（从开始采集算起） */
export const HOME_REFRESH_TIMEOUT_MS = 180_000;

/** 壳在不在：只有安卓工具箱安装包里有本机采集桥。 */
export const canRefreshHome = (): boolean =>
  typeof window !== 'undefined' && typeof window.RocoCapture?.startCapture === 'function';

/**
 * 只把家园部分并进已有快照：宠物 / 蛋 / 名字都保留。
 * 没带家园（还没走到家园场景）或本机没有这个账号时返回 null，由调用方给提示。
 */
export function mergeHomeSnapshot(
  incoming: AccountSnapshot,
  existing: AccountSnapshot | undefined,
): AccountSnapshot | null {
  if (!incoming.home || !existing) return null;
  return { ...existing, home: incoming.home };
}

/** 读当前采集中的抓包，解出家园；还没有家园数据时返回 null。 */
export async function readHomeFromCapture(): Promise<AccountSnapshot | null> {
  const snapshot = await readCaptureSnapshot();
  if (!snapshot) return null;
  const decoded = await decodeUrlInWorker(snapshot.url, snapshot.id);
  const parsed = parseBackup(decoded.payload, new Date().toISOString());
  return parsed.home ? parsed : null;
}

/** 合并并落库；本机没有这个账号（后续导入过才有的）时返回 null。 */
export async function saveRefreshedHome(incoming: AccountSnapshot): Promise<AccountSnapshot | null> {
  const key = accountKeyOf(incoming);
  const existing = (getCachedSnapshots() ?? []).find((item) => accountKeyOf(item) === key);
  const merged = mergeHomeSnapshot(incoming, existing);
  if (!merged) return null;
  await saveSnapshot(merged);
  await refreshSnapshots();
  return merged;
}

/** 开始采集（壳会弹 VPN 授权）。 */
export async function startHomeCapture(): Promise<void> {
  await collectorAction('startCapture');
}

/** 结束采集；已经在别处停掉时不报错（收尾用）。 */
export async function stopHomeCapture(): Promise<void> {
  try {
    await collectorAction('stopCapture');
  } catch {
    // 已经停了 / 壳状态不允许：收尾不需要把错误抛给用户
  }
}

/** 采集状态（壳没装或读不到时返回 null）。 */
export async function readHomeCaptureState(): Promise<CollectorState | null> {
  try {
    return await readCollectorState();
  } catch {
    return null;
  }
}
