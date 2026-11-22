import { useSyncExternalStore } from 'react';
import type { AppPage } from './navigation';
import {
  getPlanAlertBadge,
  subscribePlanAlertBadge,
} from './plan/planAlertsStore';

export type TabId = AppPage;

export interface TabNavProps {
  active: TabId;
  onChange: (tab: TabId) => void;
}

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'dashboard', label: '看板' },
  { id: 'home', label: '家园' },
  { id: 'collection', label: '收集' },
  { id: 'groups', label: '换蛋' },
  { id: 'profile', label: '我的' },
];

/**
 * 五入口主导航（2026-11-21）：看板 / 家园 / 收集 / 换蛋 / 我的。
 *
 * 「附近」不再是独立页签：它挂进「我的 · 游戏数据」（页面仍是 `nearby`，
 * 由 App 渲染成我的页里的「附近」子视图，见 Profile 的 dataView）。
 * 「小组」的管理入口搬进「我的 · 小组」后，这个页签只剩换蛋/需求广场，因此改名叫「换蛋」。
 * 「换蛋」上的红点数字 = 待我确认 + 新提供（本机已读水位，见 planAlertsStore）。
 */
export function TabNav({ active, onChange }: TabNavProps) {
  const planBadge = useSyncExternalStore(subscribePlanAlertBadge, getPlanAlertBadge, () => 0);
  return (
    <nav className="flex border-b border-slate-100 bg-white px-2" data-tour="tab-nav">
      {TABS.map((tab) => {
        const badge = tab.id === 'groups' ? planBadge : 0;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            aria-current={active === tab.id ? 'page' : undefined}
            aria-label={tab.label}
            // 新手引导要能单独框到某个页签（例如首启先指「我的」）
            data-tour={`tab-${tab.id}`}
            className={`relative min-h-[40px] flex-1 border-b-2 px-2 text-sm font-medium ${
              active === tab.id
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500'
            }`}
          >
            {tab.label}
            {badge > 0 ? (
              <span
                className="ml-1 inline-flex min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-[16px] text-white"
                data-testid="tab-badge-groups"
              >
                {badge > 99 ? '99+' : badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
