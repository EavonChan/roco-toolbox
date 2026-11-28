import { useState, type ReactNode } from 'react';
import { ImportPanel } from '../../ImportPanel';
import { ModalSurface } from '../../primitives/ModalSurface';
import type { SectionProps } from '../types';

/**
 * 更多与设置（2026-11-28 重排）：这里只放**导航与帮助**，不放业务数字。
 *
 * 设置类内容（导出 / 合并导入 / 重置、隐私开关、数据来源）按规范 §0.4 不进首屏：
 * 它们收在同一行的弹层里，首屏只留一个入口。
 */
function SettingsList({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <h2 className="px-s4 pb-s1 pt-s3 text-caption font-semibold tracking-wide text-ink-muted">
        {title}
      </h2>
      <div className="divide-y divide-line">{children}</div>
    </section>
  );
}

function SettingsRow({
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
      className="flex min-h-12 w-full items-center gap-s2 px-s4 text-left text-body text-ink transition-colors active:bg-surface-sunken disabled:text-ink-muted disabled:active:bg-transparent"
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {value ? <span className="shrink-0 text-meta text-ink-muted">{value}</span> : null}
      <span aria-hidden className="shrink-0 text-ink-faint">
        ›
      </span>
    </button>
  );
}

export function SettingsSection({ ctx }: SectionProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div data-section="settings" className="space-y-s3">
      <SettingsList title="更多">
        <SettingsRow
          testId="data-view-nearby"
          label="附近精灵"
          value="采集时实时看"
          onClick={ctx.onGoNearby}
        />
        <SettingsRow
          testId="profile-section-identity"
          label="我的身份"
          value={ctx.accountId ? ctx.accountName || '已登录' : '未登录'}
          onClick={ctx.onGoIdentity}
        />
      </SettingsList>

      <SettingsList title="设置与帮助">
        <SettingsRow testId="profile-guide" label="新手引导" value="重看一遍" onClick={ctx.onStartTour} />
        <SettingsRow
          testId="profile-settings-more"
          label="导出 / 隐私"
          value="设置"
          onClick={() => setSettingsOpen(true)}
        />
      </SettingsList>

      <ModalSurface
        open={settingsOpen}
        title="更多与隐私"
        onClose={() => setSettingsOpen(false)}
        testId="profile-settings-dialog"
        closeTestId="profile-settings-close"
      >
        <div className="p-s4">
          <ImportPanel />
        </div>
      </ModalSurface>
    </div>
  );
}
