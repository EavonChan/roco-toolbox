#!/usr/bin/env node
/**
 * U5 截图：375×812 / 390×844 两个手机宽度 × 五屏。
 *
 *   node tools/preview/u5/build.mjs && node tools/preview/u5/shot.mjs
 *   → docs/preview/U5-<宽>-<屏>.png
 *
 * 为什么要起本地静态服务：面板里的绿窝图标是 `/ui/...` 绝对路径（App 由 Vite 从 `public/`
 * 提供），`file://` 下会 404，截图全是缺图。服务只在 127.0.0.1 随机端口、进程退出即关。
 * 蛋图是 patchwiki 远程地址：按 URL 拦成本地 `icons/` 文件，保证截图里蛋图是齐的。
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const HTML = path.join(ROOT, 'docs', 'preview', 'U5-同类蛋聚合-2026-11-25.html');
const OUT = path.join(ROOT, 'docs', 'preview');

const ICON_IDS = [3001, 3002, 3003, 3049];
const iconUrls = JSON.parse(await readFile(path.join(ROOT, 'src', 'data', 'eggIconUrls.json'), 'utf8'));
const icons = new Map();
for (const id of ICON_IDS) icons.set(iconUrls[id], await readFile(path.join(HERE, 'icons', `${id}.png`)));

const MIME = { '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.css': 'text/css' };
const server = createServer(async (request, response) => {
  const file = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
  const target = file === '/u5' ? HTML : file.startsWith('/ui/') ? path.join(ROOT, 'public', file) : null;
  if (!target) { response.writeHead(404).end('not found'); return; }
  try {
    const body = await readFile(target);
    response.writeHead(200, { 'Content-Type': file === '/u5' ? 'text/html; charset=utf-8' : (MIME[path.extname(target)] ?? 'application/octet-stream') });
    response.end(body);
  } catch {
    response.writeHead(404).end('not found');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/u5`;

const SHOTS = [
  { file: '1-现状-5颗占5格', screen: 'now' },
  { file: '2-聚合-一张卡x5', screen: 'group' },
  { file: '3-就地展开-按性格分组', screen: 'open' },
  { file: '4-筛选已标注-x4共5', screen: 'filter' },
];
const SIZES = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
];

const browser = await chromium.launch();
try {
  for (const size of SIZES) {
    for (const shot of SHOTS) {
      const page = await browser.newPage({ viewport: size, deviceScaleFactor: 2 });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
      await page.route('https://patchwiki.biligame.com/**', (route) => {
        const body = icons.get(route.request().url());
        return body ? route.fulfill({ status: 200, contentType: 'image/png', body }) : route.abort();
      });
      await page.goto(`${base}?${new URLSearchParams({ screen: shot.screen, bare: '1' })}`, { waitUntil: 'load' });
      await page.waitForSelector('[data-testid="egg-stock-filter-chips"]', { timeout: 10_000 });
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(150);
      const file = path.join(OUT, `U5-${size.width}-${shot.file}.png`);
      await page.screenshot({ path: file });
      const singles = await page.locator('[data-testid="stock-card"]').count();
      const groups = await page.locator('[data-testid="stock-group-card"]').count();
      const rows = await page.locator('[data-testid="stock-group-row"]').count();
      const counts = await page.locator('[data-testid="stock-group-card"]').evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-egg-count')));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      console.log(`${size.width}  ${shot.file.padEnd(20)} 单卡 ${singles} 聚合卡 ${groups}${counts.length ? `(${counts.join(',')})` : ''} 展开行 ${rows}  横向溢出 ${overflow ? '有' : '无'}  ${path.relative(ROOT, file)}`);
      if (errors.length) console.log(`  [页面错误] ${errors.join(' | ')}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
