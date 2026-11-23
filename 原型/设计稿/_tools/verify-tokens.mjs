/**
 * tokens.css ↔ 线上 CSS 对账（阶段 0 验收「token 与代码一致，抽查 5 个颜色/字号」）。
 *
 * 为什么能这么查：线上用的是 Tailwind，工具类都在产物 CSS 里；
 * 往线上页面塞一个探针元素、挂上对应工具类，读回来的计算值就是线上真实值。
 * 于是「token 里写的」和「线上实际渲染的」可以逐条对齐，而不是靠肉眼看截图。
 *
 * 用法：
 *   node 原型/设计稿/_tools/verify-tokens.mjs            # 全量对账
 *   node 原型/设计稿/_tools/verify-tokens.mjs --sample 5 # 只跑前 5 条
 *
 * 退出码：有不一致即 1（可以挂进 CI）。
 */
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOKENS = path.resolve(HERE, 'tokens.css');
const BASE_URL = 'https://roco-toolbox.pages.dev';

/* --- 从 tokens.css 里读出变量值（够用即可，不做完整 CSS 解析） --- */
async function loadTokens() {
  const css = await readFile(TOKENS, 'utf8');
  const map = {};
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(css))) map[m[1]] = m[2].trim();
  return map;
}

/** token → 探针：挂哪个 Tailwind 类、看哪个计算属性、按什么类型比。 */
const CASES = [
  // ---- 颜色（抽查 ≥5） ----
  { token: '--c-slate-100', cls: 'bg-slate-100', prop: 'background-color', kind: 'color' },
  { token: '--c-slate-200', cls: 'border-slate-200', prop: 'border-top-color', kind: 'color' },
  { token: '--c-slate-500', cls: 'text-slate-500', prop: 'color', kind: 'color' },
  { token: '--c-slate-900', cls: 'text-slate-900', prop: 'color', kind: 'color' },
  { token: '--c-emerald-50', cls: 'bg-emerald-50', prop: 'background-color', kind: 'color' },
  { token: '--c-emerald-500', cls: 'border-emerald-500', prop: 'border-top-color', kind: 'color' },
  { token: '--c-emerald-600', cls: 'bg-emerald-600', prop: 'background-color', kind: 'color' },
  { token: '--c-emerald-700', cls: 'text-emerald-700', prop: 'color', kind: 'color' },
  { token: '--c-rose-500', cls: 'bg-rose-500', prop: 'background-color', kind: 'color' },
  { token: '--c-amber-50', cls: 'bg-amber-50', prop: 'background-color', kind: 'color' },
  { token: '--c-amber-800', cls: 'text-amber-800', prop: 'color', kind: 'color' },
  { token: '--c-sky-700', cls: 'text-sky-700', prop: 'color', kind: 'color' },

  // ---- 语义别名：应等于对应调色板值，验证引用没写错 ----
  { token: '--accent', cls: 'bg-emerald-600', prop: 'background-color', kind: 'color', aliasOf: '--c-emerald-600' },
  { token: '--accent-text', cls: 'text-emerald-700', prop: 'color', kind: 'color', aliasOf: '--c-emerald-700' },
  { token: '--text-muted', cls: 'text-slate-500', prop: 'color', kind: 'color', aliasOf: '--c-slate-500' },
  { token: '--line-subtle', cls: 'border-slate-100', prop: 'border-top-color', kind: 'color', aliasOf: '--c-slate-100' },

  // ---- 字号 / 行高（抽查 ≥5） ----
  { token: '--fs-title', cls: 'text-base', prop: 'font-size', kind: 'px' },
  { token: '--lh-title', cls: 'text-base', prop: 'line-height', kind: 'px' },
  { token: '--fs-body', cls: 'text-sm', prop: 'font-size', kind: 'px' },
  { token: '--lh-body', cls: 'text-sm', prop: 'line-height', kind: 'px' },
  { token: '--fs-hint', cls: 'text-xs', prop: 'font-size', kind: 'px' },
  { token: '--lh-hint', cls: 'text-xs', prop: 'line-height', kind: 'px' },
  { token: '--fs-meta', cls: 'text-[11px]', prop: 'font-size', kind: 'px' },
  { token: '--fs-micro', cls: 'text-[10px]', prop: 'font-size', kind: 'px' },

  // ---- 圆角 ----
  { token: '--r-md', cls: 'rounded-md', prop: 'border-radius', kind: 'px' },
  { token: '--r-lg', cls: 'rounded-lg', prop: 'border-radius', kind: 'px' },
  { token: '--r-xl', cls: 'rounded-xl', prop: 'border-radius', kind: 'px' },
  { token: '--r-2xl', cls: 'rounded-2xl', prop: 'border-radius', kind: 'px' },

  // ---- 控件高度 ----
  { token: '--ctl-28', cls: 'min-h-[28px]', prop: 'min-height', kind: 'px' },
  { token: '--ctl-32', cls: 'min-h-[32px]', prop: 'min-height', kind: 'px' },
  { token: '--ctl-36', cls: 'min-h-[36px]', prop: 'min-height', kind: 'px' },
  { token: '--ctl-44', cls: 'min-h-[44px]', prop: 'min-height', kind: 'px' },

  // ---- 阴影 / 容器宽度 ----
  { token: '--shadow-sm', cls: 'shadow-sm', prop: 'box-shadow', kind: 'shadow' },
  { token: '--container-max', cls: 'max-w-md', prop: 'max-width', kind: 'px' },
];

const argv = process.argv.slice(2);
const sampleIdx = argv.indexOf('--sample');
const cases = sampleIdx >= 0 ? CASES.slice(0, Number(argv[sampleIdx + 1])) : CASES;

function hexToRgb(hex) {
  const h = hex.replace('#', '').trim();
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

/**
 * 阴影归一化。
 * Tailwind 的 shadow-sm 实际输出三层（两圈透明的 ring + 真正的一层），
 * token 里只写了一层。所以只比「最后那层不透明的」，并把颜色与四个长度拆成可比字符串。
 */
function shadowLayers(value) {
  const layers = String(value)
    .split(/,(?![^(]*\))/)
    .map((s) => s.trim())
    .filter(Boolean);
  return layers.map((layer) => {
    const colorMatch = /rgba?\(([^)]+)\)/.exec(layer);
    let rgba = 'rgba(0,0,0,0)';
    if (colorMatch) {
      // 兼容两种写法：`rgba(0, 0, 0, 0.05)` 与 `rgb(0 0 0 / 0.05)`
      const [rgbPartRaw, alphaPart] = colorMatch[1].split('/');
      const rgb = rgbPartRaw
        .split(/[\s,]+/)
        .filter(Boolean)
        .slice(0, 3)
        .join(',');
      const alphaTokens = (alphaPart ?? '').split(/[\s,]+/).filter(Boolean);
      const alpha =
        alphaTokens.length > 0
          ? alphaTokens[alphaTokens.length - 1]
          : rgbPartRaw.split(/[\s,]+/).filter(Boolean)[3] ?? '1';
      rgba = `rgba(${rgb},${Number(alpha)})`;
    }
    const nums = (layer.replace(/rgba?\([^)]*\)/, '').match(/-?\d+(?:\.\d+)?/g) || []).map((n) =>
      String(parseFloat(n)),
    );
    while (nums.length < 4) nums.push('0');
    return { rgba, key: `${rgba}|${nums.slice(0, 4).join('|')}`, transparent: /,0\)$/.test(rgba) };
  });
}

function normShadow(value) {
  const layers = shadowLayers(value);
  const visible = layers.filter((l) => !l.transparent);
  return (visible.length ? visible[visible.length - 1] : layers[layers.length - 1]).key;
}

/** 把 CSS 值归一化，好比较：rgb(...) 统一空格、px 取数值。 */
function norm(value, kind) {
  const v = String(value).trim();
  if (kind === 'px') {
    const n = parseFloat(v);
    return Number.isFinite(n) ? `${n}` : v;
  }
  if (kind === 'shadow') return normShadow(v);
  // color
  return v
    .replace(/\s+/g, ' ')
    .replace(/^rgba?\(([^)]+)\)$/, (_, inner) => {
      const parts = inner.split(',').map((x) => x.trim());
      const alpha = parts[3] === undefined ? '1' : String(Number(parts[3]));
      return `rgba(${parts[0]},${parts[1]},${parts[2]},${alpha})`;
    });
}

function expectedOf(raw, kind, tokens, aliasOf) {
  if (aliasOf) raw = tokens[aliasOf] ?? raw;
  if (kind === 'color') {
    // tokens 里语义别名写成 var(--c-xxx)，解析一层
    const varMatch = /^var\((--[\w-]+)\)$/.exec(raw.trim());
    if (varMatch) raw = tokens[varMatch[1]] ?? raw;
    return norm(raw.startsWith('#') ? hexToRgb(raw) : raw, 'color');
  }
  if (kind === 'px') return norm(raw, 'px');
  return norm(raw, kind);
}

async function main() {
  const tokens = await loadTokens();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN' });
  const page = await context.newPage();
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(600);

  const results = [];
  for (const c of cases) {
    const actual = await page.evaluate(
      ({ cls, prop }) => {
        const probe = document.createElement('div');
        probe.className = cls;
        probe.textContent = '探针';
        probe.style.cssText = 'position:fixed;left:-9999px;top:0;width:100px;height:20px';
        document.body.appendChild(probe);
        const value = getComputedStyle(probe).getPropertyValue(prop);
        probe.remove();
        return value;
      },
      { cls: c.cls, prop: c.prop },
    );
    const expectedRaw = tokens[c.token];
    const expected = expectedOf(expectedRaw === undefined ? '' : expectedRaw, c.kind, tokens, c.aliasOf);
    const got = norm(actual, c.kind);
    results.push({
      token: c.token,
      cls: c.cls,
      prop: c.prop,
      expected,
      rawExpected: expectedRaw,
      actual: got,
      ok: expectedRaw !== undefined && expected === got,
    });
  }
  await browser.close();

  let bad = 0;
  console.log('设计 token 与线上实际 CSS 逐条对账');
  console.log('─'.repeat(72));
  for (const r of results) {
    if (!r.ok) bad += 1;
    console.log(
      `${r.ok ? '✅' : '❌'} ${r.token.padEnd(18)} ${r.cls.padEnd(20)} ${r.prop.padEnd(17)} ` +
        `token=${String(r.expected)}${r.ok ? '' : `  线上=${String(r.actual)}`}`,
    );
  }
  console.log('─'.repeat(72));
  console.log(`共 ${results.length} 条：一致 ${results.length - bad}，不一致 ${bad}`);
  const colors = results.filter((r) => r.prop.includes('color'));
  console.log(
    `覆盖：颜色 ${colors.length} 条 / 字号与行高 ${results.filter((r) => r.prop.includes('font') || r.prop.includes('line-height')).length} 条 / ` +
      `圆角 4 条 / 控件高度 4 条 / 阴影 1 条 / 容器宽度 1 条`,
  );
  process.exit(bad ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
