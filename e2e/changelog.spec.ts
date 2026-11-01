import { expect, test } from '@playwright/test';
import { TOUR_SEGMENT_ORDER, TOUR_VERSION } from '../src/ui/tour';

// 覆盖 config 里「更新已读」的预置，才能看到首启弹窗。
// 但新手引导仍预置为已读：本文件只验证更新弹窗，引导由 tour.spec.ts 单独验证。
test.use({
  storageState: {
    cookies: [],
    origins: [
      {
        origin: 'http://localhost:4173',
        localStorage: TOUR_SEGMENT_ORDER.map((segment) => ({
          name: `roco.tourSeen.${segment}`,
          value: TOUR_VERSION,
        })),
      },
    ],
  },
});

test('首次打开弹出更新内容，点「知道了」后不再打扰', async ({ page }) => {
  await page.goto('/');

  const modal = page.getByTestId('changelog-modal');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('更新内容');
  await expect(modal.getByTestId('changelog-body').locator('li').first()).toBeVisible();

  // 关闭 → 消失，且不挡后续操作
  await page.getByTestId('changelog-ok').click();
  await expect(modal).toHaveCount(0);
  await page.getByRole('button', { name: '看板', exact: true }).click();
  await expect(page.getByRole('heading', { name: '种公全收集' })).toBeVisible();

  // 刷新：本机已记住 → 不再弹
  await page.reload();
  await expect(page.getByTestId('changelog-modal')).toHaveCount(0);
});

test('右上角 × 也能关闭弹窗', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('changelog-modal')).toBeVisible();
  await page.getByTestId('changelog-close').click();
  await expect(page.getByTestId('changelog-modal')).toHaveCount(0);
});
