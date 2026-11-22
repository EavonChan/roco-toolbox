import { useMemo, useState } from 'react';
import { CATALOG_VERSION, species } from '../../data/catalog';
import type { MotherGroup, TargetMode } from '../../domain/petFilters';
import { buildCollectionPlanCards, type CollectionPlanCard } from '../../domain/collectionPlan';
import { useCollectionGroups } from '../useCollectionGroups';
import { useSnapshots } from '../useSnapshots';
import { useMotherPlan } from '../motherPlanStore';
import { PetAvatar } from '../PetAvatar';
import { PetCardLayout } from '../PetCardLayout';
import { Button } from '../primitives/Button';
import { useEggMatching } from './useEggMatching';
import {
  GroupEggRequestSheet,
  type GroupEggRequestCriteria,
} from './GroupEggRequestSheet';
import { newUuid } from '../../shared/uuid';
import type { NavigationIntent } from '../navigation';

export interface MotherCollectingViewProps {
  motherGroups: readonly MotherGroup[];
  missingNaturesByEgg: ReadonlyMap<number, readonly string[]>;
  eggGroupNames: Record<number, string>;
  targetBody: '大块头' | '小不点';
  targetVoice: '+100' | '-100' | '婉转声' | '粗嗓门';
  mode: TargetMode;
  onNavigate: (intent: NavigationIntent) => void;
}

function collectingCards(
  plan: readonly string[],
  motherGroups: readonly MotherGroup[],
  missingNaturesByEgg: ReadonlyMap<number, readonly string[]>,
  demands: Parameters<typeof buildCollectionPlanCards>[0]['demands'],
  trades: Parameters<typeof buildCollectionPlanCards>[0]['trades'],
  members: Parameters<typeof buildCollectionPlanCards>[0]['members'],
  viewerAccountId: string,
) {
  return buildCollectionPlanCards({
    planKeys: plan,
    motherGroups: motherGroups.map((group) => ({
      chainKey: group.chainKey,
      eggGameId: group.eggGameId,
      formLabel: group.formLabel,
      number: group.number,
      eggGroups: group.eggGroups,
    })),
    naturesByEgg: missingNaturesByEgg,
    demands,
    trades,
    members,
    viewerAccountId,
  });
}

function CollectingCards({
  cards,
  eggGroupNames,
  onOpen,
}: {
  cards: readonly CollectionPlanCard[];
  eggGroupNames: Record<number, string>;
  onOpen: (card: CollectionPlanCard) => void;
}) {
  if (cards.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-6 text-center text-xs text-slate-500">
        还没有收集中精灵。先在未收集卡片点“计划”。
      </p>
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
            status="planned"
            fitName
            fitNameBase={8}
            fitNameMin={6}
            avatar={<PetAvatar gameId={card.eggGameId} name={card.name} size={44} />}
            title={card.statusDetail}
            onClick={() => onOpen(card)}
            footer={
              <span
                className="w-full truncate rounded-full bg-sky-100 px-1 text-[7px] font-medium leading-[13px] text-sky-700"
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
  cards,
  eggGroupNames,
  onNavigate,
}: {
  cards: readonly CollectionPlanCard[];
  eggGroupNames: Record<number, string>;
  onNavigate: (intent: NavigationIntent) => void;
}) {
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
      <CollectingCards
        cards={cards}
        eggGroupNames={eggGroupNames}
        onOpen={() => onNavigate({ type: 'tab', page: 'groups' })}
      />
    </section>
  );
}

function GroupCollecting({
  groupHook,
  plan,
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
  plan: readonly string[];
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
  const state = api.data?.state;
  const members = groupHook.currentGroup?.members ?? [];
  const cards = useMemo(
    () =>
      collectingCards(
        plan,
        motherGroups,
        missingNaturesByEgg,
        state?.demands ?? [],
        state?.trades ?? [],
        members.map((member) => ({
          accountId: member.accountId,
          displayName: member.displayName,
        })),
        accountId,
      ),
    [plan, motherGroups, missingNaturesByEgg, state?.demands, state?.trades, members, accountId],
  );
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
      <CollectingCards cards={cards} eggGroupNames={eggGroupNames} onOpen={onOpen} />
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
  const plan = useMotherPlan();
  const { snapshots } = useSnapshots();
  const groupHook = useCollectionGroups({
    snapshots,
    species,
    catalogVersion: CATALOG_VERSION,
  });
  const [open, setOpen] = useState<CollectionPlanCard | null>(null);
  const accountId = groupHook.accountId ?? '';
  const groupId = groupHook.currentGroupId;
  const noGroupCards = useMemo(
    () => collectingCards(plan, motherGroups, missingNaturesByEgg, [], [], [], accountId),
    [plan, motherGroups, missingNaturesByEgg, accountId],
  );

  if (!accountId || !groupId) {
    return (
      <NoGroupCollecting
        cards={noGroupCards}
        eggGroupNames={eggGroupNames}
        onNavigate={onNavigate}
      />
    );
  }

  return (
    <GroupCollecting
      groupHook={groupHook}
      plan={plan}
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
