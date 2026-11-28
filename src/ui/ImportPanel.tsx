import { useState } from 'react';
import { CATALOG_VERSION } from '../data/catalog';
import { backupFileName, buildBackup } from '../domain/backup';
import { shareToNative } from '../share/nativeShare';
import { useSnapshots } from './useSnapshots';
import { getTargetMode } from './targetModeStore';
import { getMotherPlan } from './motherPlanStore';
import { setImportMessage, useImportMessage } from './importMessageStore';
import { SourceNotice } from './SourceNotice';

/**
 * 「设置」里的数据与来源（2026-11-28 CLEAN2）。
 *
 * 数据入口收敛为「壳内采集 + 同账号登录同步」后，这里只保留：
 * - 导出（只做备份 / 排障，收在「更多」里；本应用不再提供文件导入）
 * - 数据来源署名（CC BY-SA 4.0 的合规要求）
 *
 * 匿名统计开关已移到设置分组的「使用统计」一行（见 SettingsSection）。
 * 文件导入 / 合并导入 / 导入历史 / 重置入口已删除，入库链路见 `src/import/captureIngest.ts`。
 */
export function ImportPanel() {
  const { snapshots } = useSnapshots();
  const dataMessage = useImportMessage();
  // 导出是低频操作：默认收起，避免设置里一进来就是一排按钮
  const [moreOpen, setMoreOpen] = useState(false);

  /** 导出：把本机全部账号数据打包，优先「分享」出去（网页 navigator.share / 壳 JS Bridge），
   *  不支持时兜底下载文件。2026-10-04 用户拍板：APK 里 blob 下载被 WebView 忽略，
   *  改为直接分享到 QQ/微信等。导出只用于备份与排障，换设备请用同账号登录同步。 */
  const handleExport = async () => {
    const backup = buildBackup(snapshots, {
      exportedAt: new Date().toISOString(),
      catalogVersion: CATALOG_VERSION,
      targetMode: getTargetMode(),
      motherPlan: getMotherPlan(),
    });
    const text = JSON.stringify(backup, null, 1);
    const fileName = backupFileName(backup.exportedAt);

    try {
      // 1) 壳 JS Bridge：调起系统分享面板（QQ/微信等）
      if (shareToNative(text, fileName)) {
        setImportMessage(`已发起分享 ${snapshots.length} 个账号的数据`);
        return;
      }
      // 2) 网页 Web Share API（手机浏览器）
      if (typeof navigator !== 'undefined' && navigator.share) {
        const file = new File([text], fileName, { type: 'application/json' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: '小布助手数据备份' });
          setImportMessage(`已分享 ${snapshots.length} 个账号的数据`);
          return;
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return; // 用户取消分享，什么都不提示
      // 分享失败（如权限）不打断，继续走下载兜底
    }

    // 3) 兜底：下载文件（桌面浏览器 / 不支持分享的环境）
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    setImportMessage(`已导出 ${snapshots.length} 个账号的数据`);
  };

  return (
    <div className="space-y-3" data-testid="import-settings">
      <section className="rounded-2xl bg-white shadow-sm" data-testid="import-more">
        <button
          type="button"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((open) => !open)}
          data-testid="import-more-toggle"
          className="flex min-h-[36px] w-full items-center justify-between px-3 text-left text-sm font-medium text-slate-500"
        >
          <span>更多（导出）</span>
          <span className="text-xs text-slate-300" aria-hidden>
            {moreOpen ? '▲' : '▼'}
          </span>
        </button>
        {moreOpen ? (
          <div className="px-3 pb-3" data-testid="import-more-body">
            <button
              type="button"
              data-testid="export-button"
              disabled={snapshots.length === 0}
              onClick={() => void handleExport()}
              className="flex min-h-[36px] w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 disabled:text-slate-300"
            >
              导出全部数据
            </button>
            <p className="mt-1 text-xs text-slate-400">
              导出只用于离线备份 / 排障；本应用不能再导入，换设备请用同账号登录同步。
            </p>
            {dataMessage ? (
              <p className="mt-1 text-xs text-emerald-700" data-testid="data-message">
                {dataMessage}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <SourceNotice />
    </div>
  );
}
