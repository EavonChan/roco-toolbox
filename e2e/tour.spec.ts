import { expect, test } from '@playwright/test';
import { TOUR_STEPS } from '../src/ui/tour';
import { GROUP_ID, loginAs, mockMotherGroups } from './helpers/motherGroupsMock';

// 覆盖 config 里「教程/更新/引导已读」的预置，才能看到首启自动弹出的新手引导
test.use({ storageState: { cookies: [], origins: [] } });

/**
 * 第 12 步「接单上窝」要框到真实控件，就必须**本机有数据、并且有一条我接的单**：
 * 没导入数据时家园页是空态，这个锚点根本不在屏幕上。
 * 蛋用真实图鉴 ID（3003 = 火花），`backup-breed-pair` 里正好有一对同种蛋的公母，能排出真实名单。
 */
const CLAIMED_DEMAND = {
  groupId: GROUP_ID,
  demanderAccountId: 'B',
  eggGameId: 3003,
  nature: '',
  gender: '母',
  body: '',
  voice: '',
  status: 'claimed',
  claimerAccountId: 'A',
  version: 1,
  createdAt: 1_760_000_000_000,
  updatedAt: 1_760_000_000_000,
};

/** 跳过首启引导 → 导入一份可配对的背包 → 从「教程」重播，保证第 12 步有真实内容。 */
const seedAndReplayTour = async (page: import('@playwright/test').Page) => {
  await loginAs(page);
  await mockMotherGroups(page, { demands: [CLAIMED_DEMAND] });
  await page.goto('/');
  await expect(page.getByTestId('tour-root')).toBeVisible();

  await page.getByTestId('tour-skip').click();
  await page
    .getByTestId('import-input')
    .setInputFiles('src/domain/__fixtures__/backup-breed-pair.json');
  await expect(page.getByTestId('import-outcome')).toContainText('已保存到本机');

  await page.getByTestId('guide-open').click();
  await expect(page.getByTestId('guide-modal')).toBeVisible();
  await page.getByTestId('guide-tour').click();
  await expect(page.getByTestId('tour-root')).toBeVisible();
};

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
  await seedAndReplayTour(page);

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
      // 预置的那条单必须真的渲染出来（排出配对或明确写「排不上」，不能是空态）
      await expect(
        page.getByTestId('home-demand-row').or(page.getByTestId('home-demand-skip')).first(),
      ).toBeVisible();
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

