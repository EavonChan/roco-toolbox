import { defineConfig } from 'vitest/config';

/**
 * Functions（Cloudflare Pages Functions）单测专用配置。
 *
 * 主配置只收 `src/**`，服务端桥接（/api/egg-bot）的改动原本没有任何命令会跑到；
 * 这里单独用 node 环境收 `functions/**` 下的测试，不加载 jsdom 的 setup。
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['functions/**/*.test.ts'],
  },
});
