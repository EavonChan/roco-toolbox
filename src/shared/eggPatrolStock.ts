import type { EggParentInfo, EggParentsInfo } from './eggMatching';
import type { EggWorkflowState, WorkflowEgg } from './eggWorkflow';
import type { PatrolEgg, PatrolObservation, PatrolParent, PatrolTask } from './eggPatrol';

/** 机器人「生蛋了吗」上报的一颗家园蛋。 */
export interface IngestedHomeEgg {
  egg: PatrolEgg;
  eggGameId: number;
}

/** 同一颗蛋重复上报时，确认时间至少间隔这么久才更新，避免每次都写库。 */
const INGEST_CONFIRM_REFRESH_MS = 30 * 60 * 1000;

function parentInfo(parent: PatrolParent): EggParentInfo {
  return {
    id: parent.petId,
    gameId: parent.speciesGameId ?? 0,
    name: '',
    nature: '',
    body: '',
    voice: '',
  };
}

function parentsInfo(egg: PatrolEgg): EggParentsInfo | undefined {
  const mother = egg.mother ? parentInfo(egg.mother) : undefined;
  const fathers = egg.fathers.map(parentInfo);
  if (!mother && fathers.length === 0) return undefined;
  return {
    ...(mother ? { mother } : {}),
    ...(fathers.length ? { fathers } : {}),
    confirmed: egg.biologicalParentageConfirmed,
  };
}

/**
 * 巡查确认的蛋补进蛋仓。
 *
 * ID 与抓包导入的家园蛋一致，因此两条入口会合并成同一条记录。巡查只补充
 * 新蛋和确认时间；用户手工标注、占用状态和挂出状态都不能被后台覆盖。
 */
export function recordPatrolProducedEgg(
  previous: EggWorkflowState,
  task: PatrolTask,
  observation: PatrolObservation,
  egg: PatrolEgg,
  now: number,
): EggWorkflowState {
  if (observation.status !== 'produced' || observation.actorId !== egg.actorId) return previous;
  const accountId = task.producerAccountId;
  const gameAccountKey = `uid:${task.uid}`;
  const id = JSON.stringify([gameAccountKey, 'home', egg.actorId]);
  const parents = parentsInfo(egg);
  const existing = previous.eggs.find(value => value.accountId === accountId && value.id === id);
  if (!existing) {
    const next: WorkflowEgg = {
      id,
      accountId,
      gameAccountKey,
      eggGameId: task.eggGameId,
      nature: '',
      body: 'unknown',
      voice: 'unknown',
      provenance: 'self-bred',
      confidence: 'unknown',
      kind: 'ordinary',
      status: 'available',
      location: 'home',
      listed: false,
      labelSource: 'unknown',
      lastConfirmedAt: now,
      ...(parents ? { parents } : {}),
    };
    return { ...previous, eggs: [...previous.eggs, next] };
  }

  const next: WorkflowEgg = {
    ...existing,
    location: existing.location ?? 'home',
    lastConfirmedAt: Math.max(existing.lastConfirmedAt ?? 0, now),
    ...(existing.provenance === 'unknown' ? { provenance: 'self-bred' as const } : {}),
    ...(!existing.parents && parents ? { parents } : {}),
  };
  return {
    ...previous,
    eggs: previous.eggs.map(value => value.accountId === accountId && value.id === id ? next : value),
  };
}

/**
 * 机器人「生蛋了吗」看到的家园蛋补进蛋仓。
 *
 * 与巡查、抓包导入共用同一个 ID（uid + home + actorId），三条入口会合并成
 * 同一条记录；重复上报不会产生新记录，也不会覆盖用户的手工标注和占用状态。
 * 没有任何变化时返回原对象，调用方据此跳过写库。
 */
export function recordIngestedHomeEggs(
  previous: EggWorkflowState,
  accountId: string,
  uid: string,
  eggs: readonly IngestedHomeEgg[],
  now: number,
): EggWorkflowState {
  if (eggs.length === 0) return previous;
  const gameAccountKey = `uid:${uid}`;
  const nextEggs = [...previous.eggs];
  const indexById = new Map(nextEggs.map((egg, index) => [`${egg.accountId}\n${egg.id}`, index]));
  let changed = false;

  for (const input of eggs) {
    if (!Number.isSafeInteger(input.eggGameId) || input.eggGameId <= 0) continue;
    const id = JSON.stringify([gameAccountKey, 'home', input.egg.actorId]);
    const key = `${accountId}\n${id}`;
    const index = indexById.get(key);
    const parents = parentsInfo(input.egg);

    if (index === undefined) {
      nextEggs.push({
        id,
        accountId,
        gameAccountKey,
        eggGameId: input.eggGameId,
        nature: '',
        body: 'unknown',
        voice: 'unknown',
        provenance: 'self-bred',
        confidence: 'unknown',
        kind: 'ordinary',
        status: 'available',
        location: 'home',
        listed: false,
        labelSource: 'unknown',
        lastConfirmedAt: now,
        ...(parents ? { parents } : {}),
      });
      indexById.set(key, nextEggs.length - 1);
      changed = true;
      continue;
    }

    const existing = nextEggs[index];
    const refresh =
      now - (existing.lastConfirmedAt ?? 0) >= INGEST_CONFIRM_REFRESH_MS;
    const needParents = !existing.parents && parents;
    if (!refresh && !needParents) continue;
    nextEggs[index] = {
      ...existing,
      location: existing.location ?? 'home',
      lastConfirmedAt: refresh
        ? Math.max(existing.lastConfirmedAt ?? 0, now)
        : existing.lastConfirmedAt,
      ...(existing.provenance === 'unknown' ? { provenance: 'self-bred' as const } : {}),
      ...(needParents ? { parents } : {}),
    };
    changed = true;
  }

  return changed ? { ...previous, eggs: nextEggs } : previous;
}
