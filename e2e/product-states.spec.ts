import { expect, test } from '@playwright/test';
import { importFixtures, sendCapture } from './helpers/importFixture';

/**
 * 「我的」页与入库三阶段反馈（2026-10-24 重构任务 6）。
 * 这里只放真实页面行为；云同步 409 / 网络失败在既有单测与 mother-groups live 里覆盖。
 *
 * 2026-11-28 CLEAN2：文件导入 UI 已删除，播种改走壳内采集的 roco-share 路径。
 */

test('我的：身份 / 游戏数据两个分区各自可达，私有同步在游戏数据里', async ({ page }) => {
  await page.goto('/');

  // 首启（空存储）默认落在「游戏数据」：新用户空态 + 登录同步，不再有文件导入按钮
  await expect(page.getByTestId('profile-new-user-empty')).toBeVisible();
  await expect(page.getByTestId('import-button')).toHaveCount(0);

  await page.getByTestId('profile-section-identity').click();
  await expect(page.getByTestId('profile-identity-intro')).toContainText('我的身份');
  await expect(page.getByTestId('account-register')).toBeVisible();

  // 2026-11-21：私有同步挪到「游戏数据 · 本机采集」下方，不再单独占一个分区
  await page.getByTestId('profile-section-data').click();
  await expect(page.getByTestId('profile-sync-intro')).toContainText('不会更新小组资源');
  // 还没有身份：明确告诉用户去哪里，而不是给一个不能点的同步按钮
  await expect(page.getByTestId('account-sync-needs-identity')).toBeVisible();
  await expect(page.getByTestId('account-sync')).toHaveCount(0);
});

test('入库成功：本机 / 私有云 / 小组三个阶段分别反馈，且不声称小组已更新', async ({ page }) => {
  await page.goto('/');
  await importFixtures(page, ['src/domain/__fixtures__/backup-sample.json']);

  await expect(page.getByText('还没有数据')).toHaveCount(0);
  // 文件导入入口已删除；入库反馈统一走三阶段横幅
  await expect(page.getByTestId('import-button')).toHaveCount(0);

  const outcome = page.getByTestId('import-outcome');
  await expect(outcome).toContainText('已保存到本机');
  await expect(outcome).toContainText('私有同步未开启');
  await expect(page.getByTestId('import-outcome-group')).toContainText('小组资源未自动更新');
  await expect(page.getByTestId('import-outcome-open-groups')).toBeVisible();
});

test('坏文件失败：提示切到别的分区再回来仍在（不是一次性 local state）', async ({ page }) => {
  await page.goto('/');
  await sendCapture(page, 'bad.json', Buffer.from('this is not json'));

  await expect(page.getByTestId('import-outcome')).toContainText('导入失败');

  await page.getByTestId('profile-section-identity').click();
  await page.getByTestId('profile-section-data').click();
  await expect(page.getByTestId('import-outcome')).toContainText('导入失败');
});
