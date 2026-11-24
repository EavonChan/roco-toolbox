import type { DemandBody, DemandVoice } from './collectionGroups';
import type { EggParentInfo, EggParentsInfo } from './eggMatching';
import type { EggWorkflowState, WorkflowEgg } from './eggWorkflow';
import { autoListStock, hasAcademyParent } from './eggWorkflow';
import type { BodySize } from './bodySize.js';
import type { PatrolEgg, PatrolObservation, PatrolParent, PatrolTask } from './eggPatrol';
import { ACADEMY_NEST_CONFIG_ID, ORDINARY_NEST_CONFIG_ID } from './eggPatrol';
import { averageVoice, bodyMedalOfWeight, voiceLabelOf } from './eggLabels';

/** 机器人「生蛋了吗」上报的一颗家园蛋。 */
export interface IngestedHomeEgg {
  egg: PatrolEgg;
  eggGameId: number;
}

/** 标注推理用的图鉴索引（物种→体型阈值、性格 id→名字）。 */
export interface EggLabelIndex {
  bodySizeByGameId: ReadonlyMap<number, BodySize>;
  natureNameById: ReadonlyMap<number, string>;
}

/** 同一颗蛋重复上报时，确认时间至少间隔这么久才更新，避免每次都写库。 */
const INGEST_CONFIRM_REFRESH_MS = 30 * 60 * 1000;

function natureOf(parent: PatrolParent, index?: EggLabelIndex): string {
  if (parent.natureId === null || !index) return '';
  return index.natureNameById.get(parent.natureId) ?? '';
}

function bodyOf(parent: PatrolParent, index?: EggLabelIndex): DemandBody | 'unknown' {
  if (!index || parent.speciesGameId === null) return 'unknown';
  const size = index.bodySizeByGameId.get(parent.speciesGameId);
  const label = size ? bodyMedalOfWeight(size, parent.weightKg) : '';
  return label || 'unknown';
}

function parentInfo(parent: PatrolParent, index?: EggLabelIndex): EggParentInfo {
  const academy = parent.nestConfigId === ACADEMY_NEST_CONFIG_ID;
  const ordinary = parent.nestConfigId === ORDINARY_NEST_CONFIG_ID;
  return {
    id: parent.petId,
    gameId: parent.speciesGameId ?? 0,
    name: '',
    nature: natureOf(parent, index),
    body: bodyOf(parent, index),
    voice: voiceLabelOf(parent.voiceDb),
    ...(academy ? { nestName: '学院小窝', academy: true } : ordinary ? { nestName: '普通小窝' } : {}),
  };
}

function parentsInfo(egg: PatrolEgg, index?: EggLabelIndex): EggParentsInfo | undefined {
  const mother = egg.mother ? parentInfo(egg.mother, index) : undefined;
  const fathers = egg.fathers.map(father => parentInfo(father, index));
  if (!mother && fathers.length === 0) return undefined;
  return {
    ...(mother ? { mother } : {}),
    ...(fathers.length ? { fathers } : {}),
    confirmed: egg.biologicalParentageConfirmed,
  };
}

export interface InferredLabels {
  nature: string;
  body: DemandBody | 'unknown';
  voice: DemandVoice | 'unknown';
}

/**
 * 绿窝（学院小窝）：蛋自己或任一亲本住在学院小窝就是绿窝蛋。
 *
 * 2026-11-25 用户实证：rc「生蛋了吗」入库的蛋永远没有绿窝标记——这两条入库函数以前完全不写
 * `greenNest`。判定与展示/合并共用 `hasAcademyParent`（父母里有 `academy: true` 即可，
 * 不要求恰好一只、也不要求它有性格）。
 */
function isGreenNestEgg(egg: PatrolEgg, parents?: EggParentsInfo): boolean {
  return egg.nestConfigId === ACADEMY_NEST_CONFIG_ID || hasAcademyParent(parents);
}

/**
 * 由父母本推蛋的标注（与抓包导入 `homeEggAdapter` 同一套口径）：
 * - 性格：双亲都有且完全相同才落值（绿色小窝 100% 遗传的场景里，抓包入口会另标）；
 * - 体型：双亲都能判、且同档才落值；
 * - 声音：所有父本与母本都能算平均档、且落点一致才落值。
 */
export function inferEggLabels(egg: PatrolEgg, index: EggLabelIndex): InferredLabels {
  const mother = egg.mother;
  const fathers = egg.fathers;

  const motherNature = mother ? natureOf(mother, index) : '';
  const fatherNatures = fathers.map(father => natureOf(father, index));
  // 学院小窝（绿窝）那只的当前性格 100% 遗传；只有一只且它有性格时优先按它标。
  const academy = [mother, ...fathers].filter(
    (parent): parent is PatrolParent => !!parent &&
      parent.nestConfigId === ACADEMY_NEST_CONFIG_ID && !!natureOf(parent, index),
  );
  const nature = academy.length === 1
    ? natureOf(academy[0], index)
    : motherNature && fatherNatures.length > 0 &&
      fatherNatures.every(value => value === motherNature) ? motherNature : '';

  const motherBody = mother ? bodyOf(mother, index) : 'unknown';
  const fatherBodies = fathers.map(father => bodyOf(father, index));
  const body = motherBody !== 'unknown' && fatherBodies.length > 0 &&
    fatherBodies.every(value => value === motherBody) ? motherBody : 'unknown';

  let voice: DemandVoice | 'unknown' = 'unknown';
  const motherDb = mother?.voiceDb ?? null;
  const fatherDbs = fathers.map(father => father.voiceDb);
  if (typeof motherDb === 'number' && fatherDbs.length > 0 &&
    fatherDbs.every((db): db is number => typeof db === 'number')) {
    const labels = new Set(fatherDbs.map(db => voiceLabelOf(averageVoice(db, motherDb))));
    if (labels.size === 1) voice = [...labels][0] as DemandVoice | 'unknown';
  }

  return { nature, body, voice };
}

/** 巡查确认的蛋补进蛋仓。 */
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
  const greenNest = isGreenNestEgg(egg, parents);
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
      greenNest,
      confidence: 'unknown',
      kind: 'ordinary',
      status: 'available',
      location: 'home',
      listed: false,
      labelSource: 'unknown',
      lastConfirmedAt: now,
      ...(parents ? { parents } : {}),
    };
    return autoListStock({ ...previous, eggs: [...previous.eggs, next] }, accountId, gameAccountKey);
  }

  const next: WorkflowEgg = {
    ...existing,
    location: existing.location ?? 'home',
    lastConfirmedAt: Math.max(existing.lastConfirmedAt ?? 0, now),
    ...(existing.provenance === 'unknown' ? { provenance: 'self-bred' as const } : {}),
    ...(!existing.parents && parents ? { parents } : {}),
    // 历史行缺绿窝标记（rc 入库早期）→ 按父母补；已有 true / 手动取消的 false 一律不动。
    ...(existing.greenNest === undefined && greenNest ? { greenNest: true } : {}),
  };
  return autoListStock({
    ...previous,
    eggs: previous.eggs.map(value => value.accountId === accountId && value.id === id ? next : value),
  }, accountId, gameAccountKey);
}

function fillParents(existing: EggParentsInfo, incoming: EggParentsInfo): EggParentsInfo {
  const mother = existing.mother && incoming.mother ? {
    ...existing.mother,
    name: existing.mother.name || incoming.mother.name,
    nature: existing.mother.nature || incoming.mother.nature,
    body: existing.mother.body || incoming.mother.body,
    voice: existing.mother.voice || incoming.mother.voice,
    nestName: existing.mother.nestName || incoming.mother.nestName,
    academy: existing.mother.academy ?? incoming.mother.academy,
  } : existing.mother ?? incoming.mother;
  const fathers = (existing.fathers ?? []).map((father, i) => {
    const next = incoming.fathers?.[i];
    if (!next) return father;
    return {
      ...father,
      name: father.name || next.name,
      nature: father.nature || next.nature,
      body: father.body || next.body,
      voice: father.voice || next.voice,
      nestName: father.nestName || next.nestName,
      academy: father.academy ?? next.academy,
    };
  });
  if (fathers.length === 0 && incoming.fathers?.length) return { ...existing, ...(mother ? { mother } : {}) };
  return { ...existing, ...(mother ? { mother } : {}), ...(fathers.length ? { fathers } : {}) };
}

export interface IngestStockResult {
  state: EggWorkflowState;
  written: number;
  labeled: number;
}

/**
 * 机器人「生蛋了吗」看到的家园蛋补进蛋仓。
 *
 * 与巡查、抓包导入共用同一个 ID（uid + home + actorId），三条入口会合并成
 * 同一条记录；重复上报不会产生新记录，也不会覆盖用户的手工标注和占用状态。
 * 新蛋会按父母本自动标注性格 / 体型 / 声音；已有蛋只补空值，不改人工标注。
 * 没有任何变化时 state 返回原对象，调用方据此跳过写库。
 */
export function recordIngestedHomeEggs(
  previous: EggWorkflowState,
  accountId: string,
  uid: string,
  eggs: readonly IngestedHomeEgg[],
  now: number,
  index?: EggLabelIndex,
): IngestStockResult {
  if (eggs.length === 0) return { state: previous, written: 0, labeled: 0 };
  const gameAccountKey = `uid:${uid}`;
  const nextEggs = [...previous.eggs];
  const indexById = new Map(nextEggs.map((egg, i) => [`${egg.accountId}\n${egg.id}`, i]));
  let written = 0;
  let labeled = 0;
  let changed = false;

  for (const input of eggs) {
    if (!Number.isSafeInteger(input.eggGameId) || input.eggGameId <= 0) continue;
    const id = JSON.stringify([gameAccountKey, 'home', input.egg.actorId]);
    const key = `${accountId}\n${id}`;
    const position = indexById.get(key);
    const parents = parentsInfo(input.egg, index);
    const greenNest = isGreenNestEgg(input.egg, parents);
    const labels = index ? inferEggLabels(input.egg, index) : { nature: '', body: 'unknown' as const, voice: 'unknown' as const };
    const hasLabel = !!labels.nature || labels.body !== 'unknown' || labels.voice !== 'unknown';

    if (position === undefined) {
      nextEggs.push({
        id,
        accountId,
        gameAccountKey,
        eggGameId: input.eggGameId,
        nature: labels.nature,
        body: labels.body,
        voice: labels.voice,
        provenance: 'self-bred',
        greenNest,
        confidence: hasLabel ? 'system' : 'unknown',
        kind: 'ordinary',
        status: 'available',
        location: 'home',
        listed: false,
        labelSource: hasLabel ? 'system' : 'unknown',
        lastConfirmedAt: now,
        ...(parents ? { parents } : {}),
      });
      indexById.set(key, nextEggs.length - 1);
      written += 1;
      changed = true;
      continue;
    }

    const existing = nextEggs[position];
    let next = existing;
    if (existing.labelSource !== 'manual') {
      const nature = existing.nature || labels.nature;
      const body = existing.body === 'unknown' ? labels.body : existing.body;
      const voice = existing.voice === 'unknown' ? labels.voice : existing.voice;
      if (nature !== existing.nature || body !== existing.body || voice !== existing.voice) {
        next = {
          ...next,
          nature,
          body,
          voice,
          confidence: 'system',
          labelSource: 'system',
        };
        labeled += 1;
        changed = true;
      }
    }
    if (parents) {
      const merged = next.parents ? fillParents(next.parents, parents) : parents;
      if (!next.parents || JSON.stringify(merged) !== JSON.stringify(next.parents)) {
        next = { ...next, parents: merged };
        changed = true;
      }
    }
    // 历史行缺绿窝标记（rc 入库早期）→ 按父母补；已有 true / 手动取消的 false 一律不动。
    if (next.greenNest === undefined && greenNest) {
      next = { ...next, greenNest: true };
      changed = true;
    }
    const refresh = now - (next.lastConfirmedAt ?? 0) >= INGEST_CONFIRM_REFRESH_MS;
    if (refresh) {
      next = {
        ...next,
        location: next.location ?? 'home',
        lastConfirmedAt: Math.max(next.lastConfirmedAt ?? 0, now),
        ...(next.provenance === 'unknown' ? { provenance: 'self-bred' as const } : {}),
      };
      changed = true;
    }
    if (next !== existing) nextEggs[position] = next;
  }

  // 入库完成后再走自动挂出；家园蛋不满足「在背包」，这里只会补到已合并成背包的行。
  // autoListStock 无变化时返回原对象，保持「没变化就返回同一个 state」的契约。
  const state = changed ? { ...previous, eggs: nextEggs } : previous;
  return {
    state: autoListStock(state, accountId, gameAccountKey),
    written,
    labeled,
  };
}
