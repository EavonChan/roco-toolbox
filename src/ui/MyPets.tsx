import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  buildChainSearchIndex,
  buildTagIndex,
  chainKeyOf,
  computeFacetCounts,
  DEFAULT_HEIGHT_RANGE,
  filterByTags,
  matchesHeightRange,
} from '../domain/petFilters';
import type { HeightRange, PetTag } from '../domain/petFilters';
import type { OwnedPet } from '../domain/types';
import { speciesDisplayName } from '../domain/speciesName';
import {
  allNatureNames,
  eggGroupNames,
  naturePlusStats,
  species,
  targetNaturePool,
} from '../data/catalog';
import {
  bodyMedalIconByLabel,
  rarityIcon,
  voiceMedalIconByLabel,
} from '../domain/petIcons';
import { EmptyState } from './EmptyState';
import { PetList } from './PetList';
import { FilterAccordion } from './FilterAccordion';
import { formatPercent } from './formatPercent';
import { FilterPanel } from './primitives/FilterPanel';
import { SearchField } from './primitives/SearchField';
import { useOwnedPets } from './useOwnedPets';
import {
  clearInventoryFilters,
  setMyPetsEggGroupMatchMode,
  setMyPetsExtremeMedalMode,
  setMyPetsFiltersOpen,
  setMyPetsHeightRange,
  setMyPetsSelected,
  useMyPetsFilters,
} from './myPetsFilterStore';
import { setPersonalQuery, usePersonalList } from './listViewStore';

/** 筛选维度顺序；稀有度单独占一行。 */
const FILTER_DIMENSIONS: Array<{ kind: string; label: string }> = [
  { kind: 'nature', label: '性格' },
  { kind: 'eggGroup', label: '蛋组' },
];

const BODY_TAG_ORDER = ['大块头', '小不点'];
const sortBodyFirst = <T extends { label: string }>(tags: T[]): T[] =>
  [...tags].sort((a, b) => BODY_TAG_ORDER.indexOf(a.label) - BODY_TAG_ORDER.indexOf(b.label));
const VOICE_TAG_ORDER = ['婉转声', '粗嗓门'];
const sortVoiceFirst = <T extends { label: string }>(tags: T[]): T[] =>
  [...tags].sort((a, b) => VOICE_TAG_ORDER.indexOf(a.label) - VOICE_TAG_ORDER.indexOf(b.label));

const NATURE_STAT_ORDER = ['物攻', '物防', '魔攻', '魔防', '速度', '生命'];
const NATURE_CATALOG_ORDER = new Map(allNatureNames.map((name, index) => [name, index]));

function groupNatureTags(tags: PetTag[]): {
  target: PetTag[];
  stats: Array<{ stat: string; tags: PetTag[] }>;
  other: PetTag[];
} {
  const byName = new Map(tags.map((tag) => [tag.label, tag]));
  const target = targetNaturePool
    .map((entry) => byName.get(entry.name))
    .filter((tag): tag is PetTag => tag !== undefined);
  const orderedTags = [...tags].sort((a, b) => {
    const aOrder = NATURE_CATALOG_ORDER.get(a.label) ?? Number.MAX_SAFE_INTEGER;
    const bOrder = NATURE_CATALOG_ORDER.get(b.label) ?? Number.MAX_SAFE_INTEGER;
    return aOrder - bOrder || a.label.localeCompare(b.label);
  });
  const stats = NATURE_STAT_ORDER.map((stat) => ({
    stat,
    tags: orderedTags.filter((tag) => naturePlusStats.get(tag.label) === stat),
  })).filter((group) => group.tags.length > 0);
  const groupedNames = new Set(stats.flatMap((group) => group.tags.map((tag) => tag.label)));

  return {
    target,
    stats,
    other: orderedTags.filter((tag) => !groupedNames.has(tag.label)),
  };
}

function filterOptionIcon(kind: string, label: string, extremeMode = false, compact = false) {
  if (kind === 'body') {
    const medalLabel = extremeMode ? (label === '大块头' ? '满体重' : '零体重') : label;
    const src = bodyMedalIconByLabel(medalLabel);
    return src ? <img src={src} alt="" className={`${compact ? 'h-3 w-3' : 'h-4 w-4'} shrink-0`} /> : null;
  }
  if (kind === 'voice') {
    const medalLabel = extremeMode ? (label === '婉转声' ? '+100' : '-100') : label;
    const src = voiceMedalIconByLabel(medalLabel);
    return src ? <img src={src} alt="" className={`${compact ? 'h-3 w-3' : 'h-4 w-4'} shrink-0`} /> : null;
  }
  const rarityKind =
    label === '异色炫彩' ? 'shiny-colorful' : label === '异色' ? 'shiny' : label === '炫彩' ? 'colorful' : null;
  const src = kind === 'shiny' ? rarityIcon(rarityKind) : null;
  return src ? <img src={src} alt="" className={`${compact ? 'h-3 w-3' : 'h-4 w-4'} shrink-0`} /> : null;
}

function FilterOptionRow({
  kind,
  label,
  tags,
  selected,
  counts,
  onToggle,
  onClear,
  extremeMode = false,
  trailing,
  compact = false,
  className,
}: {
  kind: string;
  label?: string;
  tags: PetTag[];
  selected: ReadonlySet<string>;
  counts: Record<string, number>;
  onToggle: (tagId: string) => void;
  onClear?: () => void;
  extremeMode?: boolean;
  trailing?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  const hasSelectedFilter = Array.from(selected).some((id) => id.startsWith(`${kind}:`));

  return (
    <div
      className={`flex min-w-0 items-start ${compact ? 'gap-0.5' : 'gap-1'} ${className ?? 'w-full'}`}
      data-testid={`filter-row-${kind}`}
    >
      {label ? (
        <span
          className={`${compact ? 'w-7 whitespace-nowrap' : 'w-8'} shrink-0 pt-1 text-[11px] font-medium text-slate-600`}
        >
          {label}
        </span>
      ) : null}
      <div
        className={`flex min-w-0 ${
          compact ? 'flex-nowrap gap-0.5 whitespace-nowrap' : 'flex-wrap gap-1'
        }`}
      >
        {onClear ? (
          <button
            type="button"
            aria-pressed={!hasSelectedFilter}
            onClick={onClear}
            className={`inline-flex min-h-[24px] items-center gap-0.5 rounded-md border ${
              compact ? 'px-1 text-[10px]' : 'px-1.5 text-[11px]'
            } py-0.5 transition ${
              hasSelectedFilter
                ? 'bg-slate-100 font-medium text-slate-500'
                : 'bg-emerald-500 font-semibold text-white shadow'
            }`}
            data-testid={`filter-unlimited-${kind}`}
          >
            不限
          </button>
        ) : null}
        {tags.map((tag) => {
          const on = selected.has(tag.id);
          const count = counts[tag.id] ?? 0;
          return (
            <button
              key={tag.id}
              type="button"
              aria-pressed={on}
              disabled={count === 0 && !on}
              onClick={() => onToggle(tag.id)}
              data-testid={`filter-opt-${kind}-${tag.id}`}
              className={`inline-flex min-h-[24px] items-center gap-0.5 rounded-md border ${
                compact ? 'px-1 text-[10px]' : 'px-1.5 text-[11px]'
              } py-0.5 transition disabled:cursor-not-allowed ${
                on
                  ? 'bg-emerald-500 font-semibold text-white shadow'
                  : 'bg-slate-100 font-medium text-slate-500 disabled:text-slate-300'
              }`}
            >
                {filterOptionIcon(kind, tag.label, extremeMode, compact)}
              <span>{tag.label} ({count})</span>
            </button>
          );
        })}
      </div>
      {trailing}
    </div>
  );
}

const formatPercentInput = (value: number): string => formatPercent(value).replace(/%$/, '');

function HeightRangeControl({
  range,
  onChange,
}: {
  range: HeightRange;
  onChange: (range: HeightRange) => void;
}) {
  const isZeroHeight = range.min === 0 && range.max === 0;
  const isFullHeight = range.min === 100 && range.max === 100;
  const [minimum, setMinimum] = useState(formatPercentInput(range.min));
  const [maximum, setMaximum] = useState(formatPercentInput(range.max));

  useEffect(() => {
    setMinimum(formatPercentInput(range.min));
    setMaximum(formatPercentInput(range.max));
  }, [range.min, range.max]);

  const parsePercentage = (value: string): number | null => {
    const normalized = value.trim().replace(/%$/, '').trim();
    if (normalized === '') return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const commitMinimum = () => {
    const value = parsePercentage(minimum);
    if (value === null) {
      setMinimum(formatPercentInput(range.min));
      return;
    }
    const min = Math.max(0, Math.min(range.max, value));
    setMinimum(formatPercentInput(min));
    onChange({ min, max: range.max });
  };

  const commitMaximum = () => {
    const value = parsePercentage(maximum);
    if (value === null) {
      setMaximum(formatPercentInput(range.max));
      return;
    }
    const max = Math.min(100, Math.max(range.min, value));
    setMaximum(formatPercentInput(max));
    onChange({ min: range.min, max });
  };

  return (
    <section className="bg-white px-1.5 py-0" data-testid="height-filter-controls">
      <div className="flex flex-nowrap items-center gap-0.5 whitespace-nowrap text-[11px] text-slate-600">
        <span className="shrink-0 font-medium">身高:</span>
        <input
          id="height-range-min"
          type="text"
          inputMode="decimal"
          value={minimum}
          aria-label="最低身高百分比"
          onChange={(event) => setMinimum(event.currentTarget.value)}
          onBlur={commitMinimum}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          className="w-12 rounded-md border border-slate-200 bg-slate-50 px-1 py-0.5 text-center text-[11px] text-slate-700 focus:border-emerald-500 focus:outline-none"
          data-testid="height-range-min"
        />
        <span>%</span>
        <span>至</span>
        <input
          id="height-range-max"
          type="text"
          inputMode="decimal"
          value={maximum}
          aria-label="最高身高百分比"
          onChange={(event) => setMaximum(event.currentTarget.value)}
          onBlur={commitMaximum}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
          }}
          className="w-12 rounded-md border border-slate-200 bg-slate-50 px-1 py-0.5 text-center text-[11px] text-slate-700 focus:border-emerald-500 focus:outline-none"
          data-testid="height-range-max"
        />
        <span>%</span>
        <button
          type="button"
          aria-pressed={isZeroHeight}
          onClick={() =>
            onChange(isZeroHeight ? { ...DEFAULT_HEIGHT_RANGE } : { min: 0, max: 0 })
          }
          className={`inline-flex min-h-[24px] shrink-0 items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[11px] transition ${
            isZeroHeight
              ? 'bg-emerald-500 font-semibold text-white shadow'
              : 'bg-slate-100 font-medium text-slate-500'
          }`}
          data-testid="height-zero-preset"
        >
          零身高
        </button>
        <button
          type="button"
          aria-pressed={isFullHeight}
          onClick={() =>
            onChange(isFullHeight ? { ...DEFAULT_HEIGHT_RANGE } : { min: 100, max: 100 })
          }
          className={`inline-flex min-h-[24px] shrink-0 items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[11px] transition ${
            isFullHeight
              ? 'bg-emerald-500 font-semibold text-white shadow'
              : 'bg-slate-100 font-medium text-slate-500'
          }`}
          data-testid="height-full-preset"
        >
          满身高
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...DEFAULT_HEIGHT_RANGE })}
          className="inline-flex min-h-[24px] shrink-0 items-center rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-600 transition hover:bg-red-100"
          data-testid="height-range-reset"
        >
          清除
        </button>
      </div>
    </section>
  );
}

export interface MyPetsProps {
  /** 空数据时「去导入数据」按钮的跳转 */
  onGoImport?: () => void;
  onVisibleCountChange?: (count: number) => void;
}

/**
 * 精灵背包（原「我的精灵」）：只放**全部精灵**。
 *
 * 2026-10-29 用户口径：「合格种公」视图不要了——挑种公去「收集 · 种公」看种公阵列；
 * 母本去看「收集 · 母本」。这里不再有视角切换。
 */
export function MyPets({ onGoImport, onVisibleCountChange }: MyPetsProps) {
  const { owned, accounts } = useOwnedPets();
  // 筛选状态提升到模块级 store：切页签 / 切视角都不丢（2026-10-04 用户拍板）
  const {
    selected,
    filtersOpen,
    heightRange,
    bodyExtremeMode,
    voiceExtremeMode,
    eggGroupMatchMode,
  } = useMyPetsFilters();
  const [showAllNatures, setShowAllNatures] = useState(false);
  const heightRangeActive =
    heightRange.min !== DEFAULT_HEIGHT_RANGE.min || heightRange.max !== DEFAULT_HEIGHT_RANGE.max;
  // 搜索是本次会话的临时查看条件（切页保留、重启清空），放 listViewStore
  const nameQuery = usePersonalList('inventory-all').query;
  const setNameQuery = (value: string) => setPersonalQuery('inventory-all', value);

  const speciesByGameId = useMemo(() => new Map(species.map((s) => [s.gameId, s])), []);
  // 进化链搜索索引：搜链上任一成员名/图鉴号 → 命中整条链（火花→焰火/火神）
  const chainSearchIndex = useMemo(() => buildChainSearchIndex(species), []);
  /** 该精灵是否命中搜索词（按进化链全员匹配，图鉴未收录时退回抓包原名） */
  const petMatchesQuery = (pet: OwnedPet, query: string): boolean => {
    const entry = speciesByGameId.get(pet.gameId);
    const text =
      chainSearchIndex.get(chainKeyOf(entry, pet.gameId)) ??
      speciesDisplayName(entry, pet.name).toLowerCase();
    return text.includes(query);
  };
  const { tags, index } = useMemo(
    () => buildTagIndex(owned, speciesByGameId, eggGroupNames),
    [owned, speciesByGameId],
  );
  // 账号筛选交给页面顶部的 AccountFilterBar，下方筛选面板不再重复展示账号标签
  // （2026-10-05 用户拍板去冗余）
  const displayTags = useMemo(() => {
    const visible = tags.filter(
      (tag) =>
        tag.kind !== 'account' &&
        !(tag.kind === 'body' && (tag.label === '满身高' || tag.label === '零身高')),
    );
    const present = new Set(visible.map((tag) => tag.id));
    const allNatureOptions = new Set([
      ...targetNaturePool.map((entry) => entry.name),
      ...allNatureNames,
    ]);
    const missingNatures = [...allNatureOptions]
      .filter((name) => !present.has(`nature:${name}`))
      .map((name) => ({
        id: `nature:${name}`,
        kind: 'nature' as const,
        label: name,
      }));
    return [...visible, ...missingNatures];
  }, [tags]);

  const heightIndices = useMemo(
    () =>
      owned.flatMap((pet, index) =>
        matchesHeightRange(pet.heightPercent, heightRange) ? [index] : [],
      ),
    [owned, heightRange],
  );

  const filteredIndices = useMemo(() => {
    const selectedTagIds = [...selected];
    const selectedEggGroupIds = selectedTagIds.filter((id) => id.startsWith('eggGroup:'));
    const tagIdsForUnionFilter =
      eggGroupMatchMode === 'dual'
        ? selectedTagIds.filter((id) => !id.startsWith('eggGroup:'))
        : selectedTagIds;
    const tagIndices =
      tagIdsForUnionFilter.length === 0
        ? owned.map((_, i) => i)
        : filterByTags(index, tagIdsForUnionFilter);
    const eggGroupSets =
      eggGroupMatchMode === 'dual'
        ? selectedEggGroupIds.map((id) => new Set(index[id] ?? []))
        : [];
    const eggGroupIndices =
      eggGroupSets.length > 0
        ? tagIndices.filter((itemIndex) => eggGroupSets.every((group) => group.has(itemIndex)))
        : tagIndices;
    if (!heightRangeActive) return eggGroupIndices;
    const heightIndexSet = new Set(heightIndices);
    return eggGroupIndices.filter((itemIndex) => heightIndexSet.has(itemIndex));
  }, [selected, eggGroupMatchMode, index, owned, heightRangeActive, heightIndices]);

  // 动态标签数量：按"其他类别已选条件"和身高范围重新计算
  const facetCounts = useMemo(
    () =>
      computeFacetCounts(
        index,
        [...selected].filter((id) => !id.startsWith('account:')),
        heightRangeActive ? heightIndices : undefined,
      ),
    [index, selected, heightRangeActive, heightIndices],
  );

  // 名称搜索 + 标签筛选的最终结果（搜索不持久化；按进化链全员匹配）
  const visiblePets = useMemo(() => {
    const list = filteredIndices.map((i) => owned[i]);
    const query = nameQuery.trim().toLowerCase();
    if (!query) return list;
    return list.filter((pet) => petMatchesQuery(pet, query));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredIndices, owned, nameQuery, speciesByGameId, chainSearchIndex]);

  useEffect(() => {
    onVisibleCountChange?.(visiblePets.length);
  }, [visiblePets.length, onVisibleCountChange]);

  const toggle = (tagId: string) => {
    const next = new Set(selected);
    if (next.has(tagId)) next.delete(tagId);
    else next.add(tagId);
    setMyPetsSelected(next);
  };

  const toggleNatureTags = (tags: PetTag[]) => {
    if (tags.length === 0) return;
    const allSelected = tags.every((tag) => selected.has(tag.id));
    const next = new Set(selected);
    for (const tag of tags) {
      if (allSelected) next.delete(tag.id);
      else next.add(tag.id);
    }
    setMyPetsSelected(next);
  };

  const switchExtremeMedalMode = (kind: 'body' | 'voice', enabled: boolean) => {
    const pairs =
      kind === 'body'
        ? [
            ['body:大块头', 'body:满体重'],
            ['body:小不点', 'body:零体重'],
          ]
        : [
            ['voice:婉转声', 'voice:+100'],
            ['voice:粗嗓门', 'voice:-100'],
          ];
    const next = new Set(selected);
    for (const [normalId, extremeId] of pairs) {
      const source = enabled ? normalId : extremeId;
      const destination = enabled ? extremeId : normalId;
      if (next.delete(source)) next.add(destination);
    }
    setMyPetsSelected(next);
    setMyPetsExtremeMedalMode(kind, enabled);
  };

  const clearTagKind = (kind: 'shiny' | 'body' | 'voice') => {
    setMyPetsSelected(new Set([...selected].filter((id) => !id.startsWith(`${kind}:`))));
    if (kind === 'body' || kind === 'voice') setMyPetsExtremeMedalMode(kind, false);
  };

  // 完全没数据才早退；账号筛选全取消导致 owned 为空时，保留页面与顶部账号筛选条
  // （2026-10-05 用户反馈：全取消后控件会消失）
  if (accounts.length === 0) {
    return (
      <main className="mx-auto max-w-md p-4">
        <EmptyState onGoImport={onGoImport} />
      </main>
    );
  }

  const selectedLabels = [
    ...displayTags.filter((tag) => selected.has(tag.id)).map((tag) => tag.label),
    ...(heightRangeActive
      ? [
          isHeightPreset(heightRange)
            ? `身高 ${formatPercent(heightRange.min)}`
            : `身高 ${formatPercent(heightRange.min)}–${formatPercent(heightRange.max)}`,
        ]
      : []),
  ];
  const selectedFilterCount = selected.size + (heightRangeActive ? 1 : 0);
  const tagsOfKind = (kind: string, labels?: string[]) =>
    displayTags.filter(
      (tag) => tag.kind === kind && (labels === undefined || labels.includes(tag.label)),
    );
  const selectedEggGroupIds = [...selected].filter((id) => id.startsWith('eggGroup:'));
  const natureGroups = groupNatureTags(tagsOfKind('nature'));
  const renderNatureOption = (tag: PetTag, showCount = true) => {
    const on = selected.has(tag.id);
    const count = facetCounts[tag.id] ?? 0;
    return (
      <button
        key={tag.id}
        type="button"
        aria-pressed={on}
        aria-label={showCount ? undefined : `${tag.label}，${count}只`}
        title={showCount ? undefined : `${count}只`}
        onClick={() => toggle(tag.id)}
        data-testid={`filter-opt-nature-${tag.id}`}
        className={`flex min-h-[30px] w-full items-center justify-center rounded-md border px-1.5 py-1 text-xs transition ${
          on
            ? 'bg-emerald-500 font-semibold text-white shadow'
            : 'bg-slate-100 font-medium text-slate-500'
        }`}
      >
        {showCount ? `${tag.label} (${count})` : tag.label}
      </button>
    );
  };
  const natureContent = (
    <div className="space-y-1.5" data-testid="nature-filter-groups">
      {natureGroups.target.length > 0 ? (
        <section data-testid="filter-nature-group-target">
          <div
            className="relative mb-1 flex w-full flex-nowrap items-center justify-center gap-1"
            data-testid="nature-group-controls"
          >
            <button
              type="button"
              aria-pressed={!showAllNatures}
              onClick={() => setShowAllNatures(false)}
              className={`rounded-md border px-2 py-0.5 text-[11px] transition ${
                !showAllNatures
                  ? 'border-emerald-500 bg-emerald-500 font-semibold text-white'
                  : 'border-slate-200 bg-slate-50 font-medium text-slate-600'
              }`}
              data-testid="filter-nature-target-toggle"
            >
              八大性格
            </button>
            <button
              type="button"
              aria-pressed={showAllNatures}
              onClick={() => setShowAllNatures(true)}
              className={`rounded-md border px-2 py-0.5 text-[11px] transition ${
                showAllNatures
                  ? 'border-emerald-500 bg-emerald-500 font-semibold text-white'
                  : 'border-slate-200 bg-white font-medium text-emerald-700'
              }`}
              data-testid="nature-show-all-toggle"
            >
              全部性格
            </button>
            <button
              type="button"
              onClick={() =>
                setMyPetsSelected(new Set([...selected].filter((id) => !id.startsWith('nature:'))))
              }
              className="absolute right-0 rounded px-1 text-[11px] font-medium text-emerald-600"
              data-testid="filter-clear-nature"
            >
              清除
            </button>
          </div>
          {!showAllNatures ? (
            <div className="grid grid-cols-4 justify-items-center gap-1">
              {natureGroups.target.map((tag) => renderNatureOption(tag))}
            </div>
          ) : null}
        </section>
      ) : null}
      {showAllNatures ? (
        <>
          {natureGroups.stats.map(({ stat, tags: natureTags }) => {
            const allSelected = natureTags.every((tag) => selected.has(tag.id));
            return (
              <section
                key={stat}
                className="max-w-full"
                data-testid={`filter-nature-group-${stat}`}
              >
                <div className="grid grid-cols-6 items-center gap-1">
                  <div className="flex items-center justify-center gap-0.5 whitespace-nowrap">
                    <button
                      type="button"
                      aria-pressed={allSelected}
                      onClick={() => toggleNatureTags(natureTags)}
                      className={`rounded-md border px-1.5 py-1 text-xs transition ${
                        allSelected
                          ? 'border-emerald-500 bg-emerald-500 font-semibold text-white'
                          : 'border-slate-200 bg-slate-50 font-medium text-slate-600'
                      }`}
                      data-testid={`filter-nature-stat-${stat}`}
                    >
                      {stat}
                    </button>
                    <span className="text-xs">:</span>
                  </div>
                  {natureTags.map((tag) => renderNatureOption(tag, false))}
                </div>
              </section>
            );
          })}
          {natureGroups.other.length > 0 ? (
            <section className="max-w-full" data-testid="filter-nature-group-other">
              <div className="flex flex-nowrap items-center justify-center gap-0.5 whitespace-nowrap">
                <button
                  type="button"
                  aria-pressed={natureGroups.other.every((tag) => selected.has(tag.id))}
                  onClick={() => toggleNatureTags(natureGroups.other)}
                  className="rounded-md border border-slate-200 bg-slate-50 px-0.5 py-0.5 text-[10px] font-medium text-slate-600 transition"
                  data-testid="filter-nature-stat-other"
                >
                  其他
                </button>
                <span className="text-[10px]">:</span>
                {natureGroups.other.map((tag) => renderNatureOption(tag, false))}
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
  const eggGroupModeActions = (
    <div
      className="flex items-center justify-center gap-1"
      role="group"
      aria-label="蛋组筛选方式"
      data-testid="egg-group-match-mode"
    >
      {([
        ['multi', '多选'],
        ['dual', '双组'],
      ] as const).map(([mode, label]) => {
        const disabled = mode === 'dual' && eggGroupMatchMode !== 'dual' && selectedEggGroupIds.length > 2;
        return (
          <button
            key={mode}
            type="button"
            aria-pressed={eggGroupMatchMode === mode}
            disabled={disabled}
            title={disabled ? '请先在多选模式下将已选蛋组减至两个以内' : undefined}
            onClick={() => setMyPetsEggGroupMatchMode(mode)}
            className={`min-h-[32px] rounded-md border px-2 py-1.5 text-[10px] transition disabled:cursor-not-allowed disabled:opacity-40 ${
              eggGroupMatchMode === mode
                ? 'border-emerald-500 bg-emerald-500 font-semibold text-white'
                : 'border-slate-200 bg-slate-50 font-medium text-slate-500'
            }`}
            data-testid={`egg-group-mode-${mode}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
  const filterDimensions = FILTER_DIMENSIONS.filter(({ kind }) =>
    displayTags.some((tag) => tag.kind === kind),
  ).map(({ kind, label }) => {
    const groupTags = tagsOfKind(kind);
    return {
      id: kind,
      label,
      options: groupTags.map((tag) => {
        const on = selected.has(tag.id);
        const limitReached =
          kind === 'eggGroup' &&
          eggGroupMatchMode === 'dual' &&
          selectedEggGroupIds.length >= 2 &&
          !on;
        return {
          value: tag.id,
          label: `${tag.label} (${facetCounts[tag.id] ?? 0})`,
          // 已选项即使当前命中 0 也必须能取消（已选但被置灰就点不掉，只能整页重置；R2-4-M02）
          disabled: ((facetCounts[tag.id] ?? 0) === 0 && !on) || limitReached,
        };
      }),
      selected: groupTags.filter((tag) => selected.has(tag.id)).map((tag) => tag.id),
      onToggle: (id: string) => toggle(id),
      onClear: () =>
        setMyPetsSelected(new Set([...selected].filter((id) => !id.startsWith(`${kind}:`)))),
      headerActions: kind === 'eggGroup' ? eggGroupModeActions : undefined,
      content: kind === 'nature' ? natureContent : undefined,
      centerOptions: kind === 'eggGroup',
      columns: kind === 'eggGroup' ? 4 as const : undefined,
      hideClear: kind === 'nature',
    };
  });

  return (
    <main className="mx-auto max-w-md space-y-1 px-4 pb-4 pt-0.5">
      {/* 搜索常显、独立于高级筛选（2026-10-24 统一控件） */}
      <SearchField
        label="搜索精灵名"
        value={nameQuery}
        onValueChange={setNameQuery}
        placeholder="搜索精灵名"
        testId="pet-name-search"
      />
      <FilterPanel
        title={`筛选${selectedFilterCount > 0 ? `（${selectedFilterCount}）` : ''}`}
        dense
        open={filtersOpen}
        onOpenChange={setMyPetsFiltersOpen}
        onClear={() => {
          clearInventoryFilters();
          setNameQuery('');
        }}
        clearLabel={`重置${selectedFilterCount > 0 ? `（${selectedFilterCount}）` : ''}`}
        testId="pet-filters"
        toggleTestId="pet-filters-toggle"
        clearTestId="pet-filters-reset"
        summary={selectedLabels.length > 0 ? `已选：${selectedLabels.join('、')}` : undefined}
        summaryTestId="pet-filters-selected"
      >
        <div
          className="relative flex min-w-0 flex-nowrap items-center gap-1"
          data-testid="inventory-primary-filters"
        >
          <FilterOptionRow
            kind="gender"
            tags={tagsOfKind('gender', ['公', '母'])}
            selected={selected}
            counts={facetCounts}
            onToggle={toggle}
            className="shrink-0"
          />
          <FilterAccordion
            inline
            popover
            centered
            dimensions={filterDimensions}
          />
        </div>
        <HeightRangeControl range={heightRange} onChange={setMyPetsHeightRange} />
        <div className="space-y-1 bg-white p-1.5" data-testid="pet-medal-filters">
          <FilterOptionRow
            kind="shiny"
            label="稀有:"
            tags={tagsOfKind('shiny', ['炫彩', '异色', '异色炫彩'])}
            selected={selected}
            counts={facetCounts}
            onToggle={toggle}
            onClear={() => clearTagKind('shiny')}
            compact
          />
          <FilterOptionRow
            kind="body"
            label="体型:"
            tags={
              bodyExtremeMode
                ? [
                    { id: 'body:满体重', kind: 'body', label: '大块头' },
                    { id: 'body:零体重', kind: 'body', label: '小不点' },
                  ]
                : sortBodyFirst(tagsOfKind('body', ['大块头', '小不点']))
            }
            selected={selected}
            counts={facetCounts}
            onToggle={toggle}
            onClear={() => clearTagKind('body')}
            compact
            extremeMode={bodyExtremeMode}
            trailing={
              <button
                type="button"
                aria-pressed={bodyExtremeMode}
                onClick={() => switchExtremeMedalMode('body', !bodyExtremeMode)}
                className={`shrink-0 rounded border px-1.5 py-0.5 text-[11px] ${
                  bodyExtremeMode
                    ? 'border-emerald-500 bg-emerald-500 font-semibold text-white'
                    : 'border-slate-200 bg-slate-50 font-medium text-slate-500'
                }`}
                data-testid="body-extreme-mode-toggle"
              >
                极限
              </button>
            }
          />
          <FilterOptionRow
            kind="voice"
            label="声音:"
            tags={
              voiceExtremeMode
                ? [
                    { id: 'voice:+100', kind: 'voice', label: '婉转声' },
                    { id: 'voice:-100', kind: 'voice', label: '粗嗓门' },
                  ]
                : sortVoiceFirst(tagsOfKind('voice', VOICE_TAG_ORDER))
            }
            selected={selected}
            counts={facetCounts}
            onToggle={toggle}
            onClear={() => clearTagKind('voice')}
            compact
            extremeMode={voiceExtremeMode}
            trailing={
              <button
                type="button"
                aria-pressed={voiceExtremeMode}
                onClick={() => switchExtremeMedalMode('voice', !voiceExtremeMode)}
                className={`shrink-0 rounded border px-1.5 py-0.5 text-[11px] ${
                  voiceExtremeMode
                    ? 'border-emerald-500 bg-emerald-500 font-semibold text-white'
                    : 'border-slate-200 bg-slate-50 font-medium text-slate-500'
                }`}
                data-testid="voice-extreme-mode-toggle"
              >
                极限
              </button>
            }
          />
        </div>
      </FilterPanel>
      {visiblePets.length === 0 ? (
        <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">
          没有符合条件的精灵，试试取消部分标签。
        </div>
      ) : (
        <PetList
          pets={visiblePets}
          speciesByGameId={speciesByGameId}
          eggGroupNames={eggGroupNames}
          showCount={false}
        />
      )}
    </main>
  );
}

function isHeightPreset(range: HeightRange): boolean {
  return (range.min === 0 && range.max === 0) || (range.min === 100 && range.max === 100);
}
