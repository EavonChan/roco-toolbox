import type { EggWorkflowState, WorkflowTrade } from '../../src/shared/eggWorkflow';
import catalog from '../../src/data/catalog.gen.json';
import { targetUidsForTrade } from './eggReminders';

export type ExchangeNotificationEvent = 'request' | 'accepted' | 'cancelled' | 'completed';

export interface ExchangeNotificationPayload {
  kind: 'exchange';
  event: ExchangeNotificationEvent;
  groupId: string;
  groupName: string;
  tradeId: string;
  uid: string;
  uids: string[];
  actorAccountId: string;
  targetAccountId: string;
  actorName: string;
  targetName: string;
  eggName: string;
  nature: string;
  message: string;
  createdAt: number;
}

interface MemberRow {
  account_id: string;
  display_name: string;
}

const eggNameOf = (trade: WorkflowTrade): string =>
  catalog.species.find((entry) => entry.gameId === trade.give.eggGameId)?.name ?? '任务精灵';

const eventOfAction = (type: string): ExchangeNotificationEvent | null => {
  if (type === 'propose' || type === 'request') return 'request';
  if (type === 'accept') return 'accepted';
  if (type === 'cancel') return 'cancelled';
  if (type === 'receive') return 'completed';
  return null;
};

const messageOf = (input: {
  event: ExchangeNotificationEvent;
  actorName: string;
  targetName: string;
  supplierName: string;
  demanderName: string;
  eggName: string;
  nature: string;
}): string => {
  const egg = `${input.eggName}蛋${input.nature ? `（${input.nature}）` : ''}`;
  if (input.event === 'request') {
    return `${input.actorName} 向 ${input.targetName} 发起换蛋：${input.supplierName} 提供 ${egg}`;
  }
  if (input.event === 'accepted') {
    return `${input.actorName} 已接受与 ${input.targetName} 的换蛋：${input.supplierName} 提供 ${egg}`;
  }
  if (input.event === 'cancelled') {
    return `${input.actorName} 取消了与 ${input.targetName} 的换蛋：${egg}`;
  }
  return `${input.actorName} 已确认收到 ${input.targetName} 的 ${egg}（${input.demanderName} 的需求）`;
};

async function memberNames(
  db: D1Database,
  groupId: string,
  ids: readonly string[],
): Promise<Map<string, string> | null> {
  const rows = await db.prepare(
    `SELECT account_id,display_name FROM mother_group_members
     WHERE group_id=? AND account_id IN (${ids.map(() => '?').join(',')})`,
  ).bind(groupId, ...ids).all<MemberRow>();
  if (rows.results.length !== new Set(ids).size) return null;
  return new Map(rows.results.map((row) => [row.account_id, row.display_name]));
}

export async function prepareExchangeNotification(
  db: D1Database,
  groupId: string,
  next: EggWorkflowState,
  action: { type?: string; id?: string },
  actor: string,
  mutation: string,
  now: number,
): Promise<D1PreparedStatement | null> {
  const event = eventOfAction(action.type ?? '');
  if (!event || typeof action.id !== 'string') return null;
  const trade = next.trades.find((item) => item.id === action.id && item.groupId === groupId);
  if (!trade) return null;
  if (event === 'request' && trade.status !== 'proposed') return null;
  if (event === 'accepted' && trade.status !== 'accepted') return null;
  if (event === 'cancelled' && trade.status !== 'cancelled') return null;
  if (event === 'completed' && trade.status !== 'done') return null;

  const binding = await db.prepare(
    'SELECT binding_version FROM egg_bot_bindings WHERE group_id=? AND enabled=1',
  ).bind(groupId).first<{ binding_version: string }>();
  if (!binding) return null;

  let target: string;
  if (event === 'request') {
    target = actor === trade.supplierAccountId ? trade.demanderAccountId : trade.supplierAccountId;
  } else if (event === 'accepted') {
    target = trade.initiatorAccountId === actor ? trade.demanderAccountId : trade.initiatorAccountId ?? trade.demanderAccountId;
    if (target === actor) {
      target = actor === trade.supplierAccountId ? trade.demanderAccountId : trade.supplierAccountId;
    }
  } else if (event === 'completed') {
    target = actor === trade.demanderAccountId ? trade.supplierAccountId : trade.demanderAccountId;
  } else {
    target = actor === trade.supplierAccountId ? trade.demanderAccountId : trade.supplierAccountId;
  }
  if (target === actor) return null;

  const names = await memberNames(db, groupId, [actor, target]);
  if (!names) return null;
  const group = await db.prepare('SELECT name FROM mother_groups WHERE id=?')
    .bind(groupId).first<{ name: string }>();
  if (!group) return null;
  const uids = await targetUidsForTrade(db, groupId, trade, target, next);
  const eggName = eggNameOf(trade);
  const actorName = names.get(actor) ?? '组员';
  const targetName = names.get(target) ?? '组员';
  const supplierName = names.get(trade.supplierAccountId) ?? '组员';
  const demanderName = names.get(trade.demanderAccountId) ?? '组员';
  const payload: ExchangeNotificationPayload = {
    kind: 'exchange',
    event,
    groupId,
    groupName: group.name,
    tradeId: trade.id,
    uid: uids[0] ?? '',
    uids,
    actorAccountId: actor,
    targetAccountId: target,
    actorName,
    targetName,
    eggName,
    nature: trade.give.nature,
    message: messageOf({
      event,
      actorName,
      targetName,
      supplierName,
      demanderName,
      eggName,
      nature: trade.give.nature,
    }),
    createdAt: now,
  };
  const id = JSON.stringify(['exchange', groupId, trade.id, event, mutation]);
  return db.prepare(
    `INSERT INTO egg_patrol_notifications(
       id,group_id,binding_version,trade_id,side,uid,actor_id,payload_json,next_at,created_at
     )
     SELECT ?,?,?,?,?,?,?,?,?,?
     WHERE EXISTS(SELECT 1 FROM egg_matching_groups WHERE group_id=? AND mutation_id=?)
       AND EXISTS(SELECT 1 FROM egg_bot_bindings WHERE group_id=? AND binding_version=? AND enabled=1)`,
  ).bind(
    id,
    groupId,
    binding.binding_version,
    trade.id,
    `exchange-${event}`,
    uids[0] ?? '',
    actor,
    JSON.stringify(payload),
    now,
    now,
    groupId,
    mutation,
    groupId,
    binding.binding_version,
  );
}

export async function exchangeNotificationCurrent(
  db: D1Database,
  groupId: string,
  tradeId: string,
  payload: ExchangeNotificationPayload,
): Promise<boolean> {
  if (payload.kind !== 'exchange' || payload.groupId !== groupId) return false;
  const row = await db.prepare('SELECT state_json FROM egg_matching_groups WHERE group_id=?')
    .bind(groupId).first<{ state_json: string }>();
  if (!row) return false;
  const state = JSON.parse(row.state_json) as EggWorkflowState;
  const trade = state.trades.find((item) => item.id === tradeId && item.groupId === groupId);
  if (!trade) return false;
  if (payload.event === 'request' && trade.status !== 'proposed') return false;
  if (payload.event === 'accepted' && trade.status !== 'accepted') return false;
  if (payload.event === 'cancelled' && trade.status !== 'cancelled') return false;
  if (payload.event === 'completed' && trade.status !== 'done') return false;
  if (![trade.supplierAccountId, trade.demanderAccountId].includes(payload.actorAccountId)) return false;
  if (![trade.supplierAccountId, trade.demanderAccountId].includes(payload.targetAccountId)) return false;
  return (await memberNames(db, groupId, [payload.actorAccountId, payload.targetAccountId])) != null;
}
