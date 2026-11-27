#!/usr/bin/env node
/**
 * 面板级验收：证明"改 md 的符号 → 浏览器里的卡片 5 秒内跟着变"，且不是整页刷新。
 *   node tools/workbench/check-ui.mjs
 *
 * 用 md 副本测（WORKBENCH_BOARD），绝不动 docs/任务看板.md。
 * 依赖仓库已有的 playwright；工作台本身不依赖它。
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.join(HERE, 'server.mjs');
const REPO_ROOT = path.resolve(HERE, '..', '..');
const BOARD = path.join(REPO_ROOT, 'docs', '任务看板.md');
const PORT = Number(process.env.CHECK_UI_PORT || 4470);
// 页面加载时会打计时器心跳；指到临时目录，绝不碰用户真实的 ~/.workbench/timer/
process.env.WORKBENCH_TIMER_DIR = path.join(tmpdir(), `wb-timer-check-ui-${process.pid}`);
const SYMBOLS = ['🟡', '🔵', '⚪', '🟢', '🔴'];
const STATUS_BY_KEY = { doing: '🟡', waiting: '🔵', done: '🟢', backlog: '⚪', blocked: '🔴' };
const COLUMN_HEADS = [
  { key: 'doing', re: /进行中/ },
  { key: 'waiting', re: /等你/ },
  { key: 'done', re: /已完成/ },
  { key: 'backlog', re: /待派|backlog/i },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => { failures += 1; console.error(`  ✗ ${m}`); };

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
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error(`服务提前退出（code=${code}）\n${out}\n${err}`)); });
  });
  return { child, ready };
}

/** 四个章节里第一张有数据行的表的第一行。 */
function pickFirstRow(lines) {
  for (const h of COLUMN_HEADS) {
    const start = lines.findIndex((l) => /^##\s+/.test(l) && h.re.test(l));
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

const text = await readFile(BOARD, 'utf8');
const lines = text.split('\n');
const target = pickFirstRow(lines);
if (!target) {
  console.error('看板四张表都没有数据行，无法测');
  process.exit(1);
}
const { column, rowIdx } = target;
const originalLine = lines[rowIdx];

const tmpDir = await mkdtemp(path.join(tmpdir(), 'workbench-ui-'));
const copy = path.join(tmpDir, '任务看板.md');
await writeFile(copy, text, 'utf8');

const server = startServer({ PORT: String(PORT), WORKBENCH_BOARD: copy });
const browser = await chromium.launch();
try {
  const url = await server.ready;
  console.log(`副本服务 ${url}（数据源 ${copy}）`);
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector(`.col[data-col="${column}"] .card`, { timeout: 10000 });
  await page.evaluate(() => { window.__wbNoReload = 'kept'; });

  const card = page.locator(`.col[data-col="${column}"] .card`).first();
  const readCard = async () => ({
    status: await card.getAttribute('data-status'),
    badge: (await card.locator('.badge').innerText()).trim(),
    title: (await card.locator('.title').innerText()).trim(),
  });
  const before = await readCard();
  const beforeStatus = before.status;
  const targetKey = beforeStatus === 'blocked' ? 'doing' : 'blocked';
  const targetSym = STATUS_BY_KEY[targetKey];
  console.log(`目标卡片「${before.title}」当前 ${before.badge} → 改成 ${targetSym}`);

  // 先清掉这一行所有状态符号，再把目标符号放到单元格末尾（副本里，真实看板不动）
  lines[rowIdx] = originalLine.replace(/[🟡🔵⚪🟢🔴]/g, '')
    .replace(/\|\s*$/, '')
    .trimEnd() + ` ${targetSym} |`;
  await writeFile(copy, lines.join('\n'), 'utf8');
  const t0 = Date.now();

  let after = null;
  let elapsed = 0;
  while (Date.now() - t0 < 6000) {
    after = await readCard();
    if (after.status === targetKey) { elapsed = Date.now() - t0; break; }
    await sleep(150);
  }
  if (after && after.status === targetKey) {
    ok(`${elapsed} ms 后面板卡片变成「${after.badge}」（接口 5 秒轮询 + 150ms 采样）`);
    if (elapsed <= 5200) ok(`延迟 ${elapsed} ms ≤ 5 秒轮询周期，符合"5 秒内跟着变"`);
    else bad(`延迟 ${elapsed} ms，超过 5 秒`);
    const stillAlive = await page.evaluate(() => window.__wbNoReload === 'kept');
    if (stillAlive) ok('页面没有整页刷新（window 标记仍在），只重拉了数据');
    else bad('页面发生了整页刷新');
    const cardCount = await page.locator('.col .card').count();
    if (cardCount > 0) ok(`四列都在，卡片总数 ${cardCount}（改符号不影响行数）`);
  } else {
    bad(`6 秒内面板卡片没变（仍为 ${after && after.badge}）`);
  }

  // 整行原样写回，验证双向
  lines[rowIdx] = originalLine;
  await writeFile(copy, lines.join('\n'), 'utf8');
  const t1 = Date.now();
  let back = false;
  while (Date.now() - t1 < 6000) {
    const now = await readCard();
    if (now.status === beforeStatus) { back = true; break; }
    await sleep(150);
  }
  if (back) ok(`整行写回后面板 ${Date.now() - t1} ms 内恢复`);
  else bad('写回后 6 秒内面板没恢复');

  await page.close();
} catch (err) {
  bad(err && err.stack ? err.stack : String(err));
} finally {
  await browser.close();
  server.child.kill();
  if (path.resolve(tmpDir).startsWith(path.resolve(tmpdir()))) await rm(tmpDir, { recursive: true, force: true });
  await rm(process.env.WORKBENCH_TIMER_DIR, { recursive: true, force: true }).catch(() => {});
}
console.log(failures === 0 ? '\nPASS 面板级刷新通过' : `\nFAIL ${failures} 项`);
process.exitCode = failures === 0 ? 0 : 1;
