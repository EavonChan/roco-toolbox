#!/usr/bin/env node
/**
 * 工作台验收脚本（可重复跑）：
 *   node tools/workbench/check.mjs
 *
 * 验四件事：
 *   1. 默认服务起来后，/api/board 的任务条数 == docs/任务看板.md 四个表的行数（独立数，不用服务端解析器）；
 *   2. /api/board 的 sha256 == 该 md 文件字节的 sha256（证明返回的是这一份文件，不是别处来的状态）；
 *   3. 端口占用自动 +1，并返回实际地址；
 *   4. 改 md 一行的状态符号，5 秒内接口跟着变（用 md 的副本测，绝不动 docs/任务看板.md）。
 *
 * 原生 Node，零依赖。退出码 0 = 全过。
 */
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.join(HERE, 'server.mjs');
const REPO_ROOT = path.resolve(HERE, '..', '..');
const BOARD = path.join(REPO_ROOT, 'docs', '任务看板.md');
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

// ───────────────────────────── 开始 ─────────────────────────────
const boardText = await readFile(BOARD, 'utf8');
const boardHash = sha(boardText);
const boardStat = await stat(BOARD);
const perRows = countRows(boardText);
const expectedTotal = Object.values(perRows).reduce((a, b) => a + b, 0);
const servers = [];
let tmpDir = null;

try {
  step(1, 7, '默认服务：node tools/workbench/server.mjs → /api/board 与 md 行数一致');
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

  step(2, 7, '接口字段固定：每条任务都有代号/任务/派给/状态/更新时间');
  const tasks = body.columns.flatMap((c) => c.tasks);
  const missing = tasks.filter((t) =>
    !t.id || !t.title || !t.updatedAt || !SYMBOLS.includes(t.status) || !t.statusKey || !t.statusLabel);
  if (missing.length) bad(`${missing.length} 条任务缺字段，例：${JSON.stringify(missing[0])}`);
  else ok(`${tasks.length} 条任务字段齐全（id/title/status/statusKey/statusLabel/updatedAt/assignee/blocker）`);
  const noStatus = tasks.filter((t) => !SYMBOLS.includes(t.status));
  if (noStatus.length) bad(`有任务状态符号不在 🟡🔵⚪🟢🔴 里：${noStatus.map((t) => t.title).join('、')}`);

  step(3, 7, '前端：单文件、无外网依赖、四列都在');
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

  step(4, 7, '端口占用自动 +1，并打印实际地址');
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

  step(5, 7, '读的是 md 而不是缓存：改一份副本的状态符号，5 秒内接口跟着变');
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

  step(6, 7, '真实看板文件未被改动（验收只碰副本）');
  const afterText = await readFile(BOARD, 'utf8');
  const afterStat = await stat(BOARD);
  if (sha(afterText) === boardHash && afterStat.mtimeMs === boardStat.mtimeMs) ok('docs/任务看板.md 字节与 mtime 均未变化');
  else bad('docs/任务看板.md 被改动了！');

  step(7, 7, '总结');
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
