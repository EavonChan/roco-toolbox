#!/usr/bin/env node
/**
 * 工作台「快速决策 + 评论」截图（375 / 1440），验收与回归对比用：
 *   node tools/workbench/shot-decide.mjs                                  # 自己起一个临时服务
 *   node tools/workbench/shot-decide.mjs --url http://127.0.0.1:4320     # 打已经跑着的服务
 *   node tools/workbench/shot-decide.mjs --prefix W5 --out docs/preview
 *
 * 会真的点一次选项、写一条评论（POST /api/decide），所以默认把 WORKBENCH_PROGRESS 指到临时目录：
 * 决策进临时 决策.jsonl，不碰 docs/进度/，跑完就删。指向已有服务时，记录会追加进那个服务的 决策.jsonl。
 *
 * 依赖仓库里已有的 playwright devDependency；工作台本身不依赖它。
 */
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const SERVER = path.join(HERE, 'server.mjs');

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const outDir = path.resolve(REPO_ROOT, arg('out', 'docs/preview'));
const prefix = arg('prefix', 'W5');
const note = arg('note', '三栏太慢，先按推荐止血');
const port = Number(arg('port', '4390'));
const sizes = [
  { width: 375, height: 812, label: '375' },
  { width: 1440, height: 900, label: '1440' },
];

let url = arg('url', '');
let child = null;
let tmpProgress = null;
let tmpTimer = null;

if (!url) {
  tmpProgress = await mkdtemp(path.join(tmpdir(), 'wb-shot-decide-'));
  tmpTimer = await mkdtemp(path.join(tmpdir(), 'wb-shot-timer-'));
  child = spawn(process.execPath, [SERVER], {
    cwd: REPO_ROOT,
    env: { ...process.env, PORT: String(port), WORKBENCH_PROGRESS: tmpProgress, WORKBENCH_TIMER_DIR: tmpTimer },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  url = await new Promise((resolve, reject) => {
    let out = '';
    const timer = setTimeout(() => reject(new Error(`服务 10 秒没起来：\n${out}`)), 10000);
    child.stdout.on('data', (b) => {
      out += b.toString('utf8');
      const m = /\[ready\]\s+(http:\/\/\S+)/.exec(out);
      if (m) { clearTimeout(timer); resolve(m[1].replace(/\/$/, '')); }
    });
    child.stderr.on('data', (b) => { out += b.toString('utf8'); });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`服务提前退出（code=${code}）：\n${out}`));
    });
  });
}

const browser = await chromium.launch();
try {
  for (const size of sizes) {
    const page = await browser.newPage({
      viewport: { width: size.width, height: size.height },
      deviceScaleFactor: 2,
    });
    const errors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(`${url}/#board`, { waitUntil: 'networkidle' });
    await page.waitForSelector('#board .card [data-act="decide"]', { timeout: 10000 });

    const waiting = page.locator('#board .col[data-col="waiting"]');
    const withOptions = waiting.locator('.card', { has: page.locator('.optbtn') });
    const firstCard = withOptions.first();

    // ① 点一个选项（有「推荐」就点推荐）：按钮立刻进已选态，右上角出现「已决策 · A」
    const recommended = firstCard.locator('.optbtn.rec').first();
    const pick = (await recommended.count()) ? recommended : firstCard.locator('.optbtn').first();
    const optionKey = await pick.getAttribute('data-opt');
    const decideId = await pick.getAttribute('data-decide-id');
    await pick.click();
    await firstCard.locator('.badge.decided').first().waitFor({ timeout: 8000 });
    // 等这一轮的 POST + 重拉 /api/board 走完（同一时刻只允许一笔在飞，否则第二笔会被 busy 挡掉）
    await firstCard.locator('.act-msg[data-kind="done"]').first().waitFor({ timeout: 8000 });
    await page.waitForResponse((r) => r.url().includes('/api/board'), { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(300);

    // ② 另一张卡只填一句备注 → 评论（不点选项），右上角出现「已评论」
    const secondCard = waiting.locator('.card', { has: page.locator('.dnote') }).nth(1);
    await secondCard.locator('.dnote').fill(note);
    await secondCard.locator('[data-act="decide-comment"]').click();
    await secondCard.locator('.badge.decided[data-kind="comment"]').waitFor({ timeout: 8000 });
    await secondCard.locator('.act-msg[data-kind="done"]').first().waitFor({ timeout: 8000 });
    // 等 toast 自己收起来，别让它盖住卡片
    await page.waitForFunction(() => {
      const el = document.getElementById('toast');
      return !el || !el.classList.contains('show');
    }, null, { timeout: 10000 });
    await page.waitForTimeout(200);

    const counts = await page.evaluate(() => ({
      optionButtons: document.querySelectorAll('#board .optbtn').length,
      decided: document.querySelectorAll('#board .badge.decided[data-kind="decision"]').length,
      commented: document.querySelectorAll('#board .badge.decided[data-kind="comment"]').length,
      pendingCards: document.querySelectorAll('#board .card.dcard').length,
      overflow: document.documentElement.scrollWidth > window.innerWidth,
    }));
    // 整页截图时 sticky 顶栏会被拼进中间：截图前把它改成静态，图里只留一条顶栏
    await page.addStyleTag({ content: '.top{position:static !important}' });
    await page.evaluate(() => window.scrollTo(0, 0));
    const file = path.join(outDir, `${prefix}-${size.label}-决策.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`${size.label}  ${file}  选项按钮 ${counts.optionButtons} 个 / 已决策 ${counts.decided} 张` +
      ` / 已评论 ${counts.commented} 张 / 待决策卡 ${counts.pendingCards} 张 / 横向溢出 ${counts.overflow ? '有' : '无'}` +
      `（点了 ${decideId} → ${optionKey}）`);
    if (errors.length) console.log(`  [页面错误] ${errors.join(' | ')}`);
    await page.close();
  }
} finally {
  await browser.close();
  if (child) child.kill();
  if (tmpProgress) await rm(tmpProgress, { recursive: true, force: true });
  if (tmpTimer) await rm(tmpTimer, { recursive: true, force: true });
}
