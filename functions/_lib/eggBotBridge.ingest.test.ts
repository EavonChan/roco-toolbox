// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { handleEggBotBridge } from './eggBotBridge';
import type { Env } from './util';
import { emptyEggWorkflow } from '../../src/shared/eggWorkflow';

const TOKEN = 'test-token-0123456789abcdef';

/** 只覆盖 ingest 用到的查询：绑定、成员账号、小组状态读/写。 */
class FakeDB {
  state = { version: 1, state_json: JSON.stringify(emptyEggWorkflow()) };
  updates = 0;
  constructor(private readonly options: {
    binding?: { groupId: string } | null;
    account?: { accountId: string } | null;
  } = {}) {}

  prepare(sql: string) {
    const run = async (args: unknown[]) => {
      if (sql.startsWith('UPDATE egg_matching_groups')) {
        this.state = { version: this.state.version + 1, state_json: String(args[0]) };
        this.updates += 1;
        return { meta: { changes: 1 } };
      }
      return { meta: { changes: 0 } };
    };
    const first = async () => {
      if (sql.includes('FROM egg_bot_bindings')) return this.options.binding ?? null;
      if (sql.includes('FROM mother_group_accounts')) return this.options.account ?? null;
      if (sql.includes('FROM egg_matching_groups')) return this.state;
      return null;
    };
    const all = async () => ({ results: [] });
    return {
      bind: (...args: unknown[]) => ({ first, run: () => run(args), all }),
      first,
      run: () => run([]),
      all,
    };
  }
}

const scene = {
  code: 0,
  data: {
    home_scene_info: {
      snapshot_status: 'valid',
      egg_count: 1,
      eggs: [{
        actor_id: 'egg-1',
        nest_furniture_guid: 100,
        mother_candidate: { pet_gid: 'pet-1', pet_cfg_id: 3001, nature: 2, voice: 100 },
        father_candidates: [],
        biological_parentage_confirmed: true,
      }],
      home_pets: [],
    },
  },
};

function ingestRequest(payload: Record<string, unknown>, token = TOKEN): Request {
  return new Request('https://example.com/api/egg-bot/ingest', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

function envFor(db: FakeDB): Env {
  return {
    DB: db as unknown as D1Database,
    EGG_BOT_BRIDGE_TOKEN: TOKEN,
    CF_PAGES_BRANCH: 'main',
  } as unknown as Env;
}

const payload = { uid: '293143', qqGroupId: '1124313894', botId: '2946301083', scene };

describe('egg-bot ingest', () => {
  test('adds a reported home egg into the group stock', async () => {
    const db = new FakeDB({ binding: { groupId: 'g1' }, account: { accountId: 'a1' } });
    const response = await handleEggBotBridge(ingestRequest(payload), envFor(db), 1000);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, written: 1, seen: 1 });
    expect(db.updates).toBe(1);

    const stored = JSON.parse(db.state.state_json) as { eggs: Array<Record<string, unknown>> };
    expect(stored.eggs).toHaveLength(1);
    expect(stored.eggs[0]).toMatchObject({
      id: JSON.stringify(['uid:293143', 'home', 'egg-1']),
      accountId: 'a1',
      gameAccountKey: 'uid:293143',
      eggGameId: 3001,
      location: 'home',
      provenance: 'self-bred',
    });
  });

  test('reporting the same scene again writes nothing', async () => {
    const db = new FakeDB({ binding: { groupId: 'g1' }, account: { accountId: 'a1' } });
    await handleEggBotBridge(ingestRequest(payload), envFor(db), 1000);
    const second = await handleEggBotBridge(ingestRequest(payload), envFor(db), 1000 + 60_000);
    expect(await second.json()).toMatchObject({ ok: true, written: 0 });
    expect(db.updates).toBe(1);
  });

  test('an unbound uid returns a readable reason instead of failing', async () => {
    const db = new FakeDB({ binding: { groupId: 'g1' }, account: null });
    const response = await handleEggBotBridge(ingestRequest(payload), envFor(db), 1000);
    expect(response.status).toBe(200);
    // 2026-11-27：拒绝要带机器可读的 code，机器人才能按 code 给「去哪绑」的引导；
    // 原 error 文案保留，旧机器人忽略新字段仍然正常。
    expect(await response.json()).toMatchObject({
      ok: false,
      code: 'uid-unbound',
      error: expect.stringContaining('绑定'),
    });
    expect(db.updates).toBe(0);
  });

  test('a group that has not bound the bot is rejected', async () => {
    const db = new FakeDB({ binding: null, account: { accountId: 'a1' } });
    const response = await handleEggBotBridge(ingestRequest(payload), envFor(db), 1000);
    expect(await response.json()).toMatchObject({
      ok: false,
      code: 'group-unbound',
      error: expect.stringContaining('接入'),
    });
    expect(db.updates).toBe(0);
  });

  test('a wrong bridge token is rejected before touching the DB', async () => {
    const db = new FakeDB({ binding: { groupId: 'g1' }, account: { accountId: 'a1' } });
    const response = await handleEggBotBridge(ingestRequest(payload, 'wrong-token'), envFor(db), 1000);
    expect(response.status).toBe(401);
    expect(db.updates).toBe(0);
  });
});
