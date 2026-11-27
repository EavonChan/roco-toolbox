import { useMemo, useState } from 'react';
import { allNatureNames, species } from '../data/catalog';
import type { SpeciesEntry } from '../domain/types';
import { defaultEggNatures, eggNatures, type NatureOverrides } from '../domain/recommendedNatures';
import { speciesDisplayName } from '../domain/speciesName';
import { NATURE_OVERRIDE_MAX_NATURES } from '../shared/collectionGroups';
import { setEggNatures, useNatureOverrides } from './natureOverrideStore';
import { ModalSurface } from './primitives/ModalSurface';
import { SearchField } from './primitives/SearchField';

export interface RecommendedNatureEditorProps {
  open: boolean;
  onClose: () => void;
}

/**
 * 推荐性格（按蛋编辑，2026-10-25 用户拍板）。
 *
 * - 列表只有可孵蛋的「基础形态」：一颗蛋一行，改性格在蛋粒度；
 * - 没改过的蛋用图鉴的 PVP 推荐，图鉴没收录的按种族值兜底；
 * - 改完立即存本机、随云同步到自己的账号；
 * - 这是**看的人自己的口径**（2026-10-31 用户澄清）：小组「我缺的」按它算组内谁能补我，
 *   不下发、不影响别人看到的判定。组目标里的 `natureOverrides` 只留作历史展示。
 */
export function RecommendedNatureEditor({ open, onClose }: RecommendedNatureEditorProps) {
  const overrides = useNatureOverrides();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<number | null>(null);

  const eggs = useMemo(
    () =>
      species
        .filter(
          (entry) =>
            entry.eggGameId === entry.gameId &&
            (entry.eggGroups ?? []).some((groupId) => groupId >= 2 && groupId <= 15),
        )
        .sort(
          (a, b) =>
            a.number.localeCompare(b.number) || a.name.localeCompare(b.name, 'zh-Hans-CN'),
        ),
    [],
  );

  /** 显示名带形态（如「雪绒鸟_春天的样子」），搜索也按它匹配 */
  const labelOf = (egg: (typeof eggs)[number]): string => speciesDisplayName(egg, egg.name);
  const keyword = query.trim().toLowerCase();
  const filtered = keyword
    ? eggs.filter(
        (egg) => labelOf(egg).toLowerCase().includes(keyword) || egg.number.includes(keyword),
      )
    : eggs;

  const change = (eggGameId: number, natures: string[]) => {
    setEggNatures(eggGameId, natures);
  };

  const toggle = (eggGameId: number, current: readonly string[], nature: string) => {
    if (current.includes(nature)) {
      change(eggGameId, current.filter((item) => item !== nature));
      return;
    }
    if (current.length >= NATURE_OVERRIDE_MAX_NATURES) return;
    change(eggGameId, [...current, nature]);
  };

  return (
    <ModalSurface
      open={open}
      title="推荐性格"
      onClose={onClose}
      size="lg"
      testId="nature-editor"
      closeTestId="nature-editor-close"
      backdropTestId="nature-editor-backdrop"
    >
      <div className="space-y-1.5 p-2">
        <p className="text-[11px] leading-snug text-slate-400">
          按蛋设置，最多 {NATURE_OVERRIDE_MAX_NATURES} 个。没改过的蛋用图鉴推荐；图鉴没收录的按种族值兜底。
          这是<span className="font-medium text-slate-500">你自己的口径</span>：小组里「我缺的」按它算
          组内谁能补我，不影响其他成员看到的判定。
        </p>
        <SearchField
          label="搜索蛋"
          value={query}
          onValueChange={setQuery}
          placeholder="搜蛋名 / 图鉴号"
          testId="nature-editor-search"
        />

        {/*
          蛋列表抽成子组件（2026-11-25 P3b）：`ModalSurface` 虽然 `open=false` 时返回 null，
          但传进去的 children 在父组件渲染时就已经求值完了 —— 列表直接写在这里，
          等于「弹层关着也把全图鉴 209 颗蛋算一遍」。抽成组件后，React 不渲染它就不执行。
        */}
        <NatureEditorRows
          rows={filtered}
          overrides={overrides}
          labelOf={labelOf}
          editing={editing}
          onToggle={setEditing}
          change={change}
          toggle={toggle}
        />
      </div>
    </ModalSurface>
  );
}

/**
 * 蛋列表本体（只在弹层打开时才会被 React 渲染）。
 *
 * 这里才是「按蛋算推荐性格」的地方：每行一次 `eggNatures` + `defaultEggNatures`。
 * 全图鉴 200+ 颗蛋，所以它必须跟着弹层的开关走，不能跟着外层组件的渲染走。
 */
function NatureEditorRows({
  rows,
  overrides,
  labelOf,
  editing,
  onToggle,
  change,
  toggle,
}: {
  rows: SpeciesEntry[];
  overrides: NatureOverrides;
  labelOf: (egg: SpeciesEntry) => string;
  editing: number | null;
  onToggle: (eggGameId: number | null) => void;
  change: (eggGameId: number, natures: string[]) => void;
  toggle: (eggGameId: number, current: readonly string[], nature: string) => void;
}) {
  if (rows.length === 0) {
    return <p className="py-4 text-center text-xs text-slate-400">没有匹配的蛋。</p>;
  }
  return (
    <ul className="grid grid-cols-3 gap-1 sm:grid-cols-4" data-testid="nature-editor-grid">
      {rows.map((egg) => {
        const current = eggNatures(species, egg.gameId, overrides);
        const defaults = defaultEggNatures(species, egg.gameId);
        const customized = (overrides[String(egg.gameId)]?.length ?? 0) > 0;
        const expanded = editing === egg.gameId;
        return (
          <li
            key={egg.gameId}
            className={`min-w-0 rounded-md bg-slate-50 px-1 py-1 ${expanded ? 'col-span-full' : ''}`}
            data-testid="nature-editor-row"
          >
            <button
              type="button"
              onClick={() => onToggle(expanded ? null : egg.gameId)}
              data-testid={`nature-editor-toggle-${egg.gameId}`}
              className="w-full break-words text-left"
            >
              <span className="block text-[10px] leading-[1.2] text-slate-700">
                {labelOf(egg)}
              </span>
              <span className="mt-0.5 block text-[9.5px] leading-[1.2] text-slate-500">
                {current.join('/') || '无推荐'}
                {customized ? ' · 已改' : ''}
              </span>
            </button>
            {expanded ? (
              <div className="mt-1.5 space-y-1.5 border-t border-slate-200 pt-1.5">
                <div className="flex flex-wrap gap-1">
                  {allNatureNames.map((nature) => {
                    const on = current.includes(nature);
                    return (
                      <button
                        key={nature}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggle(egg.gameId, current, nature)}
                        data-testid={`nature-option-${egg.gameId}-${nature}`}
                        className={`min-h-[28px] rounded-md border px-2 text-xs ${
                          on
                            ? 'border-emerald-500 bg-emerald-50 font-medium text-emerald-700'
                            : 'border-slate-200 bg-white text-slate-500'
                        }`}
                      >
                        {nature}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-slate-400">
                    默认：{defaults.join(' / ') || '无'}
                  </p>
                  <button
                    type="button"
                    disabled={!customized}
                    onClick={() => change(egg.gameId, [])}
                    data-testid={`nature-editor-reset-${egg.gameId}`}
                    className="min-h-[28px] rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-500 disabled:opacity-40"
                  >
                    恢复默认
                  </button>
                </div>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
