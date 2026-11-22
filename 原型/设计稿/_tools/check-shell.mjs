/**
 * 外壳自检（阶段 0 验收）：证明外壳本身没毛病，再去画页面。
 *
 * 检查项：
 *   1. 打开 外壳.html 不报 JS 错误；
 *   2. 标题栏 47px、页签 41px、合计 88px，与线上实测一致；
 *   3. 375 / 390 并排时两个 iframe 的真实视口宽度就是 375 / 390；
 *   4. 参考线、元素边框、状态切换真的生效；
 *   5. 顺手截 4 张图给用户看：375、390、并排、开着参考线与边框。
 *
 * 用法：node 原型/设计稿/_tools/check-shell.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE = pathToFileURL(path.join(HERE, '..', '_shell', '外壳.html')).href;
const OUT = path.resolve(HERE, '..', '_baseline', '_work', '外壳自检');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();
const errors = [];
const results = [];

function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function open(search = '', viewport = { width: 1280, height: 1000 }) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, locale: 'zh-CN' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(PAGE + search, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  return { ctx, page };
}

/* ---------------- 1. 单宽度 375：量骨架 + 截图 ---------------- */
{
  const { ctx, page } = await open('?w=375');
  const m = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const r = (el) => (el ? el.getBoundingClientRect() : null);
    const rootStyle = getComputedStyle(document.documentElement);
    return {
      tokenFont: rootStyle.getPropertyValue('--font-sans').trim(),
      tokenChromeH: rootStyle.getPropertyValue('--chrome-header-h').trim(),
      tokenAccent: rootStyle.getPropertyValue('--accent').trim(),
      headerH: r(q('.chrome-header'))?.height ?? null,
      navH: r(q('.chrome-nav'))?.height ?? null,
      deviceW: r(q('.shell-device'))?.width ?? null,
      deviceH: r(q('.shell-device'))?.height ?? null,
      pageW: r(q('.proto-page'))?.width ?? null,
      tabs: [...document.querySelectorAll('.chrome-tab')].map((b) => b.textContent),
      active: q('.chrome-tab[aria-current="page"]')?.textContent ?? null,
      title: q('.chrome-title')?.textContent ?? null,
      shell: !!q('.shell'),
      barButtons: [...document.querySelectorAll('.shell-bar button')].map((b) => b.textContent),
    };
  });
  const inner = await page.evaluate(() => {
    const d = document.querySelector('.shell-device');
    return { clientWidth: d.clientWidth, clientHeight: d.clientHeight };
  });
  // token 一道兜底：CSS 注释里写坏一个 `*/` 就会让整个 :root 失效，这里会立刻露馅。
  check('tokens.css 已生效（--font-sans 有值）', m.tokenFont.length > 0, m.tokenFont || '空');
  check('tokens.css 已生效（--accent 有值）', m.tokenAccent.length > 0, m.tokenAccent || '空');
  check('标题栏 47px', Math.round(m.headerH) === 47, `实测 ${m.headerH}`);
  check('页签 41px', Math.round(m.navH) === 41, `实测 ${m.navH}`);
  check('设备内容宽 = 375（描边不吃宽度）', inner.clientWidth === 375, `clientWidth=${inner.clientWidth}`);
  check('页面容器宽 375（max-w-md 未触顶）', Math.round(m.pageW) === 375, `实测 ${m.pageW}`);
  check('五页签齐全（2026-11-22 起：附近并入我的、小组合并进换蛋）', m.tabs.join('/') === '看板/家园/收集/换蛋/我的', m.tabs.join('/'));
  check('当前页签高亮 = 外壳自检所在页（看板）', m.active === '看板', String(m.active));
  check('标题是小布助手', m.title === '小布助手', String(m.title));
  await page.screenshot({ path: path.join(OUT, '375-单宽.png'), fullPage: false });
  await ctx.close();
}

/* ---------------- 2. 单宽度 390 + 参考线 + 边框 ---------------- */
{
  const { ctx, page } = await open('?w=390&guides=1&outline=1');
  const m = await page.evaluate(() => {
    const d = document.querySelector('.shell-device');
    return {
      clientWidth: d.clientWidth,
      guidesVisible: !document.querySelector('[data-shell-part="guides"]').hidden,
      outlineOn: document.body.classList.contains('shell-outline'),
      pressed: [...document.querySelectorAll('.shell-bar button[aria-pressed="true"]')].map((b) => b.textContent),
    };
  });
  check('设备内容宽 = 390', m.clientWidth === 390, `clientWidth=${m.clientWidth}`);
  check('参考线已开', m.guidesVisible, `guidesVisible=${m.guidesVisible}`);
  check('元素边框已开', m.outlineOn, `outlineOn=${m.outlineOn}`);
  check('工具栏按钮状态回显正确', m.pressed.includes('390') && m.pressed.includes('参考线') && m.pressed.includes('元素边框'), m.pressed.join(','));
  await page.screenshot({ path: path.join(OUT, '390-参考线边框.png'), fullPage: false });
  await ctx.close();
}

/* ---------------- 3. 并排：两个真实视口 ---------------- */
{
  const { ctx, page } = await open('?w=both');
  await page.waitForTimeout(1200);
  const frames = page.frames().filter((f) => f !== page.mainFrame());
  const widths = [];
  for (const f of frames) {
    const w = await f.evaluate(() => ({
      innerWidth: window.innerWidth,
      chromeH: document.querySelector('.chrome-header')?.getBoundingClientRect().height ?? null,
      navH: document.querySelector('.chrome-nav')?.getBoundingClientRect().height ?? null,
      embed: document.body.classList.contains('shell-embed'),
    }));
    widths.push(w);
  }
  check('并排有两个 iframe', frames.length === 2, `frames=${frames.length}`);
  const sorted = widths.map((w) => w.innerWidth).sort((a, b) => a - b);
  check('两个 iframe 视口 = 375 / 390', sorted.join(',') === '375,390', sorted.join(','));
  check('iframe 内骨架也是 47 + 41', widths.every((w) => Math.round(w.chromeH) === 47 && Math.round(w.navH) === 41), JSON.stringify(widths.map((w) => [w.chromeH, w.navH])));
  await page.screenshot({ path: path.join(OUT, '并排-375与390.png'), fullPage: false });
  await ctx.close();
}

/* ---------------- 4. 状态切换真的换内容 ---------------- */
{
  const { ctx, page } = await open('?w=375');
  const before = await page.locator('.demo-data').first().isVisible();
  await page.getByRole('button', { name: '空', exact: true }).click();
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({
    state: document.body.dataset.state,
    dataVisible: getComputedStyle(document.querySelector('.demo-data')).display !== 'none',
    emptyVisible: getComputedStyle(document.querySelector('.demo-state[data-for="empty"]')).display !== 'none',
  }));
  check('默认态：内容可见', before, `before=${before}`);
  check('切到空态：data-state = empty', after.state === 'empty', after.state);
  check('切到空态：内容块隐藏、空态块出现', !after.dataVisible && after.emptyVisible, JSON.stringify(after));
  await page.screenshot({ path: path.join(OUT, '375-空态.png'), fullPage: false });
  await ctx.close();
}

/* ---------------- 5. 并排下切状态，两侧一起换 ---------------- */
{
  const { ctx, page } = await open('?w=both');
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: '异常', exact: true }).click();
  await page.waitForTimeout(900);
  const states = [];
  for (const f of page.frames().filter((x) => x !== page.mainFrame())) {
    states.push(await f.evaluate(() => document.body.dataset.state));
  }
  check('并排下切「异常」两侧同步', states.length === 2 && states.every((s) => s === 'error'), states.join(','));
  await ctx.close();
}

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log('\n' + '─'.repeat(60));
console.log(`通过 ${results.length - failed.length} / ${results.length}`);
if (errors.length) {
  console.log('⚠ 控制台错误：');
  errors.forEach((e) => console.log('  ' + e));
} else {
  console.log('控制台无错误');
}
console.log(`截图：${path.relative(process.cwd(), OUT)}`);
process.exit(failed.length || errors.length ? 1 : 0);
