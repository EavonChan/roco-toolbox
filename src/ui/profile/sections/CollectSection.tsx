import { AccountPanel } from '../../AccountPanel';
import { ImportOutcomeNotice } from '../../ImportOutcomeNotice';
import { NativeCollectorPanel } from '../../NativeCollectorPanel';
import type { SectionProps } from '../types';

/**
 * 采集与同步（2026-11-28 重排 + CLEAN2）。
 *
 * 数据入口收敛为「壳内采集 + 同账号登录同步」：本区块只留这三块——
 * 入库三阶段反馈、壳内采集卡、私有同步；文件导入 UI 已删除（导出收在设置里）。
 */
export function CollectSection({ ctx }: SectionProps) {
  return (
    <div data-section="collect" data-testid="profile-collect" className="scroll-mt-24 space-y-s3">
      <ImportOutcomeNotice onOpenGroups={ctx.onOpenGroups} />
      {ctx.snapshots.length > 0 ? <NativeCollectorPanel /> : null}
      <div data-testid="profile-sync-block" data-tour="profile-sync">
        <AccountPanel
          section="sync"
          autoConflict={ctx.autoConflict}
          onAutoConflictHandled={ctx.onAutoConflictHandled}
        />
      </div>
    </div>
  );
}
