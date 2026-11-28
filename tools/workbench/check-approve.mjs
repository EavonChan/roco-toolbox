#!/usr/bin/env node
/**
 * W2 验收脚本（可重复跑）：
 *   node tools/workbench/check-approve.mjs
 *
 * 验七件事：
 *   1. 会话视图行数 == docs/会话台账.md 现役会话数（独立数，不用服务端解析器）；
 *   2. 「确认已完成」（接口）→ 看板该行变 🟢、审批.jsonl 多一行、快照存在、接口 5 秒内同步；
 *   3. 面板上点「确认已完成」→ 卡片 5 秒内变 🟢，且不是整页刷新；
 *   4. 面板上点「打回」→ 变 🔴 并显示红色阻塞条，备注写进审批日志；
 *   5. 只读副本上审批 → 报错、看板内容不变、日志不增行；
 *   6. 卡片详情：新列「详情」有时给链接，没有该列时不报错；展开能看到完整字段；
 *   7. 375 / 1440 截图（任务 + 会话）落 docs/preview/W2-*.png。
 *
 * 除了截图和最后一步打印之外，全部在 %TEMP% 的副本上做，绝不写 docs/任务看板.md 与 docs/进度/。
 * 依赖仓库已有的 playwright；工作台本身零依赖。
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  readFile, writeFile, mkdtemp, rm, stat, chmod, mkdir, readdir,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.join(HERE, 'server.mjs');
const REPO_ROOT = path.resolve(HERE, '..', '..');
const BOARD = path.join(REPO_ROOT, 'docs', '任务看板.md');
const LEDGER = path.join(REPO_ROOT, 'docs', '会话台账.md');
const PROGRESS = path.join(REPO_ROOT, 'docs', '进度');
const PREVIEW = path.join(REPO_ROOT, 'docs', 'preview');
const BASE_PORT = Number(process.env.CHECK_APPROVE_PORT || 4481);
// 页面加载时会打计时器心跳；指到临时目录，绝不碰用户真实的 ~/.workbench/timer/
process.env.WORKBENCH_TIMER_DIR = path.join(tmpdir(), `wb-timer-check-approve-${process.pid}`);
const SYMBOL_RE = /[\u{1F7E1}\u{1F535}\u{26AA}\u{1F7E2}\u{1F534}]/u;
const STAGES = ['待派', '执行中', '已交付', '已验收', '已收口'];
const COLUMN_HEADS = [
  { key: 'doing', re: /进行中/ },
  { key: 'waiting', re: /等你/ },
  { key: 'done', re: /已完成/ },
  { key: 'backlog', re: /待派|backlog/i },
];
const SNAPSHOT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.md$/;

let failures = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const bad = (msg) => { failures += 1; console.error(`  ✗ ${msg}`); };
const step = (n, total, msg) => console.log(`\n[${n}/${total}] ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (text) => createHash('sha256').update(text).digest('hex');

// ───────────────────────────── 独立解析（只用来看"对不对"） ─────────────────────────────

/** 数「现役会话」表的数据行：找表头（下一行是分隔线），数到非表格行为止，容忍空行。 */
function countLedgerRows(text, headingRe) {
  const lines = text.split(/\r?\n/);
  let heading = null;
  let rows = 0;
  let coded = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^##\s+/.test(line)) { heading = line; continue; }
    if (!heading || !headingRe.test(heading)) continue;
    if (!/^\s*\|/.test(line)) continue;
    if (i + 1 >= lines.length || !/^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) || !lines[i + 1].includes('-')) continue;
    let j = i + 2;
    while (j < lines.length) {
      if (/^\s*\|/.test(lines[j])) {
        rows += 1;
        const first = lines[j].trim().replace(/^\|/, '').split('|')[0].replace(/[`*\s]/g, '');
        if (first && first !== '—' && first !== '-') coded += 1;
        j += 1;
        continue;
      }
      if (/^\s*$/.test(lines[j])) { j += 1; continue; }
      break;
    }
    i = j - 1;
  }
  return { rows, coded };
}

/** 判断计算出来的底色是不是「红底」：兼容 rgb()/rgba() 与 color(srgb …) 两种序列化。
 *  浅色主题的红色底是「白 + 8% 红」，比灰底红一点点就够；深色主题是 rgba(248,81,73,…)，两种都认。 */
function isReddish(color) {
  if (!color) return false;
  let rgb = null;
  const legacy = color.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (legacy) rgb = legacy.slice(1, 4).map(Number);
  if (!rgb) {
    const modern = color.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i);
    if (modern) rgb = modern.slice(1, 4).map((v) => Number(v) * 255);
  }
  if (!rgb) return false;
  const [r, g, b] = rgb;
  return r > g + 8 && r > b + 8;
}

/** 数四张任务表的数据行（和 check.mjs 同口径）。 */
function countBoardRows(text) {
  const lines = text.split(/\r?\n/);
  const per = {};
  let heading = null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^##\s+/.test(line)) { heading = line; continue; }
    const col = heading ? COLUMN_HEADS.find((c) => c.re.test(heading)) : null;
    if (!col) continue;
    if (!/^\s*\|/.test(line)) continue;
    if (i + 1 >= lines.length || !/^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1])) continue;
    let n = 0;
    let j = i + 2;
    while (j < lines.length) {
      if (/^\s*\|/.test(lines[j])) { n += 1; j += 1; continue; }
      if (/^\s*$/.test(lines[j])) { j += 1; continue; }
      break;
    }
    per[col.key] = (per[col.key] || 0) + n;
    i = j - 1;
  }
  return per;
}

/** 两份 md 的差异行：只看行内容，不错位。 */
function diffLines(before, after) {
  const a = before.split('\n');
  const b = after.split('\n');
  const out = [];
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if (a[i] !== b[i]) out.push({ line: i + 1, before: a[i], after: b[i] });
  }
  return out;
}

/** 找某个章节里的第一张表：表头 / 分隔线 / 数据行范围。 */
function findTable(lines, headingRe) {
  const start = lines.findIndex((l) => /^##\s+/.test(l) && headingRe.test(l));
  if (start < 0) return null;
  let sep = -1;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (/^##\s+/.test(lines[i])) break;
    if (/^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i]) && lines[i].includes('-')) { sep = i; break; }
  }
  if (sep < 1) return null;
  let end = sep + 1;
  while (end < lines.length && /^\s*\|/.test(lines[end])) end += 1;
  return { header: sep - 1, sep, firstRow: sep + 1, end };
}

function cellsOfRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

const rowOf = (cells) => `| ${cells.join(' | ')} |`;

/** 把「进行中」表的「详情」列设成给定值：有这列就改第一行，没这列就整列加上。 */
function withDetailValue(text, value, headingRe = /进行中/) {
  const lines = text.split('\n');
  const t = findTable(lines, headingRe);
  if (!t) return null;
  const header = cellsOfRow(lines[t.header]);
  const idx = header.findIndex((h) => /^详情/.test(h));
  if (idx >= 0) {
    const cells = cellsOfRow(lines[t.firstRow]);
    if (idx >= cells.length) return null;
    cells[idx] = value;
    lines[t.firstRow] = rowOf(cells);
    return lines.join('\n');
  }
  const add = (line, cell) => rowOf([...cellsOfRow(line), cell]);
  lines[t.header] = add(lines[t.header], '详情');
  lines[t.sep] = add(lines[t.sep], '---');
  for (let i = t.firstRow; i < t.end; i += 1) lines[i] = add(lines[i], value);
  return lines.join('\n');
}

/** 去掉「进行中」表的「详情」列（用来验"没有该列也不报错"）。 */
function withoutDetailColumn(text, headingRe = /进行中/) {
  const lines = text.split('\n');
  const t = findTable(lines, headingRe);
  if (!t) return null;
  const idx = cellsOfRow(lines[t.header]).findIndex((h) => /^详情/.test(h));
  if (idx < 0) return text;
  for (let i = t.header; i < t.end; i += 1) {
    const cells = cellsOfRow(lines[i]);
    if (cells.length > idx) cells.splice(idx, 1);
    lines[i] = rowOf(cells);
  }
  return lines.join('\n');
}

// ───────────────────────────── 进程与 HTTP ─────────────────────────────

const servers = [];
const tmpDirs = [];

/**
 * 起一个工作台实例。这台机器上偶尔会有别的东西把刚起来的 node 子进程杀掉
 * （exit code -1、没有任何 stderr），所以启动失败自动重试一次；真崩的会两次都失败。
 */
function startServer(env) {
  let out = '';
  let err = '';
  const handle = {
    child: null,
    ready: null,
    log: () => out,
    stop: () => { try { if (handle.child) handle.child.kill(); } catch (_) { /* 已退出 */ } },
  };
  const attempt = (n) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER], {
      cwd: REPO_ROOT,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    handle.child = child;
    let own = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { child.kill(); } catch (_) { /* 已退出 */ }
      reject(new Error(`服务 8 秒没起来。stderr:\n${err}`));
    }, 8000);
    child.stderr.on('data', (b) => { err += b; });
    child.stdout.on('data', (buf) => {
      const text = buf.toString('utf8');
      own += text;
      out += text;
      const m = /\[ready\]\s+(http:\/\/\S+)/.exec(own);
      if (m && !settled) {
        settled = true;
        clearTimeout(timer);
        resolve(m[1].replace(/\/$/, ''));
      }
    });
    child.on('exit', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (n < 1) {
        console.log(`  · 服务被提前终止（code=${code}${signal ? `，signal=${signal}` : ''}），自动重试一次`);
        attempt(n + 1).then(resolve, reject);
        return;
      }
      reject(new Error(`服务提前退出（code=${code}${signal ? `，signal=${signal}` : ''}）。输出:\n${out}\n${err}`));
    });
  });
  handle.ready = attempt(0);
  servers.push(handle);
  return handle;
}

async function getJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  const body = await res.json().catch(() => null);
  return { res, body };
}

async function postApprove(url, payload) {
  const res = await fetch(url + '/api/approve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  return { res, body };
}

async function makeSite(name, boardText, ledgerText) {
  const dir = await mkdtemp(path.join(tmpdir(), `wb-w2-${name}-`));
  tmpDirs.push(dir);
  const board = path.join(dir, '任务看板.md');
  const ledger = path.join(dir, '会话台账.md');
  const progress = path.join(dir, '进度');
  await writeFile(board, boardText, 'utf8');
  await writeFile(ledger, ledgerText, 'utf8');
  await mkdir(progress, { recursive: true });
  return { dir, board, ledger, progress };
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

async function listSnapshots(progress) {
  try {
    const files = await readdir(path.join(progress, 'snapshots'));
    return files.filter((f) => SNAPSHOT_RE.test(f));
  } catch (err) {
    if (err && err.code === 'ENOENT') return [];
    throw err;
  }
}

// ───────────────────────────── 浏览器 ─────────────────────────────

const browser = await chromium.launch();

async function openPage(url, opts = {}) {
  const page = await browser.newPage({ viewport: opts.viewport || { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto(url + (opts.hash || ''), { waitUntil: 'networkidle' });
  return { page, errors };
}

async function waitCardStatus(page, key, statusKey, timeout = 6500) {
  const t0 = Date.now();
  const locator = page.locator(`.card[data-key="${key}"]`);
  while (Date.now() - t0 < timeout) {
    const cur = await locator.getAttribute('data-status').catch(() => null);
    if (cur === statusKey) return Date.now() - t0;
    await sleep(120);
  }
  return -1;
}

// ───────────────────────────── 开始 ─────────────────────────────

const boardText = await readFile(BOARD, 'utf8');
const ledgerText = await readFile(LEDGER, 'utf8');
const boardHash = sha(boardText);
const ledgerHash = sha(ledgerText);
const boardRows = countBoardRows(boardText);
const activeSessions = countLedgerRows(ledgerText, /现役/);
const progressBefore = await (async () => {
  try { return (await readdir(PROGRESS)).sort().join(','); } catch { return ''; }
})();
let siteA = null;
let siteReadonly = null;
let approvedKey = null;

try {
  siteA = await makeSite('a', boardText, ledgerText);
  const A = startServer({
    PORT: String(BASE_PORT),
    WORKBENCH_BOARD: siteA.board,
    WORKBENCH_LEDGER: siteA.ledger,
    WORKBENCH_PROGRESS: siteA.progress,
  });
  const urlA = await A.ready;

  // ── 1 ──
  step(1, 8, '会话视图：行数 == 会话台账.md 现役会话数，字段齐全');
  {
    const { res, body } = await getJson(urlA + '/api/sessions');
    if (res.status !== 200 || !body) {
      bad(`/api/sessions 不可用：${res.status}`);
    } else {
      ok(`服务启动：${urlA}`);
      if (body.counts.total === activeSessions.rows) {
        ok(`会话行数 ${body.counts.total} == 台账现役表 ${activeSessions.rows} 行（其中有代号的 ${activeSessions.coded} 行）`);
      } else {
        bad(`会话行数 ${body.counts.total} != 台账现役表 ${activeSessions.rows} 行`);
      }
      if (body.source.sha256 === ledgerHash) ok(`台账 sha256 与 docs/会话台账.md 一致（${ledgerHash.slice(0, 12)}…）`);
      else bad('会话数据不是来自 docs/会话台账.md');
      const stages = new Set((body.stages || []).map((s) => s.label));
      const missingStages = STAGES.filter((s) => !stages.has(s));
      if (missingStages.length) bad(`阶段没给全，缺：${missingStages.join('、')}`);
      else ok(`五个阶段都在：${STAGES.join(' / ')}`);
      const broken = (body.sessions || []).filter((s) =>
        !s.id || !s.name || !s.stage || !STAGES.includes(s.stage.label) || !s.updatedAt || !s.ledgerStatus);
      if (broken.length) bad(`${broken.length} 个会话行缺字段，例：${JSON.stringify(broken[0]).slice(0, 200)}`);
      else ok(`${body.sessions.length} 个会话都有 代号/名字/阶段/最后活动/台账状态`);
      const withOutputs = (body.sessions || []).filter((s) => (s.outputs || []).length).length;
      ok(`产出链接可解析：${withOutputs} 个会话有可点的产出路径/URL`);

      const { page, errors } = await openPage(urlA, { hash: '#sessions' });
      await page.waitForSelector('.srow', { timeout: 10000 });
      const rows = await page.locator('.srow').count();
      if (rows === activeSessions.rows) ok(`页面上渲染 ${rows} 行会话，与台账一致`);
      else bad(`页面上 ${rows} 行会话，台账 ${activeSessions.rows} 行`);
      const stageTexts = await page.locator('.srow .stagechip').allInnerTexts();
      const badStage = stageTexts.map((s) => s.trim()).filter((s) => !STAGES.includes(s));
      if (badStage.length) bad(`页面上出现了不认识的阶段：${badStage.join('、')}`);
      else ok('每行都显示了阶段标签（待派/执行中/已交付/已验收/已收口）');
      if (errors.length) bad(`会话视图有页面错误：${errors.join(' | ')}`);
      await page.close();
    }
  }

  // ── 2 ──
  step(2, 8, '接口审批：点「确认已完成」→ 该行变 🟢 + 审批.jsonl 多一行 + 快照存在 + 5 秒内同步');
  {
    const before = await getJson(urlA + '/api/board');
    const task = before.body.columns.find((c) => c.key === 'doing').tasks[0];
    if (!task) {
      bad('进行中列没有任务，没法测审批');
    } else {
      const jsonlBefore = await readJsonl(path.join(siteA.progress, '审批.jsonl'));
      const snapsBefore = await listSnapshots(siteA.progress);
      const mdBefore = await readFile(siteA.board, 'utf8');

      const { res, body } = await postApprove(urlA, { id: task.id, action: 'approve' });
      if (res.status !== 200 || !body || !body.ok) {
        bad(`审批接口失败：${res.status} ${JSON.stringify(body).slice(0, 200)}`);
      } else {
        ok(`POST /api/approve {id:"${task.id}", action:"approve"} → 200`);
        const rec = body.record || {};
        const fieldsOk = rec.id === task.id && rec.action === 'approve' && 'note' in rec && rec.at && !Number.isNaN(Date.parse(rec.at));
        if (fieldsOk) ok(`回执字段齐全：id / action / note / at（${rec.at}）`);
        else bad(`回执字段不对：${JSON.stringify(rec)}`);

        const mdAfter = await readFile(siteA.board, 'utf8');
        const diff = diffLines(mdBefore, mdAfter);
        // 两种合法写法：行内原有 🟡 → 换成 🟢；行内本来没符号（「状态」列写的是「在跑」这类文字）→ 补一个 🟢。
        // 两种都要求"只动这一个符号、只动这一行"。
        const beforeLine = diff[0] ? diff[0].before : '';
        const afterLine = diff[0] ? diff[0].after : '';
        const onlySymbolAdded = afterLine.replace(/🟢\s?/, '') === beforeLine;
        const symbolReplaced = beforeLine.includes('🟡') && afterLine.replace('🟢', '🟡') === beforeLine;
        const lineOk = diff.length === 1 && afterLine.includes('🟢') && (onlySymbolAdded || symbolReplaced);
        if (lineOk) ok(`看板只有 1 行变化：${diff[0].before.trim().slice(0, 46)}… → 该行变 🟢`);
        else bad(`看板变化不对（${diff.length} 行）：${JSON.stringify(diff.map((d) => d.after)).slice(0, 200)}`);
        const rowsAfter = countBoardRows(mdAfter);
        if (JSON.stringify(rowsAfter) === JSON.stringify(boardRows)) ok(`表格结构没动：四列行数仍是 ${Object.values(rowsAfter).join('/')}`);
        else bad(`表格行数变了：${JSON.stringify(rowsAfter)}`);

        const jsonlAfter = await readJsonl(path.join(siteA.progress, '审批.jsonl'));
        const added = jsonlAfter.slice(jsonlBefore.length);
        if (added.length === 1 && added[0].id === task.id && added[0].action === 'approve') {
          ok(`审批.jsonl 追加 1 行：${JSON.stringify(added[0])}`);
        } else {
          bad(`审批.jsonl 增量不对：${JSON.stringify(added)}`);
        }

        const snapsAfter = await listSnapshots(siteA.progress);
        const newSnaps = snapsAfter.filter((f) => !snapsBefore.includes(f));
        if (newSnaps.length === 1) {
          const snapText = await readFile(path.join(siteA.progress, 'snapshots', newSnaps[0]), 'utf8');
          if (sha(snapText) === boardHash && snapText === mdBefore) ok(`快照 docs/进度/snapshots/${newSnaps[0]} 存的是改前内容（字节一致）`);
          else bad('快照内容不是改前的看板');
        } else {
          bad(`快照文件数不对：新增 ${newSnaps.length} 个`);
        }

        // 5 秒内接口跟上（面板轮询用的是同一个接口）
        const t0 = Date.now();
        let synced = false;
        let elapsed = 0;
        while (Date.now() - t0 < 6000) {
          const now = await getJson(urlA + '/api/board');
          const t = now.body.columns.flatMap((c) => c.tasks).find((x) => x.id === task.id);
          if (t && t.statusKey === 'done') { synced = true; elapsed = Date.now() - t0; break; }
          await sleep(150);
        }
        if (synced && elapsed <= 5000) ok(`${elapsed} ms 内 /api/board 已变成 🟢（面板 5 秒轮询会跟上）`);
        else bad(`接口 ${elapsed} ms 才同步（要求 ≤5000）`);
      }
    }
  }

  // ── 3 ──
  step(3, 8, '面板点「确认已完成」：卡片 5 秒内变 🟢，且不是整页刷新');
  {
    const { page, errors } = await openPage(urlA);
    await page.waitForSelector('.col[data-col="waiting"] .card[data-status="waiting"]', { timeout: 10000 });
    await page.evaluate(() => { window.__w2NoReload = 'kept'; });
    const card = page.locator('.col[data-col="waiting"] .card[data-status="waiting"]').first();
    const key = await card.getAttribute('data-key');
    const id = await card.getAttribute('data-id');
    approvedKey = key;
    const title = (await card.locator('.title').innerText()).trim();
    const approveLabel = (await card.locator('[data-act="approve"]').innerText()).trim();
    const rejectLabel = (await card.locator('[data-act="reject"]').innerText()).trim();
    if (approveLabel === '确认已完成' && rejectLabel === '打回') ok(`卡片上有两个审批按钮：「${approveLabel}」「${rejectLabel}」`);
    else bad(`审批按钮文案不对：${approveLabel} / ${rejectLabel}`);

    // 先验展开：完整字段 + 详情
    await card.locator('.title').click();
    const expanded = page.locator(`.card[data-key="${key}"]`);
    await page.waitForSelector(`.card[data-key="${key}"].is-open .card-more`, { timeout: 3000 });
    const kv = await expanded.locator('.card-more .kv dt').allInnerTexts();
    const need = ['任务', '派给', '开始', '最近进展', '下一步'];
    const missing = need.filter((n) => !kv.map((k) => k.trim()).includes(n));
    if (missing.length) bad(`展开后缺字段：${missing.join('、')}`);
    else ok(`卡片展开显示完整字段：${need.join(' / ')}`);
    const rawFields = await expanded.locator('table.fields tr').count();
    if (rawFields > 0) ok(`还能展开看板原始字段（${rawFields} 列）`);
    else bad('展开后没有原始字段表');
    const hasDetail = await expanded.locator('.kv dt', { hasText: '详情' }).count();
    ok(hasDetail ? '该行有「详情」列，展开后有详情链接' : '该行没有「详情」列（约定列缺失），只显示现有字段、不报错');

    // 再点审批
    const mdBefore = await readFile(siteA.board, 'utf8');
    const jsonlBefore = await readJsonl(path.join(siteA.progress, '审批.jsonl'));
    const snapsBefore = await listSnapshots(siteA.progress);
    const t0 = Date.now();
    await page.locator(`.card[data-key="${key}"] [data-act="approve"]`).click();
    const took = await waitCardStatus(page, key, 'done');
    if (took >= 0 && took <= 5200) ok(`点按钮后 ${took} ms 卡片变 🟢（「${title}」，id=${id}）`);
    else bad(`点按钮后 ${took < 0 ? '6 秒内没变' : took + ' ms 才变'}（预算 5000 ms）`);

    const alive = await page.evaluate(() => window.__w2NoReload === 'kept');
    if (alive) ok('没有整页刷新（window 标记还在），只重拉了 /api/board');
    else bad('页面发生了整页刷新');

    const mdAfter = await readFile(siteA.board, 'utf8');
    const diff = diffLines(mdBefore, mdAfter);
    if (diff.length === 1 && diff[0].after.includes('🟢')) ok('面板这一下真的写进了 md（1 行变化，🟢）');
    else bad(`面板审批后 md 变化不对：${diff.length} 行`);
    const jsonlAfter = await readJsonl(path.join(siteA.progress, '审批.jsonl'));
    if (jsonlAfter.length === jsonlBefore.length + 1) ok(`审批.jsonl ${jsonlBefore.length} → ${jsonlAfter.length} 行`);
    else bad(`审批.jsonl 行数没按预期增加`);
    const snapsAfter = await listSnapshots(siteA.progress);
    if (snapsAfter.length === snapsBefore.length + 1) ok(`快照多了一个：${snapsAfter.filter((f) => !snapsBefore.includes(f))[0]}`);
    else bad('快照没有按预期新增');

    // 标题里带 🔴 的行（真实看板就有，当"这条要紧"的标记用）：审批只能写状态位，绝不许改标题
    const all = (await getJson(urlA + '/api/board')).body.columns.flatMap((c) => c.tasks);
    const titled = all.find((t) => t.statusKey === 'blocked' && /^[🔴🟡🔵⚪🟢]/.test(t.title));
    if (!titled) {
      ok('（当前看板没有"标题里带状态符号"的行，跳过标题保护检查）');
    } else {
      const beforeTitle = await readFile(siteA.board, 'utf8');
      const { res, body } = await postApprove(urlA, { id: titled.id, key: titled.key, action: 'approve' });
      const afterTitle = await readFile(siteA.board, 'utf8');
      const d = diffLines(beforeTitle, afterTitle);
      const titleKept = afterTitle.includes(titled.title);
      if (res.status === 200 && body && body.ok && d.length === 1 && titleKept && d[0].after.includes('🟢')) {
        ok(`标题带 🔴 的行（${titled.title.slice(0, 18)}…）审批后：标题原样保留，只在状态位写 🟢`);
      } else {
        bad(`标题保护没生效：HTTP ${res.status}，变化 ${d.length} 行，标题保留=${titleKept}`);
      }
    }
    if (errors.length) bad(`任务视图有页面错误：${errors.join(' | ')}`);
    await page.close();
  }

  // ── 4 ──
  step(4, 8, '面板点「打回」：变 🔴 + 红色阻塞条 + 备注进日志');
  {
    const { page } = await openPage(urlA);
    if (!approvedKey) throw new Error('第 3 步没拿到审批过的行，第 4 步没法接着测');
    await page.waitForSelector(`.col[data-col="waiting"] .card[data-key="${approvedKey}"]`, { timeout: 10000 });
    const card = page.locator(`.col[data-col="waiting"] .card[data-key="${approvedKey}"]`);
    const key = approvedKey;
    await card.locator('.title').click();
    await page.waitForSelector(`.card[data-key="${key}"].is-open .note`, { timeout: 3000 });
    const note = '验收打回：截图对不上，还差一张 390';
    await page.locator(`.card[data-key="${key}"] .note`).fill(note);
    const mdBefore = await readFile(siteA.board, 'utf8');
    const jsonlBefore = await readJsonl(path.join(siteA.progress, '审批.jsonl'));
    await page.locator(`.card[data-key="${key}"] [data-act="reject"]`).click();
    const took = await waitCardStatus(page, key, 'blocked');
    if (took >= 0 && took <= 5200) ok(`点「打回」后 ${took} ms 卡片变 🔴`);
    else bad(`点「打回」后 ${took < 0 ? '6 秒内没变' : took + ' ms 才变'}`);
    await page.waitForSelector(`.card[data-key="${key}"] .blocker`, { timeout: 3000 }).catch(() => null);
    const blockerText = await page.locator(`.card[data-key="${key}"] .blocker`).innerText().catch(() => '');
    const blockerColor = await page.locator(`.card[data-key="${key}"] .blocker`).evaluate((el) => getComputedStyle(el).backgroundColor).catch(() => '');
    if (blockerText.trim() && isReddish(blockerColor)) {
      ok(`卡片上出现红色阻塞条：${blockerText.replace(/\s+/g, ' ').trim().slice(0, 60)}（底色 ${blockerColor}）`);
    } else {
      bad(`没有红色阻塞条（文字「${blockerText.slice(0, 30)}」，底色「${blockerColor}」）`);
    }
    const mdAfter = await readFile(siteA.board, 'utf8');
    const diff = diffLines(mdBefore, mdAfter);
    if (diff.length === 1 && diff[0].after.includes('🔴')) ok('md 该行变成 🔴（只改符号这一处）');
    else bad(`打回后 md 变化不对：${diff.length} 行`);
    const jsonlAfter = await readJsonl(path.join(siteA.progress, '审批.jsonl'));
    const last = jsonlAfter[jsonlAfter.length - 1];
    if (jsonlAfter.length === jsonlBefore.length + 1 && last.action === 'reject' && last.note === note) {
      ok(`审批日志记下打回与备注：${JSON.stringify(last).slice(0, 120)}`);
    } else {
      bad(`打回日志不对：${JSON.stringify(last)}`);
    }
    await page.close();
  }

  // ── 5 ──
  step(5, 8, '只读副本上审批：报错、看板不变、日志不增行');
  {
    siteReadonly = await makeSite('readonly', boardText, ledgerText);
    await chmod(siteReadonly.board, 0o444);
    const R = startServer({
      PORT: String(BASE_PORT + 1),
      WORKBENCH_BOARD: siteReadonly.board,
      WORKBENCH_LEDGER: siteReadonly.ledger,
      WORKBENCH_PROGRESS: siteReadonly.progress,
    });
    const urlR = await R.ready;
    const mdBefore = await readFile(siteReadonly.board, 'utf8');
    const first = (await getJson(urlR + '/api/board')).body.columns.find((c) => c.key === 'doing').tasks[0];
    const { res, body } = await postApprove(urlR, { id: first.id, action: 'approve' });
    if (res.status >= 400 && body && body.ok === false && /write_failed|verify_failed|snapshot_failed/.test(body.error || '')) {
      ok(`写 md 失败被如实报出来：HTTP ${res.status} ${body.error} — ${String(body.message).slice(0, 80)}`);
    } else {
      bad(`只读副本居然没报错：HTTP ${res.status} ${JSON.stringify(body).slice(0, 160)}`);
    }
    const mdAfter = await readFile(siteReadonly.board, 'utf8');
    if (sha(mdAfter) === sha(mdBefore)) ok('看板内容一个字没变（sha 一致）');
    else bad('看板被写坏了！');
    const logs = await readJsonl(path.join(siteReadonly.progress, '审批.jsonl'));
    if (logs.length === 0) ok('审批.jsonl 没有多出半截记录（0 行）');
    else bad(`写失败却记了日志：${JSON.stringify(logs)}`);

    // 面板上也得看到报错，而不是假装成功
    const { page } = await openPage(urlR);
    await page.waitForSelector('.col[data-col="doing"] .card', { timeout: 10000 });
    const card = page.locator('.col[data-col="doing"] .card').first();
    const key = await card.getAttribute('data-key');
    await page.locator(`.card[data-key="${key}"] [data-act="approve"]`).click();
    const errEl = page.locator(`.card[data-key="${key}"] .act-msg[data-kind="error"]`);
    let shown = false;
    const t0 = Date.now();
    while (Date.now() - t0 < 6000) {
      if (await errEl.count()) { shown = (await errEl.innerText()).trim().length > 0; if (shown) break; }
      await sleep(150);
    }
    if (shown) ok(`面板显示错误：${(await errEl.innerText()).trim().slice(0, 90)}`);
    else bad('面板上没有显示写入失败');
    const mdFinal = await readFile(siteReadonly.board, 'utf8');
    if (sha(mdFinal) === sha(mdBefore)) ok('面板点完看板仍未变');
    else bad('面板点完看板被改了！');
    await page.close();
    await chmod(siteReadonly.board, 0o666);
  }

  // ── 6 ──
  step(6, 8, '卡片详情：约定新列「详情」支持路径 / URL / markdown 链接；没有该列就跳过（都不报错）');
  {
    const mdLink = '[方案 HTML](docs/preview/方案示例.html)';
    const startSite = async (name, board, port) => {
      const site = await makeSite(name, board, ledgerText);
      const srv = startServer({
        PORT: String(port),
        WORKBENCH_BOARD: site.board,
        WORKBENCH_LEDGER: site.ledger,
        WORKBENCH_PROGRESS: site.progress,
      });
      return { site, url: await srv.ready };
    };

    // a) markdown 链接 → 标签 + 目标路径（看板里最常见的就是这种写法）
    const withMd = withDetailValue(boardText, mdLink);
    if (!withMd) {
      bad('构造「详情」列失败（看板结构变了？）');
    } else {
      const { url } = await startSite('detail-md', withMd, BASE_PORT + 2);
      const { body } = await getJson(url + '/api/board');
      const task = body.columns.find((c) => c.key === 'doing').tasks[0];
      const link = task && task.detailLink;
      if (link && link.kind === 'path' && link.raw === 'docs/preview/方案示例.html' && link.label === '方案 HTML') {
        ok(`markdown 链接 → 标签「${link.label}」+ 路径 ${link.raw}`);
      } else {
        bad(`markdown 链接没解析对：${JSON.stringify(link)}`);
      }
      const total = boardRows.doing + boardRows.waiting + boardRows.done + boardRows.backlog;
      if (body.counts.total === total) ok('有「详情」列不影响行数（按表头识别，不靠位置）');
      else bad(`有详情列后行数变了：${body.counts.total} != ${total}`);

      const { page, errors } = await openPage(url);
      await page.waitForSelector('.col[data-col="doing"] .card', { timeout: 10000 });
      const card = page.locator('.col[data-col="doing"] .card').first();
      const key = await card.getAttribute('data-key');
      await card.locator('.title').click();
      await page.waitForSelector(`.card[data-key="${key}"].is-open .card-more`, { timeout: 3000 });
      const copyBtn = page.locator(`.card[data-key="${key}"] .card-more [data-copy="docs/preview/方案示例.html"]`);
      if (await copyBtn.count()) {
        const text = (await copyBtn.innerText()).trim();
        if (text === '方案 HTML') ok(`展开后「详情」按钮用 md 里的标签「${text}」（本地路径，点击复制目标路径）`);
        else bad(`详情按钮文案不是 md 标签：${text}`);
        if (await page.locator(`.card[data-key="${key}"] .kv dt`, { hasText: '详情' }).count()) ok('详情出现在完整字段里');
      } else {
        bad('展开后没有详情链接');
      }
      if (errors.length) bad(`详情页有页面错误：${errors.join(' | ')}`);
      await page.close();

      // b) 值是 URL → 真的 <a href>，新标签打开
      const withUrl = withDetailValue(boardText, 'https://example.com/x');
      const { url: urlU } = await startSite('detail-url', withUrl, BASE_PORT + 4);
      const urlBody = (await getJson(urlU + '/api/board')).body;
      const uTask = urlBody.columns.find((c) => c.key === 'doing').tasks[0];
      if (uTask.detailLink && uTask.detailLink.kind === 'url' && uTask.detailLink.href === 'https://example.com/x') {
        ok('值是 URL 时解析成 kind=url 并带 href');
      } else {
        bad(`URL 值没解析对：${JSON.stringify(uTask.detailLink)}`);
      }
      const urlPage = await openPage(urlU);
      await urlPage.page.waitForSelector('.col[data-col="doing"] .card', { timeout: 10000 });
      const uCard = urlPage.page.locator('.col[data-col="doing"] .card').first();
      const uKey = await uCard.getAttribute('data-key');
      await uCard.locator('.title').click();
      const anchor = urlPage.page.locator(`.card[data-key="${uKey}"] .card-more a.linkbtn[href="https://example.com/x"]`);
      if (await anchor.count()) ok('URL 详情渲染成可点的链接（新标签打开）');
      else bad('URL 详情没有渲染成链接');
      await urlPage.page.close();

      // c) 没有「详情」列的板子 → 不报错、也不出现详情行
      const without = withoutDetailColumn(boardText);
      const { url: urlW } = await startSite('detail-none', without, BASE_PORT + 5);
      const wBody = (await getJson(urlW + '/api/board')).body;
      const wTask = wBody.columns.find((c) => c.key === 'doing').tasks[0];
      if (wTask && wTask.detailLink === null) ok('没有「详情」列时 detailLink=null，不报错');
      else bad(`没有详情列却解析出了：${JSON.stringify(wTask && wTask.detailLink)}`);
      const wPage = await openPage(urlW);
      await wPage.page.waitForSelector('.col[data-col="doing"] .card', { timeout: 10000 });
      const wCard = wPage.page.locator('.col[data-col="doing"] .card').first();
      const wKey = await wCard.getAttribute('data-key');
      await wCard.locator('.title').click();
      await wPage.page.waitForSelector(`.card[data-key="${wKey}"].is-open .card-more`, { timeout: 3000 });
      const dtCount = await wPage.page.locator(`.card[data-key="${wKey}"] .kv dt`, { hasText: '详情' }).count();
      if (dtCount === 0 && wPage.errors.length === 0) ok('展开后没有「详情」这一行，页面也没有报错');
      else bad(`没有详情列时表现不对（详情行 ${dtCount}，错误 ${wPage.errors.join(' | ')}）`);
      await wPage.page.close();

      // d) 真实看板上值写「—」的行 → 当成没有详情，不硬造链接
      const aTask = (await getJson(urlA + '/api/board')).body.columns
        .find((c) => c.key === 'doing').tasks.find((t) => t.detailLink === null);
      if (aTask) ok(`真实看板里详情写「—」的行（${aTask.code || aTask.id}）不生成链接`);
      else ok('真实看板里暂时没有「—」的详情行（跳过）');
    }
  }

  // ── 7 ──
  step(7, 8, '真实文件没被测试碰过（只动副本）');
  {
    const boardAfter = await readFile(BOARD, 'utf8');
    const ledgerAfter = await readFile(LEDGER, 'utf8');
    if (sha(boardAfter) === boardHash) ok('docs/任务看板.md 字节未变');
    else bad('docs/任务看板.md 被改了！');
    if (sha(ledgerAfter) === ledgerHash) ok('docs/会话台账.md 字节未变');
    else bad('docs/会话台账.md 被改了！');
    const progressNow = await (async () => {
      try { return (await readdir(PROGRESS)).sort().join(','); } catch { return ''; }
    })();
    if (progressNow === progressBefore) ok(`docs/进度/ 没有被验收脚本写入（现状：${progressNow || '目录不存在'}）`);
    else bad(`docs/进度/ 被写了：${progressBefore || '空'} → ${progressNow}`);
  }

  // ── 8 ──
  step(8, 8, '375 / 1440 截图（任务 + 会话 + 展开详情），落 docs/preview/W2-*.png');
  if (process.env.SKIP_SHOTS) {
    console.log('  · SKIP_SHOTS=1：跳过截图（只验功能，不碰 docs/preview）');
  } else {
    await mkdir(PREVIEW, { recursive: true });
    const D = startServer({ PORT: String(BASE_PORT + 6), WORKBENCH_BOARD: '', WORKBENCH_LEDGER: '', WORKBENCH_PROGRESS: '' });
    const urlD = await D.ready;
    const shots = [
      { width: 375, height: 812, label: '375' },
      { width: 1440, height: 900, label: '1440' },
    ];
    const files = [];
    for (const size of shots) {
      for (const view of [{ key: 'board', name: '任务' }, { key: 'sessions', name: '会话' }]) {
        const { page, errors } = await openPage(urlD, { viewport: { width: size.width, height: size.height }, hash: '#' + view.key });
        await page.waitForSelector(view.key === 'board' ? '.col .card' : '.srow', { timeout: 10000 });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        const file = path.join(PREVIEW, `W2-${size.label}-${view.name}.png`);
        await page.screenshot({ path: file, fullPage: true });
        const info = await stat(file);
        files.push({ file, size: info.size, overflow });
        if (errors.length) bad(`${size.label} ${view.name} 页面有错误：${errors.join(' | ')}`);
        if (info.size < 20000) bad(`${size.label} ${view.name} 截图太小（${info.size} 字节）`);
        if (overflow) bad(`${size.label} ${view.name} 横向溢出`);
        await page.close();
      }
    }
    // 再补一张展开后的卡片详情，留证据（优先挑有「详情」列的那张：进行中第二行）
    {
      const { page } = await openPage(urlD, { viewport: { width: 1440, height: 900 } });
      await page.waitForSelector('.col[data-col="doing"] .card', { timeout: 10000 });
      const doingCards = page.locator('.col[data-col="doing"] .card');
      const n = await doingCards.count();
      await doingCards.nth(n > 1 ? 1 : 0).locator('.title').click();
      await page.waitForSelector('.card.is-open .card-more', { timeout: 3000 });
      await page.locator('.card.is-open').first().scrollIntoViewIfNeeded();
      const file = path.join(PREVIEW, 'W2-1440-卡片详情.png');
      await page.screenshot({ path: file, fullPage: false });
      files.push({ file, size: (await stat(file)).size, overflow: false });
      await page.close();
    }
    for (const f of files) ok(`${path.relative(REPO_ROOT, f.file).split(path.sep).join('/')}  ${f.size} 字节`);
    D.stop();
  }

  const taskTotal = ['doing', 'waiting', 'done', 'backlog'].reduce((sum, k) => sum + (boardRows[k] || 0), 0);
  console.log(failures === 0
    ? `\nPASS W2 全部通过（任务 ${taskTotal} 条 / 现役会话 ${activeSessions.rows} 个）`
    : `\nFAIL：${failures} 项没通过`);
} catch (err) {
  console.error('\n[check-approve] 异常：', err && err.stack ? err.stack : err);
  failures += 1;
} finally {
  if (siteReadonly) await chmod(siteReadonly.board, 0o666).catch(() => {});
  for (const s of servers) s.stop();
  await browser.close().catch(() => {});
  if (!process.env.KEEP_TMP) {
    for (const dir of tmpDirs) {
      if (path.resolve(dir).startsWith(path.resolve(tmpdir()))) {
        await rm(dir, { recursive: true, force: true }).catch(() => {});
      }
    }
  }
  await rm(process.env.WORKBENCH_TIMER_DIR, { recursive: true, force: true }).catch(() => {});
  process.exitCode = failures === 0 ? 0 : 1;
}
