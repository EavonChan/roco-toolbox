#!/usr/bin/env node
/**
 * U5 对比拼图：两行（375 / 390）× 五列（现状 / 聚合 / 点开 / 筛选 / 抽屉备选）。
 *
 *   node tools/preview/u5/compose.mjs
 *   → docs/preview/U5-方案总览-2026-11-25.png
 */
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const PREVIEW = path.join(ROOT, 'docs', 'preview');

const ROWS = [
  { width: 375, tag: '375' },
  { width: 390, tag: '390' },
];
const COLS = [
  { file: '1-现状-5颗占5格', label: '① 现状：5 颗占 5 格' },
  { file: '2-聚合-一张卡x5', label: '② 聚合：一张卡 ×5' },
  { file: '3-就地展开-按性格分组', label: '③ 点开：就地展开（按性格分组，拍板）' },
  { file: '4-筛选已标注-x4共5', label: '④ 筛选「已标注」：×4/5' },
];

/** 用 data URL 内联：`setContent` 的页面没有 file:// 权限，直接写 file:// 会全是裂图。 */
const dataUrl = async (file) => `data:image/png;base64,${(await readFile(file)).toString('base64')}`;
const cells = (await Promise.all(ROWS.flatMap((row) => COLS.map(async (col) => `
  <figure>
    <figcaption>${row.tag} · ${col.label}</figcaption>
    <img src="${await dataUrl(path.join(PREVIEW, `U5-${row.width}-${col.file}.png`))}" style="width:${row.width}px"/>
  </figure>`)))).join('');

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/>
<style>
  body { margin: 0; background: #f1f5f9; font: 13px/1.4 system-ui, "Segoe UI", "Microsoft YaHei", sans-serif; color: #0f172a; }
  h1 { font-size: 17px; margin: 0 0 4px; }
  p { margin: 0 0 12px; color: #475569; font-size: 12px; }
  .page { padding: 16px; }
  .grid { display: grid; grid-template-columns: repeat(4, auto); gap: 14px; justify-content: start; }
  figure { margin: 0; display: flex; flex-direction: column; gap: 6px; }
  figcaption { font-size: 12px; font-weight: 600; color: #334155; }
  img { display: block; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; }
</style></head><body><div class="page">
<h1>U5 · 蛋仓同类蛋聚合：现状 vs 聚合后</h1>
<p>假数据 8 颗：白发懒人 5 颗（1 已挂出 / 1 未挂出 / 1 换蛋中 / 1 在家园 / 1 待认领；性格平和×4 + 冷静×1）+ 喵喵 / 水蓝蓝 / 火花。① 是仓库里的真实组件渲染，②~④ 是本方案原型（tools/preview/u5，不进 src/）。</p>
<div class="grid">${cells}</div>
</div></body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1720, height: 1200 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  const file = path.join(PREVIEW, 'U5-方案总览-2026-11-25.png');
  await page.screenshot({ path: file, fullPage: true });
  console.log(`[u5] ${path.relative(ROOT, file)}`);
} finally {
  await browser.close();
}
