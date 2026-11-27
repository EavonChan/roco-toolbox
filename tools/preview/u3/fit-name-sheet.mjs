#!/usr/bin/env node
/**
 * 字号对比：A（现状 10/10）vs B（恢复 12/9）在 375 / 390 下的同一排卡。
 *
 *   node tools/preview/u3/fit-name-sheet.mjs
 *
 * 产出：
 *   docs/preview/U3-{375,390}-字号-A现状.png     （只有名字那一排卡片的元素截图）
 *   docs/preview/U3-{375,390}-字号-B恢复.png
 *   docs/preview/U3-字号对比-2026-11-26.png      （拼图 + 实测字号）
 * 顺带打印每个名字的实际字号（证据），并额外量一遍 320 窄屏（只看机制，不出图）。
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const PREVIEW = path.join(ROOT, 'docs', 'preview');
const HTML = path.join(PREVIEW, 'U3-蛋仓角色对齐-2026-11-25.html');

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
const measure = async (page) => page.evaluate(() => {
  const read = (label) => [...document.querySelectorAll(`[data-testid="fit-row-${label}"] [data-testid="pet-card-name"]`)].map((node) => {
    const heading = node.closest('h3');
    return {
      text: node.textContent ?? '',
      size: Number.parseFloat(getComputedStyle(node).fontSize),
      available: Math.round(heading.clientWidth),
      truncated: node.scrollWidth > heading.clientWidth + 1,
    };
  });
  return { a: read('a'), b: read('b') };
});

const results = {};
try {
  for (const width of [375, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 2 });
    await page.goto(`${base}?screen=fit-name&bare=1`, { waitUntil: 'load' });
    await page.waitForSelector('[data-testid="fit-row-b"] [data-testid="pet-card-name"]', { timeout: 10_000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(150);
    results[width] = await measure(page);
    if (width !== 320) {
      await page.locator('[data-testid="fit-row-a"]').screenshot({ path: path.join(PREVIEW, `U3-${width}-字号-A现状.png`) });
      await page.locator('[data-testid="fit-row-b"]').screenshot({ path: path.join(PREVIEW, `U3-${width}-字号-B恢复.png`) });
      await page.screenshot({ path: path.join(PREVIEW, `U3-${width}-字号-整屏.png`) });
    }
    console.log(`${width}px  A: ${results[width].a.map((r) => `${r.text} ${r.size}px`).join(' | ')}`);
    console.log(`${width}px  B: ${results[width].b.map((r) => `${r.text} ${r.size}px（可用${r.available}${r.truncated ? '，截断' : ''}）`).join(' | ')}`);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

const dataUrl = async (file) => `data:image/png;base64,${(await readFile(path.join(PREVIEW, file))).toString('base64')}`;
const caption = (rows) => rows.map((r) => `${r.text} ${r.size}px`).join(' · ');
const rows = (await Promise.all([375, 390].map(async (width) => `
  <section>
    <h2>${width}px</h2>
    <div class="pair">
      <figure><figcaption>A · 现状：10px（${caption(results[width].a)}）</figcaption><img src="${await dataUrl(`U3-${width}-字号-A现状.png`)}" style="width:${width * 1.6}px"/></figure>
      <figure><figcaption>B · 恢复：12→9（${caption(results[width].b)}）</figcaption><img src="${await dataUrl(`U3-${width}-字号-B恢复.png`)}" style="width:${width * 1.6}px"/></figure>
    </div>
  </section>`))).join('');

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
  body { margin: 0; background: #f1f5f9; font: 13px/1.4 system-ui, "Segoe UI", "Microsoft YaHei", sans-serif; color: #0f172a; }
  .page { padding: 16px; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  p.lead { margin: 0 0 14px; color: #475569; font-size: 12px; max-width: 1400px; }
  h2 { font-size: 12px; margin: 0 0 6px; color: #0f766e; }
  section { margin-bottom: 16px; }
  .pair { display: flex; gap: 16px; align-items: flex-start; }
  figure { margin: 0; display: flex; flex-direction: column; gap: 6px; }
  figcaption { font-size: 12px; font-weight: 600; color: #334155; }
  img { display: block; border: 1px solid #cbd5e1; border-radius: 10px; background: #f8fafc; }
</style></head><body><div class="page">
<h1>卡名字号：A 现状（10px）vs B 恢复（base 12 / min 9）</h1>
<p class="lead">同一批卡、同一排、同一批名字（睡铃雪影娃娃 6 字 / 蒲公英娃娃、白金独角兽 5 字 / 喵喵 2 字对照）。图片按 1.6× 放大便于看字号差别；括号里是浏览器实测字号。<br/>
A = 现在：fitName 但 base = min = 10（466351b 之后），永远不缩、超宽靠截断。B = 朋友的参数化（56f23cd）：基准 12px，超出卡片宽度按实测比例缩，下限 9px。</p>
${rows}
<p class="lead">补充：在 375/390 的 4 列卡里，最长 6 字的名字只把 12px 缩到 11.5px，9px 下限其实用不到；320 窄屏才会真正落到 10px 以下（机制证明）。</p>
</div></body></html>`;

const sheetBrowser = await chromium.launch();
try {
  const shot = await sheetBrowser.newPage({ viewport: { width: 1320, height: 900 }, deviceScaleFactor: 1 });
  await shot.setContent(html, { waitUntil: 'load' });
  await shot.waitForTimeout(250);
  const file = path.join(PREVIEW, 'U3-字号对比-2026-11-26.png');
  await shot.screenshot({ path: file, fullPage: true });
  console.log(`[u3] ${path.relative(ROOT, file)}`);
} finally {
  await sheetBrowser.close();
}
