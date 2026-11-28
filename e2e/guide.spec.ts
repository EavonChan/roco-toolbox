import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { TOUR_SEGMENT_ORDER, TOUR_VERSION } from '../src/ui/tour';

const { entries: changelogEntries } = JSON.parse(
  readFileSync(join(process.cwd(), 'src', 'data', 'changelog.json'), 'utf8'),
) as { entries: Array<{ id: string }> };

// 允许换端口跑（默认 4173；CI 本机被占用时用 E2E_ORIGIN 指到临时 preview）
const ORIGIN = process.env.E2E_ORIGIN ?? 'http://localhost:4173';

// 覆盖 config 里「已读」的预置，才能看到「还没数据」时的空态与它上面的「教程」入口。
// 引导本身预置为已读：本文件只验证空态与「教程」按钮，自动引导由 tour.spec.ts 单独验证。
test.use({
  storageState: {
    cookies: [],
    origins: [
      {
        origin: ORIGIN,
        localStorage: [
          { name: 'roco.changelogSeen', value: changelogEntries[0]?.id ?? '' },
          ...TOUR_SEGMENT_ORDER.map((segment) => ({
            name: `roco.tourSeen.${segment}`,
            value: TOUR_VERSION,
          })),
        ],
      },
    ],
  },
});

test('没有数据时：新用户空态可达，点「教程」重播首启引导', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('changelog-modal')).toHaveCount(0);
  // CLEAN2：文件导入入口已删除，空态只给「采集 / 登录同步」
  await expect(page.getByTestId('profile-new-user-empty')).toBeVisible();
  await expect(page.getByTestId('import-button')).toHaveCount(0);

  await page.getByTestId('guide-open').click();
  await expect(page.getByTestId('tour-root')).toBeVisible();
  // 顶部「教程」重播当前页那一段：站在「我的」页 → 采集/登录同步（不再是首启）
  await expect(page.getByTestId('tour-title')).toHaveText('采集与登录同步');
  await expect(page.getByTestId('tour-progress')).toHaveText('第 1 / 2 步');

  // 「我的」段没有收尾提示步：一次跳过即关闭
  await page.getByTestId('tour-skip').click();
  await expect(page.getByTestId('tour-root')).toHaveCount(0);

  // 页面仍可用
  await page.getByRole('button', { name: '看板', exact: true }).click();
  await expect(page.getByRole('heading', { name: '种公全收集' })).toBeVisible();
});
