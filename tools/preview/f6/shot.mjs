#!/usr/bin/env node
/**
 * F6 截图：375×812 / 390×844 两个手机宽度 × 七屏。
 *   node tools/preview/f6/build.mjs && node tools/preview/f6/shot.mjs
 *   → docs/preview/F6-<宽>-<屏>.png
 *
 * 认领页/详情的点击在这里驱动真实组件，保证拍的是实现后的交互状态，不是原型。
 * 服务只监听 127.0.0.1 随机端口，进程退出即关。
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const HTML = path.join(ROOT, 'docs', 'preview', 'F6-待认领-实现预览-2026-11-27.html');
const OUT = path.join(ROOT, 'docs', 'preview');

const ICON_IDS = [3049, 3001, 3002, 3003];
const iconUrls = JSON.parse(await readFile(path.join(ROOT, 'src', 'data', 'eggIconUrls.json'), 'utf8'));
const icons = new Map();
for (const id of ICON_IDS) icons.set(iconUrls[id], await readFile(path.join(HERE, '..', 'u5', 'icons', `${id}.png`)));

const MIME = { '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.css': 'text/css' };
const server = createServer(async (request, response) => {
  const file = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
  const target = file === '/f6' ? HTML : file.startsWith('/ui/') ? path.join(ROOT, 'public', file) : null;
  if (!target) { response.writeHead(404).end('not found'); return; }
  try {
    const body = await readFile(target);
    response.writeHead(200, { 'Content-Type': file === '/f6' ? 'text/html; charset=utf-8' : (MIME[path.extname(target)] ?? 'application/octet-stream') });
    response.end(body);
  } catch {
    response.writeHead(404).end('not found');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/f6`;

/** 每屏：URL 里的数据 + 需要点哪些东西（真实交互）。 */
const SHOTS = [
  { file: '1-蛋仓-待认领入口', screen: 'stock' },
  { file: '2-手动认领-未选', screen: 'claim', clicks: ['去认领'] },
  { file: '3-手动认领-已选同种', screen: 'pick', clicks: ['去认领', 'home:home-1002', 'bag:bag-4559'] },
  { file: '4-手动认领-只显示同种', screen: 'same-species', clicks: ['去认领', 'home:home-1002'] },
  { file: '5-详情-拆开认领', screen: 'detail', clicks: ['card:home-1002', 'dialog'] },
  { file: '6-拆开-确认', screen: 'split', clicks: ['card:home-1002', 'dialog', '拆开认领'] },
  { file: '7-蛋仓-认领后', screen: 'after' },
  { file: '8-手动认领-没有同种新蛋', screen: 'empty', clicks: ['去认领'] },
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
      await page.waitForSelector('[data-testid="egg-stock-grid"]', { timeout: 10_000 });
      for (const click of shot.clicks ?? []) {
        if (click.startsWith('home:')) {
          await page.click(`[data-claim-home-id="${click.slice(5)}"]`);
        } else if (click.startsWith('bag:')) {
          await page.click(`[data-claim-bag-id="${click.slice(4)}"]`);
        } else if (click.startsWith('card:')) {
          await page.click(`[data-testid="stock-card"][data-egg-id="${click.slice(5)}"]`);
        } else if (click === 'dialog') {
          await page.waitForSelector('[role="dialog"]', { timeout: 5_000 });
        } else {
          await page.getByRole('button', { name: click, exact: true }).click();
        }
        await page.waitForTimeout(120);
      }
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(150);
      const file = path.join(OUT, `F6-${size.width}-${shot.file}.png`);
      await page.screenshot({ path: file });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      // 认领页：滚到底后，左列最后一张卡要能完整落在 sticky 操作条上方（底部留白是否够）。
      const clearance = await page.evaluate(() => {
        const column = document.querySelector('[data-testid="claim-home-column"]');
        const foot = document.querySelector('[data-testid="claim-foot"]');
        if (!column || !foot) return null;
        window.scrollTo(0, document.documentElement.scrollHeight);
        const cards = column.querySelectorAll('[data-testid="claim-home-card"]');
        const last = cards[cards.length - 1];
        return last ? Math.round(foot.getBoundingClientRect().top - last.getBoundingClientRect().bottom) : null;
      });
      const banner = await page.locator('[data-testid="claim-banner"]').count();
      const pending = await page.locator('[data-testid="stock-pending-badge"]').count();
      const claimView = await page.locator('[data-testid="claim-view"]').count();
      console.log(`${size.width}  ${shot.file.padEnd(20)} 横幅 ${banner} 待认领卡 ${pending} 认领页 ${claimView}  横向溢出 ${overflow ? '有' : '无'}${clearance === null ? '' : `  末卡距操作条 ${clearance}px`}  ${path.relative(ROOT, file)}`);
      if (errors.length) console.log(`  [页面错误] ${errors.join(' | ')}`);
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
