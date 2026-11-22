/**
 * 设计稿截图（通用）：把某一页在 375 / 390 下整页截出来，顺手报横向溢出。
 *
 * 走的是「被嵌页」模式（`?embed=1`）：页面自己就是视口，没有评审台外框，
 * 于是截图尺寸和线上基准图完全可比（375 就是 375，不会多出边框那 1px）。
 *
 * 用法：
 *   node 原型/设计稿/_tools/shoot.mjs 精灵卡专题
 *   node 原型/设计稿/_tools/shoot.mjs 精灵卡专题 --state empty
 *   node 原型/设计稿/_tools/shoot.mjs 精灵卡专题 --guides 1     # 连参考线一起截
 *
 * 产出：_baseline/_work/<页面>-<宽度>.png
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = path.resolve(ROOT, '_baseline/_work');

const argOf = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const pageId = process.argv[2];
const state = argOf('--state') ?? 'default';
if (!pageId) {
  console.error('用法：node 原型/设计稿/_tools/shoot.mjs <页面目录名> [--state empty]');
  process.exit(2);
}

const target = pathToFileURL(path.join(ROOT, pageId, 'index.html')).href;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const errors = [];
for (const width of [375, 390]) {
  const ctx = await browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 812 },
    deviceScaleFactor: 2,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${width}: ${e}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`${width}: ${m.text()}`);
  });
  await page.goto(`${target}?embed=1&w=${width}&state=${state}${argOf('--guides') === '1' ? '&guides=1' : ''}`, {
    waitUntil: 'load',
  });
  // 头像来自官方 CDN，等图片解码完再截，否则会截到空白
  await page.waitForFunction(
    () => [...document.querySelectorAll('img')].every((i) => i.complete),
    { timeout: 20000 },
  ).catch(() => {});
  await page.waitForTimeout(600);
  const info = await page.evaluate(() => ({
    docWidth: document.documentElement.scrollWidth,
    docHeight: document.documentElement.scrollHeight,
    innerWidth: window.innerWidth,
    embed: document.body.classList.contains('shell-embed'),
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    brokenImages: [...document.querySelectorAll('img')].filter((i) => i.complete && i.naturalWidth === 0).length,
    images: document.querySelectorAll('img').length,
  }));
  const file = path.join(OUT, `${pageId}-${width}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(
    `${width}: ${info.docWidth}×${info.docHeight} 图片 ${info.images}（坏 ${info.brokenImages}）` +
      `${info.embed ? '' : ' ⚠ 不在 embed 模式'}${info.horizontalOverflow ? ' ⚠ 横向溢出' : ''}`,
  );
  await ctx.close();
}
await browser.close();
if (errors.length) {
  console.log('⚠ 控制台错误：');
  errors.forEach((e) => console.log('  ' + e));
} else {
  console.log('控制台无错误');
}
console.log(`截图：${path.relative(process.cwd(), OUT)}`);
