import { bodyMedalOf, type BodySize } from './bodySize.js';

/**
 * 声音分贝 → 蛋仓现有的声音档位（与 eggInventory / 抓包导入口径一致）。
 *
 * 抓包导入（homeEggAdapter）与机器人上报（eggPatrolStock）共用这一份，
 * 避免两条入口对同一颗蛋标出不同的声音。
 */
export function voiceLabelOf(db: number | null | undefined): string {
  if (typeof db !== 'number' || !Number.isFinite(db)) return '';
  if (db === 100) return '+100';
  if (db === -100) return '-100';
  if (db >= 96) return '婉转声';
  if (db <= -96) return '粗嗓门';
  return '';
}

/** 蛋的声音 = (父 + 母) / 2 向零取整（设计口径 §8.7）。 */
export function averageVoice(fatherDb: number, motherDb: number): number {
  return Math.trunc((fatherDb + motherDb) / 2);
}

/** 亲本体型：按体重与物种阈值判定；缺体重或物种未收录时判不了。 */
export function bodyMedalOfWeight(
  size: BodySize | null | undefined,
  weightKg: number | null | undefined,
): '' | '小不点' | '大块头' {
  return bodyMedalOf(size, weightKg);
}
