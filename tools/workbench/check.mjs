#!/usr/bin/env node
/**
 * 工作台验收脚本（可重复跑）：
 *   node tools/workbench/check.mjs
 *
 * 验这些事：
 *   1. 默认服务起来后，/api/board 的任务条数 == docs/任务看板.md 四个表的行数（独立数，不用服务端解析器）；
 *   2. /api/board 的 sha256 == 该 md 文件字节的 sha256（证明返回的是这一份文件，不是别处来的状态）；
 *   3. 端口占用自动 +1，并返回实际地址；
 *   4. 改 md 一行的状态符号，5 秒内接口跟着变（用 md 的副本测，绝不动 docs/任务看板.md）；
 *   5. 「选项」列解析：中英文逗号都认、（推荐）标出来、没有这一列不报错；
 *   6. POST /api/decide：写 决策.jsonl（只追加）、非法选项被拒、空选项空备注被拒、不改 md；
 *   7. 决策后 /api/board 能读到 decision 字段；待决策.md 的 Q-xxx 也算可决策卡片。
 *
 * 原生 Node + fetch，零依赖。退出码 0 = 全过。
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdtemp, rm, stat, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.join(HERE, 'server.mjs');
const REPO_ROOT = path.resolve(HERE, '..', '..');
const BOARD = path.join(REPO_ROOT, 'docs', '任务看板.md');
const DECISIONS_DOC = path.join(REPO_ROOT, 'docs', '待决策.md');
const BASE_PORT = Number(process.env.CHECK_PORT || 4451);
// 页面加载时会打计时器心跳；指到临时目录，绝不碰用户真实的 ~/.workbench/timer/
process.env.WORKBENCH_TIMER_DIR = path.join(tmpdir(), `wb-timer-check-${process.pid}`);
const SYMBOLS = ['🟡', '🔵', '⚪', '🟢', '🔴'];
const STATUS_BY_KEY = { doing: '🟡', waiting: '🔵', done: '🟢', backlog: '⚪', blocked: '🔴' };
const COLUMN_HEADS = [
  { key: 'doing', head: /进行中/, label: '进行中' },
  { key: 'waiting', head: /等你/, label: '等你' },
  { key: 'done', head: /已完成/, label: '已完成' },
  { key: 'backlog', head: /待派|backlog/i, label: '待派' },
];

let failures = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const bad = (msg) => { failures += 1; console.error(`  ✗ ${msg}`); };
const step = (n, total, msg) => console.log(`\n[${n}/${total}] ${msg}`);

const sha = (text) => createHash('sha256').update(text).digest('hex');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 独立数表：按 md 章节找四个表，数分隔线之后、非表格行之前的行数。 */
function countRows(text) {
  const lines = text.split(/\r?\n/);
  const per = {};
  let heading = null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^##\s+/.test(line)) {
      heading = line.replace(/^##\s+/, '').trim();
      continue;
    }
    const col = heading ? COLUMN_HEADS.find((c) => c.head.test(heading)) : null;
    if (!col) continue;
    if (!/^\s*\|/.test(line)) continue;
    if (i + 1 >= lines.length || !/^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])) continue;
    let n = 0;
    let j = i + 2;
    while (j < lines.length) {
      if (/^\s*\|/.test(lines[j])) { n += 1; j += 1; continue; }
      if (/^\s*$/.test(lines[j])) { j += 1; continue; } // 容忍表头后的空行（看板实际出现过）
      break;
    }
    per[col.key] = (per[col.key] || 0) + n;
    i = j - 1;
  }
  return per;
}

/** 取四个章节里第一张有数据行的表的第一行；返回 { column, rowIdx }。 */
function pickFirstRow(lines) {
  for (const h of COLUMN_HEADS) {
    const start = lines.findIndex((l) => /^##\s+/.test(l) && h.head.test(l));
    if (start < 0) continue;
    let sep = -1;
    for (let i = start + 1; i < lines.length; i += 1) {
      if (/^##\s+/.test(lines[i])) break;
      if (/^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i]) && lines[i].includes('-')) { sep = i; break; }
    }
    if (sep < 0) continue;
    for (let i = sep + 1; i < lines.length; i += 1) {
      if (/^##\s+/.test(lines[i])) break;
      if (/^\s*$/.test(lines[i])) continue;
      if (/^\s*\|/.test(lines[i])) return { column: h.key, rowIdx: i };
      break;
    }
  }
  return null;
}

/** 数「已完成」「等你」这类没有代号列的行时，标题列下标会因为表头不同而变；验收只需要行数。 */

function startServer(env) {
  const child = spawn(process.execPath, [SERVER], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  let err = '';
  child.stderr.on('data', (b) => { err += b; });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`服务 8 秒没起来。stderr:\n${err}`)), 8000);
    child.stdout.on('data', (buf) => {
      out += buf.toString('utf8');
      const m = /\[ready\]\s+(http:\/\/\S+)/.exec(out);
      if (m) { clearTimeout(timer); resolve(m[1].replace(/\/$/, '')); }
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`服务提前退出（code=${code}）。输出:\n${out}\n${err}`));
    });
  });
  return { child, ready, log: () => out, stop: () => child.kill() };
}

async function getJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  const body = await res.json();
  return { res, body };
}

async function postJson(url, route, payload) {
  const res = await fetch(url + route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  return { res, body };
}

async function readJsonl(file) {
  try {
    const text = await readFile(file, 'utf8');
    return text.split(/\r?\n/).filter(Boolean).map((line) => {
      try { return JSON.parse(line); } catch { return { raw: line }; }
    });
  } catch (err) {
    if (err && err.code === 'ENOENT') return [];
    throw err;
  }
}

// ── 决策夹具（固定内容，不依赖真实 md 今天写到哪） ──
const FIXTURE_BOARD = `# 任务看板

> 最后更新：2026-11-28 08:00

## 二、等你（按优先级）

| # | 项 | 等什么 | 选项 |
| --- | --- | --- | --- |
| 1 | 甲决策 | 等一句话 | A 锁 720（推荐），B 三栏 |
| 2 | 乙决策 | 等一句话 | A 甲方案, B 乙方案 |
| 3 | 只有评论 | 等一句话 | |
`;

const FIXTURE_BOARD_NO_OPTIONS = `# 任务看板

> 最后更新：2026-11-28 08:00

## 二、等你（按优先级）

| # | 项 | 等什么 |
| --- | --- | --- |
| 1 | 没有选项列的行 | 等一句话 |
`;

const FIXTURE_DECISIONS = `# 待决策与问答追溯

## 一、现在等你拍板（2 条）

| 编号 | 谁问的 | 问题 | 我的建议 | 状态 | 提出时间 | 选项 |
| --- | --- | --- | --- | --- | --- | --- |
| Q-901 | T | 夹具问题一 | 建议甲 | 🔵 等你 | 08:00 | A 加回（推荐）, B 保持 |
| Q-902 | T | 夹具问题二 | 建议乙 | ⚪ 待回传 | 08:00 | A 好, B 不好 |
| Q-903 | T | 已关闭的不该出现在清单里 | 已办 | 🟢 已关闭 | 08:00 | |

## 三、已关闭（有结论、有据可查）

| 编号 | 谁问的 | 问题 | 结论 | 关闭时间 |
| --- | --- | --- | --- | --- |
| Q-904 | T | 早关了 | 已办 | 08:00 |
`;

/** 决策夹具站点：md 与 jsonl 都落在临时目录，绝不碰 docs/。 */
async function makeDecideSite(name, boardText, decisionsText) {
  const dir = path.join(tmpDir, `decide-${name}`);
  await mkdir(dir, { recursive: true });
  const progress = path.join(dir, '进度');
  await mkdir(progress, { recursive: true });
  const board = path.join(dir, '任务看板.md');
  const decisions = path.join(dir, '待决策.md');
  await writeFile(board, boardText, 'utf8');
  if (decisionsText != null) await writeFile(decisions, decisionsText, 'utf8');
  return { dir, board, decisions, progress, log: path.join(progress, '决策.jsonl') };
}

// ───────────────────────────── 开始 ─────────────────────────────
const boardText = await readFile(BOARD, 'utf8');
const boardHash = sha(boardText);
const boardStat = await stat(BOARD);
const perRows = countRows(boardText);
const expectedTotal = Object.values(perRows).reduce((a, b) => a + b, 0);
const servers = [];
let tmpDir = null;

try {
  step(1, 10, '默认服务：node tools/workbench/server.mjs → /api/board 与 md 行数一致');
  const a = startServer({ PORT: String(BASE_PORT), WORKBENCH_BOARD: '' });
  servers.push(a);
  const urlA = await a.ready;
  ok(`服务启动：${urlA}`);
  const { res, body } = await getJson(urlA + '/api/board');
  if (res.status !== 200) bad(`/api/board 状态码 ${res.status}`);
  if (body.source.sha256 !== boardHash) {
    bad(`sha256 与 docs/任务看板.md 不一致：接口 ${body.source.sha256} / 文件 ${boardHash}（检查期间看板被改了？重跑一次）`);
  } else {
    ok(`sha256 与文件字节一致：${boardHash.slice(0, 12)}…`);
  }
  const expectedStr = COLUMN_HEADS.map((c) => `${c.label}=${perRows[c.key] || 0}`).join(' ');
  const actualStr = COLUMN_HEADS.map((c) => `${c.label}=${body.counts[c.key]}`).join(' ');
  if (body.counts.total === expectedTotal) ok(`任务条数 ${body.counts.total} == md 表格行数 ${expectedTotal}（${expectedStr}）`);
  else bad(`任务条数 ${body.counts.total} != md 表格行数 ${expectedTotal}（接口 ${actualStr} / md ${expectedStr}）`);
  for (const c of COLUMN_HEADS) {
    if ((body.counts[c.key] || 0) !== (perRows[c.key] || 0)) bad(`${c.label} 列条数不一致：接口 ${body.counts[c.key]} / md ${perRows[c.key]}`);
  }

  step(2, 10, '接口字段固定：每条任务都有代号/任务/派给/状态/更新时间');
  const tasks = body.columns.flatMap((c) => c.tasks);
  const missing = tasks.filter((t) =>
    !t.id || !t.title || !t.updatedAt || !SYMBOLS.includes(t.status) || !t.statusKey || !t.statusLabel ||
    !t.decideId || !Array.isArray(t.options));
  if (missing.length) bad(`${missing.length} 条任务缺字段，例：${JSON.stringify(missing[0])}`);
  else ok(`${tasks.length} 条任务字段齐全（id/title/status/statusKey/statusLabel/updatedAt/assignee/blocker/decideId/options）`);
  const noStatus = tasks.filter((t) => !SYMBOLS.includes(t.status));
  if (noStatus.length) bad(`有任务状态符号不在 🟡🔵⚪🟢🔴 里：${noStatus.map((t) => t.title).join('、')}`);

  step(3, 10, '前端：单文件、无外网依赖、四列都在');
  const htmlRes = await fetch(urlA + '/', { cache: 'no-store' });
  const html = await htmlRes.text();
  if (htmlRes.status === 200 && html.includes('任务看板')) ok('GET / 返回 200 且是工作台页面');
  else bad(`GET / 异常：${htmlRes.status}`);
  const missingCols = ['doing', 'waiting', 'done', 'backlog'].filter((k) => !html.includes(`data-col="${k}"`));
  if (missingCols.length) bad(`页面里没有这些列：${missingCols.join(', ')}`);
  else ok('页面包含 进行中/等你/已完成/待派 四列');
  if (/https?:\/\//.test(html)) bad('页面里出现了外网地址，违反"纯本地"约束');
  else ok('页面无 http(s) 外链，无 CDN/字体依赖');
  if (/<script[^>]+src=/.test(html)) bad('页面引用了外部脚本');
  else ok('脚本与样式全部内联');
  if (/setInterval\(load,\s*REFRESH_MS\)/.test(html) && /REFRESH_MS\s*=\s*5000/.test(html)) ok('5 秒轮询 /api/board');
  else bad('没找到 5 秒刷新逻辑');
  if (html.includes("'/api/decide'") && html.includes('optbtn') && html.includes('data-act="decide"')) {
    ok('页面带快速决策：选项按钮 + 备注框 + POST /api/decide');
  } else {
    bad('页面里没找到决策按钮/接口（optbtn / data-act="decide" / /api/decide）');
  }

  step(4, 10, '端口占用自动 +1，并打印实际地址');
  const b = startServer({ PORT: String(BASE_PORT), WORKBENCH_BOARD: '' });
  servers.push(b);
  const urlB = await b.ready;
  const portA = Number(new URL(urlA).port);
  const portB = Number(new URL(urlB).port);
  if (portB === portA + 1) ok(`${BASE_PORT} 被占用，第二个实例自动用 ${portB}：${urlB}`);
  else bad(`第二个实例端口 ${portB}，预期 ${portA + 1}`);
  const bHealth = await getJson(urlB + '/api/board').then(() => true).catch(() => false);
  if (bHealth) ok(`+1 后的地址可访问：${urlB}/api/board`);
  else bad(`+1 后的地址不可访问：${urlB}`);
  b.stop();

  step(5, 10, '读的是 md 而不是缓存：改一份副本的状态符号，5 秒内接口跟着变');
  const current = await readFile(BOARD, 'utf8'); // 重新取一次，避免并发编辑导致前后不一致
  tmpDir = await mkdtemp(path.join(tmpdir(), 'workbench-check-'));
  const copy = path.join(tmpDir, '任务看板.md');
  await writeFile(copy, current, 'utf8');
  const c = startServer({ PORT: String(BASE_PORT + 10), WORKBENCH_BOARD: copy });
  servers.push(c);
  const urlC = await c.ready;
  ok(`副本服务：${urlC}（数据源 ${copy}）`);

  const before = await getJson(urlC + '/api/board');
  const lines = current.split('\n');
  const target = pickFirstRow(lines); // 四个章节里第一张有数据行的表的第一行
  if (!target) {
    bad('副本里四张表都没有数据行，没法测状态变化');
  } else {
    const { column, rowIdx } = target;
    const originalLine = lines[rowIdx];
    const beforeTask = before.body.columns.find((col) => col.key === column)?.tasks[0];
    if (!beforeTask) {
      bad(`「${column}」列在接口里没有任务，没法测状态变化`);
    } else {
      const beforeStatus = beforeTask.status;
      const beforeKey = beforeTask.statusKey;
      const targetKey = beforeKey === 'blocked' ? 'doing' : 'blocked';
      const targetSym = STATUS_BY_KEY[targetKey];
      // 先把这一行所有状态符号去掉，再在末尾放目标符号：避免行内原本有多个符号时改不干净
      lines[rowIdx] = originalLine.replace(/[🟡🔵⚪🟢🔴]/g, '')
        .replace(/\|\s*$/, '')
        .trimEnd() + ` ${targetSym} |`;
      await writeFile(copy, lines.join('\n'), 'utf8');
      const changedAt = Date.now();
      let latest = null;
      let switched = false;
      let elapsed = 0;
      while (Date.now() - changedAt < 6000) {
        latest = (await getJson(urlC + '/api/board')).body;
        const t = latest.columns.find((col) => col.key === column)?.tasks[0];
        if (t && t.statusKey === targetKey) { switched = true; elapsed = Date.now() - changedAt; break; }
        await sleep(300);
      }
      if (!switched) {
        const t = latest && latest.columns.find((col) => col.key === column)?.tasks[0];
        bad(`改符号后 6 秒内接口没变（仍是 ${t && t.status}）`);
      } else {
        ok(`${elapsed} ms 内接口切到 ${targetSym}（${beforeStatus} → ${targetSym}），源哈希 ${latest.source.sha256 === sha(lines.join('\n')) ? '同步' : '不一致'}`);
        if (latest.counts.total === before.body.counts.total) ok(`条数不变（${latest.counts.total} 条）：只换符号不动表格结构`);
        else bad(`改符号后条数变了：${before.body.counts.total} → ${latest.counts.total}`);
        if (elapsed < 5000) ok(`刷新延迟 ${elapsed} ms < 5000 ms，满足"5 秒内面板跟着变"`);
        else bad(`刷新延迟 ${elapsed} ms，超过 5 秒`);
      }
      // 整行原样写回，验一次双向
      lines[rowIdx] = originalLine;
      await writeFile(copy, lines.join('\n'), 'utf8');
      const revertedAt = Date.now();
      let reverted = false;
      while (Date.now() - revertedAt < 6000) {
        const again = (await getJson(urlC + '/api/board')).body;
        const t = again.columns.find((col) => col.key === column)?.tasks[0];
        if (t && t.status === beforeStatus) { reverted = true; break; }
        await sleep(300);
      }
      if (reverted) ok('整行写回原样也在 6 秒内生效（可双向刷新）');
      else bad('还原后接口没恢复');
    }
  }

  step(6, 10, '真实看板文件未被改动（验收只碰副本）');
  const afterText = await readFile(BOARD, 'utf8');
  const afterStat = await stat(BOARD);
  if (sha(afterText) === boardHash && afterStat.mtimeMs === boardStat.mtimeMs) ok('docs/任务看板.md 字节与 mtime 均未变化');
  else bad('docs/任务看板.md 被改动了！');

  step(7, 10, '「选项」列解析：中文逗号 / 英文逗号 /（推荐）/ 没有这一列都不报错');
  {
    const site = await makeDecideSite('parse', FIXTURE_BOARD, FIXTURE_DECISIONS);
    const d = startServer({
      PORT: String(BASE_PORT + 20),
      WORKBENCH_BOARD: site.board,
      WORKBENCH_DECISIONS: site.decisions,
      WORKBENCH_PROGRESS: site.progress,
    });
    servers.push(d);
    const urlD = await d.ready;
    const { res, body } = await getJson(urlD + '/api/board');
    if (res.status !== 200) bad(`夹具 /api/board 状态码 ${res.status}`);
    const tasks = body.columns.flatMap((c) => c.tasks);
    const byTitle = new Map(tasks.map((t) => [t.title, t]));

    const cn = byTitle.get('甲决策');
    if (!cn) {
      bad('夹具里的「甲决策」没解析出来');
    } else if (cn.options.length !== 2 || cn.options[0].key !== 'A' || cn.options[1].key !== 'B') {
      bad(`中文逗号选项没拆对：${JSON.stringify(cn.options)}`);
    } else if (!cn.options[0].recommended || cn.options[1].recommended) {
      bad(`（推荐）标记不对：${JSON.stringify(cn.options)}`);
    } else {
      ok(`中文逗号拆出 ${cn.options.length} 项：${cn.options.map((o) => o.key + ' ' + o.label).join(' / ')}（推荐只标 A）`);
    }

    const en = byTitle.get('乙决策');
    if (!en || en.options.length !== 2 || en.options.map((o) => o.key).join('') !== 'AB') {
      bad(`英文逗号选项没拆对：${JSON.stringify(en && en.options)}`);
    } else {
      ok(`英文逗号也拆出 ${en.options.length} 项：${en.options.map((o) => o.key).join('/')}`);
    }

    const blank = byTitle.get('只有评论');
    if (!blank || blank.options.length !== 0) bad(`空的「选项」格应当解析成 0 项：${JSON.stringify(blank && blank.options)}`);
    else ok('「选项」格为空 = 0 项（卡片只剩评论框，不报错）');

    if (!cn || !/^b[0-9a-f]{10}$/.test(cn.decideId || '')) bad(`看板行没有标题稳定 hash 的 decideId：${cn && cn.decideId}`);
    else ok(`看板行的决策 id = 标题 hash：${cn.decideId}`);
    d.stop();

    // 老看板根本没有「选项」列：照常返回，options 一律空
    const plain = await makeDecideSite('noopt', FIXTURE_BOARD_NO_OPTIONS, null);
    const e = startServer({
      PORT: String(BASE_PORT + 21),
      WORKBENCH_BOARD: plain.board,
      WORKBENCH_PROGRESS: plain.progress,
    });
    servers.push(e);
    const urlE = await e.ready;
    const plainRes = await getJson(urlE + '/api/board');
    const plainTask = plainRes.body.columns.flatMap((c) => c.tasks)[0];
    if (plainRes.res.status !== 200) bad(`没有「选项」列时 /api/board 挂了：${plainRes.res.status}`);
    else if (!plainTask || (plainTask.options || []).length !== 0) bad(`没有「选项」列时 options 应为空：${JSON.stringify(plainTask && plainTask.options)}`);
    else ok('没有「选项」列的老看板照常返回，options=[]（不报错）');
    e.stop();
  }

  step(8, 10, 'POST /api/decide：只追加 决策.jsonl、非法选项被拒、空提交被拒、md 一个字都不改');
  {
    const site = await makeDecideSite('write', FIXTURE_BOARD, FIXTURE_DECISIONS);
    const s = startServer({
      PORT: String(BASE_PORT + 22),
      WORKBENCH_BOARD: site.board,
      WORKBENCH_DECISIONS: site.decisions,
      WORKBENCH_PROGRESS: site.progress,
    });
    servers.push(s);
    const url = await s.ready;
    const boardBefore = await readFile(site.board, 'utf8');
    const { body } = await getJson(url + '/api/board');
    const task = body.columns.flatMap((c) => c.tasks).find((t) => t.title === '甲决策');

    const first = await postJson(url, '/api/decide', { id: task.decideId, option: 'a', note: '三栏太慢先止血' });
    if (first.res.status !== 200 || !first.body || !first.body.ok) {
      bad(`决策没写成功：${first.res.status} ${JSON.stringify(first.body)}`);
    } else if (first.body.record.kind !== 'decision' || first.body.record.option !== 'A' || !first.body.record.at) {
      bad(`写回的记录不对：${JSON.stringify(first.body.record)}`);
    } else {
      ok(`决策已写（小写 a 也认）：${JSON.stringify(first.body.record)}`);
    }

    let lines = await readJsonl(site.log);
    if (lines.length === 1 && lines[0].option === 'A' && lines[0].note === '三栏太慢先止血') {
      ok(`决策.jsonl 追加 1 行，只有追加没有覆盖：${site.log}`);
    } else {
      bad(`决策.jsonl 内容不对：${JSON.stringify(lines)}`);
    }
    if (lines[0] && /任务看板\.md$/.test(lines[0].source || '')) ok(`记录里写清来源：${lines[0].source}`);
    else bad(`记录里没写清来源：${JSON.stringify(lines[0])}`);

    const afterDecide = await getJson(url + '/api/board');
    const decidedTask = afterDecide.body.columns.flatMap((c) => c.tasks).find((t) => t.title === '甲决策');
    if (decidedTask && decidedTask.decision && decidedTask.decision.option === 'A') {
      ok(`决策后 /api/board 能读到 decision：${JSON.stringify(decidedTask.decision)}`);
    } else {
      bad(`决策后 /api/board 没带 decision：${JSON.stringify(decidedTask && decidedTask.decision)}`);
    }

    const badOption = await postJson(url, '/api/decide', { id: task.decideId, option: 'Z' });
    if (badOption.res.status === 400 && badOption.body && badOption.body.error === 'option_not_declared') {
      ok(`非法选项被拒（400 option_not_declared）：${badOption.body.message}`);
    } else {
      bad(`非法选项没被拒：${badOption.res.status} ${JSON.stringify(badOption.body)}`);
    }

    const empty = await postJson(url, '/api/decide', { id: task.decideId });
    if (empty.res.status === 400 && empty.body && empty.body.error === 'empty_decision') {
      ok(`空选项 + 空备注被拒（400 empty_decision）`);
    } else {
      bad(`空提交没被拒：${empty.res.status} ${JSON.stringify(empty.body)}`);
    }

    const missing = await postJson(url, '/api/decide', { id: 'no-such-row', option: 'A' });
    if (missing.res.status === 404) ok('md 里没有的 id → 404 row_not_found（不会写脏数据）');
    else bad(`不存在的 id 返回 ${missing.res.status}，预期 404`);

    const comment = await postJson(url, '/api/decide', { id: task.decideId, note: '只写一句评论' });
    if (comment.res.status === 200 && comment.body && comment.body.record.kind === 'comment' && !('option' in comment.body.record)) {
      ok(`只填备注 = 评论：${JSON.stringify(comment.body.record)}`);
    } else {
      bad(`评论没写对：${comment.res.status} ${JSON.stringify(comment.body && comment.body.record)}`);
    }

    lines = await readJsonl(site.log);
    if (lines.length === 2 && lines[1].kind === 'comment') ok(`决策.jsonl 2 行（决策 1 + 评论 1），仍是只追加`);
    else bad(`决策.jsonl 行数不对：${JSON.stringify(lines)}`);

    const afterComment = await getJson(url + '/api/board');
    const commented = afterComment.body.columns.flatMap((c) => c.tasks).find((t) => t.title === '甲决策');
    if (commented && commented.decision && commented.decision.kind === 'comment' && commented.decision.note === '只写一句评论') {
      ok('评论后 /api/board 的 decision 更新成最新那条（kind=comment）');
    } else {
      bad(`评论后 /api/board 的 decision 不对：${JSON.stringify(commented && commented.decision)}`);
    }

    const boardAfter = await readFile(site.board, 'utf8');
    if (boardAfter === boardBefore) ok('决策/评论没有改动看板 md（字节完全一致）');
    else bad('看板 md 被决策接口改了！');
    s.stop();
  }

  step(9, 10, '待决策.md 的 Q-xxx：已关闭的不进清单、能点能评论、刷新后带 decision');
  {
    const site = await makeDecideSite('q', FIXTURE_BOARD, FIXTURE_DECISIONS);
    const s = startServer({
      PORT: String(BASE_PORT + 23),
      WORKBENCH_BOARD: site.board,
      WORKBENCH_DECISIONS: site.decisions,
      WORKBENCH_PROGRESS: site.progress,
    });
    servers.push(s);
    const url = await s.ready;
    const { body } = await getJson(url + '/api/board');
    const pending = body.pendingDecisions || {};
    const ids = (pending.items || []).map((i) => i.id);
    if (!pending.available) {
      bad('pendingDecisions 不可用（夹具 待决策.md 没读到）');
    } else if (pending.items.length !== 2 || !ids.includes('Q-901') || !ids.includes('Q-902')) {
      bad(`待决策清单不对：${ids.join('、')}`);
    } else {
      ok(`待决策清单 2 条（${ids.join('、')}）：🟢 已关闭的 Q-903、已关闭章节的 Q-904 都没混进来`);
    }
    const q901 = pending.items.find((i) => i.id === 'Q-901');
    if (q901 && q901.options.length === 2 && q901.options[0].recommended && q901.options[0].key === 'A') {
      ok(`Q-901 的选项带推荐：${q901.options.map((o) => o.text).join(' / ')}`);
    } else {
      bad(`Q-901 选项解析不对：${JSON.stringify(q901 && q901.options)}`);
    }

    const vote = await postJson(url, '/api/decide', { id: 'Q-901', option: 'A' });
    if (vote.res.status === 200 && vote.body.record.kind === 'decision' && /待决策\.md$/.test(vote.body.record.source || '')) {
      ok(`Q-901 决策已写，来源 ${vote.body.record.source}`);
    } else {
      bad(`Q-901 决策没写对：${vote.res.status} ${JSON.stringify(vote.body)}`);
    }
    const illegal = await postJson(url, '/api/decide', { id: 'Q-901', option: 'C' });
    if (illegal.res.status === 400 && illegal.body && illegal.body.error === 'option_not_declared') {
      ok('Q-901 没声明的选项 C 被拒（校验真的读 md，不是照单全收）');
    } else {
      bad(`Q-901 的非法选项没被拒：${illegal.res.status} ${JSON.stringify(illegal.body)}`);
    }
    const note = await postJson(url, '/api/decide', { id: 'Q-902', note: '先记一句，回头再定' });
    if (note.res.status === 200 && note.body.record.kind === 'comment') ok('Q-902 只填备注 = 评论');
    else bad(`Q-902 评论没写对：${note.res.status} ${JSON.stringify(note.body)}`);

    const again = await getJson(url + '/api/board');
    const items = again.body.pendingDecisions.items;
    const d901 = items.find((i) => i.id === 'Q-901');
    const d902 = items.find((i) => i.id === 'Q-902');
    if (d901 && d901.decision && d901.decision.option === 'A') ok('刷新后 Q-901 带 decision A（来自 决策.jsonl）');
    else bad(`刷新后 Q-901 的 decision 不对：${JSON.stringify(d901 && d901.decision)}`);
    if (d902 && d902.decision && d902.decision.kind === 'comment') ok('刷新后 Q-902 带 decision（kind=comment）');
    else bad(`刷新后 Q-902 的 decision 不对：${JSON.stringify(d902 && d902.decision)}`);

    const docText = await readFile(site.decisions, 'utf8');
    if (docText === FIXTURE_DECISIONS) ok('待决策.md 一个字没改（md 仍是唯一权威，工作台只写事件流）');
    else bad('待决策.md 被决策接口改了！');
    s.stop();

    // 真实入口也验一遍：不依赖具体内容，只要还能读出清单结构
    const real = await getJson(urlA + '/api/board');
    const realPending = real.body.pendingDecisions || {};
    const broken = (realPending.items || []).filter((i) => !i.id || !Array.isArray(i.options) || !i.source);
    if (realPending.available && !broken.length) {
      ok(`真实 docs/待决策.md 读出 ${realPending.items.length} 条待决策，字段齐全（来源 ${realPending.source}）`);
    } else {
      bad(`真实 docs/待决策.md 的清单结构不对：${JSON.stringify(broken[0] || realPending)}`);
    }
  }

  step(10, 10, '总结');
  if (failures === 0) {
    console.log(`\nPASS 全部通过（任务 ${expectedTotal} 条，四列 ${Object.values(perRows).join('/')}）`);
  } else {
    console.error(`\nFAIL：${failures} 项没通过`);
  }
} catch (err) {
  console.error('\n[check] 异常：', err && err.stack ? err.stack : err);
  failures += 1;
} finally {
  for (const s of servers) s.stop();
  if (tmpDir) {
    if (path.resolve(tmpDir).startsWith(path.resolve(tmpdir()))) await rm(tmpDir, { recursive: true, force: true });
  }
  await rm(process.env.WORKBENCH_TIMER_DIR, { recursive: true, force: true }).catch(() => {});
  process.exitCode = failures === 0 ? 0 : 1;
}
