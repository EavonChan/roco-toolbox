import type { EggParentInfo, EggParentsInfo } from './eggMatching';
import type { EggWorkflowState, WorkflowEgg } from './eggWorkflow';
import type { PatrolEgg, PatrolObservation, PatrolParent, PatrolTask } from './eggPatrol';

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
