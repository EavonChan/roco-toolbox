# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: my-pets.spec.ts >> 我的精灵页：卡片展示与标签叠加筛选
- Location: e2e\my-pets.spec.ts:4:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByTestId('filter-tile-gender')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByTestId('filter-tile-gender') with timeout 5000ms
  - waiting for getByTestId('filter-tile-gender')

```

```yaml
- banner:
  - heading "小布助手" [level=1]
  - button "刷新"
  - button "教程"
- navigation:
  - button "看板"
  - button "家园"
  - button "收集"
  - button "附近"
  - button "小组"
  - button "我的"
- navigation "收集视图":
  - button "账号筛选 1/1": 测试甲 1/1
  - button "精灵背包 共 4 只" [pressed]
  - button "母本"
  - button "种公"
- main:
  - text: 搜索精灵名
  - searchbox "搜索精灵名"
  - button "筛选" [expanded]
  - text: 身高体重
  - button "百分比" [pressed]
  - button "数值"
  - button "三列"
  - button "四列" [pressed]
  - button "重置"
  - button "公"
  - button "母"
  - button "异色"
  - button "异色炫彩" [disabled]
  - button "炫彩" [disabled]
  - button "性格 不限 ▼"
  - button "蛋组 不限 ▼"
  - text: "身高:"
  - textbox "最低身高百分比": "0"
  - text: "% 至"
  - textbox "最高身高百分比": "100"
  - text: "%"
  - button "零身高"
  - button "满身高"
  - button "清除"
  - text: "体型:"
  - button "不限" [pressed]
  - button "大块头"
  - button "小不点"
  - button "满体重" [disabled]
  - button "零体重" [disabled]
  - text: "声音:"
  - button "不限" [pressed]
  - button "婉转声"
  - button "粗嗓门" [disabled]
  - button "+100"
  - button "-100" [disabled]
  - list:
    - listitem:
      - article:
        - text: No.263 机械组 拟人组
        - img "异色"
        - text: ♀ 大胆
        - img "大块头"
        - img "婉转声"
        - text: 100dB
        - heading "机械方方" [level=3]
        - text: 高— · 重98.4% 测试甲·盒子01
    - listitem:
      - article:
        - text: No.011 天空组 ♂ 固执
        - img "婉转声"
        - text: 96dB
        - heading "鸭吉吉_等一等鸭" [level=3]
        - text: 高— · 重55.2% 测试甲·盒子01
    - listitem:
      - article:
        - text: No.002 动物组 拟人组 ? 踏实
        - img "小不点"
        - text: 40dB
        - heading "喵喵" [level=3]
        - text: 高— · 重0.8% 测试甲·盒子02
    - listitem:
      - article:
        - text: No.005 魔力组 巨灵组 ♂ 固执
        - img "大块头"
        - img "婉转声"
        - text: 100dB
        - heading "火花" [level=3]
        - text: 高— · 重99.1% 测试甲·盒子01·3
```

# Test source

```ts
  1   | ﻿import { mkdirSync, writeFileSync } from 'node:fs';
  2   | import { expect, test } from '@playwright/test';
  3   | 
  4   | test('我的精灵页：卡片展示与标签叠加筛选', async ({ page }) => {
  5   |   await page.goto('/');
  6   |   await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  7   |   await expect(page.getByText('还没有数据')).toHaveCount(0);
  8   | 
  9   |   await page.getByRole('button', { name: '收集', exact: true }).click();
  10  |   await page.getByTestId('collection-kind-inventory').click();
  11  | 
  12  |   // 卡片展示：名称、盒子位置（2026-10-05 卡内不再显示账号与图鉴编号，账号由账号筛选条承担）
  13  |   await expect(page.getByText('机械方方')).toBeVisible();
  14  |   await expect(page.getByText(/盒子01/).first()).toBeVisible();
  15  |   await expect(page.getByTestId('pet-card-gender').first()).toBeVisible();
  16  | 
  17  |   // 带形态的精灵用**官方名**显示（游戏自己的写法，下划线分隔），不是自己拼的空格写法
  18  |   await expect(page.getByText('鸭吉吉_等一等鸭')).toBeVisible();
  19  |   await expect(page.getByText('鸭吉吉 等一等鸭')).toHaveCount(0);
  20  | 
  21  |   // 筛选区默认展开（2026-10-05 拍板）：维度是手风琴瓦片（第一行 性别/体型/声音）
  22  |   await expect(page.getByTestId('pet-filters-toggle')).toHaveText(/筛选/);
> 23  |   await expect(page.getByTestId('filter-tile-gender')).toBeVisible();
      |                                                        ^ Error: expect(locator).toBeVisible() failed
  24  | 
  25  |   // 手风琴：展开「体型」→ 点「大块头」→ 只剩大块头精灵（点选项不自动收起，可连点多选）
  26  |   await page.getByTestId('filter-tile-body').click();
  27  |   await page.getByTestId('filter-opt-body-body:大块头').click();
  28  |   await expect(page.getByText('机械方方')).toBeVisible();
  29  |   await expect(page.getByText('鸭吉吉')).toHaveCount(0);
  30  |   await expect(page.getByText('喵喵')).toHaveCount(0);
  31  | 
  32  |   // 取消「大块头」→ 全部精灵回来
  33  |   await page.getByTestId('filter-opt-body-body:大块头').click();
  34  |   await expect(page.getByText('机械方方')).toBeVisible();
  35  |   await expect(page.getByText('鸭吉吉')).toBeVisible();
  36  |   // 账号筛选已移到页面顶部 AccountFilterBar，下方筛选面板不再重复账号标签（2026-10-05）
  37  |   await expect(page.getByTestId('pet-filters')).not.toContainText('账号（');
  38  |   // 收起筛选后已选条件仍有摘要
  39  |   await page.getByTestId('pet-filters-toggle').click();
  40  |   await expect(page.getByTestId('pet-filters-selected')).toHaveCount(0);
  41  | });
  42  | 
  43  | test('种公入口落到种公阵列：只列覆盖目标的种公，档位跟全局目标', async ({ page }) => {
  44  |   await page.goto('/');
  45  |   await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  46  |   await expect(page.getByText('还没有数据')).toHaveCount(0);
  47  |   await page.getByRole('button', { name: '收集', exact: true }).click();
  48  | 
  49  |   // 2026-10-29「合格种公」视图已删：种公统一在「收集 · 种公」的种公阵列里看
  50  |   await page.getByTestId('collection-kind-studs').click();
  51  |   await expect(page.getByTestId('collection-kind-studs')).toHaveAttribute('aria-pressed', 'true');
  52  |   await expect(page.getByTestId('stud-matrix')).toBeVisible();
  53  | 
  54  |   // 档位是全局目标（默认满分 → 大婉），阵列顶部 tab 必须是选中态
  55  |   await expect(page.getByTestId('stud-matrix-grade-大婉')).toHaveAttribute('aria-pressed', 'true');
  56  | 
  57  |   // 只列真正覆盖了目标的种公：代表格是带「共 N 只」的可点按钮（fixture 里只有火花达标）
  58  |   const repCell = page.getByRole('button', { name: /种公 .*共 \d+ 只/ }).first();
  59  |   await expect(repCell).toBeVisible();
  60  |   await expect(repCell).toContainText('火花');
  61  | });
  62  | 
  63  | test('种公阵列：性格筛选决定阵列的列，清空后回到未选提示', async ({ page }) => {
  64  |   await page.goto('/');
  65  |   await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  66  |   await expect(page.getByText('还没有数据')).toHaveCount(0);
  67  |   await page.getByRole('button', { name: '收集', exact: true }).click();
  68  | 
  69  |   await page.getByTestId('collection-kind-studs').click();
  70  |   await expect(page.getByTestId('collection-kind-studs')).toHaveAttribute('aria-pressed', 'true');
  71  |   await expect(page.getByTestId('stud-matrix')).toBeVisible();
  72  | 
  73  |   // 筛收取在阵列右上角：切自选性格 → 勾「固执」→ 阵列出现「固执」列；取消 → 回到未选提示
  74  |   await page.getByTestId('stud-matrix-filter-toggle').click();
  75  |   await page.getByTestId('nature-mode-custom').click();
  76  |   await page.getByTestId('custom-nature-固执').click();
  77  |   await expect(page.getByRole('columnheader', { name: '固执' })).toBeVisible();
  78  | 
  79  |   await page.getByTestId('custom-nature-固执').click();
  80  |   await expect(page.getByTestId('stud-matrix-empty')).toBeVisible();
  81  | });
  82  | 
  83  | test('母本页：链清单一链一行（按蛋组分区），搜索即答已收集/未收集，计划不误判已达成', async ({ page }) => {
  84  |   await page.goto('/');
  85  |   await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  86  |   await expect(page.getByText('还没有数据')).toHaveCount(0);
  87  |   await page.getByRole('button', { name: '收集', exact: true }).click();
  88  |   await page.getByTestId('collection-kind-inventory').click();
  89  |   // 2026-11-01：页签是「收集 · 母本」的卡片按钮，不再是页内的「母本」文字按钮
  90  |   await page.getByTestId('collection-kind-mothers').click();
  91  |   await expect(page.getByTestId('collection-kind-mothers')).toHaveAttribute('aria-pressed', 'true');
  92  | 
  93  |   // 链清单：一链一行（按蛋组分区），顶部给整体进度；默认停在「未收集」
  94  |   await expect(page.getByTestId('mother-chain-summary')).toContainText('共');
  95  |   const rows = page.getByTestId('mother-chain-row');
  96  |   expect(await rows.count()).toBeGreaterThan(10);
  97  |   await expect(page.getByTestId('mother-chain-filter-uncollected')).toHaveAttribute('aria-pressed', 'true');
  98  | 
  99  |   // 开关切到「已收集」：机械方方（大块头 + 100dB 母）默认达标 = 已收集
  100 |   await page.getByTestId('mother-chain-filter-collected').click();
  101 |   await expect(page.getByTestId('mother-chain-filter-collected')).toHaveAttribute('aria-pressed', 'true');
  102 |   const search = page.getByTestId('mother-search');
  103 |   await search.fill('机械方方');
  104 |   await expect(rows).toHaveCount(1);
  105 |   const row = rows.first();
  106 |   await expect(row).toContainText('机械方方');
  107 |   // 卡片：精灵名 + 「查看 N 只」（已收集）；第二行是推荐性格 + 蛋组标签
  108 |   await expect(row.getByTestId('mother-chain-expand')).toBeVisible();
  109 |   await expect(row.getByTestId('mother-chain-detail')).toContainText('查看 1 只');
  110 |   await expect(row.getByTestId('mother-card-egg-groups')).toBeVisible();
  111 |   // 展开 → 显示实际母本及其信息（性格/分贝/体型/账号/盒子）
  112 |   await row.getByTestId('mother-chain-expand').click();
  113 |   const motherRow = row.getByTestId('mother-chain-mother');
  114 |   await expect(motherRow).toContainText('机械方方');
  115 |   await expect(motherRow).toContainText('100dB');
  116 |   // 性格按是否命中推荐上色：推荐=翠绿(text-emerald-600)、非推荐=浅灰(text-slate-400)
  117 |   await expect(motherRow.getByText('大胆', { exact: true })).toHaveClass(/text-(emerald-600|slate-400)/);
  118 |   await row.getByTestId('mother-chain-expand').click();
  119 |   await expect(row.getByTestId('mother-chain-mother')).toHaveCount(0);
  120 | 
  121 |   // 收窄达标条件（只留「小不点」档）→ 同一颗蛋立刻变未收集：已从「已收集」里消失，切回「未收集」才看得到
  122 |   await page.getByTestId('mother-criteria-grade-小婉').click();
  123 |   await expect(rows).toHaveCount(0);
```