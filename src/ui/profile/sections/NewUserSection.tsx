import { AccountPanel } from '../../AccountPanel';
import { EmptyState } from '../../kit';
import type { SectionProps } from '../types';

/**
 * 新用户空态（2026-11-28，RUI-03 + CLEAN2）：**一句事实 + 两条取数路径**。
 *
 * 文件导入删除后，新用户只剩两条路：到电脑版 / 安卓版采集，或登录同一账号同步。
 * 同步面板就放在空态下面，网页用户首日也能登录拉云端快照。
 */
export function NewUserSection({ ctx }: SectionProps) {
  return (
    <div data-section="new-user" data-testid="profile-new-user" className="space-y-s3">
      <EmptyState
        title="还没有数据"
        description="到电脑版或安卓版采集一次，或登录同一账号同步；网页版只做查看。"
        testId="profile-new-user-empty"
      />
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
