/**
 * 组件规格截图：把 components/<name>/spec.html 在 375 / 390 下整页截出来。
 *
 * 用法：
 *   node 原型/设计稿/_tools/capture-component.mjs pet-card
 *
 * 产出：components/<name>/<name>-375.png、<name>-390.png
 * 同时报告：文档高度、横向溢出、坏图、控制台错误 —— 有任一异常会以非 0 退出。
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const name = process.argv[2];
if (!name) {
  console.error('用法：node 原型/设计稿/_tools/capture-component.mjs <组件名>');
  process.exit(2);
}
const specPath = path.join(ROOT, 'components', name, 'spec.html');
if (!existsSync(specPath)) {
  console.error(`找不到 ${specPath}`);
  process.exit(2);
}

const browser = await chromium.launch();
let bad = 0;
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
  await page.goto(pathToFileURL(specPath).href, { waitUntil: 'load' });
  await page
    .waitForFunction(() => [...document.images].every((i) => i.complete), { timeout: 20000 })
    .catch(() => {});
  await page.waitForTimeout(300);

  const info = await page.evaluate(() => ({
    docH: document.documentElement.scrollHeight,
    docW: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
    broken: [...document.images].filter((i) => i.complete && i.naturalWidth === 0).length,
    cards: document.querySelectorAll('.pc, .pair-card, .seg, .progress-card, .notice, .chip, .modal, .demand-card').length,
  }));

  const out = path.join(ROOT, 'components', name, `${name}-${width}.png`);
  await page.screenshot({ path: out, fullPage: true });

  const overflow = info.docW > info.viewport + 1;
  const ok = !overflow && info.broken === 0 && errors.length === 0;
  if (!ok) bad += 1;
  console.log(
    `${width}: ${info.docW}×${info.docH} 组件实例 ${info.cards} 个 坏图 ${info.broken} ` +
      `横向溢出 ${overflow ? '是 ✗' : '否 ✓'} 控制台错误 ${errors.length}`,
  );
  if (errors.length) console.log('   ' + errors.slice(0, 3).join(' | '));
  console.log(`   → components/${name}/${name}-${width}.png`);
  await ctx.close();
}
await browser.close();
process.exit(bad === 0 ? 0 : 1);
