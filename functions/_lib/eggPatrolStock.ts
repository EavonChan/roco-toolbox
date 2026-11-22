import type { PatrolEgg, PatrolObservation, PatrolTask } from '../../src/shared/eggPatrol';
import {
  recordIngestedHomeEggs as mergeIngestedHomeEggs,
  recordPatrolProducedEgg,
  type EggLabelIndex,
  type IngestedHomeEgg,
} from '../../src/shared/eggPatrolStock';
import type { EggWorkflowState } from '../../src/shared/eggWorkflow';

interface StateRow {
  version: number;
  state_json: string;
}

export interface ProducedPatrolEgg {
  task: PatrolTask;
  observation: PatrolObservation;
  egg: PatrolEgg;
}

/**
 * 把巡查确认的蛋合并进小组蛋仓。
 *
 * 巡查和用户换蛋操作可能同时改同一份小组状态，因此使用 version 乐观锁；
 * 冲突时重读最新状态再合并，不能让后台巡查覆盖用户刚做的操作。
 */
export async function recordProducedPatrolEggs(
  db: D1Database,
  groupId: string,
  inputs: readonly ProducedPatrolEgg[],
  now: number,
): Promise<number> {
  if (inputs.length === 0) return 0;
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await db.prepare('SELECT version,state_json FROM egg_matching_groups WHERE group_id=?')
      .bind(groupId).first<StateRow>();
    if (!row) return 0;
    let state = JSON.parse(row.state_json) as EggWorkflowState;
    const before = state.eggs.length;
    let changed = false;
    for (const input of inputs) {
      const next = recordPatrolProducedEgg(state, input.task, input.observation, input.egg, now);
      if (next !== state) {
        state = next;
        changed = true;
      }
    }
    if (!changed) return 0;
    const stateJson = JSON.stringify(state);
    if (new TextEncoder().encode(stateJson).byteLength > 1_500_000) throw new Error('STATE_CAPACITY');
    const result = await db.prepare('UPDATE egg_matching_groups SET state_json=?,version=version+1,updated_at=? WHERE group_id=? AND version=?')
      .bind(stateJson, now, groupId, row.version).run();
    if (result.meta.changes) return state.eggs.length - before;
  }
  throw new Error('PATROL_STATE_CONFLICT');
}

/**
 * 把机器人「生蛋了吗」上报的家园蛋合并进小组蛋仓。
 *
 * 和巡查共用同一套 version 乐观锁：读最新状态 → 合并 → 按版本号写回，
 * 冲突时重读重试，不能盖掉用户刚做的换蛋/标注操作。
 */
export async function recordIngestedHomeEggs(
  db: D1Database,
  groupId: string,
  accountId: string,
  uid: string,
  eggs: readonly IngestedHomeEgg[],
  now: number,
  index?: EggLabelIndex,
): Promise<{ written: number; labeled: number }> {
  if (eggs.length === 0) return { written: 0, labeled: 0 };
  for (let attempt = 0; attempt < 4; attempt++) {
    const row = await db.prepare('SELECT version,state_json FROM egg_matching_groups WHERE group_id=?')
      .bind(groupId).first<StateRow>();
    if (!row) return { written: 0, labeled: 0 };
    const state = JSON.parse(row.state_json) as EggWorkflowState;
    const merged = mergeIngestedHomeEggs(state, accountId, uid, eggs, now, index);
    if (merged.state === state) return { written: 0, labeled: 0 };
    const stateJson = JSON.stringify(merged.state);
    if (new TextEncoder().encode(stateJson).byteLength > 1_500_000) throw new Error('STATE_CAPACITY');
    const result = await db.prepare('UPDATE egg_matching_groups SET state_json=?,version=version+1,updated_at=? WHERE group_id=? AND version=?')
      .bind(stateJson, now, groupId, row.version).run();
    if (result.meta.changes) return { written: merged.written, labeled: merged.labeled };
  }
  throw new Error('INGEST_STATE_CONFLICT');
}
