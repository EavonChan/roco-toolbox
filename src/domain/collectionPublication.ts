import type { GroupTargetConfig, PublishedStudResource } from '../shared/collectionGroups';
import { motherResourceCriteriaIdOf, type PublishedMotherResource } from '../shared/motherGroups';
import { isMotherResourceComparable } from './motherSharing';
import { isStudResourceComparable } from './studSharing';

/**
 * 小组「我的共享资源」状态（2026-10-25 从旧 `MotherSharing` 补回）。
 *
 * 二期重写小组页时只保留了「已发布 / 未发布」，把「需更新」丢了：导入新数据后，
 * 本机重建出的资源与服务器上已发布的不一致，但界面仍显示「已发布」，用户不知道要重新发布。
 *
 * 判定 = 摘要仍与当前口径/图鉴可比 **且** 与已发布内容完全一致；任一不满足都是「需更新」。
 */
export type GroupPublicationStatus = '未发布' | '已发布' | '需更新';

/**
 * 组卡右侧按钮的文案（2026-11-27 改名）。
 *
 * 用户原话「没找到绑的地方，只登录了」：界面叫「选号并发布」，机器人 ingest 查的是
 * 「这个游戏 UID 有没有出现在 `mother_group_accounts`」。同一件事两个词，所以入口统一说「绑定」，
 * 让在群里看到「蛋仓未同步（这个 UID 还没绑定到小组成员）」的人，回到站内能对上这个词。
 */
export const publicationActionLabel = (
  status: GroupPublicationStatus,
  editing: boolean,
): string => {
  if (editing) return '收起';
  if (status === '需更新') return '更新绑定';
  if (status === '已发布') return '已绑定的账号';
  return '绑定游戏账号';
};

/** 按钮下的一行说明：点明这步和机器人的关系（别让人以为只是「共享给组员看」）。 */
export const PUBLICATION_BIND_HINT = '机器人靠这个把蛋同步到蛋仓';

export function groupPublicationStatus(input: {
  type: 'mother' | 'stud';
  mother: PublishedMotherResource | null;
  stud: PublishedStudResource | null;
  target: GroupTargetConfig | null;
  targetRevision: number;
  catalogVersion: string;
  /** 本机数据重建的资源是否与已发布的一致（没有可重建数据时按 true 传） */
  unchanged: boolean;
}): GroupPublicationStatus {
  const published = input.type === 'stud' ? input.stud : input.mother;
  if (!published) return '未发布';
  const comparable =
    input.type === 'stud'
      ? input.target?.kind === 'stud' &&
        isStudResourceComparable(input.stud, input.target, input.targetRevision, input.catalogVersion)
      : // 2026-10-29：产线口径（目标模式）编进 criteriaId；组长切模式后旧摘要自动需更新。
        isMotherResourceComparable(
          input.mother,
          input.catalogVersion,
          motherResourceCriteriaIdOf(
            input.target?.kind === 'mother' ? input.target.mode : 'perfect',
          ),
        );
  return comparable && input.unchanged ? '已发布' : '需更新';
}
