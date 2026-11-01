import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig } from '@playwright/test';

// 更新日志数据源（读 JSON 而不是 import src 的 TS：配置文件属于 node 的 ts 工程，跨工程 import 会报 TS6307）
const { entries: changelogEntries } = JSON.parse(
  readFileSync(join(process.cwd(), 'src', 'data', 'changelog.json'), 'utf8'),
) as { entries: Array<{ id: string }> };

/**
 * 新手引导版本号：从源码解析。引导是首启盖一层的浮层，不预置会把所有 e2e 挡死；
 * 引导本身由 e2e/tour.spec.ts 用空 storageState 单独验证。
 *
 * 分段名要与 `src/ui/tour.ts` 的 `TOUR_SEGMENT_ORDER` 保持一致（那边加段要同步这里）。
 */
const TOUR_SEGMENT_IDS = ['start', 'dashboard', 'collection', 'groups', 'home', 'profile'] as const;
const tourVersion: string = (() => {
  const source = readFileSync(join(process.cwd(), 'src', 'ui', 'tour.ts'), 'utf8');
  const matched = source.match(/TOUR_VERSION\s*=\s*'([^']+)'/);
  if (!matched) throw new Error('没法从 src/ui/tour.ts 解析出 TOUR_VERSION（写法变了？）');
  return matched[1];
})();

export default defineConfig({
  testDir: './e2e',
  // 真实本地 Functions + D1 的联调用例由 playwright.mother-groups.config.ts 单独跑，
  // 默认静态 preview 下没有后端，必须排除，否则会假装验证了后端。
  testIgnore: '**/*-live.spec.ts',
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 390, height: 844 },
    // 不写死 channel: 'chrome'：那样只有装了 Google Chrome 的机器才跑得起来。
    // 默认用 Playwright 自带的 Chromium（首次需要 `npx playwright install chromium`）。
    // 默认把「更新内容弹窗」标记为已读：它是首启盖一层的模态，不预置会挡住所有用例。
    // 弹窗本身由 e2e/changelog.spec.ts 单独用空 storageState 验证。
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:4173',
          localStorage: [
            { name: 'roco.changelogSeen', value: changelogEntries[0]?.id ?? '' },
            // 首启 / 分页引导同样是盖一层的浮层，全部预置为已读；
            // 引导本身由 e2e/tour.spec.ts 用空 storageState 单独验证。
            ...TOUR_SEGMENT_IDS.map((segment) => ({
              name: `roco.tourSeen.${segment}`,
              value: tourVersion,
            })),
          ],
        },
      ],
    },
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    port: 4173,
    // 必须每次自己构建并启动：如果复用了外部正在跑的服务（例如“启动手机版.cmd”），
    // 测试会打到旧构建上，出现"改了代码但测试没反应"的假失败。
    reuseExistingServer: false,
  },
});
