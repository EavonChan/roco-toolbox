#!/usr/bin/env node
/**
 * AV1 实现截图：默认头像 / 换头像弹层 / 已设置后的页头，375 × 390。
 *
 *   npm run dev -- --port 5237 --strictPort   # 另开一个终端
 *   node tools/preview/av1/shot-impl.mjs
 *   → docs/preview/AV1-实现-<宽>-<状态>.png
 *
 * 走真实页面（`?mock=group` 假后端）：mock 账号是「阿岚」，本机已有两份假快照，
 * 所以弹层里列的是它自己导入的精灵，不是全图鉴。
 * 「已设置」这一屏用 localStorage 预置头像值（等价于上一次设置成功后的本机状态），
 * 因为 mock 没有实现 PUT /api/sync。
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const OUT = path.join(ROOT, 'docs', 'preview');
const BASE = process.env.AV1_BASE ?? 'http://localhost:5237/';
const AVATAR = JSON.stringify({ v: 1, accountId: 'mock-me', kind: 'pet', gameId: 3007 });

const SIZES = [
  { width: 375, height: 812 },
  { width: 390, height: 844 },
];

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

async function openProfile(browser, size, { avatar }) {
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 2 });
  if (avatar) {
    await context.addInitScript((value) => {
      window.localStorage.setItem('roco.profileAvatar', value);
    }, AVATAR);
  }
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
  return { page, errors };
}

const report = [];
const browser = await chromium.launch();
try {
  for (const size of SIZES) {
    // 1. 默认头像（没设置过）
    {
      const { page, errors } = await openProfile(browser, size, { avatar: false });
      const name = await page.locator('[data-testid="profile-header-name"]').innerText();
      const avatar = await page.locator('[data-testid="profile-header-avatar"]').innerText();
      const file = path.join(OUT, `AV1-实现-${size.width}-1-默认头像.png`);
      await page.screenshot({ path: file });
      console.log(`${size.width}  默认头像        名字「${name.trim()}」 首字「${avatar.trim()}」  ${path.relative(ROOT, file)}`);
      if (errors.length) report.push(`默认头像/${size.width}: ${errors.join(' | ')}`);
      await page.context().close();
    }

    // 2. 换头像弹层
    {
      const { page, errors } = await openProfile(browser, size, { avatar: false });
      await page.locator('[data-testid="profile-header-avatar"]').click();
      await page.waitForSelector('[data-testid="avatar-picker"]', { timeout: 5000 });
      await page.waitForTimeout(250);
      const options = await page.locator('[data-testid^="avatar-option-"]').count();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      const file = path.join(OUT, `AV1-实现-${size.width}-2-换头像弹层.png`);
      await page.screenshot({ path: file });
      console.log(`${size.width}  换头像弹层      候选 ${options} 个  横向溢出 ${overflow ? '有' : '无'}  ${path.relative(ROOT, file)}`);
      if (options < 2) report.push(`弹层/${size.width}: 候选只有 ${options} 个`);
      if (overflow) report.push(`弹层/${size.width}: 横向溢出`);
      if (errors.length) report.push(`弹层/${size.width}: ${errors.join(' | ')}`);
      await page.context().close();
    }

    // 3. 已设置后的页头（预置本机头像值）
    {
      const { page, errors } = await openProfile(browser, size, { avatar: true });
      await page.waitForSelector('[data-testid="profile-header-avatar"] img', { timeout: 5000 });
      const src = await page.locator('[data-testid="profile-header-avatar"] img').getAttribute('src');
      const file = path.join(OUT, `AV1-实现-${size.width}-3-已设置头像.png`);
      await page.screenshot({ path: file });
      console.log(`${size.width}  已设置头像      ${src?.includes('/3007/') ? '精灵 3007' : src}  ${path.relative(ROOT, file)}`);
      if (!src?.includes('/3007/')) report.push(`已设置/${size.width}: 头像地址不对 ${src}`);
      if (errors.length) report.push(`已设置/${size.width}: ${errors.join(' | ')}`);
      await page.context().close();
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
  console.log('\n全部 6 张：弹层有候选、头像已设置、无横向溢出、无页面错误。');
}
