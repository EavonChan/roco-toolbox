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

// 只在这些步骤上断言「一定框得到」：不依赖是否导入数据、是否登录 / 入组
const ALWAYS_SPOTLIGHT = new Set([
  'nav',
  'dashboard-target',
  'dashboard-actions',
  'collection-kinds',
  'collection-studs',
  'collection-mothers',
  'home-tabs',
  'home-placement',
  'profile-import',
  'profile-account',
]);

test('走完 15 步：有锚点的步骤都框到真实控件，接单上窝会切分页', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('tour-root')).toBeVisible();

  for (let index = 0; index < TOUR_STEPS.length; index += 1) {
    const step = TOUR_STEPS[index];
    await expect(page.getByTestId('tour-progress')).toHaveText(`第 ${index + 1} / ${TOUR_STEPS.length} 步`);
    await expect(page.getByTestId('tour-title')).toHaveText(step.title);
    if (ALWAYS_SPOTLIGHT.has(step.id)) {
      await expect(page.getByTestId('tour-spotlight')).toBeVisible();
    }
    if (step.id === 'home-placement') {
      // 家园页要真的切到「接单上窝」，否则这一步讲的控件根本不在屏幕上
      await expect(page.getByTestId('home-view-demands')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('home-demand-placements')).toBeVisible();
    }
    if (index < TOUR_STEPS.length - 1) await page.getByTestId('tour-next').click();
  }

  await page.getByTestId('tour-done').click();
  await expect(page.getByTestId('tour-root')).toHaveCount(0);
});

test('引导进行中点「教程」：先结束引导，不会叠出两层浮层', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('tour-root')).toBeVisible();

  await page.getByTestId('guide-open').click();
  await expect(page.getByTestId('tour-root')).toHaveCount(0);
  await expect(page.getByTestId('guide-modal')).toBeVisible();
});

