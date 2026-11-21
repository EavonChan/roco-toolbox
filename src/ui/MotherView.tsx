import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { GRADE_BODY, GRADE_VOICE, type MotherGroup, type TargetMode } from '../domain/petFilters';
import type { OwnedPet } from '../domain/types';
import { species as catalogSpecies } from '../data/catalog';
import {
  effectiveMotherVoices,
  isChainCollected as chainCollectedBy,
  isQualifiedMother as isQualifiedMotherBy,
  motherVoicesForMode,
  type MotherCriteria,
} from '../domain/motherCriteria';
import { AccountSection } from './AccountSection';
import { PetAvatar } from './PetAvatar';
import { PetCardLayout } from './PetCardLayout';
import { SearchField } from './primitives/SearchField';
import { InlineMultiSelect } from './primitives/InlineMultiSelect';
import { SegmentedControl } from './primitives/SegmentedControl';
import { setPersonalQuery, usePersonalList } from './listViewStore';
import {
  getMotherCriteria,
  setMotherCriteria,
  useMotherCriteria,
} from './motherCriteriaStore';
import {
  mergeMotherPlan,
  removeManyFromMotherPlan,
  toggleMotherPlan,
  useMotherPlan,
} from './motherPlanStore';
import { createNaturesResolver, eggNatures } from '../domain/recommendedNatures';
import { useNatureOverrides } from './natureOverrideStore';
import { RecommendedNatureEditor } from './RecommendedNatureEditor';
import { MotherCriteriaMedals, selectedGradesFor } from './MotherCriteriaMedals';
import { findMotherGapFill, type GapFill } from '../domain/gapFill';
import type { MotherNestAccount } from '../domain/motherNest';
import { GapFillDialog, type GapTargetView } from './GapFillDialog';
import { MotherCollectingView } from './plan/MotherCollectingView';
import type { NavigationIntent } from './navigation';

/** 每节的分页大小：母本视角的每一节动辄上百条，必须分页 */
const PAGE_SIZE = 20;

/** 点「查看」带到精灵背包的筛选：进化链名 + 标签（不再带身高范围，见 jumpBase）。 */
export interface MotherInventoryJump {
  name: string;
  tags: string[];
}

export interface MotherViewProps {
  owned: OwnedPet[];
  /** 蛋搜索索引（`egg:<蛋物种 gameId>` → 归属这颗蛋的全部形态名 + 图鉴号） */
  searchIndex: Map<string, string>;
  eggGroupNames: Record<number, string>;
  motherGroups: MotherGroup[];
  mode: TargetMode;
  /** 从收集页直达的状态（未收集 / 收集中 / 已收集）；计划分区独立展示 */
  status?: 'missing' | 'collecting' | 'collected';
  /** 点卡片底部「查看」：带到精灵背包的筛选条件 */
  onOpenInventory?: (jump: MotherInventoryJump) => void;
  /** 母本配窝建议（与看板同一份口径）：未收集卡点开悬浮窗时找「本号直配 / 跨号传蛋」 */
  motherSuggestions?: ReadonlyMap<string, MotherNestAccount>;
  /** 当前选中的号（悬浮窗按号的顺序找线） */
  accountNames?: readonly string[];
  /** 悬浮窗目标卡：目标说明与奖牌图标 */
  gapTarget?: {
    label: string;
    bodyMedal: string | null;
    /** 声音目标标签（+100 / -100 / 婉转声 / 粗嗓门）：悬浮窗按它区分满分与双牌 */
    voiceTarget?: string | null;
    voiceDb: number | null;
    weightPercent: number | null;
  };
  /** 悬浮窗里的「去求蛋」：打开小组求助 */
  onSeekHelp?: () => void;
  /** 收集中页发布/查看小组需求 */
  onNavigate?: (intent: NavigationIntent) => void;
}

interface SectionProps {
  title: string;
  titleClass: string;
  groups: MotherGroup[];
  defaultOpen?: boolean;
  testId: string;
  renderRow: (group: MotherGroup) => ReactNode;
  /** 标题下方的工具区（候选区的搜索框、计划区的「清除已达成」） */
  toolbar?: ReactNode;
  /** 列表容器样式 */
  listClassName?: string;
  /** 提供该分组键时，列表按它聚拢、每组用 AccountSection 标题（2026-10-05 已收集按账号分组） */
  groupKey?: (group: MotherGroup) => string;
}

/** 可折叠 + 分页的一节。默认收起，避免一进页面就被几百条铺满。 */
function CollapsibleSection({
  title,
  titleClass,
  groups,
  defaultOpen = false,
  testId,
  renderRow,
  toolbar,
  listClassName = 'space-y-1',
  groupKey,
}: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [page, setPage] = useState(1);
  // 搜索命中时把这一节自动展开（用户拍板：搜索到的页签就打开展示对应精灵）
  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);
  const totalPages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = groups.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  // 提供 groupKey 时把当前页的条目按它分组（2026-10-05 已收集按账号聚拢）
  const grouped = groupKey
    ? (() => {
        const map = new Map<string, MotherGroup[]>();
        for (const group of visible) {
          const key = groupKey(group);
          const list = map.get(key) ?? [];
          list.push(group);
          map.set(key, list);
        }
        return [...map.entries()].map(([account, items]) => ({ account, items }));
      })()
    : null;

  return (
    <section className="rounded-2xl bg-white shadow-sm" data-testid={testId}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex min-h-[36px] w-full items-center justify-between px-3 text-left"
        data-testid={`${testId}-toggle`}
      >
        <span className={`text-sm font-medium ${titleClass}`}>
          {title}（{groups.length}）
        </span>
        <span className="text-xs text-slate-300" aria-hidden>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open ? (
        <div className="space-y-2 border-t border-slate-100 p-3">
          {toolbar}
          {groups.length === 0 ? (
            <p className="text-xs text-slate-400" data-testid={`${testId}-empty`}>
              这一节暂时没有。
            </p>
          ) : grouped ? (
            <>
              <div className="space-y-2" data-testid={`${testId}-list`}>
                {grouped.map(({ account, items }) => (
                  <AccountSection key={account} account={account}>
                    <ul className={listClassName}>{items.map(renderRow)}</ul>
                  </AccountSection>
                ))}
              </div>
              {totalPages > 1 ? (
                <nav className="flex items-center justify-between gap-2" aria-label="分页">
                  <button
                    type="button"
                    disabled={safePage === 1}
                    onClick={() => setPage(safePage - 1)}
                    className="min-h-[32px] flex-1 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 disabled:text-slate-300"
                  >
                    上一页
                  </button>
                  <span className="text-xs text-slate-400">
                    第 {safePage} / {totalPages} 页
                  </span>
                  <button
                    type="button"
                    disabled={safePage === totalPages}
                    onClick={() => setPage(safePage + 1)}
                    className="min-h-[32px] flex-1 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 disabled:text-slate-300"
                  >
                    下一页
                  </button>
                </nav>
              ) : null}
            </>
          ) : (
            <>
              <ul className={listClassName} data-testid={`${testId}-list`}>
                {visible.map(renderRow)}
              </ul>
              {totalPages > 1 ? (
                <nav className="flex items-center justify-between gap-2" aria-label="分页">
                  <button
                    type="button"
                    disabled={safePage === 1}
                    onClick={() => setPage(safePage - 1)}
                    className="min-h-[32px] flex-1 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 disabled:text-slate-300"
                  >
                    上一页
                  </button>
                  <span className="text-xs text-slate-400">
                    第 {safePage} / {totalPages} 页
                  </span>
                  <button
                    type="button"
                    disabled={safePage === totalPages}
                    onClick={() => setPage(safePage + 1)}
                    className="min-h-[32px] flex-1 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 disabled:text-slate-300"
                  >
                    下一页
                  </button>
                </nav>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}

/** 链清单的收/未收开关（2026-10-06 用户拍板：由「只看未收集」开关改成两态分段） */
const CHAIN_FILTERS = [
  { value: 'uncollected', label: '未收集' },
  { value: 'collecting', label: '收集中' },
  { value: 'collected', label: '已收集' },
] as const;
type ChainFilter = (typeof CHAIN_FILTERS)[number]['value'];
const INITIAL_CHAIN_SECTIONS = 2;
const CHAIN_SECTION_BATCH = 5;

/**
 * 母本视角：
 *
 * - **已收集**：按满分四档各自一节（与看板的四档计数同口径），行是两列紧凑卡（PetCard）；
 * - **计划收集**：用户从「待补齐母本」里挑出来的待办（存 localStorage / 随备份走），
 *   自动判定达成（该链已有合格母本）并支持「清除已达成」；
 * - **待补齐母本**：所有还没有合格母本的链（无母本 ∪ 有母本但不够档），
 *   默认收起、可搜索、勾选即加入计划；
 * - **收集中**（2026-11-20 好友 UI）：挑中的链按收集计划卡展示求蛋进度，
 *   与小组需求联动，可直接发布 / 查看。
 */
export function MotherView({
  owned,
  searchIndex,
  eggGroupNames,
  motherGroups,
  mode,
  status,
  onOpenInventory,
  motherSuggestions,
  accountNames = [],
  gapTarget,
  onSeekHelp,
  onNavigate,
}: MotherViewProps) {
  /** 「未收集母本怎么补」悬浮窗（2026-11-19 用户口径）：与看板共用同一块内容 */
  const [gapDialog, setGapDialog] = useState<{ chainKey: string; target: GapTargetView; fill: GapFill } | null>(
    null,
  );
  const plan = useMotherPlan();
  const criteria = useMotherCriteria();
  const natureOverrides = useNatureOverrides();
  /** 推荐性格解析器：蛋覆盖 → 图鉴 PVP → 种族值兜底（与小组同一口径） */
  const naturesOf = useMemo(
    () => createNaturesResolver({ species: catalogSpecies, overrides: natureOverrides }),
    [natureOverrides],
  );
  const [natureEditorOpen, setNatureEditorOpen] = useState(false);
  // 搜索是本次会话的临时查看条件（切页保留、重启清空）
  const query = usePersonalList('mothers').query;
  const setQuery = (value: string) => setPersonalQuery('mothers', value);
  // 默认看「未收集」（待补齐才是主场景；看板「母本全收集」卡跳过来也是它）
  const [chainFilter, setChainFilter] = useState<ChainFilter>('uncollected');
  const [visibleSectionCount, setVisibleSectionCount] = useState(INITIAL_CHAIN_SECTIONS);

  // 收集页的「未收集 / 收集中 / 已收集」直达：同步到本页的状态开关
  useEffect(() => {
    if (status === 'missing') setChainFilter('uncollected');
    else if (status === 'collecting') setChainFilter('collecting');
    else if (status === 'collected') setChainFilter('collected');
  }, [status]);

  /**
   * 声音选项随目标模式联动（2026-10-05 用户拍板）：
   * 追满分 → +100 / -100；追双牌 → 婉转声 / 粗嗓门。
   * 模式切换后若旧选择与此模式无交集，重置为该模式的默认全选（避免隐藏选项仍在暗中过滤）。
   */
  const modeVoices = motherVoicesForMode(mode);
  const activeVoices = effectiveMotherVoices(criteria.voices, mode);
  useEffect(() => {
    if (criteria.voices.length > 0 && !criteria.voices.some((voice) => modeVoices.includes(voice))) {
      setMotherCriteria({ ...getMotherCriteria(), voices: [...modeVoices] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  /**
   * 统一的「母本达标 = 已收集」口径（2026-10-05 用户拍板）。
   *
   * 定义本身在领域层 `src/domain/motherCriteria.ts`（看板「母本全收集」卡共用同一份），
   * 这里只是把当前模式下的有效声音选择传进去。
   */
  const effectiveCriteria: MotherCriteria = {
    bodies: criteria.bodies,
    voices: activeVoices,
    grades: criteria.grades,
    targetMode: mode,
    recommendedNatures: criteria.recommendedNatures === true,
  };
  const isQualifiedMother = (pet: OwnedPet): boolean =>
    isQualifiedMotherBy(pet, effectiveCriteria, naturesOf);
  const isChainCollected = (group: MotherGroup): boolean =>
    chainCollectedBy(group, owned, effectiveCriteria, naturesOf);

  /**
   * 「查看」带到精灵背包的公共条件：按钮上显示的那一档奖牌（强制单选）。
   *
   * 体型按**奖牌 或 身高到顶 / 到底**取并集，与母本达标口径（`breedingBodyGradeOf`）一致：
   * - 有奖牌：真实数据里存在身高不是 100% / 0% 的个体（如大块头 98.48%），只按身高筛会漏；
   * - 无奖牌：身高 100% / 0% 也算大块头 / 小不点，只按奖牌标签筛会漏。
   * 两个标签同属 body 类，`filterByTags` 内取并集，所以不再额外设身高范围。
   */
  const jumpBase = useMemo(() => {
    const grade = selectedGradesFor(criteria, mode)[0] ?? '大婉';
    const body = GRADE_BODY[grade];
    const voice =
      mode === 'medal' ? GRADE_VOICE[grade] : GRADE_VOICE[grade] === '婉转声' ? '+100' : '-100';
    const heightTag = body === '大块头' ? 'body:满身高' : 'body:零身高';
    return {
      tags: ['gender:母', `body:${body}`, heightTag, `voice:${voice}`],
    };
  }, [criteria, mode]);

  const plannedSet = useMemo(() => new Set(plan), [plan]);

  const targetBody = criteria.bodies.includes('小不点') && !criteria.bodies.includes('大块头')
    ? '小不点'
    : '大块头';
  const targetVoice =
    mode === 'perfect'
      ? activeVoices.includes('-100') && !activeVoices.includes('+100')
        ? '-100'
        : '+100'
      : activeVoices.includes('粗嗓门') && !activeVoices.includes('婉转声')
        ? '粗嗓门'
        : '婉转声';

  const missingNaturesByEgg = useMemo(() => {
    const map = new Map<number, readonly string[]>();
    for (const group of motherGroups) {
      const natures = eggNatures(catalogSpecies, group.eggGameId, natureOverrides);
      map.set(
        group.eggGameId,
        natures.filter(
          (nature) =>
            !group.memberIndexes.some(
              (index) =>
                owned[index]?.nature === nature &&
                isQualifiedMother(owned[index]),
            ),
        ),
      );
    }
    return map;
  }, [motherGroups, owned, criteria, activeVoices.join(','), naturesOf, natureOverrides]);

  /** 搜索（进化链全员命中）+ 蛋组筛选：同时作用于已收集 / 计划 / 待补齐 */
  const keyword = query.trim().toLowerCase();
  const [eggGroupFilter, setEggGroupFilter] = useState<string[]>([]);

  /** 蛋组筛选选项：按母本链实际覆盖的蛋组给（带链数） */
  const eggGroupOptions = useMemo(() => {
    const counts = new Map<number, number>();
    for (const group of motherGroups) {
      for (const groupId of group.eggGroups) counts.set(groupId, (counts.get(groupId) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([groupId, count]) => ({
        value: String(groupId),
        label: `${eggGroupNames[groupId] ?? `蛋组${groupId}`} (${count})`,
      }));
  }, [motherGroups, eggGroupNames]);

  const matchedGroups = useMemo(
    () =>
      motherGroups.filter((group) => {
        if (keyword) {
          const text =
            searchIndex.get(group.chainKey) ??
            `${group.formLabel} ${group.number}`.toLowerCase();
          if (!text.includes(keyword)) return false;
        }
        if (eggGroupFilter.length > 0) {
          const picked = new Set(eggGroupFilter);
          if (!group.eggGroups.some((groupId) => picked.has(String(groupId)))) return false;
        }
        return true;
      }),
    [motherGroups, keyword, searchIndex, eggGroupFilter],
  );

  /** 归属这颗蛋的合格母本（可能多只，含火神这类已进化形态） */
  const mothersOf = (group: MotherGroup): OwnedPet[] =>
    group.memberIndexes.map((i) => owned[i]).filter(isQualifiedMother);

  /** 命中链总数 / 已收集数（列表顶部给一行整体进度） */
  const collectedChainCount = matchedGroups.filter(isChainCollected).length;

  /**
   * 链清单（按蛋组分区、图鉴号排序；每行四张精灵卡）：
   * 按**主蛋组**（链的最小可孵蛋组）分区，组内按图鉴号排序；每条链一行。
   */
  const chainSections = useMemo(() => {
    const list = matchedGroups.filter((group) => {
      const collected = isChainCollected(group);
      if (chainFilter === 'uncollected') return !collected && !plannedSet.has(group.chainKey);
      if (chainFilter === 'collected') return collected;
      return false;
    });
    const byGroup = new Map<number, MotherGroup[]>();
    for (const group of list) {
      const primary = group.eggGroups[0];
      if (primary === undefined) continue;
      const bucket = byGroup.get(primary) ?? [];
      bucket.push(group);
      byGroup.set(primary, bucket);
    }
    return [...byGroup.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([groupId, groups]) => ({
        groupId,
        label: eggGroupNames[groupId] ?? `蛋组${groupId}`,
        collected: groups.filter(isChainCollected).length,
        total: groups.length,
        groups: [...groups].sort(
          (a, b) => a.number.localeCompare(b.number) || a.formLabel.localeCompare(b.formLabel),
        ),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedGroups, chainFilter, owned, criteria, activeVoices.join(','), naturesOf, plannedSet]);
  useEffect(() => {
    setVisibleSectionCount(INITIAL_CHAIN_SECTIONS);
  }, [chainFilter, keyword, eggGroupFilter.join(',')]);
  const visibleChainSections = chainSections.slice(0, visibleSectionCount);
  const hiddenChainSections = Math.max(0, chainSections.length - visibleChainSections.length);
  const planGroups = useMemo(
    () => matchedGroups.filter((group) => plannedSet.has(group.chainKey)),
    [matchedGroups, plannedSet],
  );
  const achievedGroups = planGroups.filter((group) => isChainCollected(group));
  const renderPlanRow = (group: MotherGroup): ReactNode => {
    const achieved = isChainCollected(group);
    return (
      <li
        key={group.chainKey}
        className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5"
        data-testid="mother-plan-row"
      >
        <span className="min-w-0 flex-1 truncate">
          <span className={`text-sm ${achieved ? 'text-emerald-700' : 'text-slate-800'}`}>
            {group.formLabel || '未知精灵'}
          </span>
          {group.number ? (
            <span className="ml-1 text-[11px] text-slate-400">#{group.number}</span>
          ) : null}
          {achieved ? (
            <span className="ml-1.5 text-[11px] text-emerald-700" data-testid="mother-plan-done">
              已达成
            </span>
          ) : null}
        </span>
        <button
          type="button"
          onClick={() => toggleMotherPlan(group.chainKey)}
          className="min-h-[28px] shrink-0 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-500"
          data-testid="mother-plan-remove"
        >
          移除
        </button>
      </li>
    );
  };

  /** 打开「未收集母本怎么补」悬浮窗：目标卡用当前目标奖牌，路线按本号优先找 */
  const openGapFor = (group: MotherGroup) => {
    if (!gapTarget) return;
    const name = group.formLabel || '未知精灵';
    setGapDialog({
      chainKey: group.chainKey,
      target: {
        kind: 'mother',
        name,
        number: group.number,
        gameId: group.eggGameId,
        natures: eggNatures(catalogSpecies, group.eggGameId, natureOverrides),
        eggGroupLabels: group.eggGroups.map((groupId) => eggGroupNames[groupId] ?? `蛋组${groupId}`),
        tag: '未收集',
        targetLabel: gapTarget.label,
        bodyMedal: gapTarget.bodyMedal,
        voiceTarget: gapTarget.voiceTarget ?? null,
        voiceDb: gapTarget.voiceDb,
        weightPercent: gapTarget.weightPercent,
      },
      fill: findMotherGapFill(group.eggGameId, motherSuggestions ?? new Map(), accountNames),
    });
  };

  return (
    <div className="collection-layout" data-tour="collection-mothers">
      <div className="collection-rail space-y-2">
      {/* 搜索 + 蛋组筛选同一行：蛋组用页内下拉多选，不再单开一段面板（2026-10-25 用户要求） */}
      <div className="flex items-center gap-1.5">
        <SearchField
          className="min-w-0 flex-1"
          label="搜索母本"
          value={query}
          onValueChange={setQuery}
          placeholder="搜索母本名称或图鉴号（支持进化链）"
          testId="mother-search"
        />
        <InlineMultiSelect
          label="蛋组筛选"
          values={eggGroupFilter}
          options={eggGroupOptions}
          onValuesChange={setEggGroupFilter}
          allLabel="全部蛋组"
          unit="个蛋组"
          testId="mother-egg-group-filter"
          menuTestId="mother-egg-group-options"
          optionTestId={(value) => `mother-egg-filter-option-${value || 'all'}`}
          align="right"
          className="max-w-[116px] shrink-0"
        />
      </div>

      {/* 母本页的奖牌组合与看板全局目标同一份：syncTargetGrade 让两处一起写 */}
      <MotherCriteriaMedals testIdPrefix="mother-criteria" syncTargetGrade />
        <div className="flex flex-wrap items-center justify-between gap-1 px-1">
          <span className="text-[11px] text-slate-400" data-testid="mother-chain-summary">
            共 {matchedGroups.length} 条链 · 已收集 {collectedChainCount}
          </span>
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            <button
              type="button"
              aria-pressed={criteria.recommendedNatures === true}
              onClick={() =>
                setMotherCriteria({ ...criteria, recommendedNatures: criteria.recommendedNatures !== true })
              }
              data-testid="mother-recommended-only"
              className={`min-h-[28px] rounded-lg border px-1.5 text-[11px] ${
                criteria.recommendedNatures
                  ? 'border-emerald-500 bg-emerald-50 font-medium text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-500'
              }`}
            >
              只算推荐性格
            </button>
            <button
              type="button"
              onClick={() => setNatureEditorOpen(true)}
              data-testid="mother-nature-editor"
              className="min-h-[28px] rounded-lg border border-slate-200 bg-white px-1.5 text-[11px] text-slate-500"
            >
              编辑推荐性格
            </button>
            <SegmentedControl
              label="母本收集状态"
              value={chainFilter}
              options={CHAIN_FILTERS.map((item) => ({ value: item.value, label: item.label }))}
              onValueChange={(next) => setChainFilter(next as ChainFilter)}
              optionTestId={(value) => `mother-chain-filter-${value}`}
              className="w-[186px]"
            />
          </div>
        </div>
      </div>

      <div className="collection-main space-y-2">
      {planGroups.length > 0 ? (
        <CollapsibleSection
          title="计划收集"
          titleClass="text-emerald-700"
          groups={planGroups}
          defaultOpen
          testId="mother-plan"
          renderRow={renderPlanRow}
          toolbar={
            achievedGroups.length > 0 ? (
              <button
                type="button"
                onClick={() =>
                  removeManyFromMotherPlan(achievedGroups.map((group) => group.chainKey))
                }
                className="min-h-[28px] rounded-md border border-emerald-500 px-2 text-xs font-medium text-emerald-700"
                data-testid="mother-plan-clear-done"
              >
                清除已达成（{achievedGroups.length}）
              </button>
            ) : undefined
          }
        />
      ) : null}

      {/* 链清单按蛋组分区，每行四只；收集中使用同一母本卡但不按蛋组分区 */}
      <section
        className="space-y-2"
        data-testid={chainFilter === 'collecting' ? 'mother-collecting-shell' : 'mother-chain-list'}
      >
        {chainFilter === 'collecting' ? (
          <MotherCollectingView
            motherGroups={motherGroups}
            missingNaturesByEgg={missingNaturesByEgg}
            eggGroupNames={eggGroupNames}
            targetBody={targetBody}
            targetVoice={targetVoice}
            mode={mode}
            onNavigate={onNavigate ?? (() => {})}
          />
        ) : chainSections.length === 0 ? (
          <p
            className="rounded-2xl bg-white p-3 text-xs text-slate-400 shadow-sm"
            data-testid="mother-chain-empty"
          >
            当前筛选下没有匹配的母本链。
          </p>
        ) : (
          visibleChainSections.map((section) => (
            <div
              key={section.groupId}
              className="overflow-hidden rounded-2xl bg-white shadow-sm"
              style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 180px' }}
              data-testid={`mother-chain-group-${section.groupId}`}
            >
              <p className="flex items-center justify-between bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-slate-500">
                <span>{section.label}</span>
                <span className="text-slate-400">
                  已收集 {section.collected}/{section.total}
                </span>
              </p>
              <ul
                className="grid grid-cols-4 gap-1"
                data-testid={`mother-chain-group-list-${section.groupId}`}
              >
                {section.groups.map((group) => (
                  <MotherEggRow
                    key={group.chainKey}
                    eggName={group.formLabel || '未知精灵'}
                    eggGameId={group.eggGameId}
                    number={group.number}
                    recommendedNatures={eggNatures(catalogSpecies, group.eggGameId, natureOverrides)}
                    mothers={mothersOf(group)}
                    eggGroupLabels={group.eggGroups.map(
                      (groupId) => eggGroupNames[groupId] ?? `蛋组${groupId}`,
                    )}
                    planned={plannedSet.has(group.chainKey)}
                    onTogglePlan={() => toggleMotherPlan(group.chainKey)}
                    jumpBase={jumpBase}
                    onOpenInventory={onOpenInventory}
                    onOpenGap={gapTarget ? () => openGapFor(group) : undefined}
                  />
                ))}
              </ul>
            </div>
          ))
        )}
        {chainFilter !== 'collecting' && hiddenChainSections > 0 ? (
          <button
            type="button"
            onClick={() =>
              setVisibleSectionCount((current) =>
                Math.min(chainSections.length, current + CHAIN_SECTION_BATCH),
              )
            }
            className="min-h-[36px] w-full rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-600"
            data-testid="mother-chain-show-more"
          >
            显示更多蛋组（{hiddenChainSections}）
          </button>
        ) : null}
      </section>

      </div>

      <GapFillDialog
        target={gapDialog?.target ?? null}
        fill={gapDialog?.fill ?? null}
        eyebrow="母本缺口 · 怎么补"
        targetReady={gapTarget != null && gapTarget.label !== '目标未选'}
        onClose={() => setGapDialog(null)}
        onSeekHelp={() => {
          // 去求蛋 = 跳小组页，悬浮窗顺手关掉，回来不会挡着列表
          setGapDialog(null);
          onSeekHelp?.();
        }}
        onAddToPlan={() => {
          if (gapDialog) mergeMotherPlan([gapDialog.chainKey]);
          setGapDialog(null);
        }}
      />

      <RecommendedNatureEditor open={natureEditorOpen} onClose={() => setNatureEditorOpen(false)} />
    </div>
  );
}

/**
 * 母本清单卡片（四列）：已收集点「查看」跳精灵背包，未收集可加入计划。
 */
function MotherEggRow({
  eggName,
  eggGameId,
  number,
  recommendedNatures,
  mothers,
  eggGroupLabels,
  planned,
  onTogglePlan,
  jumpBase,
  onOpenInventory,
  onOpenGap,
}: {
  eggName: string;
  eggGameId: number;
  number: string;
  recommendedNatures: string[];
  mothers: OwnedPet[];
  eggGroupLabels: string[];
  planned: boolean;
  onTogglePlan: () => void;
  jumpBase: { tags: string[] };
  onOpenInventory?: (jump: MotherInventoryJump) => void;
  /** 未收集的卡点开「怎么补」悬浮窗 */
  onOpenGap?: () => void;
}) {
  const collected = mothers.length > 0;
  const collectedNatures = new Set(mothers.map((mother) => mother.nature));
  // 只带卡片上显示为绿色的推荐性格：点「查看」就是看这几只已经达标母本的性格
  const natureTags = recommendedNatures
    .filter((nature) => collectedNatures.has(nature))
    .map((nature) => `nature:${nature}`);

  return (
    <li data-testid="mother-chain-row" className="min-w-0">
      <PetCardLayout
        name={eggName}
        number={number}
        eggGroups={eggGroupLabels}
        natures={recommendedNatures}
        natureCollected={(nature) => collectedNatures.has(nature)}
        size="mother"
        fitName
        avatar={<PetAvatar gameId={eggGameId} name={eggName} size={62} />}
        eggGroupsTestId="mother-card-egg-groups"
        naturesTestId="mother-card-natures"
        title={collected || !onOpenGap ? eggName : `${eggName} · 点卡片看怎么补`}
        onClick={collected ? undefined : onOpenGap}
        footer={
          collected ? (
            <button
              type="button"
              onClick={() =>
                onOpenInventory?.({
                  name: eggName,
                  tags: [...jumpBase.tags, ...natureTags],
                })
              }
              data-testid="mother-chain-open"
              className="min-h-3 w-full truncate rounded-full bg-emerald-100 px-1 text-[8px] font-medium leading-3 text-emerald-700"
            >
              查看
            </button>
          ) : (
            <button
              type="button"
              onClick={(event) => {
                // 卡片本身是「怎么补」入口，点底部的计划按钮不要顺手把悬浮窗也打开
                event.stopPropagation();
                onTogglePlan();
              }}
              className={`min-h-3 w-full rounded-full border px-1 text-[8px] leading-3 ${
                planned
                  ? 'border-emerald-500 bg-emerald-100 text-emerald-700'
                  : 'border-emerald-200 bg-white text-slate-500'
              }`}
              data-testid="mother-plan-toggle"
              aria-pressed={planned}
            >
              {planned ? '已计划' : '计划'}
            </button>
          )
        }
      />
    </li>
  );
}
