/**
 * 广场送蛋 + 免费领蛋：数据形状与纯规则（方案 V8，一期只做数据与规则）。
 *
 * 口径（docs/方案-广场送蛋与免费领蛋-2026-11-25.md §10.1）：
 * - 每成交一单，双方**各 +1** 次免费领蛋；**无限累积**（不封顶、不按天限、不重置、不过期）；
 * - 同一笔结单只发一次（重放 / 重开都不二次发放）；同一对成员 **24h 只给 1 次**；
 * - 送蛋**不要求五项齐全**（五项齐全只是「自动挂出到换蛋广场」的门槛）；送出去不加次数；
 * - 领取先到先得，扣 1 次；放弃退回；领到的蛋**不写库存**（只进「我领到的」，等抓包同步）。
 *
 * 一期没有新表（凭证表 `egg_trade_receipts` 与流水表放到二期）：余额与流水痕迹都落在
 * `state.chances` / `state.trades[].chanceGranted` / `state.gifts[]` 里，够判定幂等即可。
 */
import type { EggRecord } from './eggMatching';

/** 每成交一单，双方各得 1 次（用户 2026-11-25 定：每单 +1，不按比例）。 */
export const CHANCE_PER_TRADE = 1;

/** 同一对成员 24h 内只发 1 次次数。 */
export const PAIR_CHANCE_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * 免费领蛋次数余额。
 *
 * `balance = grantedTotal - claimedTotal`；放弃领取（`gift-cancel`）把 `claimedTotal` 减回去，
 * 所以余额只有一个来源，不会出现「余额和流水对不上」的第二份真相。
 */
export interface EggChance {
  balance: number;
  grantedTotal: number;
  claimedTotal: number;
}

/** 送蛋记录：一颗蛋同一时间只会在一个 `open` / `claimed` 的送蛋里（发布即锁蛋）。 */
export interface EggGift {
  id: string;
  groupId: string;
  giverAccountId: string;
  eggId: string;
  /** 发布当时的蛋快照（展示用；真实状态看 `state.eggs`）。 */
  egg: EggRecord;
  /** 发布前是否挂出：撤回时原样还原（方案 §11「撤回的蛋不再挂出」的修复点）。 */
  wasListed: boolean;
  note?: string;
  status: 'open' | 'claimed' | 'done' | 'cancelled';
  /** 每次领取生成，放弃后清空；一期用它做「同一笔领取不重复扣次数」。 */
  claimId?: string;
  claimedAt?: number;
  claimerAccountId?: string;
  claimGameAccountKey?: string;
  completedAt?: number;
  cancelledAt?: number;
  /** 领取人放弃的时间（蛋回广场，次数退回）。 */
  releasedAt?: number;
  /** 被放弃过几次（审计用，不做限频）。 */
  abandonCount?: number;
  lastNudgeAt?: number;
  createdAt: number;
}

const emptyChance: EggChance = { balance: 0, grantedTotal: 0, claimedTotal: 0 };

/** 取某人的次数；没有记录 = 0 次（旧 state 没有 `chances` 字段时也走这里）。 */
export const chanceOf = (chances: Record<string, EggChance> | undefined, accountId: string): EggChance =>
  chances?.[accountId] ?? { ...emptyChance };

/** 蛋实例的身份（账号内唯一）：`accountId:eggId`。 */
const eggIdentity = (egg: Pick<EggRecord, 'accountId' | 'id'>): string => `${egg.accountId}:${egg.id}`;

/**
 * 同一对蛋的身份：两颗实例排序后拼接。
 *
 * 用它而不是 `tradeId` 判「同一笔结单」——取消后重新发起会生成新的 tradeId，
 * 同一对蛋却会被算成两笔（方案 §4.2）。一期不落表，所以这里是可读的明文键，不做哈希。
 */
export const exchangeKeyOf = (
  give: Pick<EggRecord, 'accountId' | 'id'>,
  receive: Pick<EggRecord, 'accountId' | 'id'>,
): string => [eggIdentity(give), eggIdentity(receive)].sort().join('|');

/** 同一对成员的身份（与谁给谁无关）：用来判「同一对 24h 只给 1 次」。 */
export const memberPairKeyOf = (a: string, b: string): string => [a, b].sort().join('|');

/** 送蛋能不能领：只有 `open` 且不是自己发的。返回 null = 可以领，否则是拒绝文案。 */
export const giftClaimBlockedReason = (
  gift: Pick<EggGift, 'status' | 'giverAccountId'>,
  actorAccountId: string,
): string | null => {
  if (gift.status !== 'open') return '这颗蛋已经被领走了';
  if (gift.giverAccountId === actorAccountId) return '不能领自己送出的蛋';
  return null;
};
