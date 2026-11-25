#!/usr/bin/env node
/**
 * U3 截图：375 / 390 两个手机宽度，取五屏（家园现状 / 广场现状 / 广场对齐后 ×3）。
 *
 *   node tools/preview/u3/build.mjs && node tools/preview/u3/shot.mjs
 *   → docs/preview/U3-<宽>-<屏>.png
 *
 * 为什么要起一个本地静态服务：面板里的绿窝 / 奖牌图标是 `/ui/...` 绝对路径（App 由 Vite 从
 * `public/` 提供），`file://` 下会全部 404，截图就全是缺图。服务只在 127.0.0.1 随机端口、
 * 进程退出即关，只读仓库文件。
 * 蛋图是远程地址（patchwiki）；离线或慢网会掉成「暂无蛋图」。这里把 `icons/` 里那几张
 * 按 URL 拦成本地文件，保证截图里蛋图是齐的——和 App 里加载到图时的样子一致。
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const HTML = path.join(ROOT, 'docs', 'preview', 'U3-蛋仓角色对齐-2026-11-25.html');
const OUT = path.join(ROOT, 'docs', 'preview');

const ICON_IDS = [3001, 3002, 3003, 3005, 3007, 3013];
const iconUrls = JSON.parse(await readFile(path.join(ROOT, 'src', 'data', 'eggIconUrls.json'), 'utf8'));
const icons = new Map();
for (const id of ICON_IDS) icons.set(iconUrls[id], await readFile(path.join(HERE, 'icons', `${id}.png`)));

const MIME = { '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.css': 'text/css' };
const server = createServer(async (request, response) => {
  const file = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
  const target = file === '/u3'
    ? HTML
    : file.startsWith('/ui/')
      ? path.join(ROOT, 'public', file)
      : null;
  if (!target) { response.writeHead(404).end('not found'); return; }
  try {
    const body = await readFile(target);
    response.writeHead(200, { 'Content-Type': file === '/u3' ? 'text/html; charset=utf-8' : (MIME[path.extname(target)] ?? 'application/octet-stream') });
    response.end(body);
  } catch {
    response.writeHead(404).end('not found');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/u3`;

const SHOTS = [
  { file: '现状-家园-有选角色', screen: 'home' },
  { file: '现状-广场-没有选角色', screen: 'plaza' },
  { file: '改后-广场-有选角色', screen: 'plaza-after' },
  { file: '改后-广场-切到小号', screen: 'plaza-after', char: 'uid:1002' },
  { file: '改后-广场-该角色没有蛋', screen: 'plaza-after', char: 'uid:1003' },
  // 2026-11-25 用户口径：两处蛋仓的「返回」要一致 —— 三个方向各一张
  { file: '返回A-家园-左侧返回', screen: 'return-a-home' },
  { file: '返回B-广场-右侧返回换蛋', screen: 'return-b-plaza' },
  { file: '返回C-家园-内容行', screen: 'return-c-home' },
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
      const query = new URLSearchParams({ screen: shot.screen, bare: '1', ...(shot.char ? { char: shot.char } : {}) });
      await page.goto(`${base}?${query}`, { waitUntil: 'load' });
      await page.waitForSelector('[data-testid="egg-stock-filter-chips"]', { timeout: 10_000 });
      await page.waitForLoadState('networkidle').catch(() => {});
      const file = path.join(OUT, `U3-${size.width}-${shot.file}.png`);
      await page.screenshot({ path: file });
      const select = await page.locator('[data-testid="egg-stock-character"], [data-testid="egg-stock-character-plaza"]').count();
      const cards = await page.locator('[data-testid="stock-card"]').count();
      const empty = await page.locator('text=这个角色还没有蛋').count();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      console.log(`${size.width}  ${shot.file.padEnd(16)} 卡片 ${cards}  角色下拉 ${select}  「没有蛋」提示 ${empty}  横向溢出 ${overflow ? '有' : '无'}  ${path.relative(ROOT, file)}`);
      if (errors.length) console.log(`  [页面错误] ${errors.join(' | ')}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
