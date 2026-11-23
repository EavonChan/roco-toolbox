import { useMemo, useState } from 'react';
import { TARGET_MODE_LABELS, type TargetMode } from '../domain/petFilters';
import {
  effectiveMotherVoices,
  isChainCollected,
  type MotherCriteria,
} from '../domain/motherCriteria';
import { isStudCoverageComplete } from '../domain/studCoverage';
import {
  computeStudRecommendations,
  findUncataloguedCount,
} from '../domain/suggestions';
import { rankSwapWishes } from '../domain/swapPlan';
import { eggGroupNames, maleCapableGameIds, species } from '../data/catalog';
import { ImportAdditionCard } from './ImportAdditionCard';
import { ProgressCard } from './ProgressCard';
import { NestPlanCard, type StudRecommendationGroup } from './NestPlanCard';
import { GapFillDialog, type GapTargetView } from './GapFillDialog';
import { findStudGapFill, type GapFill } from '../domain/gapFill';
import { mergeMotherPlan } from './motherPlanStore';
import { useMotherSuggestions } from './useMotherSuggestions';
import { useLandscape, useWideLandscape } from './useWideLandscape';
import { SegmentedControl } from './primitives/SegmentedControl';
import { useOwnedPets } from './useOwnedPets';
import { sortAccountNames } from './accountOrder';
import { useCollectionSummary } from './useCollectionSummary';
import { setTargetGrade, useCoverageFilter } from './coverageFilterStore';
import { useMotherCriteria } from './motherCriteriaStore';
import { setTargetMode } from './targetModeStore';
import { toggleAccount, toggleAllAccounts, useAccountFilter } from './accountFilterStore';
import { removeStudTransferTask, useStudTransferTasks } from './studTransferTaskStore';
import { TargetGradeSelector } from './TargetGradeSelector';
import type { NavigationIntent } from './navigation';

export interface DashboardProps {
  /** 统一导航入口（2026-10-24）：看板只发意图，不直接改别页状态 */
  onNavigate: (intent: NavigationIntent) => void;
}

/**
 * 看板（2026-10-24 重构任务 8）：回答「我收集到哪了，接下来做什么」。
 *
 * 顺序：账号范围 → 目标与进度 → 近期新增 → 推荐与缺口清单。
 * 奖牌目标直接在看板调整；蛋组 / 性格设置保留在目标弹层。
 */
const LEFT_COLLAPSED_KEY = 'roco.dashboardLeftCollapsed';

function readLeftCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(LEFT_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function saveLeftCollapsed(collapsed: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LEFT_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    // 隐私模式 / 配额满：本次照样生效，只是下次打开不记住
  }
}

export function Dashboard({ onNavigate }: DashboardProps) {
  /** 横屏才允许折叠右侧信息栏；竖屏保持原来的上下堆叠（2026-11-21 用户口径） */
  const landscape = useLandscape();
  const wideLandscape = useWideLandscape();
  const [leftCollapsedState, setLeftCollapsedState] = useState(readLeftCollapsed);
  const leftCollapsed = landscape && leftCollapsedState;
  const setLeftCollapsed = (collapsed: boolean) => {
    saveLeftCollapsed(collapsed);
    setLeftCollapsedState(collapsed);
  };
  const [actionPanel, setActionPanel] = useState<'mothers' | 'studs'>('studs');
  const [accountSelectorOpen, setAccountSelectorOpen] = useState(false);
  /** 奖牌口径说明默认收起：点「追双牌」右边的问号再展开（2026-11-20 用户口径） */
  const [targetHelpOpen, setTargetHelpOpen] = useState(false);
  /**
   * 「母本缺口怎么补」悬浮窗（2026-11-19 用户口径）：点缺口卡打开，
   * 内容是目标卡 + 小组求助卡 + 本号直配 / 跨号传蛋两段。
   */
  const [gapDialog, setGapDialog] = useState<{
    chainKey: string;
    eyebrow: string;
    target: GapTargetView;
    fill: GapFill;
    /** 只有母本缺口能把这条链加入「计划收集」；种公推荐没有对应的落库动作 */
    canAddToPlan: boolean;
  } | null>(null);

  const { owned, allOwned, motherGroups, mode, stud, coverageByAccount, plans } =
    useCollectionSummary();
  const { accounts: rawAccounts } = useOwnedPets();
  /** 看板账号选择器按数字排序（2026-11-20 用户口径）。 */
  const accounts = useMemo(() => sortAccountNames(rawAccounts), [rawAccounts]);
  const { excluded } = useAccountFilter();
  const selectedAccountNames = accounts.filter((name) => !excluded.has(name));
  const selectedAccountCount = selectedAccountNames.length;
  const noSelectedAccounts = accounts.length > 0 && selectedAccountCount === 0;
  const coverageFilter = useCoverageFilter();
  /**
   * 目标条件、母本建议与目标卡文案都和收集页共用一份（2026-11-19）：
   * 同一个缺口在看板与收集页给的概率必须一致。
   */
  const {
    selectedGrade,
    naturesOf,
    suggestions: motherSuggestions,
    targetLabel: gapTargetLabel,
    bodyMedal: gapTargetBody,
    voiceTarget: gapTargetVoiceTarget,
    voiceDb: gapTargetVoiceDb,
    weightPercent: gapTargetWeight,
  } = useMotherSuggestions(
    { owned, allOwned, mode, coverageByAccount, plans },
    selectedAccountNames,
  );
  const motherCriteria = useMotherCriteria();
  /**
   * 母本进度只认母本页自己的奖牌口径（上游 R7b-H01）：看板的目标档位是种公 / 覆盖度的，
   * 拿它算母本会把「看板改档位 → 母本已收集数字跟着变」这种跨页联动带回来。
   */
  const motherEffectiveCriteria: MotherCriteria = useMemo(
    () => ({
      bodies: motherCriteria.bodies,
      voices: effectiveMotherVoices(motherCriteria.voices, mode),
      grades: motherCriteria.grades,
      targetMode: mode,
      recommendedNatures: motherCriteria.recommendedNatures === true,
    }),
    [motherCriteria, mode],
  );
  /** 种公阵列里手动加入的跨号补种公任务（2026-11-03） */
  const transferTasks = useStudTransferTasks();
  /** 母本缺口只报**个人事实**；小组未加载时不在看板声称某成员拥有 */
  const missingMothers = useMemo(
    () =>
      motherGroups.filter((group) =>
        !isChainCollected(group, owned, motherEffectiveCriteria, naturesOf),
      ),
    [motherGroups, owned, motherEffectiveCriteria, naturesOf],
  );
  const collectedMothers = motherGroups.length - missingMothers.length;
  /** 母本缺口卡（移进配窝卡的「缺口」横条，2026-11-20 用户口径） */
  /**
   * 缺口按号各算（2026-11-18 修正）：种公是成体、不能传，合并所有号算出来的「还差几个」
   * 会把别的号的种公误算成本号的进度，数字偏小。看板按每个号自己的覆盖度报缺口。
   */
  const gapsByAccount = useMemo(
    () =>
      selectedAccountNames.map((name) => {
        const coverage = coverageByAccount.get(name);
        const remaining = (coverage?.cells ?? []).filter((cell) => cell.state !== 'covered');
        return {
          account: name,
          gap: remaining.length,
          iterable: remaining.filter((cell) => cell.state === 'breedable').length,
          known: coverage != null,
        };
      }),
    [selectedAccountNames, coverageByAccount],
  );
  const gapTotal = gapsByAccount.reduce((sum, item) => sum + item.gap, 0);
  const allGapsKnown = gapsByAccount.every((item) => item.known);
  /**
   * 种公已经全齐的号（2026-11-20 用户口径）：配窝建议里不能把这种号藏掉，
   * 它们还能替别的号出蛋补种公。只认当前选中、且有目标槽位的号。
   */
  const studCompleteAccounts = useMemo(() => {
    const set = new Set<string>();
    for (const name of selectedAccountNames) {
      if (isStudCoverageComplete(coverageByAccount.get(name))) set.add(name);
    }
    return set;
  }, [selectedAccountNames, coverageByAccount]);
  const gapsByAccountMap = useMemo(
    () => new Map(gapsByAccount.map((item) => [item.account, item.gap])),
    [gapsByAccount],
  );
  /**
   * 每个号的种公推荐（2026-11-20 用户口径）：按**这个号自己的覆盖度 + 自己的精灵**算，
   * 不能拿全设备合并的推荐顶替——那个口径下别的号有就算通，本号的缺口会看不到。
   */
  const studRecommendationsByAccount = useMemo(() => {
    const byGameId = new Map(species.map((entry) => [entry.gameId, entry]));
    const map = new Map<string, ReturnType<typeof computeStudRecommendations>>();
    for (const [account, coverage] of coverageByAccount) {
      const accountOwned = owned.filter((pet) => pet.account === account);
      const ownedEggGameIds = new Set<number>();
      for (const pet of accountOwned) {
        const eggGameId = byGameId.get(pet.gameId)?.eggGameId;
        if (eggGameId != null) ownedEggGameIds.add(eggGameId);
      }
      const wishes = rankSwapWishes({
        species,
        coverage,
        owned: accountOwned,
        mode,
        ownedEggGameIds,
        maleCapableGameIds,
        eggGroupNames,
      });
      map.set(account, computeStudRecommendations(wishes));
    }
    return map;
  }, [coverageByAccount, owned, mode]);
  /** 每个号已经收齐的蛋组：配窝卡里的蛋组标签标绿（2026-11-18 用户口径） */
  const collectedGroupsByAccount = useMemo(() => {
    const map = new Map<string, Set<number>>();
    for (const [account, coverage] of coverageByAccount) {
      const collected = new Set<number>();
      for (const row of coverage.groupSummary) {
        if (row.total > 0 && row.covered === row.total) collected.add(row.groupId);
      }
      map.set(account, collected);
    }
    return map;
  }, [coverageByAccount]);
  const nestEmptyNote =
    actionPanel === 'mothers'
      ? missingMothers.length === 0
        ? '母本已全部收集，没有要补的缺口。'
        : '当前没有能排的母本配窝建议。'
      : stud.groupCount === 0
        ? '未设置种公目标，请先调整体型、声音目标、蛋组和性格。'
        : gapTotal === 0 && allGapsKnown
          ? '种公目标已全部收集，没有要补的缺口。'
          : '没有能自己孵的方案：缺可配对的母本 / 公本，先去覆盖度看每个缺口的判定。';
  /**
   * 2026-11-22 用户口径：看板不再放「种公推荐」网格，种公推荐去「收集 → 种公」的矩阵和分类看；
   * 这里只保留配窝建议。原 showStudRecommendationCard / suggestionEmptyNote 随之删除。
   */

  const speciesGameIds = useMemo(() => new Set(species.map((entry) => entry.gameId)), []);
  const speciesByGameId = useMemo(() => new Map(species.map((entry) => [entry.gameId, entry])), []);
  const uncataloguedCount = useMemo(
    () => findUncataloguedCount(owned.map((pet) => pet.gameId), speciesGameIds),
    [owned, speciesGameIds],
  );

  /**
   * 种公推荐卡 → 「怎么补」悬浮窗。accountNames 决定本号直配 / 跨号传蛋的范围：
   * 上方推荐卡用当前选中账号，配窝建议「缺口」页签只传当前这个号。
   */
  const openStudGap = (group: StudRecommendationGroup, accountNames: string[]): void => {
    const first = group.records[0];
    if (!first) return;
    const groupId = first.groupIds[0];
    setGapDialog({
      chainKey: `stud:${group.gameId}`,
      eyebrow: '种公推荐 · 怎么补',
      canAddToPlan: false,
      target: {
        kind: 'stud',
        name: group.displayName,
        number: speciesByGameId.get(group.gameId)?.number,
        gameId: group.gameId,
        natures: group.natureNames,
        eggGroupLabels: group.groupLabels,
        tag: '推荐',
        targetLabel: gapTargetLabel,
        bodyMedal: gapTargetBody,
        voiceTarget: gapTargetVoiceTarget,
        voiceDb: gapTargetVoiceDb,
        weightPercent: gapTargetWeight,
      },
      fill:
        groupId == null
          ? { self: null, transfer: null, helpChance: null }
          : findStudGapFill(
              { groupId, natureName: first.natureName, grade: first.grade },
              plans,
              accountNames,
            ),
    });
  };

  /** 配窝卡区块：宽屏双面板与窄屏共用，section 决定种公 / 母本口径。 */
  const nestCard = (section: 'studs' | 'mothers') => (
            <section
              className="rounded-2xl bg-white p-4 shadow-sm"
              data-testid="nest-summary"
              data-tour="dashboard-nest"
            >
              <NestPlanCard
                plans={plans}
                emptyNote={nestEmptyNote}
                gapsByAccount={gapsByAccountMap}
                studCompleteAccounts={studCompleteAccounts}
                studRecommendationsByAccount={studRecommendationsByAccount}
                onOpenStudRecommendation={(account, group) => openStudGap(group, [account])}
                collectedGroupIdsByAccount={collectedGroupsByAccount}
                motherSuggestions={motherSuggestions}
                selectedAccounts={selectedAccountNames}
                accountFilterActive={selectedAccountCount < accounts.length}
                section={section}
                targetBodyMedal={gapTargetBody}
                targetVoiceDb={gapTargetVoiceDb}
                onSeekHelp={() => onNavigate({ type: 'open-groups', groupType: 'mother' })}
              />
              {transferTasks.length > 0 ? (
                <div
                  className="mt-2 border-t border-dashed border-slate-200 pt-2"
                  data-testid="transfer-task-list"
                >
                  <h3 className="text-xs font-semibold text-slate-600">跨号传蛋</h3>
                  <ul className="mt-1 space-y-1">
                    {transferTasks.map((task) => (
                      <li
                        key={task.id}
                        className="flex items-center gap-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800"
                        data-testid="transfer-task-item"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">
                            {task.sourceAccount} → {task.targetAccount}
                          </p>
                          <p className="truncate text-amber-700">
                            {task.motherName} × {task.fatherName} · {task.natureName}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeStudTransferTask(task.id)}
                          data-testid="transfer-task-remove"
                          className="shrink-0 rounded border border-amber-300 bg-white px-1.5 py-0.5 text-[10px]"
                        >
                          移除
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
  );

  return (
    <main
      className="mx-auto max-w-md space-y-2 p-3"
      data-testid="dashboard-page"
      data-left-collapsed={leftCollapsed ? 'true' : 'false'}
    >
      {/* 右侧信息栏：账号 / 目标奖牌 / 进度 / 本次新增。横屏时这一栏自己滚（2026-11-21 用户口径） */}
      <div className="dashboard-left space-y-2">
        {landscape ? (
          <div className="dashboard-left-tools">
            <button
              type="button"
              onClick={() => setLeftCollapsed(true)}
              data-testid="dashboard-left-collapse"
              aria-label="收起右栏"
              className="min-h-[28px] rounded-lg border border-slate-200 bg-white px-2 text-[11px] text-slate-500 shadow-sm"
            >
              收起右栏 ›
            </button>
          </div>
        ) : null}
      {noSelectedAccounts ? (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800" data-testid="dashboard-empty-accounts">
          当前未选中任何账号，请在下方「账号」里选择。
        </p>
      ) : null}

      <section
        className="rounded-2xl bg-white p-3 shadow-sm"
        data-testid="target-mode"
        data-tour="dashboard-target"
      >
        <div
          className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2"
          data-testid="dashboard-target-header"
        >
          {accounts.length > 0 ? (
            <button
              type="button"
              onClick={() => setAccountSelectorOpen((open) => !open)}
              aria-expanded={accountSelectorOpen}
              aria-controls={accountSelectorOpen ? 'dashboard-account-options' : undefined}
              className={`flex min-h-[32px] min-w-0 w-full items-center gap-1 rounded-lg border px-2 text-xs text-slate-700 shadow-sm hover:border-emerald-300 ${
                accountSelectorOpen ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-white'
              }`}
              data-testid="dashboard-account-summary"
              title={`${selectedAccountNames.join('、')} (${selectedAccountCount}/${accounts.length})`}
            >
              <span className="flex min-w-0 flex-1 items-center">
                <span
                  className={`truncate ${
                    selectedAccountNames.length > 1 ? 'max-w-[45%] shrink-0' : 'min-w-0 flex-1'
                  }`}
                >
                  {selectedAccountNames[0] ?? '选择账号'}
                </span>
                {selectedAccountNames.length > 1 ? (
                  <span className="min-w-0 flex-1 truncate" title={selectedAccountNames.slice(1).join('、')}>
                    、{selectedAccountNames.slice(1).join('、')}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0">({selectedAccountCount}/{accounts.length})</span>
              <span aria-hidden className="shrink-0 text-[10px] text-slate-400">
                {accountSelectorOpen ? '⌃' : '⌄'}
              </span>
            </button>
          ) : null}
          <SegmentedControl
            label="目标模式"
            value={mode}
            options={(['perfect', 'medal'] as TargetMode[]).map((value) => ({
              value,
              label: TARGET_MODE_LABELS[value],
            }))}
            onValueChange={(next) => setTargetMode(next as TargetMode)}
            optionTestId={(value) => `target-mode-${value}`}
            className="w-[120px] shrink-0"
          />
          <button
            type="button"
            onClick={() => setTargetHelpOpen((open) => !open)}
            aria-expanded={targetHelpOpen}
            aria-label="目标说明"
            title="目标说明"
            data-testid="dashboard-target-help"
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-semibold ${
              targetHelpOpen
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                : 'border-slate-200 bg-white text-slate-500'
            }`}
          >
            ?
          </button>
        </div>
        {targetHelpOpen ? (
          <div
            className="mt-2 space-y-1 rounded-xl border border-slate-100 bg-slate-50/70 p-2 text-[11px] leading-4 text-slate-500"
            data-testid="dashboard-target-help-panel"
          >
            <p data-testid="dashboard-target-voice-note">
              {mode === 'perfect'
                ? '追满分即满声：婉转声 +100、粗嗓门 -100。'
                : '追双牌按声音奖牌判定：婉转声 ≥96、粗嗓门 ≤-96。'}
            </p>
            <p data-testid="dashboard-target-body-note">
              大块头对应身高 100%，小不点对应身高 0%。
            </p>
          </div>
        ) : null}
        {accountSelectorOpen && accounts.length > 0 ? (
          <div
            className="mt-2 rounded-xl border border-slate-100 bg-slate-50/70 p-2"
            data-testid="dashboard-account-selector"
            id="dashboard-account-options"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500">至少选择一个账号</span>
              {selectedAccountCount < accounts.length ? (
                <button
                  type="button"
                  onClick={() => toggleAllAccounts(accounts)}
                  className="text-[11px] font-medium text-emerald-700"
                  data-testid="dashboard-account-select-all"
                >
                  全选
                </button>
              ) : null}
            </div>
            <div className="mt-1 grid grid-cols-2 gap-1" role="group" aria-label="看板账号选择">
              {accounts.map((account) => {
                const selected = !excluded.has(account);
                const isLastSelected = selected && selectedAccountCount === 1;
                return (
                  <button
                    key={account}
                    type="button"
                    aria-pressed={selected}
                    disabled={isLastSelected}
                    title={isLastSelected ? '至少保留一个已选账号' : account}
                    onClick={() => toggleAccount(account)}
                    className={`min-h-[32px] min-w-0 truncate rounded-lg border px-2 text-left text-xs ${
                      selected
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                        : 'border-slate-200 bg-white text-slate-500'
                    } disabled:cursor-not-allowed`}
                    data-testid={`dashboard-account-${account}`}
                  >
                    {account}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
        <div className="mt-3 space-y-2" data-testid="dashboard-target-combinations">
          <TargetGradeSelector
            mode={mode}
            selectedGrades={selectedGrade ? [selectedGrade] : []}
            onSelect={(grade) => setTargetGrade(selectedGrade === grade ? null : grade)}
            label="目标奖牌组合（公母共用）"
            testIdPrefix="dashboard-target"
          />
        </div>
        {coverageFilter.grades.length === 0 ? (
          <p className="mt-1 text-[11px] text-amber-600" data-testid="target-grade-empty">
            未选体型或声音目标：种公覆盖度与配窝没有槽位；母本按自己的达标条件单独计算，不受影响。
          </p>
        ) : null}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <ProgressCard
          title="种公全收集"
          numerator={stud.passedGroups}
          denominator={stud.groupCount}
          hint={`${coverageFilter.groupIds.length} 个蛋组 · 组内目标全达标才算通`}
          onClick={() =>
            onNavigate({ type: 'open-collection', location: { kind: 'studs', view: 'coverage' } })
          }
          actionTestId="progress-card-action-stud"
        />
        <ProgressCard
          title="母本全收集"
          numerator={collectedMothers}
          denominator={motherGroups.length}
          hint="已收集 = 有达标母本的蛋；达标条件可自定义"
          onClick={() =>
            onNavigate({ type: 'open-collection', location: { kind: 'mothers', status: 'missing' } })
          }
          actionTestId="progress-card-action-mother"
        />
      </div>

      {/* 本次新增：最新一次导入的明细，可收起；历史在「我的 · 游戏数据」 */}
      <ImportAdditionCard />

      {uncataloguedCount > 0 ? (
        <section className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
          <h2 className="font-medium text-slate-500">图鉴未收录</h2>
          <p className="mt-1">
            {uncataloguedCount} 只精灵的 game_id 暂不在图鉴中，已单独列出、不计入进度分母。
          </p>
        </section>
      ) : null}

      </div>

      {wideLandscape && landscape && !leftCollapsed ? (
        <div className="dashboard-panels" data-testid="dashboard-main-column">
          <div className="dashboard-panel">
            <h2 className="dashboard-panel-title mx-auto py-1 text-center text-sm font-medium text-slate-700">
              种公推荐
            </h2>
            <div className="dashboard-panel-scroll space-y-2">
              {/* 2026-11-22：种公推荐网格已从看板撤掉，这一栏只放配窝建议 */}
              {owned.length > 0 ? nestCard('studs') : null}
            </div>
          </div>
          <div className="dashboard-panel">
            <h2 className="dashboard-panel-title mx-auto py-1 text-center text-sm font-medium text-slate-700">
              母本缺口
            </h2>
            <div className="dashboard-panel-scroll space-y-2">
              {owned.length > 0 ? nestCard('mothers') : null}
            </div>
          </div>
        </div>
      ) : (
      <div
        className={landscape ? 'dashboard-narrow-body' : 'dashboard-body'}
        data-testid="dashboard-main-column"
      >
        <div className="dashboard-narrow-switch" data-testid="dashboard-action-switch" data-tour="dashboard-actions">
          <SegmentedControl
            label="看板行动"
            value={actionPanel}
            options={[
              { value: 'studs', label: '种公推荐' },
              { value: 'mothers', label: '母本缺口' },
            ]}
            onValueChange={(value) => setActionPanel(value as 'mothers' | 'studs')}
            optionTestId={(value) => `dashboard-action-${value}`}
            className="w-full"
          />
          {/* 「显示右栏」贴切换条右侧（2026-11-21 用户口径），不再占最左边 */}
          {landscape && leftCollapsed ? (
            <button
              type="button"
              onClick={() => setLeftCollapsed(false)}
              data-testid="dashboard-left-expand"
              aria-label="显示右栏"
              className="min-h-[28px] shrink-0 rounded-lg border border-slate-200 bg-white px-2 text-[11px] text-slate-500 shadow-sm"
            >
              ‹ 显示右栏
            </button>
          ) : null}
        </div>

        <div className="dashboard-narrow-scroll space-y-2">
      {/* 配窝建议是产品亮点（2026-10-25 用户要求放回看板）：直接展示完整摆位与配对，
          不再只给一个「去配窝」入口；收集页的完整视图仍然保留。
          2026-11-22：种公推荐网格已从这里撤掉（去「收集 → 种公」看）。 */}
          <div className="dashboard-panel">
      {owned.length > 0 ? nestCard(actionPanel) : null}
          </div>
        </div>
      </div>
      )}

      <GapFillDialog
        target={gapDialog?.target ?? null}
        fill={gapDialog?.fill ?? null}
        onClose={() => setGapDialog(null)}
        eyebrow={gapDialog?.eyebrow}
        targetReady={selectedGrade != null}
        onSeekHelp={() => {
          const nextGroupType = gapDialog?.target.kind === 'stud' ? 'stud' : 'mother';
          setGapDialog(null);
          onNavigate({ type: 'open-groups', groupType: nextGroupType });
        }}
        onAddToPlan={
          gapDialog?.canAddToPlan
            ? () => {
                mergeMotherPlan([gapDialog.chainKey]);
                setGapDialog(null);
              }
            : undefined
        }
      />
    </main>
  );
}


