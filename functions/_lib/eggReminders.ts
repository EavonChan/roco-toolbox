import type { EggWorkflowState, WorkflowTrade } from '../../src/shared/eggWorkflow';
import catalog from '../../src/data/catalog.gen.json';

export interface ReminderPayload {
  kind: 'reminder'; uid: string; uids: string[]; eggName: string; recipientName: string;
  requesterName: string; requesterAccountId: string; targetAccountId: string; reminderAt: number;
}
interface Member { account_id: string; display_name: string }

export async function targetUidsForTrade(db: D1Database, groupId: string, trade: WorkflowTrade, target: string, state: EggWorkflowState): Promise<string[]> {
  const supplier = target === trade.supplierAccountId;
  const line = supplier ? trade.line : trade.returnLine;
  const egg = supplier ? trade.give : trade.receive;
  const instance = egg && state.eggs.find(value => value.accountId === target && value.id === egg.id);
  const taskKey = line?.gameAccountKey ?? instance?.gameAccountKey;
  const taskUid = taskKey && /^uid:(\d{6,24})$/.exec(taskKey);
  if (taskUid) return [taskUid[1]];
  const rows = await db.prepare('SELECT game_account_key FROM mother_group_accounts WHERE group_id=? AND member_account_id=?')
    .bind(groupId, target).all<{ game_account_key: string }>();
  return [...new Set(rows.results.flatMap(row => { const match = /^uid:(\d{6,24})$/.exec(row.game_account_key); return match ? [match[1]] : []; }))];
}

/** Added to the workflow transaction so concurrent clicks cannot enqueue duplicates. */
export async function prepareReminder(db: D1Database, groupId: string, state: EggWorkflowState, trade: WorkflowTrade, actor: string, mutation: string): Promise<D1PreparedStatement> {
  const binding = await db.prepare('SELECT binding_version FROM egg_bot_bindings WHERE group_id=? AND enabled=1')
    .bind(groupId).first<{ binding_version: string }>();
  if (!binding) throw new Error('小组尚未接入群机器人');
  const target = actor === trade.supplierAccountId ? trade.demanderAccountId : trade.supplierAccountId;
  const members = await db.prepare('SELECT account_id,display_name FROM mother_group_members WHERE group_id=? AND account_id IN (?,?)')
    .bind(groupId, actor, target).all<Member>();
  if (members.results.length !== 2) throw new Error('换蛋成员已退出小组');
  const uids = await targetUidsForTrade(db, groupId, trade, target, state);
  if (!uids.length) throw new Error('对方尚未发布可关联QQ的游戏UID');
  const payload: ReminderPayload = { kind: 'reminder', uid: uids[0], uids, eggName: catalog.species.find(s => s.gameId === trade.give.eggGameId)?.name ?? '任务精灵',
    recipientName: '', requesterName: members.results.find(m => m.account_id === actor)!.display_name,
    requesterAccountId: actor, targetAccountId: target, reminderAt: trade.reminderAt! };
  const id = JSON.stringify(['reminder', groupId, trade.id, trade.reminderAt, mutation]);
  return db.prepare(`INSERT INTO egg_patrol_notifications(id,group_id,binding_version,trade_id,side,uid,actor_id,payload_json,next_at,created_at)
    SELECT ?,?,?,?,'reminder',?,?,?,?,? WHERE EXISTS(SELECT 1 FROM egg_matching_groups WHERE group_id=? AND mutation_id=?)
    AND EXISTS(SELECT 1 FROM egg_bot_bindings WHERE group_id=? AND binding_version=? AND enabled=1)`)
    .bind(id, groupId, binding.binding_version, trade.id, uids[0], mutation, JSON.stringify(payload), trade.reminderAt, trade.reminderAt, groupId, mutation, groupId, binding.binding_version);
}

export async function reminderCurrent(db: D1Database, groupId: string, tradeId: string, payload: ReminderPayload): Promise<boolean> {
  const row = await db.prepare('SELECT state_json FROM egg_matching_groups WHERE group_id=?').bind(groupId).first<{ state_json: string }>();
  if (!row) return false;
  const state = JSON.parse(row.state_json) as EggWorkflowState;
  const trade = state.trades.find(t => t.id === tradeId && t.groupId === groupId);
  if (!trade || !['proposed', 'accepted'].includes(trade.status) || trade.reminderAt !== payload.reminderAt || trade.reminderBy !== payload.requesterAccountId) return false;
  const target = trade.reminderBy === trade.supplierAccountId ? trade.demanderAccountId : trade.supplierAccountId;
  if (target !== payload.targetAccountId) return false;
  const members = await db.prepare('SELECT account_id FROM mother_group_members WHERE group_id=? AND account_id IN (?,?)')
    .bind(groupId, payload.requesterAccountId, target).all<{ account_id: string }>();
  if (members.results.length !== 2) return false;
  const uids = await targetUidsForTrade(db, groupId, trade, target, state);
  return uids.length > 0 && uids.length === payload.uids.length && uids.every(uid => payload.uids.includes(uid));
}

export async function readReminderStatus(db: D1Database, groupId: string, state: EggWorkflowState): Promise<NonNullable<EggWorkflowState['reminders']>> {
  const rows = await db.prepare(`SELECT trade_id,created_at,status,error_code,lease_until FROM egg_patrol_notifications
    WHERE group_id=? AND side='reminder' ORDER BY created_at DESC`).bind(groupId)
    .all<{ trade_id: string; created_at: number; status: string; error_code: string | null; lease_until: number }>();
  return state.trades.flatMap(trade => {
    const row = rows.results.find(r => r.trade_id === trade.id && r.created_at === trade.reminderAt);
    if (!row) return [];
    const status = row.status === 'sent' ? 'sent' : row.error_code === 'unbound' ? 'unbound' :
      row.status === 'failed' || row.status === 'leased' && row.lease_until < Date.now() ? 'failed' : 'pending';
    return [{ tradeId: trade.id, reminderAt: row.created_at, status }];
  });
}
