import { EmptyState } from '../../kit';
import { ImportPanel } from '../../ImportPanel';
import type { SectionProps } from '../types';

/**
 * 新用户空态（2026-11-28，RUI-03）：**一句空态 + 一个动作**。
 *
 * 以前首屏有 4 块都在说「还没有数据」（引导卡 / 本机采集说明 / 导入按钮 / 导入面板空态），
 * 现在只保留这一块；导入成功后本区块消失，数字与入口区块接管首屏。
 */
export function NewUserSection(_props: SectionProps) {
  return (
    <div data-section="new-user" data-testid="profile-new-user" className="space-y-s3">
      <EmptyState
        title="还没有导入数据"
        description="导入一次游戏数据，看板和这里都会按它算；数据只存在本机。"
        testId="profile-new-user-empty"
      />
      {/* 紧凑模式：只留导入按钮与导入结果；设置类内容不下沉到空态里 */}
      <ImportPanel compact hideEmptyHint />
    </div>
  );
}
