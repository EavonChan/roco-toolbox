/**
 * 线上基准截图（阶段 0：只读线上，不改线上）。
 *
 * 做什么：
 * 1. 打开基准站（默认 test，最新构建；`--base` 可切正式站）
 * 2. 关掉首访引导（只写本机 localStorage，不动线上）
 * 3. 导入一份工具箱备份，让页面有真实内容（只写本机 localStorage）
 * 4. 在 375 / 390 两档宽度下，按真实点击路径逐页整页截图
 * 5. 顺带把关键元素的计算样式 dump 成 JSON，供 tokens.css 对照
 *
 * 用法：
 *   node 原型/设计稿/_tools/capture-baseline.mjs
 *   node 原型/设计稿/_tools/capture-baseline.mjs --widths 375
 *   node 原型/设计稿/_tools/capture-baseline.mjs --no-data             # 只截首访空数据态
 *   node 原型/设计稿/_tools/capture-baseline.mjs --base https://roco-toolbox.pages.dev
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES, mobileContext, resolveBase, dismissOverlays, gotoPage, settlePage } from './lib/nav.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(HERE, '..', '_baseline');
const SAMPLE_BACKUP = path.resolve(HERE, '..', '..', '..', '补充数据', '洛克工具箱备份-2026-11-01 千.json');

const argv = process.argv.slice(2);
const argOf = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const BASE_URL = resolveBase(argv);
const widths = (argOf('--widths') ?? '375,390').split(',').map(Number);
const withData = !argv.includes('--no-data');

/** 导入一份备份（等同于用户点「导入游戏数据」选文件），只落本机浏览器存储。 */
async function importSampleData(page, log) {
  const input = page.locator('input[type="file"]').first();
  if (!(await input.count())) {
    log('未找到文件选择框，跳过数据导入');
    return false;
  }
  await input.setInputFiles(SAMPLE_BACKUP);
  await page.waitForTimeout(3500);
  log('已导入样例备份');
  return true;
}

/** 取一份「真实渲染出来的」样式表，token 以线上实测为准，不靠猜。 */
async function dumpStyles(page) {
  return page.evaluate(() => {
    const pick = (el, props) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      return Object.fromEntries(props.map((p) => [p, cs.getPropertyValue(p)]));
    };
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: +r.width.toFixed(2), h: +r.height.toFixed(2), x: +r.x.toFixed(2), y: +r.y.toFixed(2) };
    };
    const TEXT = ['font-size', 'line-height', 'font-weight', 'color', 'font-family'];
    const BOX = ['background-color', 'border-radius', 'padding', 'box-shadow', 'border-width', 'border-color'];

    const navBtn = document.querySelector('nav[data-tour="tab-nav"] button');
    const cards = Array.from(document.querySelectorAll('div.rounded-2xl, div.rounded-xl'));
    const card = cards.find((c) => c.className.includes('bg-white')) ?? cards[0];
    const h1 = document.querySelector('h1');
    const p = document.querySelector('p');

    return {
      url: location.href,
      body: pick(document.body, [...TEXT, ...BOX]),
      page: pick(document.querySelector('main'), ['padding', 'max-width']),
      nav: pick(document.querySelector('nav[data-tour="tab-nav"]'), BOX),
      navButton: { ...pick(navBtn, [...TEXT, ...BOX]), rect: rect(navBtn) },
      card: { ...pick(card, [...BOX, 'padding']), rect: rect(card), className: card?.className ?? null },
      h1: { ...pick(h1, TEXT), rect: rect(h1) },
      paragraph: pick(p, TEXT),
      scroll: {
        docHeight: document.documentElement.scrollHeight,
        docWidth: document.documentElement.scrollWidth,
        innerHeight: window.innerHeight,
        innerWidth: window.innerWidth,
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      },
      visibleVersion: (document.body.innerText.match(/版本[^\n]{0,40}/g) ?? [null]).pop(),
    };
  });
}

const stamp = new Date().toISOString();
await mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch();
const records = [];

for (const width of widths) {
  const context = await mobileContext(browser, width);
  const page = await context.newPage();
  const log = (m) => console.log(`[${width}] ${m}`);

  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(1200);
  await dismissOverlays(page, log);
  if (withData) await importSampleData(page, log);

  for (const target of PAGES) {
    // 每页都先回到默认落点（我的·游戏数据）再走真实点击路径，保证与用户操作一致
    await page.evaluate(() => window.localStorage.setItem('roco.lastTab', 'import'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    await dismissOverlays(page, log);

    await gotoPage(page, target, log);
    if (withData) await settlePage(page, log);

    const suffix = withData ? '' : '-空数据';
    const file = path.join(OUT_DIR, `${target.id}-${width}${suffix}.png`);
    await page.screenshot({ path: file, fullPage: true });
    const styles = await dumpStyles(page);
    records.push({ page: target.id, label: target.label, width, file: path.relative(process.cwd(), file), ...styles });
    log(
      `${target.id} ${styles.scroll.docWidth}×${styles.scroll.docHeight}` +
        `${styles.scroll.horizontalOverflow ? ' ⚠ 横向溢出' : ''}`,
    );
  }

  await context.close();
}

await browser.close();
await writeFile(
  path.join(OUT_DIR, '基线信息.json'),
  JSON.stringify({ capturedAt: stamp, baseUrl: BASE_URL, widths, withSampleData: withData, records }, null, 2),
  'utf8',
);
console.log(`\n完成：${records.length} 张，信息写入 _baseline/基线信息.json`);
