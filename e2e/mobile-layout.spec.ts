import { expect, test } from '@playwright/test';
import { importFixtures } from './helpers/importFixture';

/**
 * 移动端布局守卫：真机上最容易出问题的是「横向溢出」和「主按钮被压扁/半截可见」。
 * 这里用最窄的常见安卓宽度 + 系统大字号各验一遍。
 *
 * 2026-11-28 CLEAN2：文件导入按钮已删除，播种改走 roco-share；
 * 大字号用例改验「新用户空态 + 设置行」不再有导入按钮、也不横向溢出。
 */
const MOBILE_VIEWPORTS = [
  { width: 360, height: 640, label: '360x640' },
  { width: 412, height: 915, label: '412x915' },
];

for (const viewport of MOBILE_VIEWPORTS) {
  test(`${viewport.label}：四个页签都不横向溢出`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await importFixtures(page, ['src/domain/__fixtures__/backup-sample.json']);
    await expect(page.getByText('还没有数据')).toHaveCount(0);

    for (const tab of ['看板', '家园', '收集', '换蛋', '我的']) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      const overflow = await page.evaluate(() => {
        const doc = document.scrollingElement as HTMLElement;
        return doc.scrollWidth - doc.clientWidth;
      });
      expect(overflow, `${tab} 页横向溢出 ${overflow}px`).toBeLessThanOrEqual(1);
    }
  });

  test(`${viewport.label}：新用户空态无导入按钮，设置行完整可见且点击区不小于 44px`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await page.addStyleTag({ content: 'html{font-size:20px}' }); // 模拟系统大字号

    // 文件导入入口已删除：空态只留采集说明 + 登录同步
    await expect(page.getByTestId('import-button')).toHaveCount(0);
    await expect(page.getByTestId('import-input')).toHaveCount(0);
    await expect(page.getByTestId('profile-new-user-empty')).toBeVisible();

    const overflow = await page.evaluate(() => {
      const doc = document.scrollingElement as HTMLElement;
      return doc.scrollWidth - doc.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(1);

    const row = page.getByTestId('profile-section-identity');
    await expect(row).toBeVisible();
    const box = await row.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
}
