import { useEffect, useState } from 'react';
import { readAccountId } from '../../api/session';
import { species } from '../../data/catalog';
import type { AccountSnapshot } from '../../domain/parseBackup';
import { readCurrentGroupId } from '../motherGroupStore';
import { Button } from '../primitives/Button';
import { CARD } from '../primitives/styles';
import { EggStockPanel } from './EggStockPanel';
import { useEggMatching } from './useEggMatching';
import { useEggStockSync } from './useEggStockSync';

/**
 * 家园页的「蛋仓」屏（2026-11-22 用户口径）。
 *
 * 和「组内广场 → 蛋仓」是同一份数据、同一个面板：进来时按当前小组把本机采集的
 * 背包蛋 / 家园蛋补同步一次，标注改完也同步回去。所以这里不另存一份本机蛋仓。
 * **是页内的一屏，不是悬浮窗**：由家园页的 view 切换进来，靠顶栏「返回家园」出去。
 * 没登录 / 没加入小组时说明原因并给出口，不让用户对着空列表猜。
 */
export interface EggStockViewProps {
  snapshots: readonly AccountSnapshot[];
  onGoGroups?: () => void;
  onGoAccount?: () => void;
  /** 回家园页（横屏标题栏里的「返回家园」） */
  onBack?: () => void;
}

function StockBody({ groupId, me, snapshots, onBack }: {
  groupId: string;
  me: string;
  snapshots: readonly AccountSnapshot[];
  onBack?: () => void;
}) {
  const api = useEggMatching(groupId, me);
  const sync = useEggStockSync({ api, groupId, me, snapshots });
  const eggs = (api.data?.state.eggs ?? []).filter((egg) => egg.accountId === me && egg.status !== 'transferred');
  return (
    <div className="flex flex-col gap-2" data-testid="egg-stock-body">
      {sync.syncError ? (
        <div role="alert" className="flex items-center justify-between rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
          <span>蛋仓同步失败：{sync.syncError}</span>
          <Button size="sm" variant="text" disabled={api.busy} onClick={() => sync.retrySync()}>重试同步</Button>
        </div>
      ) : null}
      {api.error ? (
        <div role="alert" className="flex items-center justify-between rounded-lg bg-rose-50 p-2 text-xs text-rose-700">
          <span>{api.error}</span>
          <Button size="sm" variant="text" onClick={() => void api.refresh()}>重试</Button>
        </div>
      ) : null}
      {!api.data ? (
        <p className="py-6 text-center text-xs text-slate-500">{api.loading ? '正在读取蛋仓…' : '蛋仓还没读出来，点上面的重试'}</p>
      ) : (
        <EggStockPanel eggs={eggs} species={species} busy={api.busy} mutate={api.mutate} collapsibleFilterRail railBack={onBack?{onClick:onBack}:undefined} />
      )}
    </div>
  );
}

export function EggStockView({ snapshots, onGoGroups, onGoAccount, onBack }: EggStockViewProps) {
  /** 进来时读一次身份：登录 / 换组都在「我的」或「组内广场」里发生，回来自然重读。 */
  const [who, setWho] = useState<{ me: string; groupId: string | null } | null>(null);
  useEffect(() => {
    const me = readAccountId();
    setWho(me ? { me, groupId: readCurrentGroupId(me) } : null);
  }, []);

  return (
    <section className={CARD} data-testid="home-egg-stock-view">
      {!who ? (
        <div className="flex flex-col gap-2" data-testid="egg-stock-need-account">
          <p className="text-xs text-slate-600">蛋仓跟着账号走：先登录，蛋仓才会和组内广场那边对得上。</p>
          {onGoAccount ? <Button size="sm" onClick={onGoAccount}>去登录</Button> : null}
        </div>
      ) : !who.groupId ? (
        <div className="flex flex-col gap-2" data-testid="egg-stock-need-group">
          <p className="text-xs text-slate-600">蛋仓按小组同步：先加入一个小组，蛋仓才能收集和换出去。</p>
          {onGoGroups ? <Button size="sm" onClick={onGoGroups}>去组内广场</Button> : null}
        </div>
      ) : (
        <StockBody key={`${who.groupId}:${who.me}`} groupId={who.groupId} me={who.me} snapshots={snapshots} onBack={onBack} />
      )}
    </section>
  );
}
