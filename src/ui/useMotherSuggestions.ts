import { useMemo } from 'react';
import { GRADE_BODY, GRADE_VOICE, type PetGrade } from '../domain/petFilters';
import { effectiveMotherVoices, type MotherCriteria } from '../domain/motherCriteria';
import { buildMotherNestSuggestions, type MotherNestAccount } from '../domain/motherNest';
import { createNaturesResolver } from '../domain/recommendedNatures';
import { species } from '../data/catalog';
import { useCoverageFilter } from './coverageFilterStore';
import { useMotherCriteria } from './motherCriteriaStore';
import { useNatureOverrides } from './natureOverrideStore';
import type { CollectionSummary } from './useCollectionSummary';

/**
 * 看板与收集页共用的「母本配窝建议 + 当前目标」口径（2026-11-19）。
 *
 * 悬浮窗复用到看板母本缺口和收集母本两处，这两处必须算出同一份线，
 * 否则同一个缺口在两边给的概率会不一样。所以把条件组装、建议计算和
 * 目标卡文案（目标 大块头 · 婉转声）都收在这一个 hook 里。
 */
export interface MotherSuggestionsView {
  selectedGrade: PetGrade | null;
  effectiveCriteria: MotherCriteria;
  naturesOf: (gameId: number) => readonly string[];
  suggestions: ReadonlyMap<string, MotherNestAccount>;
  /** 目标卡卡底：目标 大块头 · 婉转声 */
  targetLabel: string;
  bodyMedal: string | null;
  voiceDb: number | null;
  weightPercent: number | null;
}

export function useMotherSuggestions(
  summary: Pick<CollectionSummary, 'owned' | 'mode' | 'coverageByAccount' | 'plans'>,
): MotherSuggestionsView {
  const { owned, mode, coverageByAccount, plans } = summary;
  const coverageFilter = useCoverageFilter();
  const motherCriteria = useMotherCriteria();
  const natureOverrides = useNatureOverrides();

  const selectedGrade = coverageFilter.grades[coverageFilter.grades.length - 1] ?? null;

  const effectiveCriteria: MotherCriteria = useMemo(
    () => ({
      bodies: motherCriteria.bodies,
      voices: effectiveMotherVoices(motherCriteria.voices, mode),
      grades: selectedGrade ? [selectedGrade] : motherCriteria.grades,
      targetMode: mode,
      recommendedNatures: motherCriteria.recommendedNatures === true,
    }),
    [motherCriteria, mode, selectedGrade],
  );

  const naturesOf = useMemo(
    () => createNaturesResolver({ species, overrides: natureOverrides }),
    [natureOverrides],
  );

  const suggestions = useMemo(() => {
    if (!selectedGrade) return new Map<string, MotherNestAccount>();
    return buildMotherNestSuggestions({
      species,
      owned,
      mode,
      grade: selectedGrade,
      criteria: effectiveCriteria,
      naturesOf,
      coverageByAccount,
      plans,
    });
  }, [owned, mode, selectedGrade, effectiveCriteria, naturesOf, coverageByAccount, plans]);

  const bodyMedal = selectedGrade ? GRADE_BODY[selectedGrade] : null;
  const targetLabel = selectedGrade
    ? `目标 ${GRADE_BODY[selectedGrade]} · ${GRADE_VOICE[selectedGrade]}`
    : '目标未选';
  const voiceDb =
    selectedGrade == null
      ? null
      : mode === 'perfect' || GRADE_VOICE[selectedGrade] === '婉转声'
        ? 100
        : -100;

  return {
    selectedGrade,
    effectiveCriteria,
    naturesOf,
    suggestions,
    targetLabel,
    bodyMedal,
    voiceDb,
    weightPercent: bodyMedal === '大块头' ? 100 : bodyMedal === '小不点' ? 0 : null,
  };
}
