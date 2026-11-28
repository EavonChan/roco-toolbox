/**
 * 无数据时的统一空态。
 *
 * 2026-11-28 CLEAN2：文件导入删除后，空态只指向「采集 / 登录同步」这两条真实路径，
 * 不再让用户去找不存在的「导入数据」按钮。
 */
import { Button } from './primitives/Button';
import { StateNotice } from './primitives/StateNotice';

export interface EmptyStateProps {
  /** 跳到「我的 · 采集与同步」；不给时只显示文案（用于无法导航的场景） */
  onGoImport?: () => void;
}

export function EmptyState({ onGoImport }: EmptyStateProps = {}) {
  return (
    <StateNotice
      kind="empty-data"
      title="还没有数据"
      description="到电脑版或安卓版采集一次，或登录同一账号同步后，这里就有内容了。"
      testId="empty-state"
      action={
        onGoImport ? (
          <Button onClick={onGoImport} data-testid="empty-go-import">
            去采集 / 同步
          </Button>
        ) : undefined
      }
    />
  );
}
