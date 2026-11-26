/**
 * F6 预览器打包：真实 EggStockPanel + 待认领假数据 → 一个可双击打开的静态 HTML。
 *   node tools/preview/f6/build.mjs
 *   → docs/preview/F6-待认领-实现预览-2026-11-27.html
 *
 * 与 u5 同一套做法：tailwind 用 App 的 src/index.css 生成同一份 CSS，
 * esbuild 把 main.tsx 打成 IIFE，/ui/... 图标转 data URL，双击打开也不裂图。
 * 产物只做设计与截图，不进 `src/`、不参与应用构建。
 */
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const CACHE = path.join(HERE, '.cache');
const OUT = path.join(ROOT, 'docs', 'preview', 'F6-待认领-实现预览-2026-11-27.html');

await mkdir(CACHE, { recursive: true });

const css = path.join(CACHE, 'preview.css');
const cli = path.join(ROOT, 'node_modules', 'tailwindcss', 'lib', 'cli.js');
const tailwind = spawnSync(process.execPath, [
  cli, '-c', path.join(HERE, 'tailwind.config.js'),
  '-i', path.join(ROOT, 'src', 'index.css'), '-o', css,
], { cwd: ROOT, stdio: 'inherit' });
if (tailwind.status !== 0) throw new Error(`tailwindcss 退出码 ${tailwind.status}`);

const js = path.join(CACHE, 'preview.js');
await build({
  entryPoints: [path.join(HERE, 'main.tsx')],
  bundle: true,
  format: 'iife',
  outfile: js,
  jsx: 'automatic',
  loader: { '.json': 'json', '.css': 'text' },
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info',
});

const [cssText, jsText] = await Promise.all([readFile(css, 'utf8'), readFile(js, 'utf8')]);

const publicPaths = new Set(jsText.match(/\/ui\/[A-Za-z0-9_./-]+\.(?:png|svg|jpg)/g) ?? []);
const inlined = {};
for (const asset of publicPaths) {
  try {
    const bytes = await readFile(path.join(ROOT, 'public', asset));
    inlined[asset] = `data:${asset.endsWith('.svg') ? 'image/svg+xml' : 'image/png'};base64,${bytes.toString('base64')}`;
  } catch {
    // 少一张图就少一张，不让预览器整体打不开
  }
}
const fixScript = `<script>(function(){var MAP=${JSON.stringify(inlined)};
function fix(img){var s=img.getAttribute('src');if(s&&MAP[s])img.setAttribute('src',MAP[s]);}
function scan(root){if(root.nodeType!==1)return;if(root.tagName==='IMG')fix(root);root.querySelectorAll('img').forEach(fix);}
scan(document.documentElement);
new MutationObserver(function(list){list.forEach(function(m){m.addedNodes.forEach(scan);});})
  .observe(document.documentElement,{childList:true,subtree:true});})();</script>`;
const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>F6 · 待认领 UI（实现预览）</title>
<style>${cssText}</style>
</head>
<body class="bg-slate-100">
<div id="root"></div>
${fixScript}
<script>${jsText}</script>
</body>
</html>
`;
await writeFile(OUT, html);
console.log(`[f6] ${path.relative(ROOT, OUT)}  ${(html.length / 1024).toFixed(0)} KB`);
