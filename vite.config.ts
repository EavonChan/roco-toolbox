import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { build as esbuild } from 'esbuild';
import { VitePWA } from 'vite-plugin-pwa';

const DECODER_CORE = fileURLToPath(
  new URL('./src/pcap-decoder/tools/pcap-json-app/src/core.js', import.meta.url),
);

/**
 * `npm run dev` 下把内置抓包解析器现打一份 ESM 再交给浏览器（2026-11-23）。
 *
 * 解析器（`src/pcap-decoder/`）来自上游采集器，其中一部分文件是 CommonJS
 * （`require` / `module.exports`）。打包时由下面 `build.commonjsOptions.include`
 * 兜住，但开发态是浏览器原生 ESM 直接加载源码：CJS 文件没有具名导出，导入它的
 * `core.js` 会整条链失败。表现就是网页里选 `.pcap` 报「无法完成后台解析」，
 * 而生产包里同样的文件能正常解——只有 dev 坏，很难联想到是模块格式。
 *
 * 这里不改解析器源码（要保持和上游同构、方便整段替换），只在 dev 用 esbuild
 * 把它打成一份 ESM 交给 Vite；构建仍走原来的模块，产物不受影响。
 *
 * 解析器改完要重启 dev：包在第一次导入时生成一次，之后复用。
 */
function devDecoderBundle(): Plugin {
  const VIRTUAL_ID = '\0roco-dev-decoder-core';
  let enabled = false;
  let bundle: string | undefined;
  return {
    name: 'roco:dev-decoder-bundle',
    enforce: 'pre',
    configResolved(config) {
      // 只管本地 dev：构建走原模块；vitest（mode=test）跑源码，Node 自己能处理 CJS 互操作
      enabled = config.command === 'serve' && config.mode === 'development';
    },
    async resolveId(source, importer, options) {
      // `core` 是解析器里唯一被外部引用的入口（worker / inspectCapture / wildNearby）
      if (!enabled || !importer || !source.endsWith('/core')) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      return resolved?.id === DECODER_CORE ? VIRTUAL_ID : null;
    },
    async load(id) {
      if (id !== VIRTUAL_ID) return null;
      if (!bundle) {
        const result = await esbuild({
          entryPoints: [DECODER_CORE],
          bundle: true,
          format: 'esm',
          platform: 'browser',
          target: 'es2020',
          write: false,
          loader: { '.json': 'json' },
          logLevel: 'silent',
        });
        bundle = result.outputFiles[0].text;
      }
      return bundle;
    },
  };
}

export default defineConfig({
  // 顶部显示的构建时间（本地时间，形如 2026-09-26 17:40）：
  // 手机上打开的到底是哪一版，一眼可查。不用 toISOString，那是 UTC，会对不上你的表。
  define: {
    __APP_BUILD__: JSON.stringify(new Date().toLocaleString('sv-SE').slice(0, 16)),
  },
  // 部署到子路径（例如 GitHub Pages 的 /repo/）时用 VITE_BASE=/repo/ 构建；
  // 部署在域名根目录（Netlify / Cloudflare Pages 默认）时不用设。
  base: process.env.VITE_BASE ?? '/',
  plugins: [
    devDecoderBundle(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      // 用自定义 Service Worker（src/sw.ts）：除了预缓存，还要接采集器「分享」过来的数据文件
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      manifest: {
        name: '小布助手',
        short_name: '小布助手',
        description: '洛克王国：世界 孵蛋规划工具箱（数据默认只存在本机；开启云同步后账号数据会上传到云端）',
        lang: 'zh-CN',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#f8fafc',
        theme_color: '#059669',
        // 必须给 PNG 位图：安卓 Chrome 要 192/512 的位图才会做成「真安装」（WebAPK），
        // 只有 SVG 时会退化成快捷方式，而快捷方式拿不到分享目标 —— 「小布助手」就不会出现在分享面板里。
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // 2026-11-28 CLEAN2：网页 Share Target 已删除（数据入口收为壳内采集 + 同账号同步），
        // manifest 不再声明分享目标，避免分享进来「什么都没发生」。
      },
      injectManifest: {
        // 应用外壳（含图鉴 json 与图标）全部缓存，断网也能打开。
        // 2026-11-27 PWA 优化：抓包解析器（core，~800KB）和 decodeCapture.worker（~1.1MB）
        // 只在导入/抓包时用到，不预缓存，避免首次安装白下近 2MB；
        // 它们由 sw.ts 注册 NetworkFirst 运行时缓存，用到时按需拉取。
        // 注意：workbox 默认上限是 2MiB，这两个文件都没超，必须显式排除。
        globPatterns: ['**/*.{js,css,html,svg,json,png}'],
        globIgnores: [
          '**/core-*.js',
          '**/decodeCapture.worker-*.js',
          // 若将来手动把解析器命名成 pcap-decoder-*，同样排除
          '**/pcap-decoder-*.js',
        ],
      },
    }),
  ],
  build: {
    commonjsOptions: {
      // 内置的抓包解析器（src/pcap-decoder/）来自上游采集器，其中一部分文件是 CommonJS
      // （require / module.exports）。它们不在 node_modules 里，默认不会被 rollup 的
      // commonjs 插件处理，打包时会报「没有 default 导出」。这里显式把它们纳进来。
      include: [/node_modules/, /src[\\/]pcap-decoder[\\/]/],
    },
    rollupOptions: {
      output: {
        // 第三方库单独成块（2026-11-27）：库代码在版本之间几乎不变，拆出去以后
        // 每次发版只有 index 的 hash 变，vendor 仍命中浏览器缓存。
        //
        // 这里**只拆 node_modules**，不拆 src/pcap-decoder：
        // 解析器里 `generated/catalog.json` 被首页链路上的 wildNearby 静态引用，
        // 一旦把整个 src/pcap-decoder 归成一个 chunk，就会把 core（~800KB）从
        // 「动态导入」变成「index 的静态依赖」，首屏反而多下 800KB（实测见
        // docs/采择记录.md PR25 条）。解析器本身 rollup 已经按 dynamic import
        // 自动拆成独立的 core-*.js，不需要介入。
        manualChunks: (id) => {
          const idStr = id as string;
          if (!idStr.includes('node_modules')) return undefined;
          if (/node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(idStr)) return 'vendor-react';
          return 'vendor';
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/tools/**', '**/dist/**', 'e2e/**'],
  },
});
