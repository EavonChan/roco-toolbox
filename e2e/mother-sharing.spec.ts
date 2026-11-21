﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿import { expect, test } from '@playwright/test';
import { enterGroup, loginAs, mockMotherGroups } from './helpers/motherGroupsMock';

const openGroups = async (page: import('@playwright/test').Page) => {
  // 2026-11-21：小组管理搬到「我的 · 小组」，原来的「小组」页签改名叫「换蛋」只剩广场
  await page.getByRole('button', { name: '我的', exact: true }).click();
  await page.getByTestId('profile-section-groups').click();
  await expect(page.getByTestId('collection-groups')).toBeVisible();
};

test('未登录的小组页只给登录提示，待加入码保留', async ({ page }) => {
  await page.goto('/');
  await openGroups(page);

  // 个人求蛋已删除（2026-10-30）：未登录不再有清单，只有登录 + 待加入码
  await expect(page.getByTestId('group-login-hint')).toBeVisible();
  await expect(page.getByTestId('personal-eggs')).toHaveCount(0);
  await page.getByTestId('group-pending-invite').fill('abcd2345');
  const pending = await page.evaluate(() =>
    window.localStorage.getItem('roco.collectionGroups.pendingInvite'),
  );
  expect(pending).toBe('ABCD2345');

  await page.getByTestId('group-login').click();
  // 新结构：去登录直达「我的 · 我的身份」（游戏数据与身份分开）
  await expect(page.getByTestId('profile-identity-intro')).toBeVisible();
  await expect(page.getByTestId('account-username-input')).toBeVisible();
});

test('已登录且本机无数据：能浏览小组资源，不能发布自己的摘要', async ({ page }) => {
  await loginAs(page);
  await enterGroup(page);
  await mockMotherGroups(page);
  await page.goto('/');
  await openGroups(page);

  await expect(page.getByTestId('group-card')).toContainText('周末互换');
  await expect(page.getByTestId('group-card')).toContainText('3 人');
  await expect(page.getByTestId('group-type-label')).toContainText('收集小组');
  await expect(page.getByTestId('mother-resource-editor')).toHaveCount(0);
  await page.getByTestId('group-edit-resources').click();
  await expect(page.getByTestId('mother-resource-editor')).toBeVisible();
  await expect(page.getByTestId('mother-no-local-data')).toBeVisible();
  await expect(page.getByTestId('mother-missing-accounts')).toContainText('uid:1001');
  await expect(page.getByTestId('mother-publish')).toBeDisabled();
});

test('组列表接口失败时不说「还没有加入任何小组」，并给出重试', async ({ page }) => {
  await loginAs(page);
  await enterGroup(page);
  await mockMotherGroups(page);
  // 冷启动（关后台再回来）网络没恢复：列表与详情都失败
  await page.route('**/api/collection-groups**', (route) => route.abort('failed'));

  await page.goto('/');
  await openGroups(page);

  await expect(page.getByTestId('group-error')).toContainText('网络连接失败');
  await expect(page.getByTestId('group-error-retry')).toBeVisible();
  await expect(page.getByText('还没有加入任何小组')).toHaveCount(0);
});

test('375 / 390 宽度下小组页不横向溢出', async ({ page }) => {
  await loginAs(page);
  await enterGroup(page);
  await mockMotherGroups(page);
  for (const width of [375, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await openGroups(page);
    const overflow = await page.evaluate(() => {
      const doc = document.scrollingElement as HTMLElement;
      return doc.scrollWidth - doc.clientWidth;
    });
    expect(overflow, `${width}px 横向溢出 ${overflow}px`).toBeLessThanOrEqual(1);
  }
});
