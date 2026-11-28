import { readAccountId } from '../api/session';
import { clearLastImportResult } from '../storage/lastImportStore';
import { refreshSnapshots } from '../storage/snapshotStore';
import { clearAllSnapshots } from '../storage/snapshots';
import { clearAccountFilter } from './accountFilterStore';
import { clearDemandCancelledState } from './demandCancelledNotice';
import { clearCompletionRead } from './demandCompletionReadStore';
import { clearDemandPicks } from './demandPickStore';
import { clearCollapsedAccounts, clearPlacementMarks } from './demandPlacementStore';
import { setImportMessage } from './importMessageStore';
import { resetImportOutcome } from './importOutcomeStore';
import { resetListViews } from './listViewStore';
import { clearMotherPlan } from './motherPlanStore';
import { clearMyPetsFilters } from './myPetsFilterStore';
import { clearSyncFeedback } from './syncNoticeStore';

/**
 * 清空本机数据（2026-11-28 CLEAN2）。
 *
 * 「重置导入数据」随文件导入删除后，用户遇到脏数据就没有安全阀了；
 * 这里恢复成只清**本机**的版本：
 * - 清空 IndexedDB 里的账号快照，以及由这批数据派生的页面状态（本次新增、筛选、计划、
 *   「已换到」、完成回执、账号折叠等）；
 * - **不动**工具箱身份 / 登录态、目标档位与母本达标条件、已发布的小组资源；
 * - 云端快照不受影响：重新登录同一账号点「立即同步」就能拉回来。
 *
 * 调用方必须先做二次确认（不可撤销）。
 */
export async function clearLocalData(): Promise<void> {
  const accountId = readAccountId();
  await clearAllSnapshots();
  await refreshSnapshots();
  clearLastImportResult();
  clearSyncFeedback();
  resetImportOutcome();
  setImportMessage(null);
  clearMotherPlan();
  clearAccountFilter();
  clearDemandPicks();
  // 这三份本机记忆都是「按云身份 + 这批数据」派生的：清空后继续沿用会让同款单显示已上窝、
  // 完成回执不再提示（R2-2-M07）。
  clearPlacementMarks(accountId);
  clearCompletionRead(accountId);
  clearCollapsedAccounts(accountId);
  clearDemandCancelledState(accountId);
  clearMyPetsFilters();
  resetListViews();
}
