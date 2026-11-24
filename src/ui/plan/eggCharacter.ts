import { accountKeyOf, type AccountSnapshot } from '../../domain/parseBackup';

/** 蛋仓里的「游戏角色」：同一工具箱账号下可以有多个游戏号，蛋按角色分开。 */
export interface EggCharacter {
  /** 与 `WorkflowEgg.gameAccountKey` 同一口径（uid:<游戏 UID>） */
  key: string;
  name: string;
  /** 这个角色在蛋仓里的蛋数（调用方传进来的蛋全算，不再按可交换 / 标注筛） */
  count: number;
}

/**
 * 账号下的游戏角色列表 + 各自蛋数（2026-11-24 用户口径）。
 *
 * 顺序以本机账号列表（快照）为准：第一个一般是主号，进蛋仓默认就落在他身上。
 * 快照里没有、但蛋上出现过的角色补在后面，名字用蛋上带的，绝不出现空选项。
 * 蛋数由调用方决定统计范围（家园页传的是「本账号、未换出」的蛋）。
 */
export function eggCharactersOf(
  eggs: readonly { gameAccountKey?: string; accountName?: string }[],
  snapshots: readonly AccountSnapshot[],
): EggCharacter[] {
  const names = new Map<string, string>();
  const order: string[] = [];
  for (const snapshot of snapshots) {
    const key = snapshot.accountKey ?? accountKeyOf(snapshot);
    if (names.has(key)) continue;
    order.push(key);
    names.set(key, snapshot.accountName);
  }
  for (const egg of eggs) {
    const key = egg.gameAccountKey?.trim();
    if (!key || names.has(key)) continue;
    order.push(key);
    names.set(key, egg.accountName?.trim() || key);
  }
  const counts = new Map<string, number>();
  for (const egg of eggs) {
    const key = egg.gameAccountKey?.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return order.map((key) => ({ key, name: names.get(key) || key, count: counts.get(key) ?? 0 }));
}
