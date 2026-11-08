/**
 * 稀有精灵判定（2026-11-05，逆向自多多工具箱 4.2）。
 *
 * 两套口径：
 * - 列表/牌子：`kindsOf`，声音 ±96dB 就记「婉转声/粗嗓门」，体重百分位 ≥98 / ≤2 记「大块头/小不点」。
 * - 主动提醒：`rareAlertReason`，只有「±100dB」或「体重牌 + 声音牌」才响。
 *
 * 纯函数，不依赖协议解析；阈值来自多多工具箱的 `ka / _kinds / un`。
 */

export type RareKind =
  | 'colorful' // 炫彩
  | 'shiny' // 异色
  | 'pollution' // 污染
  | 'big' // 大块头
  | 'small' // 小不点
  | 'high' // 婉转声
  | 'low'; // 粗嗓门

export const KIND_LABELS: Record<RareKind, string> = {
  colorful: '炫彩',
  shiny: '异色',
  pollution: '污染',
  big: '大块头',
  small: '小不点',
  high: '婉转声',
  low: '粗嗓门',
};

export interface WeightPercentileInput {
  weightKg: number;
  lowKg: number;
  highKg: number;
}

/** 体重在种族区间内的百分位；区间无效时返回 null（不伪造）。 */
export function weightPercentile({ weightKg, lowKg, highKg }: WeightPercentileInput): number | null {
  if (!Number.isFinite(weightKg) || !Number.isFinite(lowKg) || !Number.isFinite(highKg) || highKg <= lowKg) return null;
  return Math.max(0, Math.min(100, ((weightKg - lowKg) / (highKg - lowKg)) * 100));
}

export interface KindInput {
  mutation: number;
  glassType: number;
  weightPct: number | null;
  voiceDb: number;
}

/** 列表里显示的牌子；只要有一个牌子，`rare` 就为真。 */
export function kindsOf({ mutation, glassType, weightPct, voiceDb }: KindInput): RareKind[] {
  const kinds: RareKind[] = [];
  if ((glassType || 0) !== 0 || (mutation & 8) !== 0) kinds.push('colorful');
  if ((mutation & 1) !== 0) kinds.push('shiny');
  if ((mutation & 166) !== 0) kinds.push('pollution');
  if (weightPct != null) {
    if (weightPct >= 98) kinds.push('big');
    else if (weightPct <= 2) kinds.push('small');
  }
  if (voiceDb >= 96) kinds.push('high');
  else if (voiceDb <= -96) kinds.push('low');
  return kinds;
}

export function isRare(kinds: readonly RareKind[]): boolean {
  return kinds.length > 0;
}

export interface AlertInput {
  voiceDb: number;
  kinds: readonly RareKind[];
}

/**
 * 主动提醒的原因；不满足返回 null。
 * 注意：±100dB 单独成立；±96~99dB 必须再叠加体重牌才成立。
 */
export function rareAlertReason({ voiceDb, kinds }: AlertInput): string | null {
  const reasons: string[] = [];
  if (voiceDb >= 100) reasons.push('+100dB 婉转声');
  else if (voiceDb <= -100) reasons.push('-100dB 粗嗓门');
  const body = kinds.includes('big') ? 'big' : kinds.includes('small') ? 'small' : null;
  const voice = kinds.includes('high') ? 'high' : kinds.includes('low') ? 'low' : null;
  if (body && voice) reasons.push(`${KIND_LABELS[body]}·${KIND_LABELS[voice]}`);
  return reasons.length > 0 ? reasons.join(' · ') : null;
}

export function rareAlertTitle(count: number): string {
  return count === 1 ? '稀有精灵出现！' : `稀有精灵 ×${count}`;
}
