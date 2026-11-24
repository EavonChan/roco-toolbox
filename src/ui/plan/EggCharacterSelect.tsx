import type { EggCharacter } from './eggCharacter';

/**
 * 蛋仓的游戏角色下拉（2026-11-23 首版，2026-11-24 用户口径改为「一次只显示一个角色」）。
 *
 * 不再有「全部角色」：打开就落在账号角色列表的第一个（一般是主号），
 * 每个选项后面带这个角色的蛋数。竖屏挂在「我的蛋仓」标题后面（Home 的标题行插槽），
 * 横屏挂在右侧筛选栏里；两个位置共用同一个受控组件，样式只差紧凑度。
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
      {characters.map((character) => (
        <option key={character.key} value={character.key}>{character.name}（{character.count}）</option>
      ))}
    </select>
  );
}
