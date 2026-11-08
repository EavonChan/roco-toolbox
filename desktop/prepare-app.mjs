/**
 * 把 `npm run build` 产出的 dist/ 复制成桌面版专用目录 desktop/app-dist/。
 *
 * 和网页版唯一的差别：去掉 Service Worker 注册与 sw.js。
 * 桌面版的本地服务端口每次启动都会变，缓存由 Chromium 自己管；
 * 留着 SW 反而会在升级 exe 后命中旧缓存，出现「更新了但界面还是旧的」。
 */
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync, unlinkSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const from = path.join(root, 'dist');
const to = path.join(root, 'desktop', 'app-dist');

if (!existsSync(path.join(from, 'index.html'))) {
  console.error('找不到 dist/index.html，请先运行 npm run build');
  process.exit(1);
}

rmSync(to, { recursive: true, force: true });
cpSync(from, to, { recursive: true });

const indexPath = path.join(to, 'index.html');
const before = readFileSync(indexPath, 'utf8');
writeFileSync(indexPath, before.replace(/<script id="vite-plugin-pwa:register-sw"[^>]*><\/script>/g, ''));

for (const name of ['sw.js', 'registerSW.js']) {
  const file = path.join(to, name);
  if (existsSync(file)) unlinkSync(file);
}

console.log('桌面版资源已准备好：desktop/app-dist');
