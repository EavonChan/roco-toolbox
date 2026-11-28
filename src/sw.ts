import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { ExpirationPlugin } from 'workbox-expiration';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import { putSharedFile } from './share/shareTarget';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// 静态资源（含图鉴 json）预缓存，断网也能打开。
// 抓包解析器（core-*.js，~800KB）与 decodeCapture.worker（~1.1MB）已由
// vite.config.ts 的 globIgnores 排除在这个列表之外 —— 它们只在导入/抓包时用到，
// 不值得让每个人首次安装就白下近 2MB。缺的这部分由下面 NetworkFirst 运行时缓存兜底。
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

/**
 * 大文件（解析器 / worker）运行时缓存：有网先拉最新，超时或断网用旧缓存兜底。
 *
 * **为什么不会把老用户卡在旧 bundle 上**（2026-11-27 复核结论）：
 * 1. 应用外壳（index.html、index-*.js、vendor-*.js、css、图鉴 json）仍在预缓存里，
 *    由 precacheAndRoute 先行匹配 —— 它给的 URL 带 revision，发版即变，所以外壳永远走最新；
 * 2. 这条路由只兜住「没被预缓存、请求时才第一次出现」的 URL。Vite 产物名带内容 hash
 *    （core-BIx5pY-I.js），同一个 URL 的内容永不改变，因此缓存里那份旧文件不会被当成
 *    新 bundle 发出去 —— 发版后 index.html 引用的就是新 hash，拿不到旧内容；
 * 3. `autoUpdate` + install 里的 skipWaiting + activate 里的 clients.claim 保持原样，
 *    新 SW 装好立刻接管，不需要用户手动刷新。
 *
 * 代价（必须知道）：这两个文件断网时第一次用会失败（以前预缓存过、能离线）。
 * 用过一次之后 NetworkFirst 已把它写进 roco-runtime-js，恢复离线可用。
 * networkTimeoutSeconds 保证网络半死时不干等浏览器默认超时。
 * ExpirationPlugin 防止每次发版都往缓存里堆一份新的 hash 文件（无上限增长）。
 */
registerRoute(
  ({ url }) => url.pathname.includes('/assets/') && url.pathname.endsWith('.js'),
  new NetworkFirst({
    cacheName: 'roco-runtime-js',
    networkTimeoutSeconds: 5,
    plugins: [
      new ExpirationPlugin({
        maxEntries: 12,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  }),
);

// 新版本装好就立刻接管，配合 autoUpdate 让手机用户不用自己找"刷新"
self.addEventListener('install', () => {
  void self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/** 与 manifest.share_target.action 末尾对应的路径后缀 */
const SHARE_PATH_SUFFIX = '/share-target';

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'POST') return;
  const url = new URL(event.request.url);
  if (!url.pathname.endsWith(SHARE_PATH_SUFFIX)) return;
  event.respondWith(handleShareTarget(event.request));
});

/**
 * 采集器「分享」→「小布助手」的入口。
 * 把分享过来的数据 JSON 暂存进 Cache Storage，然后跳回首页；
 * 首页启动时会把它取走并走原有的导入流程（见 src/share/shareTarget.ts）。
 */
async function handleShareTarget(request: Request): Promise<Response> {
  try {
    const form = await request.formData();
    const file = form.get('file');
    if (file instanceof File) await putSharedFile(file);
  } catch {
    // 分享内容读不出来也照常跳回首页，别让用户卡在一片空白上
  }
  const target = new URL(request.url);
  const basePath = target.pathname.slice(0, -SHARE_PATH_SUFFIX.length);
  target.pathname = basePath.endsWith('/') ? basePath : `${basePath}/`;
  target.search = '';
  return Response.redirect(target.toString(), 303);
}
