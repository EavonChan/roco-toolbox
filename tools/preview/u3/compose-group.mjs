#!/usr/bin/env node
/**
 * 2026-11-26 对比拼图（蛋仓按角色分组 + 白卡）：
 *   node tools/preview/u3/compose-group.mjs
 *   → docs/preview/U3-分组三方案-2026-11-26.png
 *   → docs/preview/U3-分组叠加聚合-2026-11-26.png
 *   → docs/preview/U3-白卡对比-2026-11-26.png
 */
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const PREVIEW = path.join(ROOT, 'docs', 'preview');
const dataUrl = async (file) => `data:image/png;base64,${(await readFile(path.join(PREVIEW, file))).toString('base64')}`;

const SHEETS = [
  {
    out: 'U3-分组三方案-2026-11-26.png',
    title: 'U3 · 蛋仓按角色分组：三个方案（375 / 390）',
    lead: '方案 1 = 保持下拉筛选（现状增强）；方案 2 = 不分下拉，一个角色一段；方案 3 = 默认分组 + 顶部角色芯片。三张都套了白卡（与家园一致）。',
    rows: [
      { tag: '375', files: [
        { file: 'U3-375-分组-方案1-下拉筛选.png', caption: '方案 1 · 下拉筛选（选一个角色 → 只显示他）' },
        { file: 'U3-375-分组-方案2-按角色分段.png', caption: '方案 2 · 分组（阿甲 · 5 颗 / 阿乙 · 3 颗）' },
        { file: 'U3-375-分组-方案3-分组加芯片.png', caption: '方案 3 · 分组 + 角色芯片（全部 / 阿甲 / 阿乙 / 阿丙）' },
      ] },
      { tag: '390', files: [
        { file: 'U3-390-分组-方案1-下拉筛选.png', caption: '' },
        { file: 'U3-390-分组-方案2-按角色分段.png', caption: '' },
        { file: 'U3-390-分组-方案3-分组加芯片.png', caption: '' },
      ] },
    ],
  },
  {
    out: 'U3-分组叠加聚合-2026-11-26.png',
    title: 'U3 · 分组（角色级）× 同类聚合（物种级）怎么叠',
    lead: '外层是角色段（阿甲 / 阿乙），段内才是物种聚合卡（×N）。同一物种跨角色**不合并**：喵喵在阿甲段和阿乙段各有一张卡，因为蛋属于不同角色。',
    rows: [
      { tag: '375', files: [
        { file: 'U3-375-分组-方案2-按角色分段.png', caption: '只有分组：段内每颗蛋一张卡' },
        { file: 'U3-375-分组-方案2-叠加同类聚合.png', caption: '分组 + 聚合：段内按物种合成 ×N' },
      ] },
      { tag: '390', files: [
        { file: 'U3-390-分组-方案2-按角色分段.png', caption: '' },
        { file: 'U3-390-分组-方案2-叠加同类聚合.png', caption: '' },
      ] },
    ],
  },
  {
    out: 'U3-白卡对比-2026-11-26.png',
    title: 'U3 · 广场蛋仓套白卡（与家园蛋仓同一层 CARD）',
    lead: '左：现状——广场蛋仓直接铺在灰底上；右：套白卡后——和家园蛋仓一致（同一套 CARD：白底、圆角、内边距）。',
    rows: [
      { tag: '375', files: [
        { file: 'U3-375-现状-广场-没有选角色.png', caption: '现状：没有白卡（卡片直接贴灰底）' },
        { file: 'U3-375-分组-方案1-下拉筛选.png', caption: '套白卡 + 角色下拉（= 方案 1）' },
      ] },
      { tag: '390', files: [
        { file: 'U3-390-现状-广场-没有选角色.png', caption: '' },
        { file: 'U3-390-分组-方案1-下拉筛选.png', caption: '' },
      ] },
    ],
  },
];

const renderSheet = async (sheet) => {
  const rows = (await Promise.all(sheet.rows.map(async (row) => `
    <section>
      <h2>${row.tag}</h2>
      <div class="pair">${(await Promise.all(row.files.map(async (item) => `
        <figure>
          <figcaption>${item.caption || '&nbsp;'}</figcaption>
          <img src="${await dataUrl(item.file)}" style="width:${row.tag}px"/>
        </figure>`))).join('')}</div>
    </section>`))).join('');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/><style>
  body { margin: 0; background: #f1f5f9; font: 13px/1.4 system-ui, "Segoe UI", "Microsoft YaHei", sans-serif; color: #0f172a; }
  .page { padding: 16px; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  p.lead { margin: 0 0 14px; color: #475569; font-size: 12px; max-width: 1400px; }
  h2 { font-size: 12px; margin: 0 0 6px; color: #0f766e; }
  section { margin-bottom: 14px; }
  .pair { display: flex; gap: 12px; align-items: flex-start; }
  figure { margin: 0; display: flex; flex-direction: column; gap: 6px; }
  figcaption { font-size: 12px; font-weight: 600; color: #334155; max-width: 390px; min-height: 17px; }
  img { display: block; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; }
</style></head><body><div class="page">
<h1>${sheet.title}</h1><p class="lead">${sheet.lead}</p>${rows}
</div></body></html>`;
};

const browser = await chromium.launch();
try {
  for (const sheet of SHEETS) {
    const page = await browser.newPage({ viewport: { width: 1300, height: 900 }, deviceScaleFactor: 1 });
    await page.setContent(await renderSheet(sheet), { waitUntil: 'load' });
    await page.waitForTimeout(250);
    const file = path.join(PREVIEW, sheet.out);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`[u3] ${path.relative(ROOT, file)}`);
    await page.close();
  }
} finally {
  await browser.close();
}
