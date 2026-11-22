import { accountKeyOf, type AccountSnapshot } from '../../domain/parseBackup';

/** 蛋仓里的「游戏角色」：同一工具箱账号下可以有多个游戏号，蛋按角色分开。 */
export interface EggCharacter {
  /** 与 `WorkflowEgg.gameAccountKey` 同一口径（uid:<游戏 UID>） */
  key: string;
  name: string;
}

/**
 * 蛋仓里实际出现过的游戏角色（按第一次出现的顺序去重）。
 *
 * 名字优先用蛋上带的 `accountName`（同步时随蛋写进服务器的），
 * 老数据没有就回落到本机快照的账号名，再不行显示 key，绝不出现空选项。
 */
export function eggCharactersOf(
  eggs: readonly { gameAccountKey?: string; accountName?: string }[],
  snapshots: readonly AccountSnapshot[],
): EggCharacter[] {
  const snapshotNames = new Map<string, string>();
  for (const snapshot of snapshots) {
    snapshotNames.set(snapshot.accountKey ?? accountKeyOf(snapshot), snapshot.accountName);
  }
  const seen = new Map<string, string>();
  for (const egg of eggs) {
    const key = egg.gameAccountKey?.trim();
    if (!key || seen.has(key)) continue;
    seen.set(key, egg.accountName?.trim() || snapshotNames.get(key) || key);
  }
  return [...seen].map(([key, name]) => ({ key, name }));
}
