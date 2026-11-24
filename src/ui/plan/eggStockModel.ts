import { canCirculateEgg, type EggRecord } from '../../shared/eggMatching';
import { hasAcademyParent } from '../../shared/eggWorkflow';

/** Normalized trusted-adapter input, not raw capture JSON or user-edited form data. */
export type EggObservation = Pick<EggRecord, 'id' | 'eggGameId' | 'nature' | 'body' | 'voice'> &
  Partial<Pick<EggRecord, 'provenance' | 'confidence' | 'kind' | 'labelSource' | 'parents' |
    'specialCategory' | 'greenNest' | 'heightCm' | 'weightGrams' | 'itemConfId' | 'location'>> & {
    gameAccountKey?: string;
    /** 抓包里的获得时间；家园蛋没有，合并时以背包观测为准。 */
    obtainedAt?: string;
    /** 家园行链接到的背包实例 ID（`EggObservation.id`）；用于跨 id 去重。 */
    capturedEggId?: string;
  };
export interface StockEgg extends EggRecord {
  location: 'bag' | 'home';
  listed: boolean;
  lastConfirmedAt: number;
  /** 游戏账号（uid:...）；同一工具箱账号可能导入多个游戏账号。 */
  gameAccountKey?: string;
  /** 游戏蛋数据里的获得时间（ISO 8601）；家园蛋与更新前的旧记录没有。 */
  obtainedAt?: string;
  /** 家园蛋收进背包后链接到的背包实例 ID；有它才能在后续同步里继续合并。 */
  capturedEggId?: string;
}
interface SnapshotPart {
  eggs: readonly EggObservation[];
  complete: boolean;
  /** 这一部位自己的采集时间；背包与家园来自不同抓包，不能共用一个时间。 */
  capturedAt?: number;
}
export interface EggStockSnapshot {
  accountId: string;
  /** 游戏账号（uid:...）；同一工具箱账号可能导入多个游戏账号，水位按它分开。 */
  gameAccountKey?: string;
  /** One coherent capture cycle; pass its bag/home parts together. */
  capturedAt: number;
  bag?: SnapshotPart;
  home?: SnapshotPart;
}
export interface EggStockState {
  eggs: StockEgg[];
  captureWatermarks: Record<string, number>;
  /** History is not visible stock. Retained so received eggs cannot become self-bred on reimport. */
  provenanceHistory: Record<string, EggRecord['provenance']>;
}

export const emptyEggStock = (): EggStockState => ({ eggs: [], captureWatermarks: {}, provenanceHistory: {} });
const instanceKey = (accountId: string, id: string): string => JSON.stringify([accountId, id]);

/** 来源冲突口径：external > self-bred > unknown；unknown 永远不能清掉已有的自产/外来标记。 */
const provenanceOf = (...values: (EggRecord['provenance'] | undefined)[]): EggRecord['provenance'] =>
  values.includes('external') ? 'external' : values.includes('self-bred') ? 'self-bred' : 'unknown';

function validatePart(part: SnapshotPart | undefined): void {
  if (!part) return;
  if (!Array.isArray(part.eggs) || typeof part.complete !== 'boolean') throw new Error('库存快照缺少完整性标记');
  const seen = new Set<string>();
  for (const egg of part.eggs) {
    if (!egg || typeof egg.id !== 'string' || !egg.id.trim()) throw new Error('蛋实例编号无效');
    if (seen.has(egg.id)) throw new Error('快照存在重复实例');
    seen.add(egg.id);
    if (!Number.isSafeInteger(egg.eggGameId) || egg.eggGameId <= 0) throw new Error('蛋物种编号无效');
    if (typeof egg.nature !== 'string') throw new Error('蛋性格字段无效');
  }
}

export function reconcileEggStock(state: EggStockState, snapshot: EggStockSnapshot): EggStockState {
  if (typeof snapshot.accountId !== 'string' || !snapshot.accountId.trim() ||
      !Number.isFinite(snapshot.capturedAt) || snapshot.capturedAt < 0) throw new Error('账号或采集时间无效');
  validatePart(snapshot.bag);
  validatePart(snapshot.home);
  if (!snapshot.bag && !snapshot.home) return state;
  const accountKey = JSON.stringify([snapshot.accountId, snapshot.gameAccountKey ?? '']);
  if (snapshot.capturedAt <= (state.captureWatermarks[accountKey] ?? -1)) return state;

  const previous = new Map(state.eggs.filter(e => e.accountId === snapshot.accountId).map(e => [e.id, e]));
  const next = new Map(previous);
  const gameKey = snapshot.gameAccountKey ?? '';
  const sameGame = (egg: StockEgg): boolean =>
    egg.accountId === snapshot.accountId && (egg.gameAccountKey ?? '') === gameKey;
  /**
   * 背包观测补进它对应的家园行，不产生第二行：保留家园 id 与自产标记，只把新值填进去。
   * 新值非空才覆盖旧值（时间/重量/身高/自产标记同一口径）。
   */
  const mergeCaptured = (home: StockEgg, observation: EggObservation): StockEgg => {
    const egg: StockEgg = {
      ...home,
      nature: observation.nature || home.nature,
      body: observation.body !== 'unknown' ? observation.body : home.body,
      voice: observation.voice !== 'unknown' ? observation.voice : home.voice,
      provenance: provenanceOf(home.provenance, observation.provenance),
      confidence: home.labelSource === 'manual' ? 'manual' : observation.confidence ?? home.confidence,
      labelSource: home.labelSource === 'manual' ? 'manual' : observation.labelSource ?? home.labelSource,
      kind: observation.kind ?? home.kind,
      parents: home.parents ?? observation.parents,
      location: 'bag',
      obtainedAt: observation.obtainedAt ?? home.obtainedAt,
      heightCm: observation.heightCm ?? home.heightCm,
      weightGrams: observation.weightGrams ?? home.weightGrams,
      itemConfId: observation.itemConfId ?? home.itemConfId,
      capturedEggId: observation.id,
      lastConfirmedAt: Math.max(home.lastConfirmedAt, snapshot.bag?.capturedAt ?? snapshot.capturedAt),
    };
    egg.listed = home.listed && canCirculateEgg(egg);
    return egg;
  };
  const mergedBagIds = new Set<string>();
  for (const observation of snapshot.bag?.eggs ?? []) {
    // 只有一颗、且没有获得时间与链接的家园行才能认；多颗同种时宁可先并存，不猜。
    const linked = [...next.values()].find(egg => sameGame(egg) && egg.capturedEggId === observation.id);
    if (linked) {
      next.set(linked.id, mergeCaptured(linked, observation));
      mergedBagIds.add(observation.id);
      continue;
    }
    if (next.has(observation.id)) continue;
    const candidates = [...next.values()].filter(egg => sameGame(egg) && egg.location === 'home' &&
      egg.eggGameId === observation.eggGameId && !egg.obtainedAt && !egg.capturedEggId);
    if (candidates.length !== 1) continue;
    next.set(candidates[0].id, mergeCaptured(candidates[0], observation));
    mergedBagIds.add(observation.id);
  }
  for (const location of ['bag', 'home'] as const) {
    const part = snapshot[location];
    if (!part?.complete) continue;
    const currentIds = new Set(part.eggs.map(e => e.id));
    for (const [id, egg] of next) {
      if (!sameGame(egg) || egg.location !== location || currentIds.has(id)) continue;
      // 已链接到本次背包快照的家园行：背包里那颗才是它的新身份，不算在家园快照里消失。
      if (location === 'bag' && egg.capturedEggId && currentIds.has(egg.capturedEggId)) continue;
      next.delete(id);
    }
  }
  const history = { ...state.provenanceHistory };
  const currentBag = new Set(snapshot.bag?.eggs.map(e => e.id) ?? []);
  // Process home first, then let actual bag entries take precedence.
  for (const location of ['home', 'bag'] as const) {
    for (const observation of snapshot[location]?.eggs ?? []) {
      if (location === 'bag' && mergedBagIds.has(observation.id)) continue;
      const old = previous.get(observation.id);
      const key = instanceKey(snapshot.accountId, observation.id);
      const provenance = provenanceOf(observation.provenance, history[key], old?.provenance);
      history[key] = provenance;
      if (location === 'home' && (currentBag.has(observation.id) || next.get(observation.id)?.location === 'bag')) {
        // Keep bag location, but retain restrictive classification from either observation.
        const current = next.get(observation.id);
        if (current) {
          const kind = observation.kind === 'special' || observation.kind === 'shiny' ? observation.kind : current.kind;
          const specialCategory = observation.specialCategory ?? current.specialCategory;
          const updated = { ...current, provenance, kind, specialCategory,
            greenNest: observation.greenNest ?? current.greenNest,
            heightCm: observation.heightCm ?? current.heightCm,
            weightGrams: observation.weightGrams ?? current.weightGrams,
            itemConfId: observation.itemConfId ?? current.itemConfId,
            obtainedAt: observation.obtainedAt ?? current.obtainedAt,
            lastConfirmedAt: Math.max(current.lastConfirmedAt, snapshot[location]?.capturedAt ?? snapshot.capturedAt) };
          if (observation.parents) updated.parents = observation.parents;
          if (observation.labelSource === 'system' && updated.labelSource !== 'manual') updated.labelSource = 'system';
          next.set(current.id, { ...updated, listed: current.listed && canCirculateEgg(updated) });
        }
        continue;
      }
      const egg: StockEgg = { id: observation.id, accountId: snapshot.accountId, eggGameId: observation.eggGameId,
        nature: observation.nature, body: observation.body, voice: observation.voice,
        provenance, confidence: observation.confidence ?? 'unknown',
        labelSource: observation.labelSource ?? (observation.confidence === 'system' ? 'system' : 'unknown'),
        parents: observation.parents ?? old?.parents,
        kind: observation.kind ?? old?.kind ?? 'ordinary',
        specialCategory: observation.specialCategory ?? old?.specialCategory,
        greenNest: observation.greenNest ?? old?.greenNest,
        heightCm: observation.heightCm ?? old?.heightCm,
        weightGrams: observation.weightGrams ?? old?.weightGrams,
        itemConfId: observation.itemConfId ?? old?.itemConfId,
        obtainedAt: observation.obtainedAt ?? old?.obtainedAt,
        capturedEggId: observation.capturedEggId ?? old?.capturedEggId,
        gameAccountKey: observation.gameAccountKey ?? old?.gameAccountKey ?? snapshot.gameAccountKey,
        status: old?.status ?? 'available', location, lastConfirmedAt: snapshot[location]?.capturedAt ?? snapshot.capturedAt, listed: false };
      egg.listed = !!old?.listed && canCirculateEgg(egg);
      next.set(egg.id, egg);
    }
  }
  // 历史蛋可能只写了父母、漏了绿窝标记：按父母回填 true；显式 false（用户手动取消）与普通小窝不动。
  // copy-on-write：`next` 里可能有直接引用旧 state 的行，不能原地改。
  for (const [id, egg] of next) {
    if (egg.greenNest === undefined && hasAcademyParent(egg.parents)) next.set(id, { ...egg, greenNest: true });
  }
  return { eggs: [...state.eggs.filter(e => e.accountId !== snapshot.accountId), ...next.values()],
    captureWatermarks: { ...state.captureWatermarks, [accountKey]: snapshot.capturedAt }, provenanceHistory: history };
}

export function setEggListed(state: EggStockState, accountId: string, id: string, listed: boolean): EggStockState {
  const egg = state.eggs.find(e => e.accountId === accountId && e.id === id);
  if (!egg) throw new Error('蛋库存不存在');
  if (listed && !canCirculateEgg(egg)) throw new Error('异色蛋和特殊蛋不可挂出交换');
  if (egg.listed === listed) return state;
  return { ...state, eggs: state.eggs.map(e => e === egg ? { ...e, listed } : e) };
}

/** Stable partition: non-giftable eggs stay visible after ordinary stock. */
export function sortEggStock(eggs: readonly StockEgg[]): StockEgg[] {
  const special = (egg: StockEgg) => egg.kind === 'special' || egg.kind === 'shiny';
  return [...eggs.filter(e => !special(e)), ...eggs.filter(special)];
}
