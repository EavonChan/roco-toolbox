/**
 * 使用埋点：POST /api/event
 * 只记「谁在什么时候用了什么功能」，不记精灵内容、不做用户画像；deviceId 是前端随机生成的匿名 id。
 */
import {
  type Env,
  authenticate,
  clientIp,
  fail,
  json,
  rateLimit,
  readJson,
  resolveOrigin,
  timingSafeEqual,
} from './util';

interface IncomingEvent {
  name?: string;
  props?: Record<string, unknown>;
  ts?: number;
}

interface EventBody {
  deviceId?: string;
  appVersion?: string;
  platform?: string;
  events?: IncomingEvent[];
}

const MAX_EVENTS_PER_BATCH = 50;
const MAX_NAME_LENGTH = 40;
const MAX_PROPS_LENGTH = 2000;
/** 单个 deviceId 每天最多上报多少批（50 条/批 → 1 万条/天），防灌库 */
const MAX_BATCHES_PER_DAY = 200;
/** /api/stats 的 exclude 最多接受多少个账号（防超长 URL / 超多绑定参数） */
const MAX_EXCLUDE_ACCOUNTS = 50;

export async function handleEvent(request: Request, env: Env, origin: string | null): Promise<Response> {
  const body = (await readJson<EventBody>(request)) ?? {};
  const deviceId = (body.deviceId ?? '').slice(0, 64);
  if (!deviceId) return fail('缺少 deviceId', 400, origin);
  const incoming = (body.events ?? []).slice(0, MAX_EVENTS_PER_BATCH);
  if (incoming.length === 0) return json({ ok: true, stored: 0 }, 200, origin);
  if (!(await rateLimit(env, `event:${deviceId}`, MAX_BATCHES_PER_DAY, 86_400_000))) {
    return fail('上报太频繁，稍后再试', 429, origin);
  }

  // 事件可以带登录态（有则记 account_id，方便「账号绑定后的行为」统计）
  const accountId = await authenticate(request, env).catch(() => null);
  const appVersion = (body.appVersion ?? '').slice(0, 20);
  const platform = (body.platform ?? '').slice(0, 20);
  const serverTs = Date.now();

  const rows: Array<[string, string | null, string, string | null, string, string, number, number]> = [];
  for (const event of incoming) {
    const name = (event.name ?? '').slice(0, MAX_NAME_LENGTH);
    if (!name) continue;
    let props: string | null = null;
    if (event.props) {
      try {
        props = JSON.stringify(event.props).slice(0, MAX_PROPS_LENGTH);
      } catch {
        props = null;
      }
    }
    const clientTs = Number.isFinite(event.ts) ? Number(event.ts) : serverTs;
    rows.push([deviceId, accountId, name, props, appVersion, platform, clientTs, serverTs]);
  }
  if (rows.length === 0) return json({ ok: true, stored: 0 }, 200, origin);

  // 分批多行插入（D1 单条 SQL 变量数有上限，20 行 × 8 列稳妥）
  for (let index = 0; index < rows.length; index += 20) {
    const chunk = rows.slice(index, index + 20);
    const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    await env.DB.prepare(
      `INSERT INTO events (device_id, account_id, name, props, app_version, platform, client_ts, server_ts)
       VALUES ${placeholders}`,
    )
      .bind(...chunk.flat())
      .run();
  }

  // 设备表：每批更新一次 last_seen（用于「设备数 / 同账号几台设备」）
  const now = Date.now();
  await env.DB.prepare(
    `INSERT INTO devices (device_id, account_id, first_seen_at, last_seen_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(device_id) DO UPDATE SET account_id = COALESCE(?, account_id), last_seen_at = ?`,
  )
    .bind(deviceId, accountId, now, now, accountId, now)
    .run();

  return json({ ok: true, stored: rows.length }, 200, origin);
}

/**
 * 看统计：GET /api/stats?days=7&exclude=<accountId>,<accountId>
 * （只读；令牌走 `Authorization: Bearer <token>`，配在 Pages secret 里）
 *
 * 口径以「账号」为主：`accounts` 才接近人数，`devices` 只是安装/曝光量——
 * 每个预览部署 URL（不同 origin）、清缓存、换浏览器都会生成新的 deviceId，设备数会远高于真实用户。
 * `exclude` 用来剔掉自己的测试号；这些账号绑定过的设备也一并剔掉，
 * 否则它们登录前产生的匿名事件还会留在统计里。
 */
export async function handleStats(request: Request, env: Env): Promise<Response> {
  const origin = resolveOrigin(request, env);
  const url = new URL(request.url);
  // 只认 Authorization 头：令牌放 URL query 会进访问日志 / Referer / 浏览器历史。
  // 配置值先 trim：`secret put` 时手滑带上的首尾空格/换行不该让令牌永远对不上。
  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const expected = (env.STATS_TOKEN ?? '').trim();
  if (!expected || !timingSafeEqual(token, expected)) {
    return json({ ok: false, error: 'unauthorized' }, 401, origin);
  }
  if (!(await rateLimit(env, `stats:${clientIp(request)}`, 60, 3_600_000))) {
    return fail('太频繁了，稍后再试', 429, origin);
  }
  // days 非法（如 ?days=abc → NaN）时回退到 7，否则 since 会算出 NaN 再绑进查询
  const rawDays = Number(url.searchParams.get('days') ?? 7);
  const days = Number.isFinite(rawDays) ? Math.min(Math.max(Math.trunc(rawDays), 1), 90) : 7;
  const since = Date.now() - days * 86_400_000;

  // ?exclude=<accountId>,<accountId>：剔掉自己的测试号（去重、最多 50 个）
  const exclude = Array.from(
    new Set(
      (url.searchParams.get('exclude') ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter((id) => id.length > 0 && id.length <= 64),
    ),
  ).slice(0, MAX_EXCLUDE_ACCOUNTS);
  const marks = exclude.map(() => '?').join(', ');
  // 未登录事件 account_id 是 NULL，`NOT IN` 对 NULL 结果是 NULL（会被丢掉）→ 必须显式放行
  const accountFilter = exclude.length > 0 ? `(account_id IS NULL OR account_id NOT IN (${marks}))` : '1 = 1';
  // 被排除账号绑定过的设备也剔掉：它们登录前产生的匿名事件 account_id 是 NULL
  const deviceFilter =
    exclude.length > 0
      ? `device_id NOT IN (SELECT device_id FROM devices WHERE account_id IN (${marks}))`
      : '1 = 1';
  /** 两个过滤片段各要一份绑定值 */
  const filterParams = [...exclude, ...exclude];

  const daily = await env.DB.prepare(
    `SELECT date(server_ts / 1000, 'unixepoch') AS day,
            COUNT(DISTINCT account_id) AS accounts,
            COUNT(DISTINCT device_id) AS devices,
            COUNT(*) AS events
       FROM events WHERE server_ts >= ? AND ${accountFilter} AND ${deviceFilter}
      GROUP BY day ORDER BY day`,
  )
    .bind(since, ...filterParams)
    .all();

  const topEvents = await env.DB.prepare(
    `SELECT name, COUNT(*) AS count,
            COUNT(DISTINCT account_id) AS accounts,
            COUNT(DISTINCT device_id) AS devices
       FROM events WHERE server_ts >= ? AND ${accountFilter} AND ${deviceFilter}
      GROUP BY name ORDER BY count DESC LIMIT 30`,
  )
    .bind(since, ...filterParams)
    .all();

  // 次日留存：以账号「首次出现」为基准（账号口径才算人；设备口径会被预览部署撑大）
  const retention = await env.DB.prepare(
    `WITH first_seen AS (
       SELECT account_id, MIN(date(server_ts / 1000, 'unixepoch')) AS day
         FROM events WHERE account_id IS NOT NULL AND ${accountFilter} AND ${deviceFilter}
        GROUP BY account_id)
     SELECT f.day AS cohort, COUNT(DISTINCT f.account_id) AS accounts,
            COUNT(DISTINCT CASE WHEN e.day = date(f.day, '+1 day') THEN f.account_id END) AS returned
       FROM first_seen f
       JOIN (SELECT DISTINCT account_id, date(server_ts / 1000, 'unixepoch') AS day
               FROM events WHERE account_id IS NOT NULL AND ${accountFilter} AND ${deviceFilter}) e
         ON e.account_id = f.account_id
      WHERE f.day >= date('now', ?)
      GROUP BY cohort ORDER BY cohort`,
  )
    .bind(...filterParams, ...filterParams, `-${days} days`)
    .all();

  const totals = await env.DB.prepare(
    `SELECT COUNT(DISTINCT account_id) AS accounts,
            COUNT(DISTINCT device_id) AS devices,
            COUNT(*) AS events
       FROM events WHERE server_ts >= ? AND ${accountFilter} AND ${deviceFilter}`,
  )
    .bind(since, ...filterParams)
    .first<{ accounts: number; devices: number; events: number }>();

  return json(
    {
      ok: true,
      days,
      exclude,
      daily: daily.results,
      topEvents: topEvents.results,
      retention: retention.results,
      totals,
    },
    200,
    origin,
  );
}
