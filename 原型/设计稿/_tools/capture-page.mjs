/**
 * 页面截图：把 pages/<name>/index.html 在 375 / 390 下整页截出来。
 *
 * 用法：
 *   node 原型/设计稿/_tools/capture-page.mjs dashboard
 *   node 原型/设计稿/_tools/capture-page.mjs dashboard collection
 *
 * 产出：原型/设计稿/_截图/<name>-{375,390}.png
 * 同时报告：文档尺寸、横向溢出、坏图、控制台错误；任一异常非 0 退出。
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = path.join(ROOT, '_截图');

const names = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (names.length === 0) {
  console.error('用法：node 原型/设计稿/_tools/capture-page.mjs <页面名> [更多页面…]');
  process.exit(2);
}

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
let bad = 0;

for (const name of names) {
  const file = path.join(ROOT, 'pages', name, 'index.html');
  if (!existsSync(file)) {
    console.log(`✗ 找不到 pages/${name}/index.html`);
    bad += 1;
    continue;
  }
  for (const width of [375, 390]) {
    const ctx = await browser.newContext({
      viewport: { width, height: width === 390 ? 844 : 812 },
      deviceScaleFactor: 2,
      locale: 'zh-CN',
      timezoneId: 'Asia/Shanghai',
    });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.goto(`${pathToFileURL(file).href}?embed=1&w=${width}`, { waitUntil: 'load' });
    await page
      .waitForFunction(() => [...document.images].every((i) => i.complete), { timeout: 20000 })
      .catch(() => {});
    await page.waitForTimeout(300);

    const info = await page.evaluate(() => ({
      docH: document.documentElement.scrollHeight,
      docW: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
      broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length,
    }));
    const out = path.join(OUT, `${name}-${width}.png`);
    await page.screenshot({ path: out, fullPage: true });

    const overflow = info.docW > info.viewport + 1;
    const ok = !overflow && info.broken === 0 && errors.length === 0;
    if (!ok) bad += 1;
    console.log(
      `${name} ${width}: ${info.docW}×${info.docH} 坏图 ${info.broken} ` +
        `横向溢出 ${overflow ? '是 ✗' : '否 ✓'} 错误 ${errors.length}`,
    );
    if (errors.length) console.log('   ' + errors.slice(0, 3).join(' | '));
    await ctx.close();
  }
}
await browser.close();
process.exit(bad === 0 ? 0 : 1);
