#!/usr/bin/env node
/**
 * 「我的」页重排截图（2026-11-28，提交 B）：
 *   1. 有数据：首屏 = 身份行 + 待处理数字 + 三个入口（375 / 390）
 *   2. 新用户：身份行 + 一句空态 + 导入动作（375 / 390）
 *
 *   npm run dev -- --port 5237 --strictPort
 *   node tools/preview/av1/shot-reorder.mjs
 *   → docs/preview/AV1-重排-<宽>-<状态>.png
 *
 * 数据态走真实页面 + `?mock=group`（假后端）；额外预置「小组缓存」和「蹲守名单」，
 * 前者是待办数字（待认领/待确认）取数的前提，后者是本机附近目标。
 * 新用户态不装 mock：只给会话，`/api/me` 用 Playwright 拦一个假用户名，本机没有快照。
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const OUT = path.join(ROOT, 'docs', 'preview');
const BASE = process.env.AV1_BASE ?? 'http://localhost:5237/';

const SIZES = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
];

const GROUP_CACHE = JSON.stringify({
  schemaVersion: 3,
  groups: [
    {
      id: 'mock-weekend',
      name: '周末互换',
      ownerAccountId: 'mock-me',
      memberCount: 3,
      groupType: 'mother',
      targetRevision: 1,
      targetReady: true,
    },
  ],
  savedAt: Date.now(),
});

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

async function openProfileTab(page) {
  await page.waitForSelector('nav[data-tour="tab-nav"]', { timeout: 60_000 });
  // 首启引导可能在页面一出来就盖住内容：先点掉再点页签
  await page.waitForTimeout(300);
  await dismissOverlays(page);
  await page.getByRole('button', { name: '我的', exact: true }).first().click({ force: true });
  await page.waitForSelector('[data-testid="profile-header"]', { timeout: 20_000 });
  await dismissOverlays(page);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(300);
}

const report = [];
const browser = await chromium.launch();
try {
  for (const size of SIZES) {
    /* 1. 有数据：身份 + 待处理数字 + 三个入口 */
    {
      const context = await browser.newContext({ viewport: size, deviceScaleFactor: 2 });
      await context.addInitScript(
        ([cache, targets]) => {
          window.localStorage.setItem('roco.collectionGroupCache:mock-me', cache);
          window.localStorage.setItem('roco.nearbyTargets', targets);
        },
        [GROUP_CACHE, JSON.stringify([3001, 3002])],
      );
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto(`${BASE}?mock=group`, { waitUntil: 'load' });
      await openProfileTab(page);
      await page.waitForSelector('[data-testid="profile-home"]', { timeout: 10_000 });
      await page.waitForTimeout(400);

      const sections = await page.locator('[data-testid="profile-home"]').getAttribute('data-sections');
      const todoText = await page.locator('[data-testid="profile-todos"]').innerText().catch(() => '（无待处理块）');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      const file = path.join(OUT, `AV1-重排-${size.width}-1-首屏-待处理.png`);
      await page.screenshot({ path: file });
      console.log(
        `${size.width}  首屏 ${sections}  待处理「${todoText.replace(/\s+/g, ' ').trim()}」  横向溢出 ${overflow ? '有' : '无'}  ${path.relative(ROOT, file)}`,
      );
      if (!sections?.includes('todos')) report.push(`首屏/${size.width}: 没有待处理区块`);
      if (overflow) report.push(`首屏/${size.width}: 横向溢出`);
      if (errors.length) report.push(`首屏/${size.width}: ${errors.join(' | ')}`);
      await context.close();
    }

    /* 2. 新用户：一句空态 + 导入动作 */
    {
      const context = await browser.newContext({ viewport: size, deviceScaleFactor: 2 });
      await context.addInitScript(() => {
        window.localStorage.setItem('roco.deviceToken', 'shot-token');
        window.localStorage.setItem('roco.accountId', 'acc-shot');
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('**/api/me', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, accountId: 'acc-shot', createdAt: 1, username: '训练家小明', snapshot: null }),
        }),
      );
      await page.route('**/api/event', (route) => route.fulfill({ status: 204, body: '' }));
      await page.goto(BASE, { waitUntil: 'load' });
      await openProfileTab(page);
      await page.waitForSelector('[data-testid="profile-new-user"]', { timeout: 10_000 });
      await page.waitForTimeout(300);

      const sections = await page.locator('[data-testid="profile-home"]').getAttribute('data-sections');
      const emptyText = await page.locator('[data-testid="profile-new-user-empty"]').innerText();
      const file = path.join(OUT, `AV1-重排-${size.width}-2-新用户空态.png`);
      await page.screenshot({ path: file });
      console.log(
        `${size.width}  新用户 ${sections}  空态「${emptyText.replace(/\s+/g, ' ').trim()}」  ${path.relative(ROOT, file)}`,
      );
      if (sections !== 'identity,new-user') report.push(`新用户/${size.width}: 区块组合 ${sections}`);
      if (errors.length) report.push(`新用户/${size.width}: ${errors.join(' | ')}`);
      await context.close();
    }
  }
} finally {
  await browser.close();
}

if (report.length) {
  console.error('\n=== 有问题 ===');
  for (const line of report) console.error(`- ${line}`);
  process.exitCode = 1;
} else {
  console.log('\n全部 4 张：首屏有待处理数字、新用户只有空态、无横向溢出、无页面错误。');
}
