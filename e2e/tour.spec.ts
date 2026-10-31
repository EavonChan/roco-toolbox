import { expect, test } from '@playwright/test';
import { TOUR_STEPS } from '../src/ui/tour';

// 覆盖 config 里「教程/更新/引导已读」的预置，才能看到首启自动弹出的新手引导
test.use({ storageState: { cookies: [], origins: [] } });

test('首启自动出现分步引导：高亮真实控件，翻页会切页面，跳过后不再弹', async ({ page }) => {
  await page.goto('/');

  const root = page.getByTestId('tour-root');
  await expect(root).toBeVisible();
  await expect(page.getByTestId('tour-progress')).toHaveText(`第 1 / ${TOUR_STEPS.length} 步`);
  await expect(page.getByTestId('tour-title')).toHaveText('五个入口');
  // 第 1 步高亮顶部导航
  await expect(page.getByTestId('tour-spotlight')).toBeVisible();

  // 下一步：自动切到看板，仍然保持引导
  await page.getByTestId('tour-next').click();
  await expect(page.getByTestId('tour-title')).toHaveText('先定目标档位');
  await expect(page.getByRole('button', { name: '看板', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByTestId('tour-spotlight')).toBeVisible();

  // 跳过 → 消失，页面可正常用
  await page.getByTestId('tour-skip').click();
  await expect(root).toHaveCount(0);
  await expect(page.getByTestId('target-mode')).toBeVisible();

  // 刷新：本机已记住 → 不再自动弹
  await page.reload();
  await expect(page.getByTestId('tour-root')).toHaveCount(0);
});

test('顶部「教程」里可以重播分步引导', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('tour-skip').click();

  await page.getByTestId('guide-open').click();
  await expect(page.getByTestId('guide-modal')).toBeVisible();
  await page.getByTestId('guide-tour').click();

  await expect(page.getByTestId('guide-modal')).toHaveCount(0);
  await expect(page.getByTestId('tour-root')).toBeVisible();
  await expect(page.getByTestId('tour-title')).toHaveText('五个入口');
});
