import type { TargetMode } from '../../domain/petFilters';
import type { AccountSnapshot } from '../../domain/parseBackup';
import type { NatureOverrides } from '../../domain/recommendedNatures';
import type { StudRecommendation } from '../../domain/suggestions';
import type { SpeciesEntry } from '../../domain/types';
import type {
  CollectionDemand,
  CollectionTaskRecord,
  MotherTargetConfig,
} from '../../shared/collectionGroups';
import type { MotherGroupDetail } from '../../shared/motherGroups';

/**
 * `GroupPlanHub` 的 props（2026-11-28 CLEAN2 从已删除的 `MotherGroupResources` 搬出）。
 *
 * 原来 `GroupPlanHub` 只 `import type { MotherGroupResourcesProps }` 拿类型，
 * 组件本体早已没人渲染；删组件前把类型单独留在这里，避免为了一个类型留下 4203 行死文件。
 * 本类型同时用于小组页的资源 / 计划入口。
 */
export interface MotherGroupResourcesProps {
  group: MotherGroupDetail;
  viewerAccountId: string;
  species: SpeciesEntry[];
  catalogVersion: string;
  /** 本机背包：用来判断我是否已有现货、能否同账号可孵、结单是否真的匹配。 */
  snapshots?: readonly AccountSnapshot[];
  /** 本组口径；旧组 / 不传时按一期固定口径。 */
  criteriaId?: string;
  /** 本组目标：用来显示真实口径（模式 / 体型 / 声音 / 推荐性格），不传时退回一期文案。 */
  target?: MotherTargetConfig | null;
  /** 优质种公推荐（与看板同源）；种公页使用。 */
  recommendations?: StudRecommendation[];
  /** 全局目标模式（推荐档位的展示与产线档位）。 */
  targetMode?: TargetMode;
  /** 个人推荐性格覆盖：母本卡片显示「我的目标」；不传时退回组目标。 */
  natureOverrides?: NatureOverrides;
  /** 当前种公目标有多少个蛋组；0 = 还没设目标，不能误报「已全通」。 */
  studGroupCount?: number;
  /** 共同寻找的任务与确认状态；不传时只看资源。 */
  tasks?: CollectionTaskRecord[];
  tasksConfirmed?: boolean;
  tasksPendingMemberIds?: string[];
  tasksLoading?: boolean;
  tasksError?: string;
  isOwner?: boolean;
  onClaimTask?: (targetKey: string) => Promise<void>;
  onReleaseTask?: (targetKey: string) => Promise<void>;
  onTransferTask?: (targetKey: string, toAccountId: string) => Promise<void>;
  /** 组内需求（2026-10-26）：我缺的用来发需求，需求中心用来承接与督促。 */
  demands?: CollectionDemand[];
  /**
   * 服务端聚合的已结单数（2026-11-01）：需求列表不再下发已完成行，
   * 优先用它；不传时退回按 demands 本地统计（兼容旧服务端 / 旧调用方）。
   */
  completedCounts?: Record<string, number>;
  /** 我承接的最近 N 条已完成（服务端给），供完成回执；不传时退回 demands 里的 done 行。 */
  myRecentCompleted?: CollectionDemand[];
  onPublishDemand?: (
    eggGameId: number,
    natures: string[],
    criteria: Pick<CollectionDemand, 'gender' | 'body' | 'voice' | 'requireGreenNest'>,
  ) => Promise<unknown>;
  onWithdrawDemand?: (
    eggGameId: number,
    criteria: Pick<CollectionDemand, 'nature' | 'gender' | 'body' | 'voice'>,
  ) => Promise<unknown>;
  onClaimDemand?: (demand: CollectionDemand) => Promise<unknown>;
  onReleaseDemand?: (demand: CollectionDemand) => Promise<unknown>;
  onCompleteDemand?: (demand: CollectionDemand) => Promise<unknown>;
}
