#!/usr/bin/env node
/**
 * U3 对比拼图：两行（375 / 390）× 三列（家园现状 / 广场现状 / 广场对齐后）。
 *
 *   node tools/preview/u3/compose.mjs
 *   → docs/preview/U3-现状vs改后-2026-11-25.png
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
  { file: '现状-家园-有选角色', label: '家园 · 我的蛋仓（有角色下拉）' },
  { file: '现状-广场-没有选角色', label: '换蛋 · 我的蛋仓（现状：没有角色下拉）' },
  { file: '改后-广场-有选角色', label: '换蛋 · 我的蛋仓（对齐后）' },
];

/** 用 data URL 内联：`setContent` 的页面没有 file:// 权限，直接写 file:// 会全是裂图。 */
const dataUrl = async (file) => `data:image/png;base64,${(await readFile(file)).toString('base64')}`;
const cells = (await Promise.all(ROWS.flatMap((row) => COLS.map(async (col) => `
  <figure>
    <figcaption>${row.tag} · ${col.label}</figcaption>
    <img src="${await dataUrl(path.join(PREVIEW, `U3-${row.width}-${col.file}.png`))}" style="width:${row.width}px"/>
  </figure>`)))).join('');

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/>
<style>
  body { margin: 0; background: #f1f5f9; font: 13px/1.4 system-ui, "Segoe UI", "Microsoft YaHei", sans-serif; color: #0f172a; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  p { margin: 0 0 12px; color: #475569; font-size: 12px; }
  .page { padding: 16px; }
  .grid { display: grid; grid-template-columns: repeat(3, auto); gap: 14px; justify-content: start; }
  figure { margin: 0; display: flex; flex-direction: column; gap: 6px; }
  figcaption { font-size: 12px; font-weight: 600; color: #334155; }
  img { display: block; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; }
</style></head><body><div class="page">
<h1>U3 · 换蛋广场蛋仓 ↔ 家园蛋仓：角色选择对齐</h1>
<p>截图由仓库里的真实组件（EggStockPanel / EggCharacterSelect / eggCharactersOf）+ 假数据渲染：阿甲 5 颗、阿乙 3 颗、阿丙 0 颗。左两列是现状，右列是本轮建议的样子。</p>
<div class="grid">${cells}</div>
</div></body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1220, height: 900 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  const file = path.join(PREVIEW, 'U3-现状vs改后-2026-11-25.png');
  await page.screenshot({ path: file, fullPage: true });
  console.log(`[u3] ${path.relative(ROOT, file)}`);
} finally {
  await browser.close();
}
