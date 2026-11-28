#!/usr/bin/env node
/**
 * 现状扫描：统计 src/ui/**（不含测试）与 src/index.css 里实际使用的
 * 字号 / 间距 / 圆角 / 颜色档位，输出「现状用了几套」。
 *
 * 用途：给 tokens 收敛提供可复算的证据，避免手抄数字。
 * 跑法：node docs/preview/DESIGN-kit/scan-tokens.mjs
 *       node docs/preview/DESIGN-kit/scan-tokens.mjs --json   （机器可读）
 *
 * 口径：
 * - 只算 class 名 / CSS 声明；注释里的 `text-[10px]` 也会被计入，
 *   因为它同样说明这套写法在扩散。
 * - Tailwind 间距单位 → px 按根字号 16px 折算（1 = 4px）。横屏会把 html 字号放大，
 *   那是缩放而不是另一套档位，这里不重复计数。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const UI_DIR = join(ROOT, 'src', 'ui');
const INDEX_CSS = join(ROOT, 'src', 'index.css');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|css)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const uiFiles = walk(UI_DIR);
const cssFiles = [INDEX_CSS];

const PATTERNS = {
  fontSizeArbitrary: /\btext-\[(\d+(?:\.\d+)?)px\]/g,
  fontSizeScale: /\btext-(xs|sm|base|lg|xl|2xl|3xl|4xl)\b/g,
  padding: /\b(p|px|py|pt|pb|pl|pr)-(\d+(?:\.\d+)?|px|\[[^\]]+\])/g,
  margin: /\b(m|mx|my|mt|mb|ml|mr)-(\d+(?:\.\d+)?|px|\[[^\]]+\])/g,
  gap: /\b(gap|gap-x|gap-y|space-x|space-y)-(\d+(?:\.\d+)?|px|\[[^\]]+\])/g,
  radius:
    /\brounded(?:-(?:t|r|b|l|tl|tr|br|bl))?(?:-(none|sm|md|lg|xl|2xl|3xl|full|\[[^\]]+\]))?/g,
  color:
    /\b(?:text|bg|border|ring|from|via|to|divide|fill|stroke|shadow|outline|decoration)-(emerald|slate|gray|sky|rose|amber|red|green|blue|indigo|violet|purple|pink|fuchsia|teal|cyan|lime|yellow|orange|stone|zinc|neutral)-(50|100|200|300|400|500|600|700|800|900|950)\b/g,
  cssFontSize: /font-size:\s*([^;}\n]+)/g,
  cssInkHex: /(?<![\w-])#[0-9a-fA-F]{3,8}\b/g,
};

const TW_FONT = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30, '4xl': 36 };
const TW_RADIUS = { none: 0, sm: 2, md: 6, lg: 8, xl: 12, '2xl': 16, '3xl': 24, full: 9999 };

/** Tailwind 间距单位 → px */
function spacePx(raw) {
  if (raw === 'px') return 1;
  const arbitrary = /^\[(.+)\]$/.exec(raw);
  if (arbitrary) {
    const px = /^(\d+(?:\.\d+)?)px$/.exec(arbitrary[1]);
    if (px) return Number(px[1]);
    return null;
  }
  return Number(raw) * 4;
}

/** 圆角 class → px（任意值 `[3px]` 也折算成数字） */
function radiusPx(key) {
  if (key === 'DEFAULT') return 4;
  if (key in TW_RADIUS) return TW_RADIUS[key];
  const arbitrary = /^\[(\d+(?:\.\d+)?)px\]$/.exec(key);
  if (arbitrary) return Number(arbitrary[1]);
  return key;
}

function tally(map, key, file) {
  const entry = map.get(key) ?? { hits: 0, files: new Set() };
  entry.hits += 1;
  entry.files.add(file);
  map.set(key, entry);
}

function scan(files, { includeCss }) {
  const fsArbitrary = new Map();
  const fsScale = new Map();
  const padding = new Map();
  const margin = new Map();
  const gap = new Map();
  const radius = new Map();
  const colors = new Map();
  const cssFont = new Map();
  const cssHex = new Map();

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const rel = relative(ROOT, file).split(sep).join('/');

    for (const m of text.matchAll(PATTERNS.fontSizeArbitrary)) tally(fsArbitrary, Number(m[1]), rel);
    for (const m of text.matchAll(PATTERNS.fontSizeScale)) tally(fsScale, m[1], rel);
    for (const m of text.matchAll(PATTERNS.padding)) tally(padding, `${m[1]}\u0000${m[2]}`, rel);
    for (const m of text.matchAll(PATTERNS.margin)) tally(margin, `${m[1]}\u0000${m[2]}`, rel);
    for (const m of text.matchAll(PATTERNS.gap)) tally(gap, `${m[1]}\u0000${m[2]}`, rel);
    for (const m of text.matchAll(PATTERNS.radius)) tally(radius, m[1] ?? 'DEFAULT', rel);
    for (const m of text.matchAll(PATTERNS.color)) tally(colors, `${m[1]}-${m[2]}`, rel);

    if (includeCss) {
      for (const m of text.matchAll(PATTERNS.cssFontSize)) tally(cssFont, m[1].trim(), rel);
      for (const m of text.matchAll(PATTERNS.cssInkHex)) tally(cssHex, m[0].toLowerCase(), rel);
    }
  }
  return { fsArbitrary, fsScale, padding, margin, gap, radius, colors, cssFont, cssHex };
}

const ui = scan(uiFiles, { includeCss: false });
const css = scan(cssFiles, { includeCss: true });

const keysOf = (map) => [...map.keys()];
const hitsOf = (map) => [...map.values()].reduce((sum, e) => sum + e.hits, 0);
const asc = (a, b) => (typeof a === 'number' ? a - b : String(a).localeCompare(String(b)));

/** 把 p-2 / px-1.5 这类按 px 归一，统计真正不同的间距档 */
function spacingValues(map) {
  const values = new Map();
  for (const [key, entry] of map) {
    const [prefix, raw] = key.split('\u0000');
    const px = spacePx(raw);
    if (px == null) continue;
    const prev = values.get(px) ?? { hits: 0, keys: new Set() };
    prev.hits += entry.hits;
    prev.keys.add(`${prefix}-${raw}`);
    values.set(px, prev);
  }
  return values;
}

const classNames = (map) => [...map.keys()].map((key) => key.replace('\u0000', '-')).sort(asc);

const fontPx = new Map();
for (const [n, entry] of ui.fsArbitrary) fontPx.set(n, (fontPx.get(n) ?? 0) + entry.hits);
for (const [k, entry] of ui.fsScale)
  fontPx.set(TW_FONT[k], (fontPx.get(TW_FONT[k]) ?? 0) + entry.hits);

const padValues = spacingValues(ui.padding);
const marginValues = spacingValues(ui.margin);
const gapValues = spacingValues(ui.gap);

const radiusValues = new Map();
for (const [key, entry] of ui.radius) {
  const px = radiusPx(key);
  radiusValues.set(px, (radiusValues.get(px) ?? 0) + entry.hits);
}

const familyCount = new Map();
for (const [key, entry] of ui.colors) {
  const family = key.split('-')[0];
  familyCount.set(family, (familyCount.get(family) ?? 0) + entry.hits);
}

const result = {
  scanned: { uiFiles: uiFiles.length, cssFiles: cssFiles.length },
  fontSize: {
    distinctLegacy: fontPx.size,
    px: [...fontPx.keys()].sort(asc),
    counts: [...fontPx.entries()].sort((a, b) => a[0] - b[0]),
    hits: [...fontPx.values()].reduce((a, b) => a + b, 0),
    arbitraryPx: keysOf(ui.fsArbitrary).sort(asc),
    arbitraryPxHits: hitsOf(ui.fsArbitrary),
    tailwindScale: keysOf(ui.fsScale).sort(asc),
    tailwindScaleHits: hitsOf(ui.fsScale),
  },
  padding: {
    distinctClasses: ui.padding.size,
    hits: hitsOf(ui.padding),
    px: [...padValues.keys()].sort(asc),
    classPreview: classNames(ui.padding),
  },
  margin: {
    distinctClasses: ui.margin.size,
    hits: hitsOf(ui.margin),
    px: [...marginValues.keys()].sort(asc),
    classPreview: classNames(ui.margin),
  },
  gap: {
    distinctClasses: ui.gap.size,
    hits: hitsOf(ui.gap),
    px: [...gapValues.keys()].sort(asc),
    classPreview: classNames(ui.gap),
  },
  radius: {
    distinctClasses: ui.radius.size,
    hits: hitsOf(ui.radius),
    px: [...radiusValues.keys()].sort(asc),
    counts: [...radiusValues.entries()].sort((a, b) => b[1] - a[1]),
    classPreview: classNames(ui.radius),
  },
  color: {
    families: [...familyCount.entries()].sort((a, b) => b[1] - a[1]),
    distinctShades: ui.colors.size,
    top: [...ui.colors.entries()]
      .sort((a, b) => b[1].hits - a[1].hits)
      .slice(0, 24)
      .map(([key, entry]) => [key, entry.hits]),
  },
  css: {
    fontSize: [...css.cssFont.entries()]
      .map(([v, e]) => [v, e.hits])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30),
    hex: [...css.cssHex.entries()]
      .map(([v, e]) => [v, e.hits])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30),
    distinctHex: css.cssHex.size,
  },
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(result, null, 2));
} else {
  const line = (label, value) => console.log(`${label.padEnd(10)} ${value}`);
  console.log(`扫描范围：src/ui/**（${uiFiles.length} 个文件，不含测试）+ src/index.css\n`);
  line('字号', `实际出现 ${result.fontSize.distinctLegacy} 种（${result.fontSize.hits} 处）`);
  line('', result.fontSize.px.map((n) => `${n}px`).join(' / ') || '无');
  line(
    '  任意px',
    result.fontSize.arbitraryPx.join(' / ') + `（${result.fontSize.arbitraryPxHits} 处）`,
  );
  line(
    '  最常用',
    result.fontSize.counts
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([n, c]) => `${n}px×${c}`)
      .join('  '),
  );
  line(
    '  Tailwind',
    (result.fontSize.tailwindScale.join(' / ') || '无') +
      `（${result.fontSize.tailwindScaleHits} 处）`,
  );
  line(
    '内边距',
    `${result.padding.px.length} 档（${result.padding.px.join(' / ')}），${result.padding.distinctClasses} 个 class 写法`,
  );
  line(
    '外边距',
    `${result.margin.px.length} 档（${result.margin.px.join(' / ')}），${result.margin.distinctClasses} 个 class 写法`,
  );
  line(
    'gap',
    `${result.gap.px.length} 档（${result.gap.px.join(' / ')}），${result.gap.distinctClasses} 个 class 写法`,
  );
  line('圆角', `${result.radius.px.length} 种（${result.radius.px.join(' / ')}）`);
  line('颜色', `${result.color.families.length} 个色系 / ${result.color.distinctShades} 个档位`);
  line('  色系', result.color.families.map(([f, n]) => `${f}×${n}`).join('  '));
  line(
    '  前10',
    result.color.top
      .slice(0, 10)
      .map(([k, n]) => `${k}×${n}`)
      .join('  '),
  );
  line('CSS字号', result.css.fontSize.slice(0, 14).map(([v, n]) => `${v}×${n}`).join('  '));
  line('CSS色值', `${result.css.distinctHex} 个不同 hex`);
}
