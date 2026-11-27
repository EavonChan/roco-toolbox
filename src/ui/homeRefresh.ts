import { mergePetBonusFields, petIdentityOf } from '../domain/backup';
import { accountKeyOf, parseBackup, type AccountSnapshot } from '../domain/parseBackup';
import type { OwnedPet } from '../domain/types';
import { collectorAction, readCaptureSnapshot, readCollectorState, type CollectorState } from '../collector/nativeCollector';
import { decodeUrlInWorker } from '../pcap/decodeInWorker';
import { saveSnapshot } from '../storage/snapshots';
import { getCachedSnapshots, refreshSnapshots } from '../storage/snapshotStore';

/**
 * 家园 · 轻量刷新（2026-11-01 用户拍板）。
 *
 * 不接第三方 API，走本机采集：起一次短采集 → 用户在游戏里打开家园 →
 * 用壳的 `inspectCapture` 拿到**当前采集中**的 pcap 片段 → 前端解码 →
 * **把 `home` 合并回该账号已有快照**，这次拍到的背包按身份补并（短采集通常没有背包数据，
 * 不能整包替换：蛋和旧精灵都得以本地为准）。
 */

/** 采集开始后每隔多久试读一次家园（解码要起 Worker，别太频繁） */
export const HOME_REFRESH_POLL_MS = 6000;
/** 最多等多久（从开始采集算起） */
export const HOME_REFRESH_TIMEOUT_MS = 180_000;

/** 壳在不在：只有安卓工具箱安装包里有本机采集桥。 */
export const canRefreshHome = (): boolean =>
  typeof window !== 'undefined' && typeof window.RocoCapture?.startCapture === 'function';

/**
 * 刷新时把这次抓到的背包并进旧快照（2026-11-27 修「新住户的精灵信息丢失」）。
 *
 * 旧实现只并 `home`、`pets` 一律沿用旧快照：刷新拿到 11 只住户，
 * 但背包还是 11-25 那份——11-25 之后新获得的住户在旧背包里不存在，
 * `node.pet` 为空，卡片名字退化成 `精灵 <actorId>`、身高体重三维全空。
 *
 * 规则：
 * - **只增不减**：旧快照有、这次没拍到的（短采集没背包 / 已放生）一律保留；
 * - **同一身份用新值**：按 `petIdentityOf`（`captureId` 优先）认同一只，属性和技能都以这次为准，
 *   但三维仍按 2026-11-24 口径「这次没采到就留旧值」，不把已有数据抹掉；
 * - **顺序稳定**：旧快照原顺序打底，新出现的追加在后面（家园卡列表不跳动）。
 */
const mergeRefreshPets = (
  existing: readonly OwnedPet[],
  incoming: readonly OwnedPet[],
): OwnedPet[] => {
  if (incoming.length === 0) return [...existing];
  const merged = [...existing];
  const slotOf = new Map<string, number>();
  existing.forEach((pet, index) => {
    const key = petIdentityOf(pet);
    if (key && !slotOf.has(key)) slotOf.set(key, index);
  });
  for (const pet of incoming) {
    const key = petIdentityOf(pet);
    const slot = key === undefined ? undefined : slotOf.get(key);
    if (slot !== undefined) {
      // 三维字段级保留：这次没采到（老客户端 / 短采集）不能当成「三维被取消」
      merged[slot] = mergePetBonusFields([pet], [merged[slot]])[0];
      continue;
    }
    if (key !== undefined) slotOf.set(key, merged.length);
    merged.push(pet);
  }
  return merged;
};

/**
 * 只把家园部分并进已有快照：宠物 / 蛋 / 名字以旧快照为准，这次拍到的背包按身份补并。
 * 没带家园（还没走到家园场景）或本机没有这个账号时返回 null，由调用方给提示。
 */
export function mergeHomeSnapshot(
  incoming: AccountSnapshot,
  existing: AccountSnapshot | undefined,
): AccountSnapshot | null {
  if (!incoming.home || !existing) return null;
  return {
    ...existing,
    home: incoming.home,
    pets: mergeRefreshPets(existing.pets ?? [], incoming.pets ?? []),
  };
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
