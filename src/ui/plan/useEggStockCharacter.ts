import { useEffect, useMemo, useState } from 'react';
import type { AccountSnapshot } from '../../domain/parseBackup';
import { eggCharactersOf, type EggCharacter } from './eggCharacter';

export interface EggStockCharacterState {
  /** 本机账号列表（第一个是主号）+ 蛋上出现过但快照里没有的角色，各带蛋数 */
  characters: EggCharacter[];
  /** 当前选中的角色 key；首帧就落在第一个上，**没有「全部角色」** */
  activeCharacter: string;
  setCharacter: (key: string) => void;
}

/**
 * 蛋仓的游戏角色筛选（2026-11-25 从 `EggStockView` 提出来，家园蛋仓与换蛋广场蛋仓共用）。
 *
 * 口径与家园一致（2026-11-24 用户口径）：
 * - 一次只显示一个角色，默认本机账号列表的第一个（一般是主号），没有「全部角色」；
 * - 换号 / 角色列表变了，选中的角色不在列表里就回到第一个；
 * - 角色列表为空（一个号都没有）时选中项清空，标题行不出下拉。
 *
 * **只影响本机这一屏画哪些蛋**：不发请求、不改库存、不写库（别人的可见性只看服务端
 * `listed && available`，见 `EggMatchingHub` 的 `offers`）。
 */
export function useEggStockCharacter({ eggs, snapshots }: {
  /** 参与统计的蛋（调用方决定范围：家园 / 广场都传「本账号、未换出」） */
  eggs: readonly { gameAccountKey?: string; accountName?: string }[];
  snapshots: readonly AccountSnapshot[];
}): EggStockCharacterState {
  const [character, setCharacter] = useState('');
  const characters = useMemo(() => eggCharactersOf(eggs, snapshots), [eggs, snapshots]);
  /** 首帧就按第一个角色渲染，别先闪一下「全部」再跳过去。 */
  const activeCharacter = character || characters[0]?.key || '';
  useEffect(() => {
    if (!characters.length) {
      if (character) setCharacter('');
      return;
    }
    // 换号 / 角色数据变了：选中的角色不在列表里了就回到第一个（主号）
    if (!characters.some((item) => item.key === character)) setCharacter(characters[0].key);
  }, [character, characters]);
  return { characters, activeCharacter, setCharacter };
}
