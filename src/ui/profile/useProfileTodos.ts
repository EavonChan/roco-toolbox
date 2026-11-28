import { useEffect, useMemo, useState } from 'react';
import { getEggMatching } from '../../api/eggMatching';
import { useNearbyTargets } from '../../nearby/nearbyTargetStore';
import { readCollectionGroupCache } from '../collectionGroupCache';
import { readLastGroupId } from '../collectionGroupStore';

/**
 * 「我的」首屏的待办数字（2026-11-28 用户口径：**待办型**，不是收集进度）。
 *
 * 三件事只回答「我现在有什么要处理」：
 * 1. 蛋仓待认领 —— 服务端蛋仓里 `claimPending` 的行数（蛋仓线的数据，只读取）；
 * 2. 换蛋待确认 —— 已接受、但我这一侧还没点「已收到」的单数；
 * 3. 附近目标 —— 本机蹲守名单的数量。
 *
 * 口径细节：
 * - 收集进度已按用户要求移出「我的」，不在这里出现；
 * - 服务端两项要有一个小组才能取（蛋仓挂在组上）；没有组或取数失败时**不编造 0**，
 *   用 `known=false` 让区块隐藏，避免把「不知道」写成「没有要处理的」；
 * - 附近目标只读本机 localStorage，不发请求。
 */
export interface ProfileTodos {
  /** 取数结束（无论成功失败） */
  loaded: boolean;
  /** 三项都已知时才敢说「暂时没有需要处理的」 */
  known: boolean;
  claims: number | null;
  confirm: number | null;
  nearbyTargets: number;
  /** 服务端数据的时间（用于「什么时候」） */
  syncedAt: number | null;
}

export function useProfileTodos(accountId: string | null): ProfileTodos {
  const targets = useNearbyTargets();

  const groupId = useMemo(() => {
    const cache = readCollectionGroupCache(accountId);
    if (!cache || cache.groups.length === 0) return null;
    return readLastGroupId(accountId, 'mother') ?? cache.groups[0]?.id ?? null;
  }, [accountId]);

  const [server, setServer] = useState<{ claims: number | null; confirm: number | null; syncedAt: number | null }>({
    claims: null,
    confirm: null,
    syncedAt: null,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!accountId || !groupId) {
      setServer({ claims: null, confirm: null, syncedAt: null });
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    void getEggMatching(groupId)
      .then(({ state }) => {
        if (!alive) return;
        const claims = state.eggs.filter((egg) => egg.claimPending === true).length;
        const confirm = state.trades.filter(
          (trade) =>
            trade.status === 'accepted' &&
            ((trade.supplierAccountId === accountId && !trade.returnConfirmedAt) ||
              (trade.demanderAccountId === accountId && !trade.giveConfirmedAt)),
        ).length;
        setServer({ claims, confirm, syncedAt: Date.now() });
      })
      .catch(() => {
        // 取数失败不写 0：保留 null，区块按「不知道」处理
        if (alive) setServer({ claims: null, confirm: null, syncedAt: null });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [accountId, groupId]);

  const known = server.claims !== null || !accountId || !groupId;
  return {
    loaded: !loading,
    known,
    claims: server.claims,
    confirm: server.confirm,
    nearbyTargets: targets.length,
    syncedAt: server.syncedAt,
  };
}
