/**
 * DESIGN1 画廊打包：真实的 src/ui/kit 原语 → 一份可双击打开的静态 HTML。
 *
 *   node tools/preview/design-kit/build.mjs
 *   → docs/preview/DESIGN-kit/index.html
 *
 * 与 tools/preview/f6 同一套做法：
 * - tailwind 用画廊专用配置（主题继承根 tailwind.config.js）生成 CSS，
 *   扫描 src/ui/kit 与画廊自己，保证页面里出现的 class 都有样式；
 * - tokens.css 原样拼在最前面（:root 变量，不经过 tailwind，避免 @import 解析问题）；
 * - esbuild 打成 IIFE，双击打开也能跑，不依赖 dev server。
 * 产物只做设计与截图，不进 src/、不参与应用构建。
 */
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');
const CACHE = path.join(HERE, '.cache');
const OUT_DIR = path.join(ROOT, 'docs', 'preview', 'DESIGN-kit');
const OUT = path.join(OUT_DIR, 'index.html');

await mkdir(CACHE, { recursive: true });
await mkdir(OUT_DIR, { recursive: true });

const css = path.join(CACHE, 'gallery.tailwind.css');
const cli = path.join(ROOT, 'node_modules', 'tailwindcss', 'lib', 'cli.js');
const tailwind = spawnSync(
  process.execPath,
  [cli, '-c', path.join(HERE, 'tailwind.config.js'), '-i', path.join(HERE, 'gallery.css'), '-o', css, '--minify'],
  { cwd: ROOT, stdio: 'inherit' },
);
if (tailwind.status !== 0) throw new Error(`tailwindcss 退出码 ${tailwind.status}`);

const js = path.join(CACHE, 'gallery.js');
await build({
  entryPoints: [path.join(HERE, 'main.tsx')],
  bundle: true,
  format: 'iife',
  outfile: js,
  jsx: 'automatic',
  loader: { '.json': 'json' },
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info',
});

const [tokens, tailwindCss, jsText] = await Promise.all([
  readFile(path.join(ROOT, 'src', 'ui', 'kit', 'tokens.css'), 'utf8'),
  readFile(css, 'utf8'),
  readFile(js, 'utf8'),
]);

const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>DESIGN1 · tokens + 6 个基础原语</title>
<style>
${tokens}
${tailwindCss}
</style>
</head>
<body>
<div id="root"></div>
<script>${jsText}</script>
</body>
</html>
`;

await writeFile(OUT, html);
console.log(
  `[design-kit] ${path.relative(ROOT, OUT)}  ${(html.length / 1024).toFixed(0)} KB（tokens ${(tokens.length / 1024).toFixed(1)} KB + tailwind ${(tailwindCss.length / 1024).toFixed(0)} KB）`,
);
