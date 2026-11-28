import { AccountPanel } from '../../AccountPanel';
import { ImportOutcomeNotice } from '../../ImportOutcomeNotice';
import { ImportPanel } from '../../ImportPanel';
import { NativeCollectorPanel } from '../../NativeCollectorPanel';
import type { SectionProps } from '../types';

/**
 * 采集与同步（2026-11-28 重排）：导入主流程 + 本机采集 + 私有同步。
 * 放在首屏数字/入口之后；设置类内容（隐私开关、导出/重置、数据来源）不在这里重复出现。
 */
export function CollectSection({ ctx }: SectionProps) {
  return (
    <div data-section="collect" data-testid="profile-collect" className="scroll-mt-24 space-y-s3">
      <ImportOutcomeNotice onOpenGroups={ctx.onOpenGroups} />
      {ctx.snapshots.length > 0 ? <NativeCollectorPanel /> : null}
      <ImportPanel
        hideEmptyHint
        hideSettings
        afterAnalytics={
          <div data-testid="profile-sync-block">
            <AccountPanel
              section="sync"
              autoConflict={ctx.autoConflict}
              onAutoConflictHandled={ctx.onAutoConflictHandled}
            />
          </div>
        }
      />
    </div>
  );
}
