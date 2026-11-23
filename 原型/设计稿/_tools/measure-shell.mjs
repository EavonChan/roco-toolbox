/**
 * 外壳骨架实测（阶段 0）：把「标题栏 / 主表签 / 页面容器 / 卡片」的真实尺寸量出来。
 * 只读线上，不写任何东西。输出供 tokens.css、shell.css 与 README 引用。
 *
 * 用法：node 原型/设计稿/_tools/measure-shell.mjs [--width 375]
 */
import { chromium } from 'playwright';

const width = Number(process.argv[process.argv.indexOf('--width') + 1]) || 375;
const BROWSE = 'https://roco-toolbox.pages.dev';

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width, height: 812 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
});
const page = await context.newPage();
await page.goto(BROWSE, { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForTimeout(1200);
for (let i = 0; i < 6; i += 1) {
  const btn = page.getByRole('button', { name: '跳过', exact: true }).first();
  if (!(await btn.count()) || !(await btn.isVisible().catch(() => false))) break;
  await btn.click().catch(() => {});
  await page.waitForTimeout(350);
}

const out = await page.evaluate(() => {
  const cs = (el) => (el ? getComputedStyle(el) : null);
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { w: +r.width.toFixed(2), h: +r.height.toFixed(2), x: +r.x.toFixed(2), y: +r.y.toFixed(2) };
  };
  const style = (el, props) => {
    const s = cs(el);
    if (!s) return null;
    return Object.fromEntries(props.map((p) => [p, s.getPropertyValue(p)]));
  };
  const TEXT = ['font-size', 'line-height', 'font-weight', 'color', 'letter-spacing'];
  const BOX = ['background-color', 'border-radius', 'padding', 'box-shadow', 'border-width', 'border-color', 'border-style'];

  const header = document.querySelector('header');
  const headerTitle = document.querySelector('h1, header div');
  const headerButtons = Array.from(document.querySelectorAll('header button'));
  const nav = document.querySelector('nav[data-tour="tab-nav"]');
  const main = document.querySelector('main');
  const root = document.getElementById('root');
  const firstCard = document.querySelector('main div.rounded-2xl, main div.rounded-xl');

  return {
    width: window.innerWidth,
    htmlBg: style(document.documentElement, ['background-color']),
    bodyBg: style(document.body, ['background-color']),
    bodyText: style(document.body, [...TEXT, 'font-family']),
    rootBg: style(root, ['background-color']),
    main: {
      ...style(main, [...BOX, 'max-width', 'margin-left', 'margin-right']),
      box: box(main),
      childrenGap: main ? getComputedStyle(main).rowGap : null,
    },
    header: { ...style(header, [...BOX, 'height', 'position', 'z-index']), box: box(header) },
    headerTitle: { ...style(headerTitle, TEXT), box: box(headerTitle) },
    headerButtons: headerButtons.slice(0, 2).map((b) => ({
      label: (b.textContent || '').trim(),
      ...style(b, [...TEXT, ...BOX, 'min-height']),
      box: box(b),
    })),
    nav: { ...style(nav, [...BOX]), box: box(nav) },
    navItems: Array.from(document.querySelectorAll('nav[data-tour="tab-nav"] button')).map((b) => ({
      label: b.getAttribute('aria-label'),
      ...style(b, [...TEXT, 'border-bottom-width', 'border-bottom-color', 'min-height', 'flex']),
      box: box(b),
    })),
    firstCard: {
      className: firstCard?.className ?? null,
      ...style(firstCard, [...BOX]),
      box: box(firstCard),
    },
  };
});

console.log(JSON.stringify(out, null, 2));
await browser.close();
