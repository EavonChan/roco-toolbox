#!/usr/bin/env node
/**
 * 工作台截图（375 / 1440 × 任务/会话两个视图），用于验收与回归对比。
 *   node tools/workbench/shot.mjs [--url http://127.0.0.1:4320] [--out docs/preview] [--prefix W2]
 *                                [--tabs board,sessions]
 *
 * 依赖仓库里已有的 playwright devDependency；工作台本身不依赖它。
 * 只读：打开页面、截图，不点审批按钮、不写任何数据文件。
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');

function arg(name, fallback) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const url = arg('url', 'http://127.0.0.1:4320');
const outDir = path.resolve(REPO_ROOT, arg('out', 'docs/preview'));
const prefix = arg('prefix', 'W1');
const tabArg = arg('tabs', 'board');
const sizes = [
  { width: 375, height: 812, label: '375' },
  { width: 1440, height: 900, label: '1440' },
];
const VIEWS = [
  { key: 'board', label: '任务', selector: '.col .card, .col .empty' },
  { key: 'sessions', label: '会话', selector: '.srow, .sessions .empty' },
].filter((view) => tabArg.split(',').map((s) => s.trim()).includes(view.key));

const browser = await chromium.launch();
try {
  for (const size of sizes) {
    for (const view of VIEWS) {
      const page = await browser.newPage({
        viewport: { width: size.width, height: size.height },
        deviceScaleFactor: 2,
      });
      const errors = [];
      page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
      page.on('pageerror', (err) => errors.push(err.message));
      await page.goto(`${url.replace(/#.*$/, '')}#${view.key}`, { waitUntil: 'networkidle' });
      await page.waitForSelector(view.selector, { timeout: 10000 });
      const shown = await page.locator(view.key === 'board' ? '.col .card' : '.srow').count();
      if (!shown && view.key === 'board') throw new Error(`${size.label}: 页面没有渲染出任何卡片`);
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      const file = path.join(outDir, `${prefix}-${size.label}-${view.label}.png`);
      await page.screenshot({ path: file, fullPage: true });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      console.log(`${size.label}  ${view.label}  ${file}  条目 ${shown}  页面高 ${height}px  横向溢出 ${overflow ? '有' : '无'}`);
      if (errors.length) console.log(`  [页面错误] ${errors.join(' | ')}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
}
