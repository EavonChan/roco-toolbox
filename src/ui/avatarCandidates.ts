/**
 * 换头像的候选（2026-11-28）：**只列本机已导入的精灵**，不列全图鉴。
 *
 * 来源是同一次导入里的宠物与蛋（蛋带 `speciesPetId`）；按形态 gameId 去重，
 * 先出现的名字优先（宠物名比「XX（蛋）」更自然）。没有可用的 id 直接跳过，
 * 图鉴里查不到名字时用 `#id` 兜底，不留空标签。
 */
import { species } from '../data/catalog';
import type { AccountSnapshot } from '../domain/parseBackup';

export interface AvatarCandidate {
  gameId: number;
  name: string;
}

const nameByGameId = new Map(species.map((entry) => [entry.gameId, entry.name]));

const validId = (gameId: number | null | undefined): gameId is number =>
  typeof gameId === 'number' && Number.isInteger(gameId) && gameId > 0;

export function collectAvatarCandidates(
  snapshots: readonly AccountSnapshot[],
): AvatarCandidate[] {
  const seen = new Set<number>();
  const result: AvatarCandidate[] = [];

  const add = (gameId: number | null | undefined, name: string | null | undefined): void => {
    if (!validId(gameId) || seen.has(gameId)) return;
    seen.add(gameId);
    result.push({ gameId, name: name?.trim() || nameByGameId.get(gameId) || `#${gameId}` });
  };

  for (const snapshot of snapshots) {
    for (const pet of snapshot.pets) add(pet.gameId, pet.name);
    for (const egg of snapshot.eggs) add(egg.speciesPetId, egg.petName);
  }
  return result;
}
