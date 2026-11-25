#!/usr/bin/env node
/**
 * 冒烟：可交互预览双击打开（file://）也能正常出图。
 *
 *   node tools/preview/u3/check-standalone.mjs
 *
 * 只看三件事：卡片渲染出来、图片（蛋图 / 绿窝 / 奖牌）真的加载了、控制台没有报错。
 * 蛋图是远程地址，离线时允许掉成「暂无蛋图」，这里只统计已经加载成功的张数。
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const FILE = `file:///${path.join(ROOT, 'docs', 'preview', 'U3-蛋仓角色对齐-2026-11-25.html').replace(/\\/g, '/')}?screen=plaza-after&bare=1`;

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(FILE, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="stock-card"]', { timeout: 10_000 });
  await page.waitForLoadState('networkidle').catch(() => {});
  const stats = await page.evaluate(() => {
    const images = [...document.querySelectorAll('img')];
    return { total: images.length, loaded: images.filter((image) => image.naturalWidth > 0).length };
  });
  const cards = await page.locator('[data-testid="stock-card"]').count();
  console.log(`卡片 ${cards}  图片 ${stats.loaded}/${stats.total} 加载成功  控制台错误 ${errors.length}`);
  if (errors.length) console.log(`  ${errors.join(' | ')}`);
} finally {
  await browser.close();
}
