import { useMemo } from 'react';
import { createModuleStore } from './createModuleStore';
import {
  DEFAULT_MOTHER_CRITERIA,
  MOTHER_BODY_OPTIONS,
  MOTHER_VOICE_OPTIONS,
  type MotherBody,
  type MotherCriteria,
  type MotherVoice,
} from '../domain/motherCriteria';
import type { PetGrade } from '../domain/petFilters';

export type { MotherBody, MotherCriteria, MotherVoice } from '../domain/motherCriteria';
export type { PetGrade } from '../domain/petFilters';
export {
  MOTHER_BODY_OPTIONS,
  MOTHER_VOICE_OPTIONS,
  matchesMotherVoice,
} from '../domain/motherCriteria';

const isVoice = (value: unknown): value is MotherVoice =>
  (MOTHER_VOICE_OPTIONS as readonly string[]).includes(value as string);
const isBody = (value: unknown): value is MotherBody =>
  (MOTHER_BODY_OPTIONS as readonly string[]).includes(value as string);
const MOTHER_GRADE_OPTIONS = ['大婉', '大粗', '小婉', '小粗'] satisfies readonly PetGrade[];
const isGrade = (value: unknown): value is PetGrade =>
  MOTHER_GRADE_OPTIONS.includes(value as PetGrade);
const singleGrade = (grades: readonly unknown[]): PetGrade[] => grades.filter(isGrade).slice(0, 1);

/**
 * 默认「只算推荐性格」（2026-11-22 C1，用户拍板）。
 *
 * 覆盖度的收集口径已经在 `2ba22ad` 默认成「推荐性格」，母本侧却还默认关着——
 * 同一个「收集」页签里两套性格口径，覆盖度说 3 个/组、母本说任意性格。
 * 这里把母本侧的默认也改成推荐性格；用户手动关过（显式 false）的照样保留。
 */
const DEFAULT_CRITERIA: MotherCriteria = {
  ...DEFAULT_MOTHER_CRITERIA,
  recommendedNatures: true,
};

/**
 * 「待补齐母本」的达标标准（2026-10-05 用户拍板，取代旧开关）。
 *
 * 口径本身（什么是达标母本）在领域层 `src/domain/motherCriteria.ts`——
 * 看板「母本全收集」卡与母本页必须用同一份定义，否则两处数字会打架。
 * 这里只负责「存哪、持久化、给 hook」。
 */
const store = createModuleStore<MotherCriteria>(DEFAULT_CRITERIA, {
  persistKey: 'roco.motherCriteria',
  // 只在**字段缺失**（老数据）时补默认：体型 / 声音空数组表示该维度不限，
  // 组合奖牌空数组表示无组合；补默认会让用户主动清空的选择在重启后被偷偷还原。
  migrate: (loaded) => ({
    voices: Array.isArray(loaded.voices)
      ? loaded.voices.filter(isVoice)
      : [...DEFAULT_MOTHER_CRITERIA.voices],
    bodies: Array.isArray(loaded.bodies)
      ? loaded.bodies.filter(isBody)
      : [...DEFAULT_MOTHER_CRITERIA.bodies],
    ...(Array.isArray(loaded.grades) ? { grades: loaded.grades.filter(isGrade) } : {}),
    // 2026-11-22：缺失 → 默认开（与覆盖度对齐）；显式关过 → 保留
    recommendedNatures: loaded.recommendedNatures !== false,
  }),
});

export function getMotherCriteria(): MotherCriteria {
  return store.get();
}

export function setMotherCriteria(criteria: MotherCriteria): void {
  store.set(criteria);
}

export function useMotherCriteria(): MotherCriteria {
  const criteria = store.use();
  return useMemo(() => criteria.grades === undefined ? criteria : { ...criteria, grades: singleGrade(criteria.grades) }, [criteria]);
}
