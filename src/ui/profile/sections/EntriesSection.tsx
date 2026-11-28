import { ProfileQuickEntries } from '../../ProfileQuickEntries';
import type { SectionProps } from '../types';

/**
 * 三个入口（首屏第三块，2026-11-28 重排）：采集 / 蛋仓 / 小组。
 * 超过三个入口就违反产品规范 §0.5，其它入口放到下面的「更多」区块。
 */
export function EntriesSection({ ctx }: SectionProps) {
  return (
    <div data-section="entries">
      <ProfileQuickEntries
        eggStockHint={ctx.accountId ? '换蛋 · 蛋仓' : '需登录'}
        onCollect={ctx.onCollect}
        onEggStock={ctx.onGoEggStock}
        onGroups={ctx.onGoGroups}
      />
    </div>
  );
}
