#!/usr/bin/env node
/**
 * B3 截图：「我的 · 小组」组卡按钮改名后的样子（375 / 390），给用户看文案与那一行小字。
 *
 *   npm run dev -- --port 5199 --strictPort      # 先起 dev server，再跑本脚本
 *   node tools/preview/b3/shot.mjs
 *   → docs/preview/B3-绑定引导/*.png
 *
 * 两种状态都用 `?mock=group`（假后端：已登录 + 已在组 + 已导入两份假快照）：
 * - 已发布：mock 默认状态 → 按钮「已绑定的账号」；
 * - 未发布：把「我」在假后端里的已发布资源清空 → 按钮「绑定游戏账号」。
 *
 * 注意（2026-11-27 实测，抄 tools/preview/b2/shot.mjs 的坑）：dev server 开着时用
 * 「原子写」保存脚本本身，Vite 的 FSWatcher 会在 Windows 上抛 EBUSY 把 dev server 带崩。
 * 改脚本前先停 dev server。
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const OUT = path.join(ROOT, 'docs', 'preview', 'B3-绑定引导');
const BASE = process.env.B3_BASE ?? 'http://localhost:5199/';
const SIZES = [
  { tag: '375', width: 375, height: 812 },
  { tag: '390', width: 390, height: 844 },
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

async function dismissOverlays(page) {
  const changelogOk = page.locator('[data-testid="changelog-ok"]');
  if (await changelogOk.count()) await changelogOk.first().click().catch(() => {});
  for (let i = 0; i < 12; i += 1) {
    if (!(await page.locator('[data-testid="tour-root"]').count())) return;
    const done = page.locator('[data-testid="tour-done"]');
    const skip = page.locator('[data-testid="tour-skip"]');
    if (await done.count()) await done.first().click().catch(() => {});
    else if (await skip.count()) await skip.first().click().catch(() => {});
    else break;
    await page.waitForTimeout(120);
  }
}

async function gotoGroupCard(page) {
  await page.goto(`${BASE}?mock=group`, { waitUntil: 'load' });
  await page.waitForSelector('nav[data-tour="tab-nav"]', { timeout: 15_000 });
  await dismissOverlays(page);
  await page.getByRole('button', { name: '我的', exact: true }).first().click();
  await dismissOverlays(page);
  await page.waitForTimeout(400);
  await page.locator('[data-testid="profile-section-groups"]').first().click();
  await page.waitForTimeout(1200);
  await dismissOverlays(page);
}

for (const size of SIZES) {
  const page = await browser.newPage({ viewport: size, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

  await gotoGroupCard(page);
  const badge = page.locator('[data-testid="group-publication-badge"]');
  const edit = page.locator('[data-testid="group-edit-resources"]');
  const hint = page.locator('[data-testid="group-bind-hint"]');
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

  console.log(`[${size.tag}] 已发布态：${(await badge.first().innerText()).trim()} / 按钮「${(await edit.first().innerText()).trim()}」 / 小字「${(await hint.first().innerText()).trim()}」`);
  await page.screenshot({ path: path.join(OUT, `B3-${size.tag}-已绑定.png`) });
  console.log(`  横向溢出：${(await overflow()) ? '有' : '无'}`);

  // 未发布：清掉假后端里「我」的已发布资源，再点刷新
  const cleared = await page.evaluate(() => {
    const state = window.__mockGroup;
    if (!state) return false;
    const me = state.group.members.find((item) => item.accountId === state.me);
    if (!me) return false;
    me.resource = null;
    me.resourceRevision = 0;
    return true;
  });
  if (!cleared) {
    console.log(`[${size.tag}] 跳过未发布态：拿不到 __mockGroup`);
    await page.close();
    continue;
  }
  await page.locator('[data-testid="group-refresh"]').first().click();
  await page.waitForTimeout(1200);
  await dismissOverlays(page);

  console.log(`[${size.tag}] 未绑定态：${(await badge.first().innerText()).trim()} / 按钮「${(await edit.first().innerText()).trim()}」 / 小字「${(await hint.first().innerText()).trim()}」`);
  await page.screenshot({ path: path.join(OUT, `B3-${size.tag}-未绑定.png`) });
  console.log(`  横向溢出：${(await overflow()) ? '有' : '无'}`);

  // 展开选号面板：确认按钮变成「收起」，小字仍在
  await edit.first().click();
  await page.waitForTimeout(600);
  console.log(`[${size.tag}] 展开后按钮「${(await edit.first().innerText()).trim()}」`);
  await page.screenshot({ path: path.join(OUT, `B3-${size.tag}-展开选号.png`) });
  console.log(`  横向溢出：${(await overflow()) ? '有' : '无'}`);

  if (errors.length) console.log(`  [${size.tag} 页面错误] ${errors.join(' | ')}`);
  await page.close();
}

await browser.close();
console.log(`\n输出目录：${path.relative(ROOT, OUT)}`);
