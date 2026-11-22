import type { EggCharacter } from './eggCharacter';

/**
 * 蛋仓的游戏角色下拉（2026-11-23 用户口径）。
 *
 * 竖屏挂在「我的蛋仓」标题后面（Home 的标题行插槽），横屏挂在右侧筛选栏里；
 * 两个位置共用同一个受控组件，样式只差紧凑度。
 */
export function EggCharacterSelect({ value, characters, onChange, testId = 'egg-stock-character', compact = false }: {
  value: string;
  characters: readonly EggCharacter[];
  onChange: (key: string) => void;
  testId?: string;
  compact?: boolean;
}) {
  return (
    <select
      aria-label="按游戏角色筛选"
      data-testid={testId}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`min-w-0 max-w-[9rem] truncate rounded-lg border border-slate-200 bg-white text-xs text-slate-600 ${
        compact ? 'min-h-[30px] w-full px-1' : 'min-h-[28px] px-1.5'
      }`}
    >
      <option value="">全部角色</option>
      {characters.map((character) => (
        <option key={character.key} value={character.key}>{character.name}</option>
      ))}
    </select>
  );
}
