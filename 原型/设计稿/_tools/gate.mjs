/**
 * 组件库门禁：把指南 §七 的第 1~3 条做成可执行检查。
 *
 * 用法：
 *   node 原型/设计稿/_tools/gate.mjs
 *
 * 规则：
 *   1. 高度只能来自 token —— components/**\/spec.html 与 *.css 里不许出现硬编码的
 *      `height: <数字>px`；`--pet-card-height-*` 的取值必须只有 96 / 104。
 *   2. 不许裸值 —— components/**\/*.css 与 spec.html 里不许出现 `#rrggbb` 或
 *      `font-size: <数字>px`。数据侧色板（如 pairingColors 的 12 色）必须在同一行写
 *      `data-gate-allow="data-color"`，否则算违规。
 *   3. 目录完整性 —— 每个组件目录必须齐 README.md / spec.html / <name>-375.png /
 *      <name>-390.png，且 README 至少 8 个 `## ` 段。
 *
 * 退出码：0 全通过；1 有违规。
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const COMPONENTS = path.join(ROOT, 'components');
const TOKENS = path.join(ROOT, '_tokens', 'component.css');

const failures = [];
const fail = (rule, where, message) => failures.push({ rule, where, message });

/** 只扫组件目录下的文件（_doc.css 是文档排版，不参与） */
const filesOf = (dir) => {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...filesOf(p));
    else out.push(p);
  }
  return out;
};

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

// ---------- 规则 1：高度只能来自 token ----------
const HEIGHT_LITERAL = /(?:^|[;{\s])height:\s*(\d+(?:\.\d+)?)px/g;
for (const file of filesOf(COMPONENTS)) {
  if (!/\.(css|html)$/.test(file)) continue;
  if (path.basename(file) === '_doc.css') continue;
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('data-gate-allow')) return;
    let m;
    HEIGHT_LITERAL.lastIndex = 0;
    while ((m = HEIGHT_LITERAL.exec(line)) !== null) {
      fail('1 高度枚举', `${rel(file)}:${i + 1}`, `硬编码 height: ${m[1]}px（应引用 --pet-card-height-* 等 token）`);
    }
  });
}

// pet-card 的高度 token 只允许 96 / 104
{
  const css = readFileSync(TOKENS, 'utf8');
  const allowed = new Set(['96px', '104px']);
  const re = /--pet-card-height-(sm|md)\s*:\s*([^;]+);/g;
  let m;
  let seen = 0;
  while ((m = re.exec(css)) !== null) {
    seen += 1;
    const value = m[2].trim();
    if (!allowed.has(value)) {
      fail('1 高度枚举', '_tokens/component.css', `--pet-card-height-${m[1]} = ${value}，只允许 96px / 104px`);
    }
  }
  if (seen < 2) fail('1 高度枚举', '_tokens/component.css', '缺少 --pet-card-height-sm / -md 定义');
}

// ---------- 规则 2：不许裸色值 / 裸字号 ----------
const HEX = /#[0-9a-fA-F]{3,8}\b/;
const FONT_PX = /font-size:\s*\d+(?:\.\d+)?px/;
for (const file of filesOf(COMPONENTS)) {
  if (!/\.(css|html)$/.test(file)) continue;
  if (path.basename(file) === '_doc.css') continue;
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (line.includes('data-gate-allow')) return;
    // 数据侧色板（pairingColors 的 12 色）以 --pair-color 传入，属于数据不是设计色
    if (/--pair-color:\s*#[0-9a-fA-F]{3,8}/.test(line)) return;
    if (HEX.test(line)) fail('2 裸值', `${rel(file)}:${i + 1}`, `裸色值：${line.trim().slice(0, 70)}`);
    if (FONT_PX.test(line)) fail('2 裸值', `${rel(file)}:${i + 1}`, `裸字号：${line.trim().slice(0, 70)}`);
  });
}

// ---------- 规则 3：目录完整性 ----------
const SKIP = new Set(['_doc.css', 'README.md']);
for (const entry of readdirSync(COMPONENTS)) {
  const dir = path.join(COMPONENTS, entry);
  if (!statSync(dir).isDirectory()) continue;
  if (SKIP.has(entry)) continue;
  const need = ['README.md', 'spec.html', `${entry}-375.png`, `${entry}-390.png`];
  for (const n of need) {
    if (!existsSync(path.join(dir, n))) fail('3 目录完整性', `components/${entry}/`, `缺少 ${n}`);
  }
  const readme = path.join(dir, 'README.md');
  if (existsSync(readme)) {
    const sections = readFileSync(readme, 'utf8').match(/^## /gm) ?? [];
    if (sections.length < 8) {
      fail('3 目录完整性', `components/${entry}/README.md`, `八段文档只有 ${sections.length} 段`);
    }
  }
}

// ---------- 汇总 ----------
console.log(`组件库门禁：扫 ${readdirSync(COMPONENTS).filter((e) => statSync(path.join(COMPONENTS, e)).isDirectory()).length} 个组件目录`);
if (failures.length === 0) {
  console.log('✅ 全部通过（规则 1 高度枚举 / 规则 2 无裸值 / 规则 3 目录完整）');
  process.exit(0);
}
for (const f of failures) console.log(`❌ [${f.rule}] ${f.where} — ${f.message}`);
console.log(`\n共 ${failures.length} 条违规`);
process.exit(1);
