import { useState } from 'react';
import { CATALOG_VERSION, species } from '../../data/catalog';
import type { MotherGroup, TargetMode } from '../../domain/petFilters';
import type { CollectionPlanCard } from '../../domain/collectionPlan';
import { useCollectionGroups } from '../useCollectionGroups';
import { useSnapshots } from '../useSnapshots';
import { useMotherPlan } from '../motherPlanStore';
import { PetAvatar } from '../PetAvatar';
import { PetCardLayout } from '../PetCardLayout';
import { Button } from '../primitives/Button';
import { useEggMatching } from './useEggMatching';
import { GroupEggRequestSheet, type GroupEggRequestCriteria } from './GroupEggRequestSheet';
import { newUuid } from '../../shared/uuid';
import type { NavigationIntent } from '../navigation';
import {
  collectingFooterClass,
  useMotherCollectionData,
  type CollectingFilter,
  type CollectingStatus,
} from '../useMotherCollectionData';

export interface MotherCollectingViewProps {
  motherGroups: readonly MotherGroup[];
  missingNaturesByEgg: ReadonlyMap<number, readonly string[]>;
  eggGroupNames: Record<number, string>;
  targetBody: '大块头' | '小不点';
  targetVoice: '+100' | '-100' | '婉转声' | '粗嗓门';
  mode: TargetMode;
  onNavigate: (intent: NavigationIntent) => void;
}

/** 收集中：状态快速筛选（带数字，点了就筛） */
function CollectingStatusBar({
  filters,
  value,
  onChange,
}: {
  filters: ReadonlyArray<{ value: CollectingFilter; label: string; count: number }>;
  value: CollectingFilter;
  onChange: (next: CollectingFilter) => void;
}) {
  if (filters.length <= 1) return null;
  return (
    <div
      className="flex gap-1 overflow-x-auto scrollbar-none"
      data-testid="mother-collecting-status"
      role="group"
      aria-label="收集中状态筛选"
    >
      {filters.map((filter) => {
        const active = filter.value === value;
        return (
          <button
            key={filter.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(filter.value)}
            data-testid={`collecting-status-${filter.value}`}
            className={`min-h-[28px] shrink-0 rounded-md border px-2 text-[11px] ${
              active
                ? 'border-emerald-500 bg-emerald-50 font-medium text-emerald-700'
                : 'border-slate-200 bg-white text-slate-500'
            }`}
          >
            {`${filter.label} ${filter.count}`}
          </button>
        );
      })}
    </div>
  );
}

function CollectingCards({
  cards,
  eggGroupNames,
  received,
  filtered,
  onClearFilter,
  onOpen,
}: {
  cards: readonly CollectionPlanCard[];
  eggGroupNames: Record<number, string>;
  /** 已收到、已归「已收集」的条数：空态要说清楚去哪了 */
  received: number;
  /** 当前是否处于状态筛选（空态文案不同） */
  filtered: boolean;
  onClearFilter: () => void;
  onOpen: (card: CollectionPlanCard) => void;
}) {
  if (cards.length === 0) {
    return (
      <div
        className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-6 text-center text-xs text-slate-500"
        data-testid="mother-collecting-empty"
      >
        {filtered ? (
          <>
            这一状态下没有收集中精灵。
            <Button variant="text" size="sm" className="ml-1" onClick={onClearFilter}>
              显示全部
            </Button>
          </>
        ) : received > 0 ? (
          `收集中都收到了，已转到「已收集」（${received} 条）。`
        ) : (
          '还没有收集中精灵。先在未收集卡片点“计划”。'
        )}
      </div>
    );
  }
  return (
    <ul className="grid grid-cols-4 gap-1" data-testid="mother-collecting-cards">
      {cards.map((card) => (
        <li key={card.eggGameId} className="min-w-0">
          <PetCardLayout
            testId="mother-collecting-card"
            name={card.name}
            number={card.number}
            eggGroups={card.eggGroups.map((id) => eggGroupNames[id] ?? `蛋组${id}`)}
            natures={card.natures}
            size="tall"
            /* 整卡统一白底：状态只由底条承担（2026-11-22 用户口径） */
            status="uncollected"
            fitName
            avatar={<PetAvatar gameId={card.eggGameId} name={card.name} size={48} />}
            title={card.statusDetail}
            onClick={() => onOpen(card)}
            footer={
              <span
                className={`h-full w-full truncate px-1 text-center text-[10px] font-medium leading-[18px] ${collectingFooterClass(
                  card.status as CollectingStatus,
                )}`}
                title={card.statusDetail}
              >
                {card.statusLabel}
              </span>
            }
          />
        </li>
      ))}
    </ul>
  );
}

function NoGroupCollecting({
  motherGroups,
  missingNaturesByEgg,
  eggGroupNames,
  accountId,
  onNavigate,
}: {
  motherGroups: readonly MotherGroup[];
  missingNaturesByEgg: ReadonlyMap<number, readonly string[]>;
  eggGroupNames: Record<number, string>;
  accountId: string;
  onNavigate: (intent: NavigationIntent) => void;
}) {
  const [filter, setFilter] = useState<CollectingFilter>('all');
  const plan = useMotherPlan();
  const data = useMotherCollectionData({
    planKeys: plan,
    motherGroups: motherGroups.map((group) => ({
      chainKey: group.chainKey,
      eggGameId: group.eggGameId,
      formLabel: group.formLabel,
      number: group.number,
      eggGroups: group.eggGroups,
    })),
    naturesByEgg: missingNaturesByEgg,
    demands: [],
    trades: [],
    members: [],
    viewerAccountId: accountId,
  });

  return (
    <section className="space-y-2" data-testid="mother-collecting-view">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
        还没有打开收集小组。计划仍保存在本机，加入小组后再发布求蛋。
        <Button
          variant="text"
          size="sm"
          className="ml-1"
          onClick={() => onNavigate({ type: 'tab', page: 'groups' })}
        >
          去小组
        </Button>
      </div>
      <CollectingStatusBar filters={data.filters} value={filter} onChange={setFilter} />
      <CollectingCards
        cards={data.visible(filter)}
        eggGroupNames={eggGroupNames}
        received={data.received}
        filtered={filter !== 'all'}
        onClearFilter={() => setFilter('all')}
        onOpen={() => onNavigate({ type: 'tab', page: 'groups' })}
      />
    </section>
  );
}

function GroupCollecting({
  groupHook,
  motherGroups,
  missingNaturesByEgg,
  eggGroupNames,
  targetBody,
  targetVoice,
  open,
  onOpen,
  onClose,
}: {
  groupHook: ReturnType<typeof useCollectionGroups>;
  motherGroups: readonly MotherGroup[];
  missingNaturesByEgg: ReadonlyMap<number, readonly string[]>;
  eggGroupNames: Record<number, string>;
  targetBody: '大块头' | '小不点';
  targetVoice: '+100' | '-100' | '婉转声' | '粗嗓门';
  open: CollectionPlanCard | null;
  onOpen: (card: CollectionPlanCard) => void;
  onClose: () => void;
}) {
  const groupId = groupHook.currentGroupId ?? '';
  const accountId = groupHook.accountId ?? '';
  const api = useEggMatching(groupId, accountId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<CollectingFilter>('all');
  const state = api.data?.state;
  const plan = useMotherPlan();
  const members = groupHook.currentGroup?.members ?? [];
  const data = useMotherCollectionData({
    planKeys: plan,
    motherGroups: motherGroups.map((group) => ({
      chainKey: group.chainKey,
      eggGameId: group.eggGameId,
      formLabel: group.formLabel,
      number: group.number,
      eggGroups: group.eggGroups,
    })),
    naturesByEgg: missingNaturesByEgg,
    demands: state?.demands ?? [],
    trades: state?.trades ?? [],
    members: members.map((member) => ({
      accountId: member.accountId,
      displayName: member.displayName,
    })),
    viewerAccountId: accountId,
  });
  const memberName = (id: string) =>
    members.find((member) => member.accountId === id)?.displayName ?? '组员';
  const whoCanHelp = open
    ? [
        ...new Set(
          [
            ...(state?.eggs ?? [])
              .filter(
                (egg) =>
                  egg.accountId !== accountId &&
                  egg.eggGameId === open.eggGameId &&
                  (egg.location ?? 'bag') !== 'home',
              )
              .map((egg) => memberName(egg.accountId)),
            ...(state?.lines ?? [])
              .filter(
                (line) =>
                  line.accountId !== accountId &&
                  line.eggGameId === open.eggGameId,
              )
              .map((line) => memberName(line.accountId)),
          ],
        ),
      ].slice(0, 2).join('、') || '组内暂无'
    : '';

  const publish = async (
    natures: string[],
    criteria: GroupEggRequestCriteria,
  ) => {
    if (!open || !api.data || busy) return;
    if (criteria.groupId !== groupId) {
      groupHook.selectGroup(criteria.groupId);
      return;
    }
    setBusy(true);
    setError('');
    try {
      await api.mutate({
        type: 'publish-batch',
        demands: [
          {
            id: newUuid(),
            eggGameId: open.eggGameId,
            natures,
            body: criteria.body,
            voice: criteria.voice,
            quantity: 1,
            greenNest: criteria.requireGreenNest,
          },
        ],
      });
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '发布失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-2" data-testid="mother-collecting-view">
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-white p-2 shadow-sm" data-testid="mother-collecting-groups">
        {groupHook.groups.map((group) => (
          <button
            key={group.id}
            type="button"
            aria-pressed={group.id === groupId}
            onClick={() => groupHook.selectGroup(group.id)}
            className={`min-h-[28px] shrink-0 rounded-md border px-2 text-[11px] ${
              group.id === groupId
                ? 'border-emerald-500 bg-emerald-50 font-medium text-emerald-700'
                : 'border-slate-200 bg-white text-slate-500'
            }`}
          >
            {group.name}
          </button>
        ))}
      </div>
      <CollectingStatusBar filters={data.filters} value={filter} onChange={setFilter} />
      <CollectingCards
        cards={data.visible(filter)}
        eggGroupNames={eggGroupNames}
        received={data.received}
        filtered={filter !== 'all'}
        onClearFilter={() => setFilter('all')}
        onOpen={onOpen}
      />
      <GroupEggRequestSheet
        open={open != null}
        eggGameId={open?.eggGameId ?? 0}
        name={open?.name ?? ''}
        number={open?.number ?? ''}
        eggGroups={(open?.eggGroups ?? []).map((id) => eggGroupNames[id] ?? `蛋组${id}`)}
        initialNatures={open?.natures ?? []}
        publishedNatures={open?.publishedNatures ?? []}
        targetBody={targetBody}
        targetVoice={targetVoice}
        groups={groupHook.groups.map((group) => ({ id: group.id, name: group.name }))}
        groupId={groupId}
        busy={busy}
        error={error || api.error || ''}
        whoCanHelp={whoCanHelp}
        supplierNote={open?.statusDetail}
        onClose={onClose}
        onGroupChange={(next) => groupHook.selectGroup(next)}
        onPublish={(natures, criteria) => void publish(natures, criteria)}
      />
    </section>
  );
}

export function MotherCollectingView({
  motherGroups,
  missingNaturesByEgg,
  eggGroupNames,
  targetBody,
  targetVoice,
  onNavigate,
}: MotherCollectingViewProps) {
  const { snapshots } = useSnapshots();
  const groupHook = useCollectionGroups({
    snapshots,
    species,
    catalogVersion: CATALOG_VERSION,
  });
  const [open, setOpen] = useState<CollectionPlanCard | null>(null);
  const accountId = groupHook.accountId ?? '';
  const groupId = groupHook.currentGroupId;

  if (!accountId || !groupId) {
    return (
      <NoGroupCollecting
        motherGroups={motherGroups}
        missingNaturesByEgg={missingNaturesByEgg}
        eggGroupNames={eggGroupNames}
        accountId={accountId}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <GroupCollecting
      groupHook={groupHook}
      motherGroups={motherGroups}
      missingNaturesByEgg={missingNaturesByEgg}
      eggGroupNames={eggGroupNames}
      targetBody={targetBody}
      targetVoice={targetVoice}
      open={open}
      onOpen={setOpen}
      onClose={() => setOpen(null)}
    />
  );
}
