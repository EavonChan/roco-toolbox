import eggWeights from '../data/eggWeights.json';

/**
 * 蛋重（2026-11-01 接入）：
 *
 * 「满体重 / 零体重」需求要交付的是**最大蛋重 / 最小蛋重**的蛋，光靠现有数据算不出来，
 * 所以从蛋神助手的 `petEggInfo` 抽了一份精简表（`src/data/eggWeights.json`，按蛋物种名索引）。
 * 交付目标取区间上下限 `max` / `min`（2026-11-01 用户口径：取 3.4 这类区间值，
 * 不用 `big` / `small` 那组实测重量）。
 */
interface EggWeightEntry {
  min: number;
  max: number;
  small?: number;
  big?: number;
}

const table = eggWeights as Record<string, EggWeightEntry>;

/** 蛋物种名（不含形态后缀）→ 蛋重区间；查不到返回 null（新蛋还没收录）。 */
export function eggWeightOf(name: string | null | undefined): EggWeightEntry | null {
  if (!name) return null;
  const key = name.split('_')[0];
  return table[key] ?? null;
}

/**
 * 这条需求要交付的蛋重（kg）：满体重 = 区间上限（最大蛋重）、零体重 = 区间下限（最小蛋重）；
 * 其他体型返回 null（不写蛋重）。查不到数据时也返回 null，界面只写文字不写数字。
 */
export function requiredEggWeight(
  body: string,
  name: string | null | undefined,
): { kind: 'max' | 'min'; weight: number } | null {
  if (body !== '满体重' && body !== '零体重') return null;
  const entry = eggWeightOf(name);
  const weight = body === '满体重' ? entry?.max : entry?.min;
  if (typeof weight !== 'number' || !Number.isFinite(weight)) return null;
  return { kind: body === '满体重' ? 'max' : 'min', weight };
}
