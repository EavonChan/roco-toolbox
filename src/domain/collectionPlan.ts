import type { EggDemand } from '../shared/eggMatching';
import type { WorkflowTrade } from '../shared/eggWorkflow';

export type CollectionPlanStatus =
  | 'planned'
  | 'published'
  | 'proposal'
  | 'in_progress'
  | 'received';

export interface CollectionPlanMotherGroup {
  chainKey: string;
  eggGameId: number;
  formLabel: string;
  number: string;
  eggGroups: readonly number[];
}

export interface CollectionPlanMember {
  accountId: string;
  displayName: string;
}

export interface CollectionPlanCard {
  eggGameId: number;
  chainKey: string;
  name: string;
  number: string;
  eggGroups: readonly number[];
  natures: string[];
  publishedNatures: string[];
  status: CollectionPlanStatus;
  statusLabel: string;
  statusDetail: string;
  acceptedBy: string[];
  remaining: number;
}

export interface BuildCollectionPlanCardsInput {
  planKeys: readonly string[];
  motherGroups: readonly CollectionPlanMotherGroup[];
  naturesByEgg: ReadonlyMap<number, readonly string[]>;
  demands: readonly EggDemand[];
  trades: readonly WorkflowTrade[];
  members: readonly CollectionPlanMember[];
  viewerAccountId: string;
}

const namesOf = (ids: readonly string[], members: readonly CollectionPlanMember[]): string[] => {
  const byId = new Map(members.map((member) => [member.accountId, member.displayName]));
  return [...new Set(ids.map((id) => byId.get(id) ?? '组员'))];
};

const natureOfTrade = (trade: WorkflowTrade, demand: EggDemand): string =>
  demand.natures.includes(trade.give.nature) ? trade.give.nature : '';

/**
 * 把本地母本计划和小组需求/交换聚合成「收集中」任务卡。
 *
 * 一个蛋一张卡；性格保留为子请求。这里不判断亲本占用或资源是否还能交换，
 * 那些事实由服务端在接受时裁决。本函数只把服务器已经给出的事实翻成用户能读懂的状态。
 */
export function buildCollectionPlanCards(
  input: BuildCollectionPlanCardsInput,
): CollectionPlanCard[] {
  const {
    planKeys,
    motherGroups,
    naturesByEgg,
    demands,
    trades,
    members,
    viewerAccountId,
  } = input;
  const plannedChains = new Set(planKeys);
  const groupByEgg = new Map<number, CollectionPlanMotherGroup>();
  const groupByChain = new Map<string, CollectionPlanMotherGroup>();
  for (const group of motherGroups) {
    groupByEgg.set(group.eggGameId, group);
    groupByChain.set(group.chainKey, group);
  }

  const eggs = new Set<number>();
  for (const chain of planKeys) {
    const group = groupByChain.get(chain);
    if (group) eggs.add(group.eggGameId);
  }
  for (const demand of demands) {
    if (demand.demanderAccountId === viewerAccountId && demand.status !== 'withdrawn') {
      eggs.add(demand.eggGameId);
    }
  }

  const cards: CollectionPlanCard[] = [];
  for (const eggGameId of eggs) {
    const group = groupByEgg.get(eggGameId);
    if (!group) continue;
    const ownDemands = demands.filter(
      (demand) =>
        demand.eggGameId === eggGameId &&
        demand.demanderAccountId === viewerAccountId &&
        demand.status !== 'withdrawn',
    );
    const planned = plannedChains.has(group.chainKey);
    if (!planned && ownDemands.length === 0) continue;
    const plannedNatures = naturesByEgg.get(eggGameId) ?? [];
    if (planned && plannedNatures.length === 0 && ownDemands.length === 0) continue;

    const demandById = new Map(ownDemands.map((demand) => [demand.id, demand]));
    const relevantTrades = trades.filter((trade) => demandById.has(trade.demandId));
    const accepted = relevantTrades.filter((trade) => trade.status === 'accepted');
    const proposed = relevantTrades.filter((trade) => trade.status === 'proposed');
    const incoming = proposed.filter(
      (trade) => trade.initiatorAccountId !== viewerAccountId,
    );
    const outgoing = proposed.filter(
      (trade) => trade.initiatorAccountId === viewerAccountId,
    );

    const publishedNatures = [...new Set(ownDemands.flatMap((demand) => demand.natures))];
    const natures = [
      ...new Set([
        ...(naturesByEgg.get(eggGameId) ?? []),
        ...publishedNatures,
      ]),
    ];
    const acceptedNatures = [
      ...new Set(
        accepted.map((trade) => {
          const demand = demandById.get(trade.demandId);
          return demand ? natureOfTrade(trade, demand) : '';
        }).filter(Boolean),
      ),
    ];
    const incomingNatures = [
      ...new Set(
        incoming.map((trade) => {
          const demand = demandById.get(trade.demandId);
          return demand ? natureOfTrade(trade, demand) : '';
        }).filter(Boolean),
      ),
    ];
    const acceptedBy = namesOf(accepted.map((trade) => trade.supplierAccountId), members);
    const acceptedCountByDemand = new Map<string, number>();
    for (const trade of accepted) {
      acceptedCountByDemand.set(
        trade.demandId,
        (acceptedCountByDemand.get(trade.demandId) ?? 0) + 1,
      );
    }
    const remaining = ownDemands.reduce(
      (sum, demand) =>
        sum + Math.max(
          0,
          demand.quantity - demand.fulfilled - (acceptedCountByDemand.get(demand.id) ?? 0),
        ),
      0,
    );
    const openNatures = [
      ...new Set(
        ownDemands
          .filter(
            (demand) =>
              demand.status === 'open' &&
              (acceptedCountByDemand.get(demand.id) ?? 0) < demand.quantity,
          )
          .flatMap((demand) =>
            demand.natures.filter((nature) => !acceptedNatures.includes(nature)),
          ),
      ),
    ];
    const received = ownDemands.some((demand) => demand.status === 'fulfilled');

    let status: CollectionPlanStatus;
    let statusLabel: string;
    let statusDetail: string;
    if (accepted.length > 0) {
      status = 'in_progress';
      statusLabel = acceptedBy.length === 1 ? `${acceptedBy[0]}已接单` : '有人已接单';
      const acceptedText = `${acceptedBy.join('、')}已接受${acceptedNatures.join('、') || natures.join('、')}`;
      const remainingText = `还剩 ${remaining} 份`;
      const openText = openNatures.length > 0 ? `；${openNatures.join('、')}仍在等组员回应` : '';
      statusDetail = `${acceptedText}，${remainingText}${openText}`;
    } else if (incoming.length > 0) {
      status = 'proposal';
      statusLabel = '收到新意向';
      const proposers = namesOf(incoming.map((trade) => trade.supplierAccountId), members);
      statusDetail = `${proposers.join('、')}想换${incomingNatures.join('、') || natures.join('、')}，等你回应`;
    } else if (outgoing.length > 0) {
      status = 'proposal';
      statusLabel = '等待回应';
      const invitees = namesOf(outgoing.map((trade) => trade.supplierAccountId), members);
      statusDetail = `已邀请${invitees.join('、')}，其他组员仍可回应`;
    } else if (ownDemands.some((demand) => demand.status === 'open')) {
      status = 'published';
      statusLabel = '已发布';
      statusDetail = `${publishedNatures.join('、') || natures.join('、')}已发布，仍在等组员回应`;
    } else if (received) {
      status = 'received';
      statusLabel = '已收到';
      statusDetail = `已收到${publishedNatures.join('、') || natures.join('、')}`;
    } else {
      status = 'planned';
      statusLabel = '已计划';
      statusDetail = '还没有发布到小组';
    }

    cards.push({
      eggGameId,
      chainKey: group.chainKey,
      name: group.formLabel || `精灵${eggGameId}`,
      number: group.number,
      eggGroups: group.eggGroups,
      natures,
      publishedNatures,
      status,
      statusLabel,
      statusDetail,
      acceptedBy,
      remaining,
    });
  }

  const rank: Record<CollectionPlanStatus, number> = {
    proposal: 0,
    in_progress: 1,
    published: 2,
    planned: 3,
    received: 4,
  };
  return cards.sort(
    (a, b) =>
      rank[a.status] - rank[b.status] ||
      a.number.localeCompare(b.number) ||
      a.name.localeCompare(b.name),
  );
}
