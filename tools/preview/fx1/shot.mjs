#!/usr/bin/env node
/**
 * FX1 手感截图：「我的」页四条手感修复（2026-11-28）。
 *
 *   npm run dev -- --port 5241 --strictPort   # 另开一个终端
 *   node tools/preview/fx1/shot.mjs
 *   → docs/preview/FX1-375-*.png
 *
 * 走真实页面（`?mock=group` 假后端，已登录 mock 账号），375×812：
 * 1) 首屏：概览卡右上角不再有伪「同步」按钮；
 * 2) 点「采集数据」后：落点块标题「本机采集」完整可见（不被 88px sticky 头盖住）；
 * 3) 按下态：鼠标按住列表行时的背景反馈；
 * 4) 返回后：滚到底 → 进「我的身份」→ 返回，滚动位置恢复。
 *
 * 输出同时打印实测数字（scrollY / 目标块 top / 顶栏高），不是只看图。
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const OUT = path.join(ROOT, 'docs', 'preview');
const BASE = process.env.FX1_BASE ?? 'http://localhost:5241/';
const SIZE = { width: 375, height: 812 };

async function dismissOverlays(page) {
  const changelogOk = page.locator('[data-testid="changelog-ok"]');
  if (await changelogOk.count()) await changelogOk.first().click().catch(() => {});
  for (let i = 0; i < 12; i += 1) {
    if (!(await page.locator('[data-testid="tour-root"]').count())) return;
    const done = page.locator('[data-testid="tour-done"]');
    const skip = page.locator('[data-testid="tour-skip"]');
    if (await done.count()) await done.first().click().catch(() => {});
    else if (await skip.count()) await skip.first().click().catch(() => {});
    else return;
    await page.waitForTimeout(120);
  }
}

const report = [];
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(`${BASE}?mock=group`, { waitUntil: 'load' });
  await page.waitForSelector('nav[data-tour="tab-nav"]', { timeout: 15_000 });
  await page.getByRole('button', { name: '我的', exact: true }).first().click();
  await page.waitForSelector('[data-testid="profile-header"]', { timeout: 10_000 });
  await dismissOverlays(page);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(250);

  // ---- 1. 首屏：概览卡右上角没有伪「同步」按钮 ----
  const headerActions = await page.locator('[data-testid="profile-header-action"]').count();
  const headerText = await page.locator('[data-testid="profile-header"]').innerText();
  await page.screenshot({ path: path.join(OUT, 'FX1-375-1-首屏-无伪同步.png') });
  report.push({
    shot: 'FX1-375-1-首屏-无伪同步.png',
    headerActions,
    headerHasSync: headerText.includes('同步'),
  });

  // ---- 2. 点「采集数据」：落点块标题要完整可见 ----
  await page.getByTestId('profile-entry-collect').click();
  await page.waitForTimeout(800); // smooth 滚动落定
  const landing = await page.evaluate(() => {
    const block = document.querySelector('[data-testid="profile-collect"]');
    const heading = block?.querySelector('h2');
    const header = document.querySelector('div.sticky.top-0');
    return {
      scrollY: Math.round(window.scrollY),
      blockTop: Math.round(block?.getBoundingClientRect().top ?? -1),
      headingTop: Math.round(heading?.getBoundingClientRect().top ?? -1),
      headerHeight: Math.round(header?.getBoundingClientRect().height ?? 0),
    };
  });
  await page.screenshot({ path: path.join(OUT, 'FX1-375-2-点采集数据后-标题可见.png') });
  report.push({ shot: 'FX1-375-2-点采集数据后-标题可见.png', ...landing });

  // ---- 3. 按下态：滚到底 → 按住「我的身份」行不松开时截图 ----
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);
  const yBefore = await page.evaluate(() => Math.round(window.scrollY));
  const identityRow = page.getByTestId('profile-section-identity');
  const box = await identityRow.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(80);
  const pressedBg = await identityRow.evaluate((el) => getComputedStyle(el).backgroundColor);
  await page.screenshot({ path: path.join(OUT, 'FX1-375-3-按下态-我的身份行.png') });
  await page.mouse.up();
  report.push({ shot: 'FX1-375-3-按下态-我的身份行.png', pressedBg, scrollYAtPress: yBefore });

  // ---- 4. 返回：「我的身份」→ 返回我的，位置恢复到离开前 ----
  await page.waitForSelector('[data-testid="profile-identity-intro"]', { timeout: 10_000 });
  await page.waitForTimeout(300);
  const scrollAtIdentity = await page.evaluate(() => Math.round(window.scrollY));
  await page.getByTestId('profile-section-data').click();
  await page.waitForTimeout(500);
  const backAt = await page.evaluate(() => ({
    scrollY: Math.round(window.scrollY),
    headerVisible: Boolean(document.querySelector('[data-testid="profile-header"]')),
  }));
  await page.screenshot({ path: path.join(OUT, 'FX1-375-4-返回后-位置恢复.png') });
  report.push({
    shot: 'FX1-375-4-返回后-位置恢复.png',
    scrollBeforeLeaving: yBefore,
    // 进二级页应该滚顶（0），返回后回到离开前的位置
    scrollAtIdentity,
    ...backAt,
  });

  report.push({ pageErrors: errors });
} finally {
  await browser.close();
}

const pass =
  report[0].headerActions === 0 &&
  report[0].headerHasSync === false &&
  report[1].headingTop >= report[1].headerHeight &&
  report[2].scrollYAtPress > 0 &&
  report[3].scrollAtIdentity === 0 &&
  report[3].scrollY === report[3].scrollBeforeLeaving &&
  report[3].headerVisible &&
  report[4].pageErrors.length === 0;

console.log(JSON.stringify(report, null, 2));
console.log(pass ? 'PASS：四条都符合预期。' : 'FAIL：见上面的实测数字。');
process.exit(pass ? 0 : 1);
