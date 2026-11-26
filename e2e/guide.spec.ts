import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { TOUR_SEGMENT_ORDER, TOUR_VERSION } from '../src/ui/tour';

const { entries: changelogEntries } = JSON.parse(
  readFileSync(join(process.cwd(), 'src', 'data', 'changelog.json'), 'utf8'),
) as { entries: Array<{ id: string }> };

// 覆盖 config 里「已读」的预置，才能看到「还没导入数据」时的入门卡。
// 引导本身预置为已读：本文件只验证入门卡与它的「教程」按钮，自动引导由 tour.spec.ts 单独验证。
test.use({
  storageState: {
    cookies: [],
    origins: [
      {
        origin: 'http://localhost:4173',
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

test('没有导入数据时：入门卡可直接导入，点「教程」重播首启引导', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByTestId('changelog-modal')).toHaveCount(0);
  await expect(page.getByTestId('first-run-card')).toBeVisible();
  // 不用先关任何弹窗就能导入
  await expect(page.getByTestId('import-button')).toBeEnabled();

  await page.getByTestId('first-run-guide').click();
  await expect(page.getByTestId('tour-root')).toBeVisible();
  await expect(page.getByTestId('tour-title')).toHaveText('先让数据进来');
  await expect(page.getByTestId('tour-progress')).toHaveText('第 1 / 6 步');

  // 跳过 → 先给出「教程」入口提示，再点一次才关闭
  await page.getByTestId('tour-skip').click();
  await expect(page.getByTestId('tour-title')).toHaveText('随时能重看引导');
  await page.getByTestId('tour-skip').click();
  await expect(page.getByTestId('tour-root')).toHaveCount(0);

  // 页面仍可用
  await page.getByRole('button', { name: '看板', exact: true }).click();
  await expect(page.getByRole('heading', { name: '种公全收集' })).toBeVisible();
});
