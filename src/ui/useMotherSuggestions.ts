import { useMemo } from 'react';
import { GRADE_BODY, GRADE_VOICE, gradeLabel, type PetGrade } from '../domain/petFilters';
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
 * 目标卡文案都收在这一个 hook 里。
 *
 * 档位取的是全局目标奖牌组合（看板「公母共用」那一组）。**母本页顶部四张组合卡不再
 * 跟它联动**（2026-11-22 用户口径：判定跟所选档位走，覆盖度目标与母本判定互不影响）：
 * 快照里的 `targetLabel` / 奖牌图标仍然是看板 / 覆盖度那份，母本页只拿它当"怎么补"
 * 悬浮窗的目标说明，母本达标判定另有 `motherCriteriaStore` 一份。
 */
export interface MotherSuggestionsView {
  selectedGrade: PetGrade | null;
  effectiveCriteria: MotherCriteria;
  naturesOf: (gameId: number) => readonly string[];
  suggestions: ReadonlyMap<string, MotherNestAccount>;
  /** 目标卡卡底：目标 满分大婉 / 目标 满分大粗 / 目标 大婉（双牌） */
  targetLabel: string;
  bodyMedal: string | null;
  /** 声音目标标签（`+100` / `-100` / `婉转声` / `粗嗓门`），悬浮窗按它取奖牌图 */
  voiceTarget: string | null;
  voiceDb: number | null;
  weightPercent: number | null;
}

export function useMotherSuggestions(
  summary: Pick<CollectionSummary, 'owned' | 'mode' | 'coverageByAccount' | 'plans'> & {
    allOwned?: CollectionSummary['allOwned'];
  },
  /**
   * 当前账号筛选里选中的号：只把它们作为「目标号」返回，其他号只作为跨号来源。
   * 不传 = 返回全部账号（老调用方 / 全选）。
   */
  selectedAccounts?: readonly string[],
): MotherSuggestionsView {
  const { owned, allOwned, mode, coverageByAccount, plans } = summary;
  const coverageFilter = useCoverageFilter();
  const motherCriteria = useMotherCriteria();
  const natureOverrides = useNatureOverrides();

  const selectedGrade = coverageFilter.grades[coverageFilter.grades.length - 1] ?? null;

  /**
   * 「已收集」判定必须和母本页同一份（`MotherView` 的 effectiveCriteria），
   * 否则会出现「页面说已收集、怎么补还推这一颗」：单选莱茵时实测差 1 条
   * （2026-11-24）。配窝档位仍由 coverageFilter 的 selectedGrade 单独决定。
   */
  const collectionCriteria: MotherCriteria = useMemo(
    () => ({
      bodies: motherCriteria.bodies,
      voices: effectiveMotherVoices(motherCriteria.voices, mode),
      grades: motherCriteria.grades,
      targetMode: mode,
      recommendedNatures: motherCriteria.recommendedNatures === true,
    }),
    [motherCriteria, mode],
  );
  const effectiveCriteria: MotherCriteria = useMemo(
    () => ({
      ...collectionCriteria,
      grades: selectedGrade ? [selectedGrade] : collectionCriteria.grades,
    }),
    [collectionCriteria, selectedGrade],
  );

  const naturesOf = useMemo(
    () => createNaturesResolver({ species, overrides: natureOverrides }),
    [natureOverrides],
  );

  /**
   * 账号筛选只限制「谁是目标号」，不能限制「算谁的数据」：
   * 单选莱茵时，洛丝/洛伞仍然是合法的出蛋来源（2026-11-24 用户口径）。
   * 所以用 allOwned 计算，再把结果过滤回选中号。
   */
  const selectedKey = selectedAccounts?.join('\u0000') ?? '';
  const suggestions = useMemo(() => {
    if (!selectedGrade) return new Map<string, MotherNestAccount>();
    const built = buildMotherNestSuggestions({
      species,
      owned: allOwned ?? owned,
      mode,
      grade: selectedGrade,
      criteria: collectionCriteria,
      naturesOf,
      coverageByAccount,
      plans,
    });
    if (!selectedKey) return built;
    const wanted = new Set(selectedKey.split('\u0000'));
    return new Map([...built].filter(([account]) => wanted.has(account)));
  }, [
    owned,
    allOwned,
    mode,
    selectedGrade,
    collectionCriteria,
    naturesOf,
    coverageByAccount,
    plans,
    selectedKey,
  ]);

  const bodyMedal = selectedGrade ? GRADE_BODY[selectedGrade] : null;
  const targetLabel = selectedGrade
    ? // 用档位简称（满分大婉 / 满分大粗 / 双牌大婉…），不再写「大块头 · 婉转声」那串有歧义的拆解
      `目标 ${gradeLabel(selectedGrade, mode)}`
    : '目标未选';
  /**
   * 目标声音（与需求卡同一套标签）：追满分是 ±100，追双牌是 婉转声 / 粗嗓门。
   * 悬浮窗用它选奖牌图，不能只看 dB —— 大粗以前被算成 +100，图标一直是婉转声。
   */
  const voiceTarget = selectedGrade
    ? mode === 'perfect'
      ? GRADE_VOICE[selectedGrade] === '婉转声'
        ? '+100'
        : '-100'
      : GRADE_VOICE[selectedGrade]
    : null;
  const voiceDb = voiceTarget === '+100' ? 100 : voiceTarget === '-100' ? -100 : null;

  return {
    selectedGrade,
    effectiveCriteria,
    naturesOf,
    suggestions,
    targetLabel,
    bodyMedal,
    voiceTarget,
    voiceDb,
    weightPercent: bodyMedal === '大块头' ? 100 : bodyMedal === '小不点' ? 0 : null,
  };
}
