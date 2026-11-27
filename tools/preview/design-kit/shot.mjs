#!/usr/bin/env node
/**
 * DESIGN1 画廊截图：
 *   node tools/preview/design-kit/build.mjs && node tools/preview/design-kit/shot.mjs
 *   → docs/preview/DESIGN-kit/DESIGN-kit-375.png
 *     docs/preview/DESIGN-kit/DESIGN-kit-390.png
 *     docs/preview/DESIGN-kit/DESIGN-kit-双档并排.png
 *
 * 服务只监听 127.0.0.1 随机端口，进程退出即关；
 * 截图拍的是真实 React 原语（index.html 由 build.mjs 从 src/ui/kit 打包）。
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const OUT = path.join(ROOT, 'docs', 'preview', 'DESIGN-kit');
const HTML = path.join(OUT, 'index.html');

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname !== '/' && url.pathname !== '/index.html') {
    response.writeHead(404).end('not found');
    return;
  }
  try {
    const body = await readFile(HTML);
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(body);
  } catch {
    response.writeHead(500).end('run build.mjs first');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1400 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text());
});

await page.goto(base, { waitUntil: 'load' });
await page.waitForSelector('[data-testid="gallery-columns"]');
await page.waitForTimeout(400); // 等字体与 pulse 动画落到稳定帧

const measured = await page.evaluate(() => {
  const pick = (width) => {
    const el = document.querySelector(`[data-testid="gallery-${width}"]`);
    return el ? Math.round(el.getBoundingClientRect().width) : null;
  };
  return {
    col375: pick(375),
    col390: pick(390),
    pageWidth: Math.round(document.documentElement.scrollWidth),
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
    tokenFont: getComputedStyle(document.querySelector('[data-demo="默认"]') ?? document.body).fontSize,
  };
});

if (measured.col375 !== 375 || measured.col390 !== 390) {
  throw new Error(`列宽不是 375/390：${JSON.stringify(measured)}`);
}

await page.screenshot({ path: path.join(OUT, 'DESIGN-kit-双档并排.png'), fullPage: true });
for (const width of [375, 390]) {
  await page
    .locator(`[data-testid="gallery-${width}"]`)
    .screenshot({ path: path.join(OUT, `DESIGN-kit-${width}.png`) });
}

console.log(`[design-kit] 列宽 ${measured.col375} / ${measured.col390}，整页宽 ${measured.pageWidth}，横向溢出：${measured.overflowX ? '有' : '无'}`);
if (errors.length) console.log(`[design-kit] 页面错误：${errors.join(' | ')}`);

await browser.close();
server.close();
console.log(`[design-kit] 输出：${path.relative(ROOT, OUT)}`);
