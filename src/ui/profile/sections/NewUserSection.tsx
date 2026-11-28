import { AccountPanel } from '../../AccountPanel';
import { ImportOutcomeNotice } from '../../ImportOutcomeNotice';
import { NativeCollectorPanel } from '../../NativeCollectorPanel';
import { EmptyState } from '../../kit';
import type { SectionProps } from '../types';

/**
 * 新用户空态（2026-11-28，RUI-03 + CLEAN2）：**一句事实 + 两条取数路径**。
 *
 * 文件导入删除后，新用户只剩两条路：壳内采集（安卓 / 电脑版）或登录同一账号同步。
 * 采集卡必须在这里也挂一份：否则全新安装没有数据时「我的」页连「开始采集」都没有，
 * 网页 / 无采集桥的环境由 NativeCollectorPanel 自己渲染说明卡。
 */
export function NewUserSection({ ctx }: SectionProps) {
  return (
    <div data-section="new-user" data-testid="profile-new-user" className="space-y-s3">
      {/* 首次采集失败也要有反馈：三阶段提示和采集区共用同一份 store */}
      <ImportOutcomeNotice onOpenGroups={ctx.onOpenGroups} />
      <EmptyState
        title="还没有数据"
        description="到电脑版或安卓版采集一次，或登录同一账号同步；网页版只做查看。"
        testId="profile-new-user-empty"
      />
      <NativeCollectorPanel />
      <div data-testid="profile-new-user-sync" data-tour="profile-sync">
        <AccountPanel
          section="sync"
          autoConflict={ctx.autoConflict}
          onAutoConflictHandled={ctx.onAutoConflictHandled}
        />
      </div>
    </div>
  );
}
