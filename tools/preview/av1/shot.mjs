#!/usr/bin/env node
/**
 * AV1 自定义头像方案截图：375×812 / 390×844 两个手机宽度 × 七个状态。
 *
 *   node tools/preview/av1/shot.mjs
 *   → docs/preview/AV1-<宽>-<状态>.png
 *
 * 只截手机本体（`.phone`，不是整页浏览器），和 U5 / U2 的评审图口径一致。
 * 起一个只读静态服务把 docs/preview 当根目录：原型里的 AV1-assets/*.png 是相对路径，
 * file:// 下也能开，但截图统一走 http 避免不同机器的 file 安全策略差异。
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const PREVIEW = path.join(ROOT, 'docs', 'preview');
const HTML = 'AV1-自定义头像-2026-11-28.html';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.css': 'text/css',
  '.js': 'text/javascript',
};

const server = createServer(async (request, response) => {
  const file = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
  const target = path.join(PREVIEW, file === '/' ? HTML : file);
  // 只允许读 docs/preview 内的文件
  if (!target.startsWith(PREVIEW)) {
    response.writeHead(403).end('forbidden');
    return;
  }
  try {
    const body = await readFile(target);
    response.writeHead(200, { 'Content-Type': MIME[path.extname(target)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end('not found');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}/`;

const SHOTS = [
  { id: 'now', file: '0-现状-概览卡' },
  { id: 'a-home', file: 'A1-我的首页-精灵头像' },
  { id: 'a-pick', file: 'A2-选精灵-宫格' },
  { id: 'b-home', file: 'B1-我的首页-上传照片' },
  { id: 'b-crop', file: 'B2-上传-圆形裁剪' },
  { id: 'c-home', file: 'C1-我的首页-两者都支持' },
  { id: 'c-sheet', file: 'C2-头像面板-两个来源' },
  { id: 'entry', file: 'D0-入口-我的身份' },
];
const SIZES = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
];

const browser = await chromium.launch();
const problems = [];
try {
  for (const size of SIZES) {
    for (const shot of SHOTS) {
      const page = await browser.newPage({ viewport: size, deviceScaleFactor: 2 });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });
      const query = new URLSearchParams({ state: shot.id, w: String(size.width), bare: '1' });
      await page.goto(`${base}${encodeURIComponent(HTML)}?${query}`, { waitUntil: 'load' });
      await page.waitForSelector('.phone', { timeout: 10_000 });
      await page.waitForLoadState('networkidle').catch(() => {});
      // 等图片解码，避免截到半张精灵图
      await page.evaluate(async () => {
        await Promise.all(
          Array.from(document.images)
            .filter((img) => !img.complete)
            .map((img) => new Promise((resolve) => {
              img.addEventListener('load', resolve, { once: true });
              img.addEventListener('error', resolve, { once: true });
            })),
        );
      });
      await page.waitForTimeout(120);

      const metrics = await page.evaluate(() => {
        const phone = document.querySelector('.phone');
        const rect = phone.getBoundingClientRect();
        const sheet = document.querySelector('.sheet');
        return {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          overflowX: phone.scrollWidth > phone.clientWidth + 1,
          sheetHeight: sheet ? Math.round(sheet.getBoundingClientRect().height) : 0,
          sheetTop: sheet ? Math.round(sheet.getBoundingClientRect().top - rect.top) : 0,
          text: phone.innerText.replace(/\s+/g, ' ').slice(0, 220),
        };
      });

      const file = path.join(PREVIEW, `AV1-${size.width}-${shot.file}.png`);
      await page.locator('.phone').screenshot({ path: file });
      const rel = path.relative(ROOT, file);
      console.log(
        `${size.width}  ${shot.file.padEnd(24)} ${metrics.width}×${metrics.height}  横向溢出 ${metrics.overflowX ? '有' : '无'}` +
          (metrics.sheetHeight ? `  面板高 ${metrics.sheetHeight} 顶距 ${metrics.sheetTop}` : '') +
          `  ${rel}`,
      );
      if (metrics.width !== size.width) problems.push(`${rel} 宽度变成 ${metrics.width}`);
      if (metrics.height !== size.height) problems.push(`${rel} 高度变成 ${metrics.height}`);
      if (metrics.overflowX) problems.push(`${rel} 横向溢出`);
      if (metrics.sheetHeight && metrics.sheetTop < 0) problems.push(`${rel} 面板超出屏幕`);
      if (errors.length) {
        problems.push(`${rel} 页面报错：${errors.join(' | ')}`);
        console.log(`  [页面错误] ${errors.join(' | ')}`);
      }
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

if (problems.length) {
  console.error('\n=== 有问题的截图 ===');
  for (const problem of problems) console.error(`- ${problem}`);
  process.exitCode = 1;
} else {
  console.log(`\n全部 ${SIZES.length * SHOTS.length} 张：尺寸正确、无横向溢出、无页面报错。`);
}
