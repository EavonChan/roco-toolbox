/**
 * 登录态基准截图（只读线上数据）。
 *
 * 为什么单独一支：换蛋（原小组）、家园、我的·小组 都要登录才看得到真实数据，
 * 而样例备份里没有云端的小组数据。
 *
 * 纪律（别改，改了就可能在别人的云端数据上动手脚）：
 * 1. 登录前**不导入任何本机数据** —— 本机是空的，登录只可能「拉云端」，不会把本机内容推上去；
 * 2. 全程不点「立即同步」「用本机覆盖云端」；
 * 3. 出现「云端有另一份更新的数据」冲突就停手，交人工决定。
 *
 * 用法：
 *   node 原型/设计稿/_tools/capture-logged-in.mjs --user <用户名> --pass <密码> --width 375
 *   node 原型/设计稿/_tools/capture-logged-in.mjs --user <用户名> --pass <密码> --width 390
 *   node 原型/设计稿/_tools/capture-logged-in.mjs ... --base https://roco-toolbox.pages.dev
 *
 * 产出：_baseline/登录态/<页面>-<宽度>.png + 登录态信息-<宽度>.json
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES, mobileContext, resolveBase, dismissOverlays, gotoPage, settlePage } from './lib/nav.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(HERE, '..', '_baseline', '登录态');

const argv = process.argv.slice(2);
const argOf = (name) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const BASE_URL = resolveBase(argv);
const USER = argOf('--user');
const PASS = argOf('--pass');
const WIDTH = Number(argOf('--width') ?? 375);

if (!USER || !PASS) {
  console.error('需要 --user 与 --pass（密码 8-32 位）');
  process.exit(2);
}

const stamp = new Date().toISOString();
await mkdir(OUT_DIR, { recursive: true });
const browser = await chromium.launch();
const context = await mobileContext(browser, WIDTH);
const page = await context.newPage();
const log = (m) => console.log(`[${WIDTH}] ${m}`);

await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForTimeout(1000);
await dismissOverlays(page, log);

/* —— 登录：我的 → 我的身份 → 登录 —— */
await page.getByRole('button', { name: '我的', exact: true }).first().click();
await page.waitForTimeout(900);
await dismissOverlays(page, log);
await page.getByRole('button', { name: '我的身份', exact: true }).first().click();
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(OUT_DIR, `00-登录前-${WIDTH}.png`), fullPage: true });

const loginMode = page.getByTestId('account-mode-login');
if (await loginMode.count()) {
  await loginMode.click();
  await page.waitForTimeout(300);
}
await page.getByTestId('account-username-input').fill(USER);
await page.getByTestId('account-password-input').fill(PASS);
await page.getByTestId('account-login').click({ timeout: 20000 });
await page.waitForTimeout(6000);
await page.waitForLoadState('networkidle').catch(() => {});
await page.waitForTimeout(1500);
await dismissOverlays(page, log);

const loginResult = await page.evaluate(() => ({
  message: document.querySelector('[data-testid="account-message"]')?.textContent?.trim() ?? null,
  error: document.querySelector('[data-testid="account-error"]')?.textContent?.trim() ?? null,
  conflict: !!document.querySelector('[data-testid="account-conflict"]'),
  bodyHead: (document.body.innerText || '').slice(0, 300),
}));
log(`登录结果：${loginResult.message ?? loginResult.error ?? '（无提示，通常是登录成功已刷新）'}`);
if (loginResult.conflict) log('⚠ 出现「云端有更新数据」冲突提示，已停手不点');

/* —— 逐页截图（登录态）—— */
const records = [];
for (const target of PAGES) {
  await page.getByRole('button', { name: '我的', exact: true }).first().click();
  await page.waitForTimeout(600);
  await dismissOverlays(page, log);
  await gotoPage(page, target, log);
  await settlePage(page, log);

  const file = path.join(OUT_DIR, `${target.id}-${WIDTH}.png`);
  await page.screenshot({ path: file, fullPage: true });
  const info = await page.evaluate(() => ({
    docHeight: document.documentElement.scrollHeight,
    docWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
    textHead: (document.body.innerText || '').slice(0, 160).replace(/\n+/g, ' / '),
  }));
  records.push({ page: target.id, label: target.label, width: WIDTH, file: path.relative(process.cwd(), file), ...info });
  log(`${target.id} ${info.docWidth}×${info.docHeight}${info.horizontalOverflow ? ' ⚠ 横向溢出' : ''}`);
}

const jsonPath = path.join(OUT_DIR, `登录态信息-${WIDTH}.json`);
await writeFile(
  jsonPath,
  JSON.stringify({ capturedAt: stamp, baseUrl: BASE_URL, width: WIDTH, user: USER, loginResult, records }, null, 2),
  'utf8',
);
await browser.close();
console.log(`\n完成：信息写入 ${path.relative(process.cwd(), jsonPath)}`);
