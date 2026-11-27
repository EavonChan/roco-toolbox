#!/usr/bin/env node
/**
 * 量一遍「卡名字号」的真实计算结果（2026-11-26 字号对比的证据）。
 *
 *   node tools/preview/u3/fit-name-check.mjs
 *
 * 打开预览页的 `fit-name` 屏，在 375 / 390 两个宽度下，把 A（现状 10/10）与
 * B（恢复 12/9）两排卡片的 `pet-card-name` 逐个读 `getComputedStyle().fontSize`，
 * 再读名字容器可用宽度与文字自然宽度，给出「放不放得下」。
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const HTML = path.join(ROOT, 'docs', 'preview', 'U3-蛋仓角色对齐-2026-11-25.html');

const server = createServer(async (request, response) => {
  const file = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
  const target = file === '/u3' ? HTML : file.startsWith('/ui/') ? path.join(ROOT, 'public', file) : null;
  if (!target) { response.writeHead(404).end('not found'); return; }
  try {
    const body = await readFile(target);
    response.writeHead(200, { 'Content-Type': file === '/u3' ? 'text/html; charset=utf-8' : 'image/png' });
    response.end(body);
  } catch { response.writeHead(404).end('not found'); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/u3`;

const browser = await chromium.launch();
try {
  for (const width of [375, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 812 }, deviceScaleFactor: 2 });
    await page.goto(`${base}?screen=fit-name&bare=1`, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="fit-row-b"] [data-testid="pet-card-name"]', { timeout: 10_000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(120); // 字号是微任务里批量写的，等一帧
    const rows = await page.evaluate(() => {
      const read = (label) => [...document.querySelectorAll(`[data-testid="fit-row-${label}"] [data-testid="pet-card-name"]`)].map((node) => {
        const el = node;
        const heading = el.closest('h3');
        const size = Number.parseFloat(getComputedStyle(el).fontSize);
        return {
          text: el.textContent ?? '',
          size,
          available: Math.round(heading.clientWidth),
          natural: Math.round(el.scrollWidth),
          truncated: el.scrollWidth > heading.clientWidth + 1,
        };
      });
      return { a: read('a'), b: read('b') };
    });
    console.log(`\n${width}px`);
    console.log('  A 现状(10/10)  ' + rows.a.map((r) => `${r.text} ${r.size}px${r.truncated ? '（截断）' : ''}`).join(' | '));
    console.log('  B 恢复(12/9)   ' + rows.b.map((r) => `${r.text} ${r.size}px 可用${r.available}/自然${r.natural}${r.truncated ? '（截断）' : ''}`).join(' | '));
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
