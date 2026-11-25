#!/usr/bin/env node
/**
 * U3「返回」对比拼图：两列 × 三行（现状 / 方向 A / 方向 B+C），用 390 的图。
 *
 *   node tools/preview/u3/compose-return.mjs
 *   → docs/preview/U3-返回对比-2026-11-25.png
 */
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const PREVIEW = path.join(ROOT, 'docs', 'preview');

const ROWS = [
  { label: '现状', left: { file: 'U3-390-现状-家园-有选角色.png', caption: '家园：标题+下拉在左，返回家园在最右（页头里）' },
    right: { file: 'U3-390-现状-广场-没有选角色.png', caption: '广场：‹ 返回 在标题左边，没有下拉' } },
  { label: '方向 A（推荐）', left: { file: 'U3-390-返回A-家园-左侧返回.png', caption: '家园：‹ 返回 + 我的蛋仓 + 下拉（页头里）' },
    right: { file: 'U3-390-改后-广场-有选角色.png', caption: '广场：一样的三件套（这一侧本来就是 ‹ 返回）' } },
  { label: '方向 B / C', left: { file: 'U3-390-返回B-广场-右侧返回换蛋.png', caption: '方向 B：广场改成右侧「返回换蛋」边框按钮' },
    right: { file: 'U3-390-返回C-家园-内容行.png', caption: '方向 C：家园蛋仓自己出内容行（页头隐藏，标题随内容滚走）' } },
];

const dataUrl = async (file) => `data:image/png;base64,${(await readFile(path.join(PREVIEW, file))).toString('base64')}`;

const rows = (await Promise.all(ROWS.map(async (row) => `
  <section>
    <h2>${row.label}</h2>
    <div class="pair">
      <figure><figcaption>${row.left.caption}</figcaption><img src="${await dataUrl(row.left.file)}"/></figure>
      <figure><figcaption>${row.right.caption}</figcaption><img src="${await dataUrl(row.right.file)}"/></figure>
    </div>
  </section>`))).join('');

const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"/>
<style>
  body { margin: 0; background: #f1f5f9; font: 13px/1.4 system-ui, "Segoe UI", "Microsoft YaHei", sans-serif; color: #0f172a; }
  .page { padding: 16px; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  p.lead { margin: 0 0 14px; color: #475569; font-size: 12px; }
  h2 { font-size: 13px; margin: 0 0 6px; color: #0f766e; }
  section { margin-bottom: 14px; }
  .pair { display: flex; gap: 14px; }
  figure { margin: 0; display: flex; flex-direction: column; gap: 6px; }
  figcaption { font-size: 12px; font-weight: 600; color: #334155; max-width: 390px; }
  img { display: block; width: 390px; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; }
</style></head><body><div class="page">
<h1>U3 · 两处蛋仓的「返回」对齐（2026-11-25 用户反馈）</h1>
<p class="lead">现在：家园把返回放在页头最右（返回家园），广场把 ‹ 返回 放在标题左边 —— 同一件事两种做法，看着像两个页面。下面三个方向都是真实组件渲染，横屏两侧本来就一致（竖排标题栏里都是「返回家园 / 返回换蛋」）。</p>
${rows}
</div></body></html>`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 860, height: 900 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  const file = path.join(PREVIEW, 'U3-返回对比-2026-11-25.png');
  await page.screenshot({ path: file, fullPage: true });
  console.log(`[u3] ${path.relative(ROOT, file)}`);
} finally {
  await browser.close();
}
