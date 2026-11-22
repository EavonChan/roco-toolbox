import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { expectProgressZero, progressOf } from './progress';

/**
 * 「数据管理」（导出全部数据 / 合并导入 / 重置）在「导入数据」页底部、**默认收起**（2026-10-06 重排）：
 * 用到里面的按钮或输入框之前先展开（幂等，已展开就不重复点）。
 */
const openMoreData = async (page: Page) => {
  const toggle = page.getByTestId('import-more-toggle');
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
};

/**
 * 等导入真正落盘再切页：导入中导航会被拦住（点了也不动）。
 * 2026-10-25 起导入完成后不再自动跳看板，需要看板内容的用例要自己点过去。
 */
const waitImported = async (page: Page) => {
  await expect(page.getByTestId('import-outcome')).toContainText('已保存到本机');
};

/**
 * 切页签：导入进行中导航会被拦住（点了不动），所以点到页签真的选中为止。
 * 断点用 aria-current（TabNav 在选中页签上写 page）。
 */
const openTab = async (page: Page, name: string) => {
  const tab = page.getByRole('button', { name, exact: true });
  await expect(async () => {
    await tab.click();
    await expect(tab).toHaveAttribute('aria-current', 'page', { timeout: 1000 });
  }).toPass({ timeout: 15000 });
};

test('看板首页展示两块进度卡与署名', async ({ page }) => {
  await page.goto('/');
  // 无数据时默认落在「导入数据」页，这里切到看板看进度卡
  await openTab(page, '看板');

  await expect(page.getByRole('heading', { name: '小布助手' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '种公全收集' })).toBeVisible();
  // 母本卡与下方筛选标题前缀相同，必须限定在各自的容器里（避免 strict mode 撞上）
  await expect(
    page.getByTestId('progress-card-action-mother').getByRole('heading', { name: '母本全收集' }),
  ).toBeVisible();

  // 两块进度卡都从 0 起（分母随图鉴变化，从卡上读，不写死）
  await expectProgressZero(page);

  // 2026-11-22 用户口径：看板去掉「数据来源」说明块，CC BY-SA 署名只在导入数据页出现
  await expect(page.getByText('CC BY-SA 4.0')).toHaveCount(0);
});

test('导入抓包数据后看板给出进度与建议', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('还没有数据')).toBeVisible();

  await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');

  await expect(page.getByText('还没有数据')).toHaveCount(0);
  await waitImported(page);
  await openTab(page, '看板');
  await expect(
    page.getByTestId('progress-card-action-mother').getByRole('heading', { name: '母本全收集' }),
  ).toBeVisible();
  // 2026-11-22：看板不再放「种公推荐」网格（改到 收集 · 种公 看），这一栏只剩配窝建议 + 两个开关
  await expect(page.getByTestId('dashboard-action-switch')).toBeVisible();
  await expect(page.getByTestId('dashboard-action-studs')).toBeVisible();
});

test('母本进度：看板卡与点进去的母本页是同一口径（数字一致）', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  await waitImported(page);
  await openTab(page, '看板');

  const card = page.getByTestId('progress-card-action-mother');
  await expect(card).toBeVisible();
  // 卡上的分子（此前按单一档位「满分大婉」算，点进去却按达标条件算 → 数字对不上）
  const cardText = await card.innerText();
  const cardNum = Number(cardText.match(/(\d+)\s*\/\s*\d+/)?.[1]);
  expect(Number.isFinite(cardNum)).toBe(true);

  await card.click();
  await expect(page.getByTestId('mother-chain-summary')).toContainText(`已收集 ${cardNum}`);
});


test('重置按钮一键清空已导入的数据', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  await waitImported(page);
  await openTab(page, '看板');
  // 导入后母本全收集不再是 0（分子 > 0）
  expect((await progressOf(page, 'progress-card-action-mother')).numerator).toBeGreaterThan(0);

  // 重置按钮在「导入数据」页，先切过去
  page.on('dialog', (dialog) => dialog.accept());
  await openTab(page, '我的');
  await openMoreData(page);
  await page.getByRole('button', { name: '重置导入数据' }).click();

  await expect(page.getByText('还没有数据')).toBeVisible();
  // 清空后回到看板：两块进度归零、署名仍在
  await openTab(page, '看板');
  await expectProgressZero(page);
});

test('切页签不再闪"正在读取本地数据"', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  await expect(page.getByText('还没有数据')).toHaveCount(0);
  await waitImported(page);

  // 四个页签来回切，加载文案都不应再出现（数据已在内存缓存里）
  for (const tab of ['收集', '换蛋', '我的', '看板', '收集', '换蛋']) {
    await page.getByRole('button', { name: tab, exact: true }).click();
    await expect(page.getByText('正在读取本地数据')).toHaveCount(0);
  }
});

test('导出全部数据 → 清空 → 导入备份，数据完整恢复（"共用一份"的手动做法）', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  // 导入后停在导入页（不再自动跳看板），导出入口就在这里
  await waitImported(page);

  await openMoreData(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-button').click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/小布助手备份-\d{4}-\d{2}-\d{2}\.json/);
  const backupPath = await download.path();
  expect(backupPath).not.toBeNull();

  // 清空本机数据（清空后仍停在导入页，空状态可见）
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '重置导入数据' }).click();
  await expect(page.getByText('还没有数据')).toBeVisible();

  // 用备份恢复（清空后合并 = 全部新增）
  await page.getByTestId('backup-input').setInputFiles(backupPath as string);
  await expect(page.getByTestId('data-message')).toContainText('已合并导入');
  await expect(page.getByTestId('data-message')).toContainText('新增 1 个账号');
  await waitImported(page);

  // 恢复后回到看板：进度不再是 0
  await openTab(page, '看板');
  await expect(page.getByText('还没有数据')).toHaveCount(0);
  expect((await progressOf(page, 'progress-card-action-mother')).numerator).toBeGreaterThan(0);
});

test('合并导入：两台设备的数据合到一起，谁的账号都不会被清掉', async ({ browser }) => {
  const BASE = 'http://localhost:4173/';

  // 设备 A（平板）：导入自己的抓包 → 导出成备份；两个上下文互不共享存储，就是两台设备
  const deviceA = await browser.newContext();
  const pageA = await deviceA.newPage();
  await pageA.goto(BASE);
  await pageA.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  // 导入后停在导入页（不再自动跳看板），「N 个账号」与导出按钮都在这里
  await waitImported(pageA);
  await expect(pageA.getByText('1 个账号')).toBeVisible();
  await openMoreData(pageA);
  const [downloadA] = await Promise.all([
    pageA.waitForEvent('download'),
    pageA.getByTestId('export-button').click(),
  ]);
  // 必须先另存：download.path() 指向该上下文的临时产物目录，关掉上下文就没了
  mkdirSync('test-results', { recursive: true });
  const backupA = 'test-results/device-a-backup.json';
  await downloadA.saveAs(backupA);
  await deviceA.close();

  // 设备 B（手机）：自己的账号是另一个，然后把平板那份备份合并进来
  const deviceB = await browser.newContext();
  const pageB = await deviceB.newPage();
  await pageB.goto(BASE);
  await pageB.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample-2.json');
  await waitImported(pageB);
  await expect(pageB.getByText('1 个账号')).toBeVisible();

  pageB.on('dialog', (dialog) => dialog.accept());
  await openMoreData(pageB);
  await pageB.getByTestId('backup-input').setInputFiles(backupA);
  await expect(pageB.getByTestId('data-message')).toContainText('已合并导入');
  await expect(pageB.getByTestId('data-message')).toContainText('新增 1 个账号');

  // 两边账号都在 —— 旧实现（清空后覆盖）这里会只剩平板的那个
  await expect(pageB.getByText('2 个账号')).toBeVisible();
  await deviceB.close();
});

test('合并导入：同账号取较新的一份，旧备份顶不回本地', async ({ page }) => {
  // 造一份「同账号但导入时间很早」的备份
  mkdirSync('test-results', { recursive: true });
  const olderPath = 'test-results/older-backup.json';
  writeFileSync(
    olderPath,
    JSON.stringify({
      type: 'roco-toolbox-backup',
      version: 1,
      exportedAt: '2020-01-01T00:00:00.000Z',
      catalogVersion: 'x',
      accounts: [
        {
          accountName: '测试甲',
          // 与 fixture（src/domain/__fixtures__/backup-sample.json）是同一个游戏 UID →
          // 认作同一账号，走「取较新的一份」这条规则（2026-10-06 起账号身份是 UID，不是名字）
          gameId: 1000001,
          exportedAt: '2020-01-01T00:00:00.000Z',
          importedAt: '2020-01-01T00:00:00.000Z',
          pets: [],
          eggs: [],
        },
      ],
    }),
    'utf8',
  );

  await page.goto('/');
  await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  // 导入后停在导入页（不再自动跳看板），「N 个账号」「合并导入」都在这里
  await waitImported(page);
  await expect(page.getByText('1 个账号')).toBeVisible();

  page.on('dialog', (dialog) => dialog.accept());
  await openMoreData(page);
  await page.getByTestId('backup-input').setInputFiles(olderPath);
  const message = page.getByTestId('data-message');
  await expect(message).toContainText('新增 0 个账号');
  await expect(message).toContainText('更新 0 个');
  await expect(message).toContainText('保留本地较新的 1 个');

  // 本地那份没被空数据顶掉：精灵还在（我的精灵里能看到 fixture 里的机械方方）
  await openTab(page, '收集');
  await page.getByTestId('collection-kind-inventory').click();
  await expect(page.getByText('机械方方')).toBeVisible();
});

test('把备份文件从「导入抓包数据」入口塞进去，也能按合并导入处理', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  // 导入后停在导入页（不再自动跳看板），导出/导入入口都在这里
  await waitImported(page);

  // 导出一份真备份，模拟「微信收到备份 → 分享给小布助手」：走的就是这条入口。
  // 以前这里会被当成抓包解析而报错，现在按合并导入处理。
  await openMoreData(page);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-button').click(),
  ]);
  const backupPath = await download.path();
  await page.getByTestId('import-input').setInputFiles(backupPath as string);

  await expect(page.getByTestId('data-message')).toContainText('已合并导入');
  // 同一份数据 → 本地时间不比它旧 → 保留本地，不报错、也不清数据
  await expect(page.getByTestId('data-message')).toContainText('保留本地较新的 1 个');
  await expect(page.getByText('1 个账号')).toBeVisible();
});

test('用「合并导入」选抓包文件时给出可读错误', async ({ page }) => {
  await page.goto('/');
  await openMoreData(page);
  await page.getByTestId('backup-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  await expect(page.getByText(/不是小布助手的备份文件/)).toBeVisible();
});


test('当前模式：看板开关切到追双牌，全程序跟着换', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  await expect(page.getByText('还没有数据')).toHaveCount(0);
  await waitImported(page);
  await openTab(page, '看板');

  // 默认追满分
  await expect(page.getByTestId('target-mode-perfect')).toHaveAttribute('aria-pressed', 'true');

  await page.getByTestId('target-mode-medal').click();
  await expect(page.getByTestId('target-mode-medal')).toHaveAttribute('aria-pressed', 'true');
  // 2026-11-22：精灵库那个「按代表档位查看」次入口已下线（MotherGradeInventory 没有挂载点了），
  // 这里只验模式切换本身；奖牌标签不带「满分」前缀由 MotherCriteriaMedals 单测覆盖。

  // 覆盖度页显示当前模式
  await openTab(page, '收集');
  await page.getByTestId('collection-kind-studs').click();
  await expect(page.getByTestId('coverage-mode')).toContainText('追双牌');

  // 刷新后模式还在（持久化在本机）；页签也留在原处（关后台回来不丢位置）
  await page.reload();
  await expect(page.getByTestId('coverage-mode')).toContainText('追双牌');
  await openTab(page, '看板');
  await expect(page.getByTestId('target-mode-medal')).toHaveAttribute('aria-pressed', 'true');
});

test('导入报告：性格不在目标池的合格公也会被列出', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-offtarget-stud.json');
  // 2026-10-25 起导入后停在导入页；「本次新增」卡片在看板（2026-10-05 移至看板）
  await waitImported(page);
  await openTab(page, '看板');

  const card = page.getByTestId('import-result');
  await expect(card).toBeVisible();
  // 「满分小婉 · 懒散」的公：懒散不在任何目标性格池里，但必须出现在「新增种公」
  const stud = card.getByTestId('import-result-stud').first();
  await expect(stud).toContainText('梦游');
  await expect(stud).toContainText('懒散');
  await expect(stud).toContainText('100dB');
});

test('账号筛选：三页共用一份，取消账号后看板进度跟着变', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('import-input').setInputFiles([
    'src/domain/__fixtures__/backup-sample.json',
    'src/domain/__fixtures__/backup-sample-2.json',
  ]);
  await expect(page.getByText('还没有数据')).toHaveCount(0);
  await waitImported(page);
  await openTab(page, '看板');

  await expect(page.getByTestId('dashboard-account-summary')).toContainText('(2/2)');

  // 覆盖度页是同一个 store：那边取消一个账号，看板这边也是 1/2
  await openTab(page, '收集');
  await page.getByTestId('collection-kind-studs').click();
  // 收集页顶部的账号筛选显示「账号名 2/2」（没有括号，2026-11-21 紧凑条改版）
  await expect(page.getByTestId('account-filter-summary')).toContainText('2/2');
  await page.getByTestId('account-filter-summary').click();
  await page.getByTestId('account-filter-测试乙').click();
  await expect(page.getByTestId('account-filter-summary')).toContainText('1/2');

  await openTab(page, '看板');
  await expect(page.getByTestId('dashboard-account-summary')).toContainText('(1/2)');

  // 「全不选」已被禁止：只剩一个账号时不可再取消，改点「全选」恢复
  await page.getByTestId('dashboard-account-summary').click();
  await expect(page.getByTestId('dashboard-account-测试甲')).toBeDisabled();
  await page.getByTestId('dashboard-account-select-all').click();
  await expect(page.getByTestId('dashboard-account-summary')).toContainText('(2/2)');
});

test('种公全收集卡可点：跳收集 · 种公阵列', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  await expect(page.getByText('还没有数据')).toHaveCount(0);
  await waitImported(page);
  await openTab(page, '看板');

  await page.getByTestId('progress-card-action-stud').click();
  // 只有「收集 · 种公阵列」这个落点才成立的强断言（旧「我的精灵 · 种公视角」已删除）
  await expect(page.getByTestId('collection-kind-studs')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('stud-matrix')).toBeVisible();
  await expect(page.getByTestId('collection-kind-inventory')).not.toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('跳转后落在目标页顶部：切页签会重置滚动位置', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  await waitImported(page);
  // 2026-11-22：看板已经短到一屏装得下（滚不动），改用收集 · 母本这种长页来验「切页签回到顶部」
  await openTab(page, '收集');
  await page.getByTestId('collection-kind-mothers').click();
  await expect(page.getByTestId('mother-chain-summary')).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

  // 切到覆盖度（目标页比视口高：不重置的话会沿用上一页的旧偏移，跳转位置不准）
  await page.getByTestId('collection-kind-studs').click();
  await expect(page.getByTestId('coverage-mode')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test('一次导入两个文件后账号数显示为 2', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('import-input').setInputFiles([
    'src/domain/__fixtures__/backup-sample.json',
    'src/domain/__fixtures__/backup-sample-2.json',
  ]);
  // 导入后停在导入页（不再自动跳看板），「N 个账号」就在这里
  await waitImported(page);
  await expect(page.getByText('2 个账号')).toBeVisible();
});

test.describe('本次导入新增', () => {
  test('按账号分组，只列合要求的精灵并标明盒子位置（卡片在看板）', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('import-input').setInputFiles([
      'src/domain/__fixtures__/backup-sample.json',
      'src/domain/__fixtures__/backup-sample-2.json',
    ]);
    // 2026-10-25 起导入后停在导入页；卡片仍在看板（2026-10-05 移至看板）
    await waitImported(page);
    await openTab(page, '看板');

    const card = page.getByTestId('import-result');
    await expect(card).toBeVisible();

    // 按账号分组：测试甲有货、测试乙没有
    const accounts = card.getByTestId('import-result-account');
    await expect(accounts).toHaveCount(2);
    await expect(accounts.first()).toContainText('测试甲');
    await expect(accounts.nth(1)).toContainText('测试乙');
    await expect(accounts.nth(1)).toContainText('没有新增符合要求的精灵');

    // 火花：大块头 + 100dB + 公 + 固执 → 满分大婉种公；标出蛋组与盒子位置
    const stud = card.getByTestId('import-result-stud').first();
    await expect(stud).toContainText('火花');
    await expect(stud).toContainText('巨灵组');
    await expect(stud).toContainText('盒子01 第3位');

    // 机械方方 + 恶魔狼：大块头 + 100dB 母本 → 都分到「满分大婉」档，并各标盒子位置
    // （2026-11-22 C1 给样本补了恶魔狼，母本数 1 → 2）
    await expect(accounts.first()).toContainText('新增满分大婉种公 1');
    await expect(accounts.first()).toContainText('新增满分大婉母本 2');
    const mothers = card.getByTestId('import-result-mother');
    await expect(mothers).toHaveCount(2);
    await expect(mothers.first()).toContainText('机械方方');
    await expect(mothers.first()).toContainText('盒子01');
  });

  test('同一份数据再导入一次 → 没有新增（不会把老精灵当成新抓的）', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
    // 导入后停在导入页；「本次新增」卡片在看板
    await waitImported(page);
    await openTab(page, '看板');
    await expect(page.getByTestId('import-result-stud').first()).toBeVisible();

    // 第二次导入的入口在「导入数据」页，导入完再回看板看结果
    await openTab(page, '我的');
    await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
    await waitImported(page);
    await openTab(page, '看板');
    await expect(page.getByTestId('import-result-empty')).toBeVisible();
    await expect(page.getByTestId('import-result-stud')).toHaveCount(0);
  });

  test('卡片可以收起再展开（收起态跨页签保持；刷新后历史仍在）', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
    // 导入后停在导入页；卡片在看板
    await waitImported(page);
    await openTab(page, '看板');
    await expect(page.getByTestId('import-result')).toBeVisible();

    // 收起：只隐藏正文
    await page.getByTestId('import-result-dismiss').click();
    await expect(page.getByTestId('import-result-dismiss')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('import-result-stud')).toHaveCount(0);

    // 切到别的页签再回看板：仍保持收起（以前展开态在组件里，回来会自己弹开）
    await openTab(page, '收集');
  await page.getByTestId('collection-kind-studs').click();
    await openTab(page, '看板');
    await expect(page.getByTestId('import-result-dismiss')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTestId('import-result-stud')).toHaveCount(0);

    // 再展开：内容回来
    await page.getByTestId('import-result-dismiss').click();
    await expect(page.getByTestId('import-result-stud').first()).toBeVisible();
  });

  test('历史在看板不出现，只留在「导入数据」页；可点开看某次导入明细', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
    // 导入后停在导入页；卡片在看板
    await waitImported(page);
    await openTab(page, '看板');
    await expect(page.getByTestId('import-result-stud').first()).toBeVisible();

    // 刷新 = 重开应用：内存里的最新结果没了 → 看板不再显示「本次新增」卡片
    await page.reload();
    await expect(page.getByRole('heading', { name: '种公全收集' })).toBeVisible();
    await expect(page.getByTestId('import-result')).toHaveCount(0);

    // 历史入口在看「导入数据」页：卡片渲染，只提供历史，不重新展示最新内容
    await openTab(page, '我的');
    const card = page.getByTestId('import-result');
    await expect(card).toBeVisible();
    await expect(card.getByRole('heading', { name: /导入历史/ })).toBeVisible();
    await expect(card.getByTestId('import-result-stud')).toHaveCount(0);

    // 点历史条目 → 明细展开（能看到账号与精灵）
    await card.getByTestId('import-result-entry').first().click();
    const detail = card.getByTestId('import-result-history-detail');
    await expect(detail).toBeVisible();
    await expect(detail.getByTestId('import-result-stud').first()).toContainText('火花');

    // 再点收起
    await card.getByTestId('import-result-entry').first().click();
    await expect(card.getByTestId('import-result-history-detail')).toHaveCount(0);
  });
});