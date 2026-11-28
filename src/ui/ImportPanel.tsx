import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { analyticsEnabled, setAnalyticsEnabled } from '../api/analytics';
import { readAccountId } from '../api/session';
import { accountKeyOf, type AccountSnapshot } from '../domain/parseBackup';
import { CATALOG_VERSION } from '../data/catalog';
import { writeSnapshots } from '../storage/snapshots';
import {
  backupFileName,
  buildBackup,
  mergeSnapshots,
  parseToolboxBackup,
} from '../domain/backup';
import { refreshSnapshots } from '../storage/snapshotStore';
import { ImportResultCard } from './ImportResultCard';
import { SourceNotice } from './SourceNotice';
import { useSnapshots } from './useSnapshots';
import { useLastImportHistory } from './useLastImportResult';
import { shareToNative } from '../share/nativeShare';
import { getTargetMode, useTargetMode } from './targetModeStore';
import { getMotherPlan } from './motherPlanStore';
import { setImportMessage, useImportMessage } from './importMessageStore';
import { beginImport, updateImportOutcome, useImportOutcome } from './importOutcomeStore';
import { useSyncFeedback } from './syncNoticeStore';
import { resetImportedData } from './resetImportedData';
import {
  achievementMessages,
  afterImport,
  applyBackupPlanning,
  consumePendingShares,
  ingestCaptureFiles,
  mergeMessage,
  reportNewPets,
} from '../import/captureIngest';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** 「导入数据」页：抓包导入 / 合并导入 / 导出全部 / 重置，以及导入结果汇报。 */
export interface ImportPanelProps {
  /** 匿名统计下方、数据来源前给调用方留的一块（2026-11-21：私有同步卡片）。 */
  afterAnalytics?: ReactNode;
  /**
   * 紧凑模式（2026-11-28「我的」页重排）：只留导入主动作与导入结果。
   * 设置类内容（导出 / 合并导入 / 重置 / 隐私开关 / 数据来源）一律不进首屏与空态，
   * 由「设置」区块或数据态下的完整面板承担。
   */
  compact?: boolean;
  /** 页面已有一句空态时，不再重复「还没有数据」 */
  hideEmptyHint?: boolean;
  /** 只渲染设置（导出 / 合并导入 / 重置、隐私开关、数据来源），供设置区块的弹层使用 */
  settingsOnly?: boolean;
  /** 主面板不渲染设置——「我的」页把设置下沉到设置区块 */
  hideSettings?: boolean;
}

export function ImportPanel({
  afterAnalytics,
  compact = false,
  hideEmptyHint = false,
  settingsOnly = false,
  hideSettings = false,
}: ImportPanelProps = {}) {
  const { snapshots, loaded } = useSnapshots();
  // 历史入口常驻：只要有导入历史，卡片就渲染（重启后入口仍在，2026-10-05 用户拍板）
  const importHistory = useLastImportHistory();
  // 全局目标模式：追满分 / 追双牌，「本次新增」的分类口径读它
  const mode = useTargetMode();
  // 导入的本机 / 私有云 / 小组三阶段反馈放模块级 store：切页或导入中离开本页也不丢（2026-10-24）
  const outcome = useImportOutcome();
  const importing = outcome.local === 'importing';
  const importError = outcome.local === 'failed' ? outcome.message : null;
  // 合并 / 导出 / 分享处理这类非导入动作的错误：留在本页即可（导入本体的反馈已进 store）
  const [actionError, setActionError] = useState<string | null>(null);
  const currentOp = useRef(0);
  const dataMessage = useImportMessage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const [analyticsOn, setAnalyticsOn] = useState(() => analyticsEnabled());
  // 导入后自动云同步的反馈（409 冲突 / 设置已跟随云端）放模块级 store：
  // 分享导入后本组件会被卸载，放 useState 里这两条提示会永久丢失（见 syncNoticeStore）
  const { conflict: autoConflict, notice: syncNotice } = useSyncFeedback();
  // 底部「更多」折叠区（导出 / 合并导入 / 重置）：低频操作收起来，默认收起
  const [moreOpen, setMoreOpen] = useState(false);

  const lastImportedAt = useMemo(() => {
    if (snapshots.length === 0) return null;
    return snapshots.reduce((latest, s) => (s.importedAt > latest ? s.importedAt : latest), '');
  }, [snapshots]);

  const stale = useMemo(() => {
    if (!lastImportedAt) return false;
    const ts = Date.parse(lastImportedAt);
    return Number.isFinite(ts) && Date.now() - ts > SEVEN_DAYS_MS;
  }, [lastImportedAt]);

  /**
   * 入库入口（壳内采集 / 手选文件 / 分享共用）。真正的解析、写库、自动同步与小组发布
   * 都在 `src/import/captureIngest.ts`，这里只是把最新的本机快照交给它。
   */
  const handleImport = (
    files: File[],
    sourceLabel?: string,
    readFile?: (file: File) => Promise<unknown>,
  ): Promise<AccountSnapshot[] | null> =>
    ingestCaptureFiles({ files, snapshots, mode, sourceLabel, readFile });

  // 晚到的分享要用最新的 handleImport，否则「本次新增」是拿旧快照在比
  const importRef = useRef(handleImport);
  importRef.current = handleImport;

  /**
   * 分享进来的数据由 captureIngest.consumePendingShares 统一消费：
   * 浏览器系统分享 / 壳注入的文本 / 壳拦下的抓包字节，三条来源都走同一条入库链路。
   * 等本机数据读完（loaded）再导，否则「本次新增」是在和空数据比。
   */
  useEffect(() => {
    if (!loaded) return;

    // 消费分享数据；失败也要给提示，不能让它变成未处理的 rejection（数据会静默丢掉）
    const runConsume = () => {
      void consumePendingShares((file, label, readFile) =>
        importRef.current([file], label, readFile),
      ).catch((error) => {
        setActionError(error instanceof Error ? error.message : '处理分享进来的数据失败');
      });
    };
    runConsume();
    // 应用已经开着的时候分享进来，壳会派发这个事件
    window.addEventListener('roco-share', runConsume);
    return () => window.removeEventListener('roco-share', runConsume);
  }, [loaded]);

  const handleReset = async () => {
    const confirmed = window.confirm(
      '确定清空本机已导入的所有账号数据吗？此操作不可撤销。\n\n' +
        '会清空：导入的账号、导入历史、本次新增、种公推荐里勾选的「已换到」、母本计划、账号与清单筛选。\n' +
        '会保留：种公奖牌目标与母本达标条件、我的身份、已发布的小组资源（要撤回请到小组页停止共享）。',
    );
    if (!confirmed) return;
    await resetImportedData();
  };

  /** 导出：把本机全部账号数据打包，优先「分享」出去（网页 navigator.share / 壳 JS Bridge），
   *  不支持时兜底下载文件。2026-10-04 用户拍板：APK 里 blob 下载被 WebView 忽略，
   *  改为直接分享到 QQ/微信等，另一台设备再「用其他应用打开」分享回工具箱导入。 */
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
        setActionError(null);
        setImportMessage(`已发起分享 ${snapshots.length} 个账号的数据`);
        return;
      }
      // 2) 网页 Web Share API（手机浏览器）
      if (typeof navigator !== 'undefined' && navigator.share) {
        const file = new File([text], fileName, { type: 'application/json' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: '小布助手数据备份' });
          setActionError(null);
          setImportMessage(`已分享 ${snapshots.length} 个账号的数据`);
          return;
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setActionError(null);
        return; // 用户取消分享，什么都不提示
      }
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
    setActionError(null);
    setImportMessage(`已导出 ${snapshots.length} 个账号的数据`);
  };

  /** 合并导入：把另一台设备的备份合并进本地（本地独有的账号不会被清掉） */
  const handleImportBackup = async (file: File) => {
    try {
      const raw = JSON.parse(await file.text()) as unknown;
      const backup = parseToolboxBackup(raw);
      const previous = snapshots;
      const planBefore = [...getMotherPlan()];
      const merged = mergeSnapshots(snapshots, backup.accounts);
      const confirmed = window.confirm(
        `合并导入：本地独有的账号会保留；两边都有的账号取导入时间较新的那份。\n\n` +
          `备份里 ${backup.accounts.length} 个账号 → 新增 ${merged.added.length} · ` +
          `更新 ${merged.updated.length} · 保留本地较新 ${merged.kept.length}\n\n确定继续吗？`,
      );
      if (!confirmed) return;
      const operationId = beginImport();
      currentOp.current = operationId;

      await writeSnapshots(merged.snapshots);
      await refreshSnapshots();
      reportNewPets(previous, merged.snapshots, operationId, mode);
      setActionError(null);
      const text = [
        mergeMessage(file.name, merged),
        ...applyBackupPlanning(backup),
        ...achievementMessages(previous, merged.snapshots, planBefore),
      ].join('；');
      setImportMessage(text);
      updateImportOutcome(operationId, {
        local: 'saved',
        message: text,
        cloud: readAccountId() ? 'syncing' : 'not-enabled',
      });
      // 合并导入也可能带进新蛋：与主入口一样跑自动发布与待结单提醒
      afterImport(
        operationId,
        merged.snapshots,
        new Set(backup.accounts.map((account) => account.accountKey ?? accountKeyOf(account))),
      );
    } catch (error) {
      // JSON.parse 的 SyntaxError 是英文原文（"Unexpected token..."），换成用户能看懂的提示
      setActionError(
        error instanceof SyntaxError
          ? '备份文件不是有效的 JSON：请确认选的是小布助手导出的备份'
          : error instanceof Error
            ? error.message
            : '合并导入失败',
      );
    }
  };

  /** 设置类内容（导出/合并导入/重置、隐私开关、数据来源）：
   *  「我的」页重排后由设置区块挂一个 settingsOnly 面板，主面板用 hideSettings 下沉。 */
  const showSettings = settingsOnly || !(compact || hideSettings);
  const settingsBlocks = (
    <>
      {/* 低频操作收在底部、默认收起：导出 / 合并导入 / 重置。
          合并导入与主按钮、分享导入重复度很高（换设备也已经有云同步），所以下沉到这里。
          紧凑模式（空态）不渲染：这些都是设置，不是新用户的首屏动作。 */}
      {showSettings ? (
      <section className="rounded-2xl bg-white shadow-sm" data-testid="import-more">
        <button
          type="button"
          aria-expanded={moreOpen}
          onClick={() => setMoreOpen((open) => !open)}
          data-testid="import-more-toggle"
          className="flex min-h-[36px] w-full items-center justify-between px-3 text-left text-sm font-medium text-slate-500"
        >
          <span>更多（导出 / 合并导入 / 重置）</span>
          <span className="text-xs text-slate-300" aria-hidden>
            {moreOpen ? '▲' : '▼'}
          </span>
        </button>
        {moreOpen ? (
          <div className="px-3 pb-3" data-testid="import-more-body">
            <div className="flex gap-2">
              <button
                type="button"
                data-testid="export-button"
                disabled={snapshots.length === 0}
                onClick={() => void handleExport()}
                className="flex min-h-[36px] flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 disabled:text-slate-300"
              >
                导出全部数据
              </button>
              <button
                type="button"
                data-testid="import-backup-button"
                onClick={() => backupInputRef.current?.click()}
                className="flex min-h-[36px] flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
              >
                合并导入
              </button>
            </div>
            <input
              ref={backupInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              data-testid="backup-input"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleImportBackup(file);
                event.target.value = '';
              }}
            />
            <p className="mt-1 text-xs text-slate-400">
              导出自己的账号数据；换设备首选上面的「云同步」。
            </p>
            {snapshots.length > 0 ? (
              <button
                type="button"
                onClick={() => void handleReset()}
                className="mt-2 flex min-h-[36px] w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600"
              >
                重置导入数据
              </button>
            ) : null}
          </div>
        ) : null}
      </section>
      ) : null}

      {/* 匿名统计开关（2026-10-06）：只报「设备 + 用了哪个功能」，可随时关掉。
          设置类内容，紧凑模式（空态）不渲染。 */}
      {showSettings ? (
      <section className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-700">匿名使用统计</p>
          <p className="mt-0.5 text-xs text-slate-400">
            只记录「哪台设备用了哪个功能」，不含精灵内容；用来知道哪些功能真有人用
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={analyticsOn}
          data-testid="analytics-toggle"
          onClick={() => {
            const next = !analyticsOn;
            setAnalyticsEnabled(next);
            setAnalyticsOn(next);
          }}
          className={`min-h-[28px] shrink-0 rounded-md border px-2.5 text-xs font-medium ${
            analyticsOn
              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
              : 'border-slate-200 bg-white text-slate-400'
          }`}
        >
          {analyticsOn ? '已开启' : '已关闭'}
        </button>
      </section>
      ) : null}

      {showSettings ? <SourceNotice /> : null}
    </>
  );

  // 设置区块里的弹层只挂设置，不再重复整块导入面板
  if (settingsOnly) {
    return (
      <div className="space-y-3" data-testid="import-settings">
        {settingsBlocks}
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="import-panel" data-compact={compact ? 'true' : undefined}>
      {/* 用真正的 button 触发隐藏 input：部分手机内置浏览器对 label 包裹 hidden input 支持不佳 */}
      <button
        type="button"
        data-testid="import-button"
        data-tour="profile-import"
        onClick={() => fileInputRef.current?.click()}
        className="flex min-h-[44px] w-full items-center justify-center rounded-lg bg-emerald-600 px-4 text-base font-medium text-white"
      >
        {importing ? '导入中…' : '导入游戏数据'}
      </button>
      <p className="-mt-1 text-center text-xs text-slate-500">
        采集器分享到「小布助手」会自动导入；也可手选 .pcap / .json（可多选）
      </p>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json,.pcap,application/vnd.tcpdump.pcap"
        multiple
        className="hidden"
        data-testid="import-input"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) void handleImport(files);
          event.target.value = '';
        }}
      />

      {/* 导入结果 / 错误紧跟主按钮：导入失败、合并结果都在这里第一时间看到 */}
      {importError || actionError ? (
        <div className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700">
          {importError ?? actionError}
        </div>
      ) : null}
      {dataMessage ? (
        <p className="-mt-1 text-xs text-emerald-700" data-testid="data-message">
          {dataMessage}
        </p>
      ) : null}

      {!loaded ? (
        <div className="min-h-[44px] rounded-lg bg-slate-50 p-3" aria-busy="true" data-testid="import-loading">
          <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
          <div className="mt-1.5 h-3 w-3/4 animate-pulse rounded bg-slate-200" />
        </div>
      ) : snapshots.length === 0 && !hideEmptyHint ? (
        <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500" data-testid="import-empty">
          还没有数据。用上面的「导入游戏数据」或本机采集导入一次，看板会自动算出两块进度。
        </div>
      ) : null}

      {/* 当前数据状态放在主按钮下面：有几个账号、上次什么时候导的 */}
      {loaded && snapshots.length > 0 ? (
        <p className="text-xs text-slate-500">
          <span>{snapshots.length} 个账号</span>
          {lastImportedAt ? <span> · 上次导入 {new Date(lastImportedAt).toLocaleString()}</span> : null}
        </p>
      ) : null}

      {stale ? (
        <div className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-800">
          数据已超过一周未更新，请重新导入抓包数据。
        </div>
      ) : null}

      {autoConflict ? (
        <div
          className="rounded-lg bg-rose-100 px-3 py-2 text-sm text-rose-700"
          data-testid="sync-conflict-notice"
        >
          已保存到本机。云端刚被别的设备改过，这次自动同步没完成——到下面「云同步」点一次「立即同步」即可。
        </div>
      ) : null}

      {syncNotice ? (
        <div
          className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-800"
          data-testid="sync-adopted-notice"
        >
          {syncNotice}
        </div>
      ) : null}

      {/* 云同步面板已移到「我的 · 工具箱身份 / 私有同步」（2026-10-24）：这里不再重复挂载认证与同步 */}
      {/* 导入历史入口（「本次新增」明细在看板，2026-10-05 用户拍板） */}
      {importHistory.length > 0 && !compact ? <ImportResultCard /> : null}

      {compact ? null : afterAnalytics}

      {showSettings ? settingsBlocks : null}
    </div>
  );
}
