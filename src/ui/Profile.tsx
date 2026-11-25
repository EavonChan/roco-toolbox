import type { NavigationIntent, ProfileSection } from './navigation';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { appUpdateSnapshot, checkAppUpdate, hasAppUpdateShell, installAppUpdateBridge, seedAppUpdate, subscribeAppUpdate } from '../collector/appUpdate';
import { readAccountId, subscribeSession } from '../api/session';
import { AccountPanel } from './AccountPanel';
import { CollectionGroups } from './CollectionGroups';
import { Nearby } from './Nearby';
import { NearbyErrorBoundary } from './NearbyErrorBoundary';
import { ImportOutcomeNotice } from './ImportOutcomeNotice';
import { ImportPanel } from './ImportPanel';
import { NativeCollectorPanel } from './NativeCollectorPanel';
import { ProfileHeader } from './ProfileHeader';
import { ProfileQuickEntries } from './ProfileQuickEntries';
import { Button } from './primitives/Button';
import { ServerAddressPanel, serverBridge, toggleServer } from './ServerAddressPanel';
import { serverEnvOf } from './serverEnv';
import { StateNotice } from './primitives/StateNotice';
import { setSyncConflict, useSyncFeedback } from './syncNoticeStore';
import { useSnapshots } from './useSnapshots';

export type ProfileDataView = 'import' | 'nearby';

export interface ProfileProps {
  section: ProfileSection;
  returnToGroups: boolean;
  onNavigate: (intent: NavigationIntent) => void;
  /** 重播「先导入一次」的首启引导（入门卡上的「教程」按钮） */
  onStartTour?: () => void;
  /** 「游戏数据」里的二级视图：导入 / 附近（附近不再是独立页签，2026-11-21） */
  dataView?: ProfileDataView;
  /** 小组资源的编辑草稿有没有未保存改动（离开时拦一下） */
  onDraftDirtyChange?: (dirty: boolean) => void;
}

/** 内测入口：2 秒内连点版本号 5 次，在测试站 / 正式站之间互切 */
const VERSION_TAPS = 5;
const TAP_WINDOW_MS = 2000;

/** 一行一个目的地（2026-11-25 U2）：48px 行高满足「导航保留 40~44px」。 */
function ProfileRow({
  testId,
  label,
  value,
  onClick,
}: {
  testId: string;
  label: string;
  value?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      data-testid={testId}
      className="flex min-h-[48px] w-full items-center gap-2 px-4 text-left text-sm text-slate-800 disabled:text-slate-500"
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {value ? <span className="shrink-0 text-xs text-slate-500">{value}</span> : null}
      <span aria-hidden className="shrink-0 text-slate-300">
        ›
      </span>
    </button>
  );
}

/** 分组列表容器：标题 11px 灰字 + 分隔线，行与行之间不画卡片。 */
function ProfileList({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <h2 className="px-4 pb-1 pt-3 text-[11px] font-semibold tracking-wide text-slate-400">{title}</h2>
      <div className="divide-y divide-slate-100">{children}</div>
    </section>
  );
}

/**
 * 「我的」（2026-11-25 U2 方案 A）。
 *
 * 结构从「三段式分段控件」改成「首页 + 行 → 二级分区」：
 * 1. 账号概览卡（谁在用 / 几个角色 / 上次采集）；
 * 2. 三个高频入口（采集数据 / 我的蛋仓 / 我的小组）；
 * 3. 采集与导入（本机采集 + 导入卡，导入仍是这一页的主动作）；
 * 4. 账号 / 设置与帮助 两组列表，行为一行一个目的地。
 *
 * 分区内容（小组 / 身份 / 游戏数据）原样保留，只是入口从分段按钮换成列表行；
 * `profile-section-*` 的 testid 仍然挂在可点击元素上，e2e 点击路径不变。
 */
export function Profile({
  section,
  returnToGroups,
  onNavigate,
  onStartTour,
  dataView = 'import',
  onDraftDirtyChange,
}: ProfileProps) {
  // 导入后的自动上传冲突仍以 syncNoticeStore 为准，交给 AccountPanel 二选一
  const { conflict: autoConflict } = useSyncFeedback();
  // 入门卡只在「本机还没有任何导入数据」时出现：导入过一次就不再打扰（2026-11-01）
  const { snapshots, loaded } = useSnapshots();
  // 登录态（本机模式 / 已登录）：概览卡与蛋仓入口都要用；只读，不在这里做登录
  const accountId = useSyncExternalStore(subscribeSession, readAccountId, () => null);
  // 更新入口（1.3.6）：壳负责检查 / 下载 / 安装，这里只显示状态与触发
  const update = useSyncExternalStore(subscribeAppUpdate, appUpdateSnapshot);
  const [updateSupported] = useState(hasAppUpdateShell);
  useEffect(() => {
    installAppUpdateBridge();
    seedAppUpdate();
  }, []);
  // 「服务器地址」只在内测壳里存在：浏览器没有 RocoServer，连点也不会开
  const [serverPanelOpen, setServerPanelOpen] = useState(false);
  const [serverSwitching, setServerSwitching] = useState(false);
  const [serverNotice, setServerNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const versionTaps = useRef<number[]>([]);
  /** 「采集数据」入口：把视线带到下面的采集 / 导入块（不再多一次跳页） */
  const collectRef = useRef<HTMLDivElement>(null);

  const onVersionTap = () => {
    const bridge = serverBridge();
    if (!bridge || serverSwitching) return;
    const now = Date.now();
    versionTaps.current = [...versionTaps.current, now].filter((at) => now - at < TAP_WINDOW_MS);
    if (versionTaps.current.length < VERSION_TAPS) return;
    versionTaps.current = [];
    // 1.3 内测包默认测试站：连点直接在测试站 / 正式站之间互切（成功时壳会清缓存并重载页面）
    setServerSwitching(true);
    setServerNotice({ kind: 'ok', text: '正在探活并切换服务器…' });
    // 桥调用是同步阻塞的（探活最多 5 秒），先让「切换中」画出来再进桥
    window.setTimeout(() => {
      const result = toggleServer(bridge);
      setServerSwitching(false);
      if (result.ok) {
        setServerNotice({ kind: 'ok', text: result.message });
        return;
      }
      // 探活失败时壳不会重载：把原因留在页面上，并打开手动面板兜底
      setServerNotice({ kind: 'error', text: result.message });
      setServerPanelOpen(true);
    }, 30);
  };

  const env = serverEnvOf(typeof window === 'undefined' ? '' : window.location.hostname);
  const envMeta = {
    test: { label: '内测', cls: 'border-orange-200 bg-orange-50 text-orange-600' },
    prod: { label: '正式', cls: 'border-slate-200 bg-slate-100 text-slate-500' },
    custom: { label: '自定义', cls: 'border-sky-200 bg-sky-50 text-sky-600' },
  }[env];
  // 环境角标不再单独占右上角（2026-11-21）：跟着版本信息走——有更新入口时在「检查更新」卡里，
  // 浏览器（没有壳）挂在底部版本号行上，两处只出现一份。
  const envBadge = (
    <span
      data-testid="env-badge"
      data-env={env}
      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${envMeta.cls}`}
    >
      {envMeta.label}
    </span>
  );

  const goSection = (next: ProfileSection) => onNavigate({ type: 'open-profile', section: next });
  const backToProfile = () => goSection('data');
  /** 二级分区（小组 / 我的身份）左上角的返回行；就是回到「我的」首页（数据视图）。 */
  const backRow = (
    <button
      type="button"
      onClick={backToProfile}
      data-testid="profile-section-data"
      className="flex min-h-[44px] w-full items-center gap-1 px-1 text-left text-sm font-medium text-emerald-700"
    >
      ‹ 返回我的
    </button>
  );

  return (
    <main className="mx-auto max-w-md space-y-3 p-4">
      {serverNotice ? (
        <p
          className={`text-xs ${serverNotice.kind === 'ok' ? 'text-emerald-700' : 'text-rose-600'}`}
          data-testid="server-switch-notice"
          aria-live="polite"
        >
          {serverNotice.text}
        </p>
      ) : null}

      {section === 'data' && dataView === 'nearby' ? (
        <>
          {backRow}
          <NearbyErrorBoundary>
            <Nearby embedded onNavigate={onNavigate} />
          </NearbyErrorBoundary>
        </>
      ) : null}

      {section === 'data' && dataView === 'import' ? (
        <>
          <ProfileHeader
            snapshots={snapshots}
            accountId={accountId}
            onGoAccount={() => goSection('identity')}
          />
          <ProfileQuickEntries
            eggStockHint={accountId ? '换蛋 · 蛋仓' : '需登录'}
            onCollect={() => collectRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })}
            onEggStock={() => onNavigate({ type: 'open-egg-stock' })}
            onGroups={() => goSection('groups')}
          />

          {loaded && snapshots.length === 0 ? (
            <section className="rounded-2xl bg-white p-4 shadow-sm" data-testid="first-run-card">
              <h2 className="text-base font-semibold text-slate-900">先采集一次，看看还缺什么</h2>
              <p className="mt-1 text-sm text-slate-600">
                小布助手帮你算洛克王国的孵蛋缺口：还缺哪只母本、怎么配窝、跟谁换蛋。
                都按你导入的游戏数据算，数据只存在本机。
              </p>
              <p className="mt-2 text-xs text-slate-500">
                导入后可去「看板」看缺什么、「收集」补齐、「换蛋」互换。
              </p>
              {onStartTour ? (
                <Button
                  variant="secondary"
                  className="mt-2"
                  onClick={onStartTour}
                  data-testid="first-run-guide"
                >
                  教程
                </Button>
              ) : null}
            </section>
          ) : null}

          <div ref={collectRef} className="space-y-3" data-testid="profile-collect">
            <ImportOutcomeNotice onOpenGroups={() => onNavigate({ type: 'open-groups' })} />
            <NativeCollectorPanel />
            {/* 私有同步（2026-11-21 从独立分区挪到这里）：本机采集 / 导入的下方 */}
            <ImportPanel
              afterAnalytics={
                <AccountPanel
                  section="sync"
                  autoConflict={autoConflict}
                  onAutoConflictHandled={() => setSyncConflict(null)}
                />
              }
            />
          </div>

          <ProfileList title="数据">
            <ProfileRow
              testId="data-view-nearby"
              label="附近精灵"
              value="采集时实时看"
              onClick={() => onNavigate({ type: 'tab', page: 'nearby' })}
            />
          </ProfileList>

          <ProfileList title="账号">
            <ProfileRow
              testId="profile-section-identity"
              label="我的身份"
              value={accountId ? '已登录' : '未登录'}
              onClick={() => goSection('identity')}
            />
          </ProfileList>

          <ProfileList title="设置与帮助">
            <ProfileRow
              testId="profile-guide"
              label="新手引导"
              value="重看一遍"
              onClick={onStartTour}
            />
          </ProfileList>
        </>
      ) : null}

      {section === 'groups' ? (
        <>
          {backRow}
          {returnToGroups ? (
            <Button
              variant="secondary"
              onClick={() => onNavigate({ type: 'open-groups' })}
              data-testid="profile-return-groups"
            >
              返回小组
            </Button>
          ) : null}
          <CollectionGroups
            embedded
            variant="admin"
            onDraftDirtyChange={onDraftDirtyChange}
            onGoAccount={() => goSection('identity')}
          />
        </>
      ) : null}

      {section === 'identity' ? (
        <>
          {backRow}
          {returnToGroups ? (
            <Button
              variant="secondary"
              onClick={() => onNavigate({ type: 'open-groups' })}
              data-testid="profile-return-groups"
            >
              返回小组
            </Button>
          ) : null}
          <StateNotice
            kind="unknown"
            title="我的身份"
            description="用来跨设备同步同一份数据。游戏账号（UID）是游戏里的角色，在「游戏数据」里单独管理。"
            testId="profile-identity-intro"
          />
          <AccountPanel
            section="identity"
            autoConflict={autoConflict}
            onAutoConflictHandled={() => setSyncConflict(null)}
          />
        </>
      ) : null}

      {/* 更新入口 A：左「检查更新 / 当前版本」右按钮；有新版变「更新」并显示新版本号 */}
      {updateSupported ? (
        <section className="flex items-center justify-between gap-2 rounded-2xl bg-white p-4 shadow-sm" data-testid="app-update-card">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-slate-800">检查更新</p>
              {envBadge}
            </div>
            <p className="text-xs text-slate-500">当前版本 {update.current || '—'}</p>
            {update.state === 'available' ? (
              <p className="text-xs text-emerald-700">发现新版本 {update.latest}</p>
            ) : update.state === 'latest' ? (
              <p className="text-xs text-slate-400">已是最新版本</p>
            ) : update.state === 'failed' ? (
              <p className="text-xs text-rose-600">{update.message ?? '检查失败，请稍后重试'}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => { checkAppUpdate(); }}
            disabled={update.state === 'checking'}
            data-testid="app-update-button"
            className="min-h-[28px] shrink-0 rounded-lg border border-slate-200 px-2 text-xs text-slate-600 disabled:text-slate-300"
          >
            {update.state === 'available' ? '更新' : update.state === 'checking' ? '检查中' : '检查'}
          </button>
        </section>
      ) : null}

      {/* 构建时间（原顶栏版本标记）：排障时确认「拿到的是不是最新一版」 */}
      <div
        className="flex flex-col items-center gap-1 pt-1"
        data-testid="app-version"
        onClick={onVersionTap}
      >
        <span className="text-[10px] text-slate-300">版本 {__APP_BUILD__}</span>
        {updateSupported ? null : envBadge}
      </div>

      {serverPanelOpen ? (
        <ServerAddressPanel onClose={() => setServerPanelOpen(false)} />
      ) : null}

    </main>
  );
}
