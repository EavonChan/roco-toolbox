import { useState } from 'react';
import { ALL_EGG_GROUP_IDS, type CoverageFilter } from '../domain/coverageTargets';
import type { TargetMode } from '../domain/petFilters';
import { eggGroupNames } from '../data/catalog';
import { TargetGradeSelector } from './TargetGradeSelector';
import { SegmentedControl } from './primitives/SegmentedControl';
import { setTargetMode, useTargetMode } from './targetModeStore';
import { toggleFilterGrade } from './coverageFilterStore';

export interface CoverageFilterBarProps {
  filter: CoverageFilter;
  onToggleGroup: (groupId: number) => void;
}

const CHIP_ON = 'border-emerald-500 bg-emerald-50 font-medium text-emerald-700';
const CHIP_OFF = 'border-slate-200 bg-white text-slate-500';
const CHIP_BASE = 'min-h-[28px] rounded-md border px-2 text-xs';

const chipClass = (active: boolean): string => `${CHIP_BASE} ${active ? CHIP_ON : CHIP_OFF}`;

/**
 * 覆盖矩阵的筛选内容（2026-10-29 起收进「种公阵列」卡片的右上角，自己不再是一张卡）。
 *
 * **体型 × 声音目标 2026-10-06 起是全局口径**（用户拍板）：看板 / 覆盖度 / 母本 / 配窝共用一份，
 * 本处与母本使用相同的模式切换和奖牌组合选择控件。
 *
 * 性格不在这里——「每组推荐前 3」这个预设只在**组内**有意义（部分性格在部分组几乎没用），
 * 所以它下沉到蛋组展开区，由 CoverageMatrix 渲染，不再有「对所有组一起加减」的全局开关。
 */
export function CoverageFilterBar({ filter, onToggleGroup }: CoverageFilterBarProps) {
  const [groupsOpen, setGroupsOpen] = useState(false);
  const mode = useTargetMode();
  const groupCount = filter.groupIds.length;

  const emptyDimensions = [
    groupCount === 0 ? '蛋组' : null,
    filter.grades.length === 0 ? '奖牌目标' : null,
  ].filter((label): label is string => label !== null);

  return (
    <div data-testid="coverage-filter">
      <div className="space-y-2" data-testid="coverage-target-filter">
        <SegmentedControl
          label="种公目标模式"
          value={mode}
          options={[
            { value: 'perfect', label: '追满分' },
            { value: 'medal', label: '追双牌' },
          ]}
          onValueChange={(value) => setTargetMode(value as TargetMode)}
          optionTestId={(value) => `coverage-target-mode-${value}`}
        />
        <TargetGradeSelector
          mode={mode}
          selectedGrades={filter.grades}
          onSelect={toggleFilterGrade}
          label="种公目标奖牌组合"
          testIdPrefix="coverage-target"
        />
      </div>

      <div className="mt-1">
        <button
          type="button"
          aria-expanded={groupsOpen}
          onClick={() => setGroupsOpen((open) => !open)}
          className="flex min-h-[28px] w-full items-center justify-between text-xs text-slate-400"
          data-testid="coverage-groups-toggle"
        >
          <span>蛋组（{groupCount}/14）</span>
          <span aria-hidden>{groupsOpen ? '▲' : '▼'}</span>
        </button>
        {groupsOpen ? (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {ALL_EGG_GROUP_IDS.map((groupId) => (
              <button
                key={groupId}
                type="button"
                aria-pressed={filter.groupIds.includes(groupId)}
                onClick={() => onToggleGroup(groupId)}
                className={chipClass(filter.groupIds.includes(groupId))}
                data-testid={`coverage-group-${groupId}`}
              >
                {eggGroupNames[groupId] ?? `蛋组${groupId}`}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {emptyDimensions.length > 0 ? (
        <p className="mt-2 text-xs text-amber-600" data-testid="coverage-filter-empty">
          请至少勾选一个{emptyDimensions.join('、')}，否则没有目标槽位。
        </p>
      ) : null}
    </div>
  );
}
