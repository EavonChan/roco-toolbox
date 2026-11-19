import {
  GRADE_BODY,
  GRADE_VOICE,
  type PetGrade,
  type TargetMode,
} from '../domain/petFilters';
import {
  type MotherCriteria,
  type MotherVoice,
} from '../domain/motherCriteria';
import { getMotherCriteria, setMotherCriteria, useMotherCriteria } from './motherCriteriaStore';
import { SegmentedControl } from './primitives/SegmentedControl';
import { setTargetMode, useTargetMode } from './targetModeStore';
import { TargetGradeSelector } from './TargetGradeSelector';

export interface MotherCriteriaMedalsProps {
  testIdPrefix: string;
}

/** 母本按体型 + 声音组合选择达标奖牌，**强制单选**：点一个换一个，再点已选中的 = 取消选择。 */
export function MotherCriteriaMedals({ testIdPrefix }: MotherCriteriaMedalsProps) {
  const mode = useTargetMode();
  const criteria = useMotherCriteria();
  const selectedGrades = selectedGradesFor(criteria);

  const saveGrades = (current: MotherCriteria, grades: PetGrade[], targetMode: TargetMode) => {
    const bodies = [...new Set(grades.map((grade) => GRADE_BODY[grade]))];
    const voices = [
      ...new Set(
        grades.map((grade) => voiceOptionFor(GRADE_VOICE[grade], targetMode)),
      ),
    ];
    setMotherCriteria({ ...current, bodies, voices, grades });
  };

  const changeMode = (value: string) => {
    const nextMode = value as TargetMode;
    if (nextMode === mode) return;
    const current = getMotherCriteria();
    // 旧数据没有组合字段时保持「按体型 / 声音判定」，切模式不能顺手把它变成空选择。
    if (current.grades !== undefined) saveGrades(current, current.grades, nextMode);
    setTargetMode(nextMode);
  };

  const selectGrade = (grade: PetGrade) => {
    const current = getMotherCriteria();
    const selected = selectedGradesFor(current);
    // 再点已选的组合 = 取消选择（与看板目标卡一致）
    if (selected.length === 1 && selected[0] === grade) {
      saveGrades(current, [], mode);
      return;
    }
    saveGrades(current, [grade], mode);
  };

  return (
    <div className="space-y-2" data-testid={`${testIdPrefix}-medals`}>
      <SegmentedControl
        label="母本达标模式"
        value={mode}
        options={[
          { value: 'perfect', label: '追满分' },
          { value: 'medal', label: '追双牌' },
        ]}
        onValueChange={changeMode}
        optionTestId={(value) => `${testIdPrefix}-mode-${value}`}
      />
      <TargetGradeSelector
        mode={mode}
        selectedGrades={selectedGrades}
        onSelect={selectGrade}
        label="母本达标奖牌组合"
        testIdPrefix={testIdPrefix}
      />
      {selectedGrades.length === 0 ? (
        <p className="text-[11px] text-slate-400" data-testid={`${testIdPrefix}-grade-unset`}>
          未设置组合：当前按体型 / 声音条件判定。
        </p>
      ) : null}
    </div>
  );
}

/**
 * 当前选中的档位：永远最多一个（强制单选）。
 *
 * - 有 `grades`：取第一个（旧数据的多选值也只取第一个）；
 * - `grades` 缺失（从没点过奖牌的旧数据）：不假装选中任何档位，
 *   判定仍按体型 / 声音条件走，界面上用一行说明讲清。
 */
function selectedGradesFor(criteria: MotherCriteria): PetGrade[] {
  if (criteria.grades !== undefined) return criteria.grades.slice(0, 1);
  return [];
}

function voiceOptionFor(
  voice: (typeof GRADE_VOICE)[PetGrade],
  mode: TargetMode,
): MotherVoice {
  if (mode === 'medal') return voice;
  return voice === '婉转声' ? '+100' : '-100';
}
