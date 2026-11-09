import type { DesktopOverlayPet, DesktopOverlayPayload } from '../collector/desktopOverlay';
import type { LiveNearbyPet } from '../collector/captureProgress';
import type { DemandHit } from '../pcap/demandMatch';
import type { NearbySnapshot } from '../collector/nearbyStore';
import { buildRadar } from '../pcap/nearbyRadar';

/**
 * 手机端悬浮面板 payload 组装（2026-11-08）。
 *
 * 只做「附近快照 → 悬浮面板要显示的数据」这一段纯函数，不碰页面与原生。
 * 口径与 PC 小窗一致（见 docs/手机端悬浮窗-方案.md §7）：
 * - 字段直接复用 `DesktopOverlayPet` / `DesktopOverlayPayload`，只加手机端需要的计数与是否可见；
 * - 列表只保留命中目标的精灵（命中需求中心 / 可提醒 / 稀有 / 炫彩·异色·污染），最多 8 条，
 *   按「需求 > 提醒 > 稀有 > 距离」排序；`total` 报附近全部数量，`matched` 报命中数量；
 * - `mapPets` 给出附近所有带坐标的精灵（最多 24 只），地图 / 雷达照常画普通精灵；
 * - 方向为 8 方位标签，距离 100 世界单位 = 1 米；
 * - 没有自身坐标时以附近精灵几何中位数为中心，并标记 `selfEstimated`。
 */

/** 悬浮面板列表上限（与 PC 小窗一致）。 */
export const OVERLAY_PET_LIMIT = 8;

/** 地图 / 雷达点位上限：列表只要命中目标，地图要看整体方位，普通精灵也要给点。 */
export const OVERLAY_MAP_POINT_LIMIT = 24;

/** 真正值得进列表的牌子：炫彩 / 异色 / 污染（与 `isHighValuePet` 同一口径）。 */
const TARGET_KINDS = new Set(['colorful', 'shiny', 'pollution']);

/**
 * 面板列表只保留「命中目标」的精灵（2026-11-09 用户口径：未命中目标的全部不要）。
 *
 * 命中口径：命中需求中心 / 可提醒（±100dB、体重牌 + 声音牌）/ 稀有 / 炫彩·异色·污染。
 * 只有单一「大块头 / 婉转声」等牌子的普通精灵只在雷达上显示，不进列表。
 */
export function isOverlayTarget(pet: LiveNearbyPet, demandHits = 0): boolean {
  return demandHits > 0 || pet.alertReason != null || pet.rare || pet.kinds.some((kind) => TARGET_KINDS.has(kind));
}

/** 命中原因（列表只显示最短标识）：需求 > 可提醒 > 稀有 > 炫彩 / 异色 / 污染。 */
export function overlayHitReason(pet: LiveNearbyPet, demandHits = 0): string | null {
  if (demandHits > 0) return 'demand';
  if (pet.alertReason != null) return 'alert';
  if (pet.rare) return 'rare';
  for (const kind of pet.kinds) {
    if (TARGET_KINDS.has(kind)) return kind;
  }
  return null;
}

/** 小于这个距离（米）时方向没有意义，返回 null 而不是随便给一个方位。 */
const MIN_BEARING_DISTANCE_M = 0.05;

export interface NearbyOverlayPayload extends DesktopOverlayPayload {
  /** 采集中才显示面板；停止采集即收起隐藏 */
  visible: boolean;
  /** 附近精灵总数（截断前的数量，含未命中目标的普通精灵） */
  total: number;
  /** 命中目标总数（截断前；列表与「还有 N 只」都按它算） */
  matched: number;
  /**
   * 地图 / 雷达点位：附近所有带坐标的精灵（按距离截断到 24 只）。
   * `pets` 只给列表用（命中目标），地图要靠这份才能看到普通精灵的方位。
   */
  mapPets: NearbyOverlayMapPet[];
  /** 稀有总数（截断前） */
  rareTotal: number;
  /** 可提醒总数（截断前） */
  alertTotal: number;
  /** true = 没有真实自身坐标，`self` 为附近精灵的估算中心 */
  selfEstimated: boolean;
}

/** 地图 / 雷达只需要落点与标识，不带名字 / 等级等列表字段。 */
export interface NearbyOverlayMapPet {
  key: string;
  kinds: string[];
  rare: boolean;
  alert: boolean;
  reason: string | null;
  x: number;
  y: number;
}

export interface NearbyOverlaySource {
  capturing: boolean;
  hasKey: boolean;
  /** 最近一帧附近快照；null 表示还没收到数据 */
  snapshot: NearbySnapshot | null;
  /** 推送时间；不传时用快照的更新时间 */
  now?: number;
  /**
   * 需求中心命中（精灵 key → 命中的需求），由页面用与 PC 相同的 `demandHitsForPet` 算好。
   * 不传时行为与之前一致（需求命中不参与过滤）。
   */
  demandHits?: ReadonlyMap<string, DemandHit[]> | null;
}

/** 命中需求 > 提醒 > 稀有 > 距离近 > key 稳定排序。 */
function comparePets(left: DesktopOverlayPet, right: DesktopOverlayPet): number {
  const demand = Number(right.reason === 'demand') - Number(left.reason === 'demand');
  if (demand !== 0) return demand;
  const alert = Number(right.alert) - Number(left.alert);
  if (alert !== 0) return alert;
  const rare = Number(right.rare) - Number(left.rare);
  if (rare !== 0) return rare;
  const leftDistance = left.distanceM ?? Number.POSITIVE_INFINITY;
  const rightDistance = right.distanceM ?? Number.POSITIVE_INFINITY;
  if (leftDistance !== rightDistance) return leftDistance - rightDistance;
  return left.key.localeCompare(right.key);
}

export function buildNearbyOverlayPayload(source: NearbyOverlaySource): NearbyOverlayPayload {
  const { capturing, hasKey, snapshot, demandHits } = source;
  const pets = snapshot?.pets ?? [];
  const hitCount = (pet: LiveNearbyPet) => demandHits?.get(pet.key)?.length ?? 0;
  // 雷达与地图仍用全部附近精灵；列表只留命中目标的（普通精灵不进列表）
  const targets = pets.filter((pet) => isOverlayTarget(pet, hitCount(pet)));
  const self = snapshot?.self ?? null;
  // 坏的自身坐标（NaN/Infinity）经 JSON 会变成 null，壳算出的中心会是 NaN；
  // 与 PC 端 overlay.js 同一口径：非有限数就当没有自身坐标。
  const hasSelf = self != null && Number.isFinite(self.x) && Number.isFinite(self.y);
  // 有自身坐标就以它为中心；没有就用附近精灵的几何中位数（并标记估算）
  const radar = buildRadar(pets, hasSelf ? { origin: self, trustOrigin: true } : {});
  const pointByKey = new Map(radar.points.map((point) => [point.key, point]));
  const distanceOf = (pet: LiveNearbyPet) =>
    pointByKey.get(pet.key)?.distanceM ?? pet.distanceM ?? Number.POSITIVE_INFINITY;

  // 地图 / 雷达点位：附近所有带坐标的精灵（普通精灵也画），按距离截断
  const mapPets = [...pets]
    .filter((pet) => pet.pos != null && Number.isFinite(pet.pos.x) && Number.isFinite(pet.pos.y))
    .sort((left, right) => distanceOf(left) - distanceOf(right) || left.key.localeCompare(right.key))
    .slice(0, OVERLAY_MAP_POINT_LIMIT)
    .flatMap<NearbyOverlayMapPet>((pet) => {
      const pos = pet.pos;
      if (pos == null) return [];
      return [{
        key: pet.key,
        kinds: pet.kinds,
        rare: pet.rare,
        alert: pet.alertReason != null,
        reason: overlayHitReason(pet, hitCount(pet)),
        x: pos.x,
        y: pos.y,
      }];
    });

  const items = targets.map<DesktopOverlayPet>((item) => {
    const point = pointByKey.get(item.key);
    const distanceM = point?.distanceM ?? item.distanceM ?? null;
    return {
      key: item.key,
      name: item.name,
      level: item.level,
      kinds: item.kinds,
      rare: item.rare,
      alert: item.alertReason != null,
      reason: overlayHitReason(item, hitCount(item)),
      nature: item.nature || null,
      gender: item.gender || null,
      distanceM,
      bearingLabel: point && point.distanceM >= MIN_BEARING_DISTANCE_M ? point.bearingLabel : null,
      x: item.pos?.x ?? null,
      y: item.pos?.y ?? null,
    };
  });

  return {
    visible: capturing,
    capturing,
    hasKey,
    scene: snapshot?.scene ?? null,
    self: radar.origin,
    pets: items.sort(comparePets).slice(0, OVERLAY_PET_LIMIT),
    total: pets.length,
    matched: items.length,
    mapPets,
    rareTotal: pets.filter((item) => item.rare).length,
    alertTotal: pets.filter((item) => item.alertReason != null).length,
    selfEstimated: !hasSelf,
    updatedAt: source.now ?? snapshot?.updatedAt ?? Date.now(),
  };
}
