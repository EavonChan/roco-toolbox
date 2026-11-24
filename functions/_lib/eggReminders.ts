import type { EggWorkflowState, WorkflowTrade } from '../../src/shared/eggWorkflow';
import catalog from '../../src/data/catalog.gen.json';

/** 档位前缀：体型 + 声音 → 大婉 / 大粗 / 小婉 / 小粗。 */
const TIER_BODY: Record<string, string> = { 大块头: '大', 满体重: '大', 小不点: '小', 零体重: '小' };
const TIER_VOICE: Record<string, string> = { 婉转声: '婉', '+100': '婉', 粗嗓门: '粗', '-100': '粗' };

interface EggSide {
  eggGameId: number;
  nature: string;
  body: string;
  voice: string;
}

/** 单侧描述：🟢绿窝 + 档位 + 满分/满重 + 性格 + 精灵名。 */
export function reminderSideText(line: { eggGameId?: number; nature?: string; body?: string; voice?: string; greenParentId?: string } | undefined, egg: EggSide | null | undefined): string {
  const eggGameId = line?.eggGameId ?? egg?.eggGameId ?? 0;
  const body = line?.body || egg?.body || '';
  const voice = line?.voice || egg?.voice || '';
  const nature = line?.nature || egg?.nature || '';
  const species = catalog.species.find((entry) => entry.gameId === eggGameId)?.name ?? '精灵';
  const tier = `${TIER_BODY[body] ?? ''}${TIER_VOICE[voice] ?? ''}` || [body, voice].filter(Boolean).join('+');
  const perfect = voice === '+100' || voice === '-100' ? '满分' : '';
  const heavy = body === '满体重' || body === '零体重' ? '满重' : '';
  const green = line?.greenParentId ? '🟢绿窝' : '';
  return `${green}${tier}${perfect}${heavy}${nature}${species}`;
}

/** 我催对方时的提醒正文：发起人本人排前面，两边都描述。 */
export function reminderText(input: {
  requesterName: string;
  targetName: string;
  requesterLine?: Parameters<typeof reminderSideText>[0];
  requesterEgg?: EggSide | null;
  targetLine?: Parameters<typeof reminderSideText>[0];
  targetEgg?: EggSide | null;
}): string {
  const mine = reminderSideText(input.requesterLine, input.requesterEgg);
  const theirs = reminderSideText(input.targetLine, input.targetEgg);
  return `${mine}（${input.requesterName}）换${theirs}（${input.targetName}）的换蛋进度，请查看任务。`;
}

export interface ReminderPayload {
  kind: 'reminder'; uid: string; uids: string[]; eggName: string; recipientName: string;
  requesterName: string; requesterAccountId: string; targetAccountId: string; reminderAt: number;
  /** 完整提醒文案（含双方精灵与档位）；老客户端没有这个字段时走旧模板。 */
  message?: string;
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
  const actorName = members.results.find(m => m.account_id === actor)!.display_name;
  const targetName = members.results.find(m => m.account_id === target)!.display_name;
  // 发起人本人排前面；两边各用自己的产线（含绿窝标记）描述
  const actorIsSupplier = actor === trade.supplierAccountId;
  const message = reminderText({
    requesterName: actorName,
    targetName,
    requesterLine: actorIsSupplier ? trade.line : trade.returnLine,
    requesterEgg: actorIsSupplier ? trade.give : trade.receive,
    targetLine: actorIsSupplier ? trade.returnLine : trade.line,
    targetEgg: actorIsSupplier ? trade.receive : trade.give,
  });
  const payload: ReminderPayload = { kind: 'reminder', uid: uids[0], uids, eggName: catalog.species.find(s => s.gameId === trade.give.eggGameId)?.name ?? '任务精灵',
    recipientName: '', requesterName: actorName,
    requesterAccountId: actor, targetAccountId: target, reminderAt: trade.reminderAt!, message };
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
