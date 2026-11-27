#!/usr/bin/env node
/**
 * 第 9 项「绑定三步引导条」三个方案的 375 / 390 截图（2026-11-27）。
 *
 *   不需要 dev server，直接拍静态原型：
 *   node tools/preview/b3/steps-shot.mjs
 *   → docs/preview/B3-三步引导条/{375,390}-方案A|B|C.png
 *
 * 原型：docs/preview/B3-三步引导条-方案-2026-11-27.html（#a / #b / #c 切换方案）
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const OUT = path.join(ROOT, 'docs', 'preview', 'B3-三步引导条');
const PAGE = pathToFileURL(path.join(ROOT, 'docs', 'preview', 'B3-三步引导条-方案-2026-11-27.html')).href;

const SIZES = [
  { tag: '375', width: 375, height: 812 },
  { tag: '390', width: 390, height: 844 },
];
const VARIANTS = [
  { hash: 'a', name: '方案A-组卡内联' },
  { hash: 'b', name: '方案B-面板顶部' },
  { hash: 'c', name: '方案C-页面浮条' },
];

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();

for (const size of SIZES) {
  const page = await browser.newPage({ viewport: size, deviceScaleFactor: 2 });
  for (const variant of VARIANTS) {
    await page.goto(`${PAGE}#${variant.hash}`, { waitUntil: 'load' });
    await page.waitForTimeout(80);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    const file = path.join(OUT, `${size.tag}-${variant.name}.png`);
    await page.screenshot({ path: file });
    console.log(`${size.tag} ${variant.name}  横向溢出 ${overflow ? '有' : '无'}  → ${path.relative(ROOT, file)}`);
  }
  await page.close();
}

await browser.close();
