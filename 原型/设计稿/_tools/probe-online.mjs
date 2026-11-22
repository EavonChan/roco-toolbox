/**
 * 线上探针（只读）：确认 roco-toolbox.pages.dev 当前结构与首访状态。
 * 不写任何线上数据，只读 DOM 与本地存储键。
 *
 * 用法：node 原型/设计稿/_tools/probe-online.mjs
 */
import { chromium } from 'playwright';

const BASE = 'https://roco-toolbox.pages.dev';

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'zh-CN',
  timezoneId: 'Asia/Shanghai',
});
const page = await context.newPage();
await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1500);

const info = await page.evaluate(() => {
  const navButtons = Array.from(document.querySelectorAll('nav[data-tour="tab-nav"] button')).map(
    (b) => ({
      label: b.getAttribute('aria-label'),
      current: b.getAttribute('aria-current'),
      text: (b.textContent || '').trim(),
    }),
  );
  const keys = Object.keys(window.localStorage).sort();
  const dialogs = Array.from(document.querySelectorAll('[role="dialog"], dialog')).map(
    (d) => (d.textContent || '').trim().slice(0, 60),
  );
  const bodyText = (document.body.innerText || '').trim();
  return {
    title: document.title,
    url: location.href,
    navButtons,
    dialogs,
    storageKeys: keys,
    bodyTextHead: bodyText.slice(0, 600),
    docHeight: document.documentElement.scrollHeight,
    docWidth: document.documentElement.scrollWidth,
    innerHeight: window.innerHeight,
    innerWidth: window.innerWidth,
  };
});

console.log(JSON.stringify(info, null, 2));
await browser.close();
