import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test('我的精灵页：卡片展示与标签叠加筛选', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  await expect(page.getByText('还没有数据')).toHaveCount(0);

  await page.getByRole('button', { name: '收集', exact: true }).click();
  await page.getByTestId('collection-kind-inventory').click();

  // 卡片展示：名称、盒子位置（2026-10-05 卡内不再显示账号与图鉴编号，账号由账号筛选条承担）
  await expect(page.getByText('机械方方')).toBeVisible();
  await expect(page.getByText(/盒子01/).first()).toBeVisible();
  await expect(page.getByTestId('pet-card-gender').first()).toBeVisible();

  // 带形态的精灵用**官方名**显示（游戏自己的写法，下划线分隔），不是自己拼的空格写法
  // 2026-11-22：卡片名字改成精简名（基础名·形态，超过 7 字只留基础名），完整名在 title 里
  await expect(page.getByText('鸭吉吉').first()).toBeVisible();
  await expect(page.getByText('鸭吉吉_等一等鸭')).toHaveCount(0);

  // 筛选区默认展开（2026-10-05 拍板）：性别 / 体型 / 声音是常显行（2026-11-18 起不再是手风琴瓦片）
  await expect(page.getByTestId('pet-filters-toggle')).toHaveText(/筛选/);
  await expect(page.getByTestId('filter-row-gender')).toBeVisible();
  await expect(page.getByTestId('filter-row-body')).toBeVisible();

  // 点「大块头」→ 只剩大块头精灵（点选项不自动收起，可连点多选）
  await page.getByTestId('filter-opt-body-body:大块头').click();
  await expect(page.getByText('机械方方')).toBeVisible();
  await expect(page.getByText('鸭吉吉')).toHaveCount(0);
  await expect(page.getByText('喵喵')).toHaveCount(0);

  // 取消「大块头」→ 全部精灵回来
  await page.getByTestId('filter-opt-body-body:大块头').click();
  await expect(page.getByText('机械方方')).toBeVisible();
  await expect(page.getByText('鸭吉吉')).toBeVisible();
  // 账号筛选已移到页面顶部 AccountFilterBar，下方筛选面板不再重复账号标签（2026-10-05）
  await expect(page.getByTestId('pet-filters')).not.toContainText('账号（');
  // 收起筛选后已选条件仍有摘要
  await page.getByTestId('pet-filters-toggle').click();
  await expect(page.getByTestId('pet-filters-selected')).toHaveCount(0);
});

test('种公入口落到种公阵列：只列覆盖目标的种公，档位跟全局目标', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  await expect(page.getByText('还没有数据')).toHaveCount(0);
  await page.getByRole('button', { name: '收集', exact: true }).click();

  // 2026-10-29「合格种公」视图已删：种公统一在「收集 · 种公」的种公阵列里看
  await page.getByTestId('collection-kind-studs').click();
  await expect(page.getByTestId('collection-kind-studs')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('stud-matrix')).toBeVisible();

  // 档位是全局目标（默认满分 → 大婉），阵列顶部 tab 必须是选中态
  await expect(page.getByTestId('stud-matrix-grade-大婉')).toHaveAttribute('aria-pressed', 'true');

  // 只列真正覆盖了目标的种公：代表格是带「共 N 只」的可点按钮（fixture 里只有火花达标）
  const repCell = page.getByRole('button', { name: /种公 .*共 \d+ 只/ }).first();
  await expect(repCell).toBeVisible();
  await expect(repCell).toContainText('火花');
});

test('种公阵列：性格筛选决定阵列的列，清空后回到未选提示', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  await expect(page.getByText('还没有数据')).toHaveCount(0);
  await page.getByRole('button', { name: '收集', exact: true }).click();

  await page.getByTestId('collection-kind-studs').click();
  await expect(page.getByTestId('collection-kind-studs')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('stud-matrix')).toBeVisible();

  // 2026-11-22：筛选常显、性格默认「推荐性格」（每组推荐前 3）→ 阵列第一列就是该组推荐性格
  await expect(page.getByTestId('nature-mode-recommended')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('columnheader').first()).toBeVisible();

  // 切自选（预选八大，下拉默认收起）→ 点开 → 全部取消 → 回到未选提示；勾回「固执」列再出现
  await page.getByTestId('nature-mode-custom').click();
  await page.getByTestId('custom-nature-toggle').click();
  await page.getByTestId('custom-nature-select-all').click();
  await expect(page.getByTestId('stud-matrix-empty')).toBeVisible();

  await page.getByTestId('custom-nature-固执').click();
  await expect(page.getByRole('columnheader', { name: '固执' })).toBeVisible();
});

test('母本页：四列卡与三页签；未收集点卡看怎么补、可加计划，收集中按状态筛，已收集空态给出口', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  await expect(page.getByText('还没有数据')).toHaveCount(0);
  await page.getByRole('button', { name: '收集', exact: true }).click();
  await page.getByTestId('collection-kind-mothers').click();
  await expect(page.getByTestId('collection-kind-mothers')).toHaveAttribute('aria-pressed', 'true');

  // 默认停在「未收集」，顶部给整条链的进度
  await expect(page.getByTestId('mother-chain-filter-uncollected')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('mother-chain-summary')).toContainText('共');

  // 四列卡；卡面本身是「怎么补」入口（2026-11-19 口径），底部是「计划」
  const rows = page.getByTestId('mother-chain-row');
  await expect(rows.first()).toBeVisible();
  await expect(rows.first().locator('article')).toHaveClass(/h-\[104px\]/);
  await rows.first().click();
  await expect(page.getByRole('dialog', { name: '怎么补' })).toBeVisible();
  await page.getByTestId('gap-fill-close').click();

  // 点「计划」→ 卡变淡蓝「已计划」，且仍留在未收集清单里（2026-11-21 口径：不再被抽走）
  const firstRow = rows.first();
  await firstRow.getByTestId('mother-plan-toggle').click();
  await expect(firstRow).toHaveAttribute('data-mother-status', 'planned');

  // 收集中：同一张母本卡 + 小组/状态筛选；没有小组时给「去小组」提示
  await page.getByTestId('mother-chain-filter-collecting').click();
  await expect(page.getByTestId('mother-collecting-view')).toBeVisible();
  await expect(page.getByTestId('mother-collecting-card')).toHaveCount(1);
  await expect(page.getByTestId('mother-collecting-cards')).toHaveClass(/grid-cols-4/);
  await expect(page.getByTestId('collecting-status-all')).toContainText('1');

  // 已收集：样本里恶魔狼（固执·大块头·100dB）是达标母本 → 分组头只给只数
  await page.getByTestId('mother-chain-filter-collected').click();
  await expect(page.getByTestId('mother-chain-row')).toHaveCount(1);
  await expect(page.getByTestId('mother-chain-row')).toContainText('恶魔狼');
  const collectedSection = page.locator('[data-testid^="mother-chain-group-"]').filter({ hasText: '恶魔狼' }).first();
  // 2026-11-22：分组头统一成「已收集 分子/分母」（分母=该蛋组精灵数）
  await expect(collectedSection).toContainText(/已收集 [1-9]\d*\//);

  // 搜一个不存在的名字 → 空态给两个出口
  await page.getByTestId('mother-search').fill('不存在的名字XYZ');
  await expect(page.getByTestId('mother-chain-empty')).toBeVisible();
  await expect(page.getByTestId('mother-chain-empty-clear')).toBeEnabled();
  await page.getByTestId('mother-chain-empty-uncollected').click();
  await expect(page.getByTestId('mother-chain-filter-uncollected')).toHaveAttribute('aria-pressed', 'true');
});
test('精灵背包搜索：按进化链全员命中，搜不到给空态', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  await expect(page.getByText('还没有数据')).toHaveCount(0);
  await page.getByRole('button', { name: '收集', exact: true }).click();
  await page.getByTestId('collection-kind-inventory').click();
  await expect(page.getByTestId('collection-kind-inventory')).toHaveAttribute('aria-pressed', 'true');

  // 种公名单连同它的搜索框一起下线；搜索能力仍在精灵背包（R2-6-L05：两条用例合并成一条）
  const search = page.getByTestId('pet-name-search');
  await expect(search).toBeVisible();
  // fixture 里只有 stage1 的火花（3003），搜它同链的进化形态名也要命中
  await search.fill('火神');
  await expect(page.getByText('火花')).toBeVisible();
  await expect(page.getByText('机械方方')).toHaveCount(0);

  await search.fill('焰火');
  await expect(page.getByText('火花')).toBeVisible();

  // 搜自己也在
  await search.fill('火花');
  await expect(page.getByText('火花')).toBeVisible();

  // 清空恢复全部
  await search.fill('');
  await expect(page.getByText('机械方方')).toBeVisible();

  // 搜不到：给空态文案，而不是留一片空白
  await search.fill('不存在的名字XYZ');
  await expect(page.getByTestId('my-pets-no-match')).toContainText('没有符合条件的精灵');
  await expect(page.getByText('火花')).toHaveCount(0);
});

test('账号同类取并集；大块头筛选与零命中档位置灰', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('import-input').setInputFiles([
    'src/domain/__fixtures__/backup-sample.json',
    'src/domain/__fixtures__/backup-sample-2.json',
  ]);
  await expect(page.getByText('还没有数据')).toHaveCount(0);
  await page.getByRole('button', { name: '收集', exact: true }).click();
  await page.getByTestId('collection-kind-inventory').click();

  // 账号筛选在页面顶部 AccountFilterBar（默认折叠；排除制：点 chip = 取消该账号）；
  // 下方筛选面板不再有账号标签。
  // 初始全选 7 只；排除「测试乙」→ 只剩测试甲 5 只（2026-11-22 C1 给样本补了一只母本）
  await page.getByTestId('account-filter-summary').click();
  await page.getByTestId('account-filter-测试乙').click();
  await expect(page.locator('article')).toHaveCount(5);

  // 点回「测试乙」→ 并集 7 只（旧实现取交集会变成 0 只）
  await page.getByTestId('account-filter-测试乙').click();
  await expect(page.locator('article')).toHaveCount(7);

  // 「全不选」已被禁止：只剩一个账号时该 chip 不可点，点「全选」恢复
  await page.getByTestId('account-filter-测试甲').click();
  await expect(page.locator('article')).toHaveCount(2);
  await expect(page.getByTestId('account-filter-测试乙')).toBeDisabled();
  await page.getByTestId('account-filter-select-all').click();
  await expect(page.locator('article')).toHaveCount(7);

  // 2026-11-22：筛选改成常显整行（不再有每维一个 tile），直接点选项
  await page.getByTestId('filter-opt-body-body:大块头').click();
  await expect(page.locator('article')).toHaveCount(4);

  // 粗嗓门零命中 → 档位置灰（这个 fixture 里没有负分贝）
  await expect(page.getByTestId('filter-opt-voice-voice:粗嗓门')).toBeDisabled();
});
