import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { EggMatchingResponse } from '../../api/eggMatching';
import { inventoryFromSnapshot } from '../../domain/eggInventory';
import type { AccountSnapshot } from '../../domain/parseBackup';
import { homeStockFromSnapshot } from './homeEggAdapter';
import { emptyEggStock, reconcileEggStock, type EggStockState, type StockEgg } from './eggStockModel';

/**
 * 蛋仓同步（2026-11-22 提取自组内广场）。
 *
 * 组内广场和家园页的「蛋仓」弹层是同一份数据：把本机采集到的背包蛋 / 家园蛋
 * 按「水印 + 部位时间」增量推到服务器，服务器确认后才推进基线。
 * 提取成 hook 是为了两处入口共用同一套幂等逻辑，而不是各自猜一份。
 */
export interface EggStockSyncApi {
  data: EggMatchingResponse | null;
  busy: boolean;
  mutate: (action: unknown) => Promise<unknown>;
}

export interface EggStockSync {
  syncError: string;
  /** 正在推蛋：调用方在别处写数据前要先让路 */
  syncing: MutableRefObject<boolean>;
  retrySync: () => void;
}

export function useEggStockSync({ api, groupId, me, snapshots }: {
  api: EggStockSyncApi;
  groupId: string;
  me: string;
  snapshots: readonly AccountSnapshot[];
}): EggStockSync {
  const stockRef = useRef<EggStockState>(emptyEggStock());
  const partTimes = useRef<Record<string, { bag: number; home: number }>>({});
  const syncing = useRef(false);
  const attemptedCaptures = useRef(new Set<string>());
  const hydrated = useRef(false);
  const [syncError, setSyncError] = useState('');
  const [syncRetry, setSyncRetry] = useState(0);

  // Read only real imported captures. The server watermark makes repeated visits idempotent.
  useEffect(() => {
    if (!groupId || !me) return;
    if (!api.data || api.busy || syncing.current) return;
    if (!hydrated.current) {
      // 先用服务端库存水合，避免把已经同步过的蛋当成新蛋重新发一遍。
      const eggs = api.data.state.eggs.map(egg => ({
        ...egg,
        location: egg.location ?? 'bag',
        lastConfirmedAt: egg.lastConfirmedAt ?? 0,
      } as StockEgg));
      stockRef.current = { eggs, captureWatermarks: {}, provenanceHistory: {} };
      for (const egg of eggs) {
        const key = egg.gameAccountKey ?? '';
        const times = partTimes.current[key] ?? { bag: -1, home: -1 };
        if (egg.location === 'home') times.home = Math.max(times.home, egg.lastConfirmedAt);
        else times.bag = Math.max(times.bag, egg.lastConfirmedAt);
        partTimes.current[key] = times;
      }
      hydrated.current = true;
    }
    for (const snapshot of snapshots) {
      try {
        const bag = inventoryFromSnapshot(snapshot, me);
        const home = homeStockFromSnapshot(snapshot, me);
        const key = bag.gameAccountKey;
        const times = partTimes.current[key] ?? { bag: -1, home: -1 };
        const bagTime = Number.isFinite(bag.capturedAt) ? bag.capturedAt : -1;
        const homeTime = home?.capturedAt ?? -1;
        const bagChanged = bagTime > times.bag;
        const homeChanged = homeTime > times.home;
        if (!bagChanged && !homeChanged) continue;
        const attempt = JSON.stringify([groupId, me, key, bagChanged ? bagTime : -1, homeChanged ? homeTime : -1]);
        if (attemptedCaptures.current.has(attempt)) continue;
        attemptedCaptures.current.add(attempt);
        const capturedAt = Math.max(bagChanged ? bagTime : -1, homeChanged ? homeTime : -1);
        const nextStock = reconcileEggStock(stockRef.current, {
          accountId: me, gameAccountKey: key, capturedAt,
          ...(bagChanged ? { bag: { eggs: bag.eggs, complete: bag.complete, capturedAt: bagTime } } : {}),
          ...(homeChanged && home ? { home: { eggs: home.eggs, complete: home.complete, capturedAt: homeTime } } : {}),
        });
        syncing.current = true;
        void api.mutate({ type: 'stock-sync', gameAccountKey: key, capturedAt,
          complete: bagChanged ? bag.complete : false,
          homeComplete: homeChanged ? !!home?.complete : false,
          eggs: nextStock.eggs
            .filter(egg => egg.accountId === me && (egg.gameAccountKey ?? '') === key)
            .map(egg => ({ ...egg, gameAccountKey: key })) })
          .then(() => {
            // 只有服务端确认成功才推进本地基线与部位时间，失败时重试仍能重发同一批。
            stockRef.current = nextStock;
            partTimes.current[key] = { bag: bagChanged ? bagTime : times.bag, home: homeChanged ? homeTime : times.home };
            setSyncError('');
          })
          .catch(e => setSyncError(e instanceof Error ? e.message : '蛋仓同步失败'))
          .finally(() => { syncing.current = false; setSyncRetry(n => n + 1); });
        break;
      } catch (e) {
        setSyncError(e instanceof Error ? e.message : '蛋仓同步失败');
      }
    }
  }, [api.data, api.busy, api.mutate, snapshots, me, groupId, syncRetry]);

  const retrySync = () => {
    attemptedCaptures.current.clear();
    setSyncError('');
    setSyncRetry(n => n + 1);
  };

  return { syncError, syncing, retrySync };
}
