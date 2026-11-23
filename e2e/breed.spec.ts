import { expect, test, type Page } from '@playwright/test';

/**
 * 导入 fixture 并切到看板。
 *
 * 2026-10-25 起导入后不再自动跳看板；断言导入真正落盘再点页签，
 * 否则导入中的导航会被拦住（点了不动）。
 */
const openDashboardWith = async (page: Page, fixture: string) => {
  await page.goto('/');
  await page.getByTestId('import-input').setInputFiles(fixture);
  await expect(page.getByTestId('import-outcome')).toContainText('已保存到本机');
  await page.getByRole('button', { name: '看板', exact: true }).click();
};

test('配窝建议：看板直接给出配对，标题不再叫「补全计划」', async ({ page }) => {
  await openDashboardWith(page, 'src/domain/__fixtures__/backup-breed-pair.json');

  const card = page.getByTestId('nest-summary');
  // 2026-11-22：卡里不再有「配窝建议」标题，段落由看板的分段开关（种公推荐 / 母本缺口）标识
  await expect(card).toBeVisible();
  await expect(page.getByTestId('dashboard-action-switch')).toBeVisible();

  // 2026-11-20 用户口径：摘要行（还差 N 个种公目标 / 能自己迭代 …）与汇总胶囊整段删除
  await expect(page.getByTestId('nest-summary-line')).toHaveCount(0);
  await expect(page.getByTestId('nest-plan-pills')).toHaveCount(0);
  // 2026-11-19 用户口径：不再画小窝摆位图
  await expect(page.getByTestId('nest-layout')).toHaveCount(0);
  // 2026-11-19 用户口径：「看缺口 / 看推荐种公」两个入口也已移除
  await expect(page.getByTestId('nest-open-coverage')).toHaveCount(0);
  await expect(page.getByTestId('nest-open-swap')).toHaveCount(0);

  // 配窝明细直接落在看板（2026-10-25 用户要求）：一条配对 = 两张精灵卡
  await expect(page.getByTestId('breed-list')).toBeVisible();
  await expect(page.getByTestId('breed-suggestion').first()).toBeVisible();
});

test('配窝建议跟随「看板行动」开关：种公推荐 ↔ 母本缺口', async ({ page }) => {
  await openDashboardWith(page, 'src/domain/__fixtures__/backup-breed-pair.json');

  // 默认在「种公推荐」：配窝卡里是种公配对
  await expect(page.getByTestId('dashboard-action-studs')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('breed-list')).toBeVisible();

  // 切到「母本缺口」：种公配对整段让位给母本配窝（这份数据没有母本建议时给空态，但一定不再画种公配对）
  await page.getByTestId('dashboard-action-mothers').click();
  await expect(page.getByTestId('dashboard-action-mothers')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('breed-list')).toHaveCount(0);
  await expect(page.getByTestId('mother-nest').or(page.getByTestId('breed-empty'))).toBeVisible();

  // 切回「种公推荐」：种公配对回来
  await page.getByTestId('dashboard-action-studs').click();
  await expect(page.getByTestId('breed-list')).toBeVisible();
});

test('没有导入数据时不出现配窝建议卡（不制造空推荐）', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '看板', exact: true }).click();
  // 看板本身正常渲染（有数据时才会多出配窝建议卡）
  await expect(page.getByRole('heading', { name: '小布助手' })).toBeVisible();

  await expect(page.getByTestId('nest-summary')).toHaveCount(0);
  await expect(page.getByTestId('breed-empty')).toHaveCount(0);
});
