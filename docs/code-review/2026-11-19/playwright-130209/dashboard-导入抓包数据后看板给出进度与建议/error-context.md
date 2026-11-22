# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard.spec.ts >> 导入抓包数据后看板给出进度与建议
- Location: e2e\dashboard.spec.ts:54:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: '种公推荐' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('heading', { name: '种公推荐' }) with timeout 5000ms
  - waiting for getByRole('heading', { name: '种公推荐' })

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
- main:
  - text: 账号
  - button "测试甲 (1/1)"
  - group "目标模式":
    - button "追满分" [pressed]
    - button "追双牌"
  - group "目标奖牌组合（公母共用）":
    - button "大块头 婉转声 +100 大块头 婉转声" [pressed]:
      - img "大块头"
      - img "婉转声 +100"
      - text: 大块头 婉转声
    - button "大块头 粗嗓门 -100 大块头 粗嗓门":
      - img "大块头"
      - img "粗嗓门 -100"
      - text: 大块头 粗嗓门
    - button "小不点 婉转声 +100 小不点 婉转声":
      - img "小不点"
      - img "婉转声 +100"
      - text: 小不点 婉转声
    - button "小不点 粗嗓门 -100 小不点 粗嗓门":
      - img "小不点"
      - img "粗嗓门 -100"
      - text: 小不点 粗嗓门
  - paragraph: 追满分即满声：婉转声 +100、粗嗓门 -100。
  - paragraph: 大块头对应身高 100%，小不点对应身高 0%。
  - button "种公全收集 0 / 14 14 个蛋组 · 组内目标全达标才算通":
    - heading "种公全收集" [level=2]
    - paragraph: 0 / 14
    - paragraph: 14 个蛋组 · 组内目标全达标才算通
  - button "母本全收集 1 / 208 已收集 = 有达标母本的蛋；达标条件可自定义":
    - heading "母本全收集" [level=2]
    - paragraph: 1 / 208
    - paragraph: 已收集 = 有达标母本的蛋；达标条件可自定义
  - heading "本次新增 （符合看板分类）" [level=2]
  - button "收起" [expanded]
  - heading "测试甲首次导入" [level=3]
  - paragraph: 新增满分大婉种公 1
  - list:
    - listitem: 火花 ♂ · 固执 · 魔力组/巨灵组 · 100dB · 盒子01 第3位
  - paragraph: 新增满分大婉母本 1
  - list:
    - listitem: 机械方方 ♀ · 大胆 · 100dB · 盒子01
  - group "看板行动":
    - button "种公推荐" [pressed]
    - button "母本缺口"
  - list:
    - listitem "平和白发懒人（巨灵组 × 拟人组）":
      - button "标记 平和白发懒人（巨灵组 × 拟人组） 已换到":
        - text: No.073 巨灵组 拟人组 平和
        - heading "白发懒人" [level=3]
    - listitem "固执、开朗小狮鹫_崖间地的样子（天空组 × 动物组）":
      - button "标记 固执、开朗小狮鹫_崖间地的样子（天空组 × 动物组） 已换到":
        - text: No.165 天空组 动物组 固执 开朗
        - heading "小狮鹫_崖间地的样子" [level=3]
    - listitem "胆小梦游_穿旧睡衣的样子（妖精组 × 魔力组）":
      - button "标记 胆小梦游_穿旧睡衣的样子（妖精组 × 魔力组） 已换到":
        - text: No.057 妖精组 魔力组 胆小
        - heading "梦游_穿旧睡衣的样子" [level=3]
    - listitem "平和多西（巨灵组 × 机械组）":
      - button "标记 平和多西（巨灵组 × 机械组） 已换到":
        - text: No.221 巨灵组 机械组 平和
        - heading "多西" [level=3]
    - listitem "沉默波波螺（两栖组 × 大地组）":
      - button "标记 沉默波波螺（两栖组 × 大地组） 已换到":
        - text: No.171 两栖组 大地组 沉默
        - heading "波波螺" [level=3]
    - listitem "固执、开朗草头鸭（两栖组 × 天空组）":
      - button "标记 固执、开朗草头鸭（两栖组 × 天空组） 已换到":
        - text: No.179 两栖组 天空组 固执 开朗
        - heading "草头鸭" [level=3]
    - listitem "固执水滴蛇（两栖组 × 妖精组）":
      - button "标记 固执水滴蛇（两栖组 × 妖精组） 已换到":
        - text: No.159 两栖组 妖精组 固执
        - heading "水滴蛇" [level=3]
    - listitem "固执小怂猫（动物组 × 拟人组）":
      - button "标记 固执小怂猫（动物组 × 拟人组） 已换到":
        - text: No.163 动物组 拟人组 固执
        - heading "小怂猫" [level=3]
    - listitem "胆小海枝枝_洋红沙丁（植物组 × 海洋组）":
      - button "标记 胆小海枝枝_洋红沙丁（植物组 × 海洋组） 已换到":
        - text: No.220 植物组 海洋组 胆小
        - heading "海枝枝_洋红沙丁" [level=3]
    - listitem "固执矿晶虫（软体组 × 大地组）":
      - button "标记 固执矿晶虫（软体组 × 大地组） 已换到":
        - text: No.039 软体组 大地组 固执
        - heading "矿晶虫" [level=3]
    - listitem "胆小脆筒甜甜（软体组 × 魔力组）":
      - button "标记 胆小脆筒甜甜（软体组 × 魔力组） 已换到":
        - text: No.234 软体组 魔力组 胆小
        - heading "脆筒甜甜" [level=3]
    - listitem "聪明翡翠水母（软体组 × 海洋组）":
      - button "标记 聪明翡翠水母（软体组 × 海洋组） 已换到":
        - text: No.244 软体组 海洋组 聪明
        - heading "翡翠水母" [level=3]
    - listitem "聪明果冻（魔力组 × 海洋组）":
      - button "标记 聪明果冻（魔力组 × 海洋组） 已换到":
        - text: No.313 魔力组 海洋组 聪明
        - heading "果冻" [level=3]
    - listitem "平和布是石（巨灵组 × 大地组）":
      - button "标记 平和布是石（巨灵组 × 大地组） 已换到":
        - text: No.027 巨灵组 大地组 平和
        - heading "布是石" [level=3]
    - listitem "平和、开朗瑰眼仔（巨灵组 × 昆虫组）":
      - button "标记 平和、开朗瑰眼仔（巨灵组 × 昆虫组） 已换到":
        - text: No.400 巨灵组 昆虫组 平和 开朗
        - heading "瑰眼仔" [level=3]
    - listitem "开朗噼啪鸟（巨灵组 × 天空组）":
      - button "标记 开朗噼啪鸟（巨灵组 × 天空组） 已换到":
        - text: No.272 巨灵组 天空组 开朗
        - heading "噼啪鸟" [level=3]
    - listitem "开朗书魔虫（巨灵组 × 妖精组）":
      - button "标记 开朗书魔虫（巨灵组 × 妖精组） 已换到":
        - text: No.303 巨灵组 妖精组 开朗
        - heading "书魔虫" [level=3]
    - listitem "开朗霹雳宝宝（巨灵组 × 拟人组）":
      - button "标记 开朗霹雳宝宝（巨灵组 × 拟人组） 已换到":
        - text: No.387 巨灵组 拟人组 开朗
        - heading "霹雳宝宝" [level=3]
    - listitem "沉默花怨鳗（两栖组 × 海洋组）":
      - button "标记 沉默花怨鳗（两栖组 × 海洋组） 已换到":
        - text: No.201 两栖组 海洋组 沉默
        - heading "花怨鳗" [level=3]
    - listitem "固执海豹战士（两栖组 × 动物组）":
      - button "标记 固执海豹战士（两栖组 × 动物组） 已换到":
        - text: No.181 两栖组 动物组 固执
        - heading "海豹战士" [level=3]
    - listitem "开朗古钟蛇（两栖组 × 动物组）":
      - button "标记 开朗古钟蛇（两栖组 × 动物组） 已换到":
        - text: No.212 两栖组 动物组 开朗
        - heading "古钟蛇" [level=3]
    - listitem "沉默小鼠獭（两栖组 × 动物组）":
      - button "标记 沉默小鼠獭（两栖组 × 动物组） 已换到":
        - text: No.036 两栖组 动物组 沉默
        - heading "小鼠獭" [level=3]
    - listitem "开朗加油海葵（两栖组 × 妖精组）":
      - button "标记 开朗加油海葵（两栖组 × 妖精组） 已换到":
        - text: No.360 两栖组 妖精组 开朗
        - heading "加油海葵" [level=3]
    - listitem "固执、开朗十字蝌蚪（两栖组 × 拟人组）":
      - button "标记 固执、开朗十字蝌蚪（两栖组 × 拟人组） 已换到":
        - text: No.427 两栖组 拟人组 固执 开朗
        - heading "十字蝌蚪" [level=3]
    - listitem "聪明毛毛（昆虫组 × 软体组）":
      - button "标记 聪明毛毛（昆虫组 × 软体组） 已换到":
        - text: No.032 昆虫组 软体组 聪明
        - heading "毛毛" [level=3]
    - listitem "聪明未完虫（昆虫组 × 魔力组）":
      - button "标记 聪明未完虫（昆虫组 × 魔力组） 已换到":
        - text: No.454 昆虫组 魔力组 聪明
        - heading "未完虫" [level=3]
    - listitem "平和小草虫（昆虫组 × 拟人组）":
      - button "标记 平和小草虫（昆虫组 × 拟人组） 已换到":
        - text: No.099 昆虫组 拟人组 平和
        - heading "小草虫" [level=3]
    - listitem "胆小风铃鲨（天空组 × 海洋组）":
      - button "标记 胆小风铃鲨（天空组 × 海洋组） 已换到":
        - text: No.108 天空组 海洋组 胆小
        - heading "风铃鲨" [level=3]
    - listitem "固执小翼龙（天空组 × 龙组）":
      - button "标记 固执小翼龙（天空组 × 龙组） 已换到":
        - text: No.224 天空组 龙组 固执
        - heading "小翼龙" [level=3]
    - listitem "固执螺旋帕帕（天空组 × 机械组）":
      - button "标记 固执螺旋帕帕（天空组 × 机械组） 已换到":
        - text: No.261 天空组 机械组 固执
        - heading "螺旋帕帕" [level=3]
    - listitem "开朗绿翼鸟（天空组 × 妖精组）":
      - button "标记 开朗绿翼鸟（天空组 × 妖精组） 已换到":
        - text: No.102 天空组 妖精组 开朗
        - heading "绿翼鸟" [level=3]
    - listitem "胆小粉星仔（天空组 × 妖精组）":
      - button "标记 胆小粉星仔（天空组 × 妖精组） 已换到":
        - text: No.335 天空组 妖精组 胆小
        - heading "粉星仔" [level=3]
    - listitem "开朗厉毒小萝（天空组 × 拟人组）":
      - button "标记 开朗厉毒小萝（天空组 × 拟人组） 已换到":
        - text: No.291 天空组 拟人组 开朗
        - heading "厉毒小萝" [level=3]
    - listitem "固执小鼓象（动物组 × 机械组）":
      - button "标记 固执小鼓象（动物组 × 机械组） 已换到":
        - text: No.371 动物组 机械组 固执
        - heading "小鼓象" [level=3]
    - listitem "开朗裘洛（动物组 × 妖精组）":
      - button "标记 开朗裘洛（动物组 × 妖精组） 已换到":
        - text: No.246 动物组 妖精组 开朗
        - heading "裘洛" [level=3]
    - listitem "开朗蝴蝶陶陶（动物组 × 拟人组）":
      - button "标记 开朗蝴蝶陶陶（动物组 × 拟人组） 已换到":
        - text: No.422 动物组 拟人组 开朗
        - heading "蝴蝶陶陶" [level=3]
    - listitem "胆小粉粉星（妖精组 × 软体组）":
      - button "标记 胆小粉粉星（妖精组 × 软体组） 已换到":
        - text: No.330 妖精组 软体组 胆小
        - heading "粉粉星" [level=3]
    - listitem "固执小箱怪（妖精组 × 机械组）":
      - button "标记 固执小箱怪（妖精组 × 机械组） 已换到":
        - text: No.210 妖精组 机械组 固执
        - heading "小箱怪" [level=3]
    - listitem "胆小蜜果骸（妖精组 × 植物组）":
      - button "标记 胆小蜜果骸（妖精组 × 植物组） 已换到":
        - text: No.434 妖精组 植物组 胆小
        - heading "蜜果骸" [level=3]
    - listitem "开朗小丑豆豆（妖精组 × 拟人组）":
      - button "标记 开朗小丑豆豆（妖精组 × 拟人组） 已换到":
        - text: No.362 妖精组 拟人组 开朗
        - heading "小丑豆豆" [level=3]
    - listitem "固执机械方方（拟人组 × 机械组）":
      - button "标记 固执机械方方（拟人组 × 机械组） 已换到":
        - text: No.263 拟人组 机械组 固执
        - heading "机械方方" [level=3]
    - listitem "沉默兽花蕾（植物组）":
      - button "标记 沉默兽花蕾（植物组） 已换到":
        - text: No.059 植物组 沉默
        - heading "兽花蕾" [level=3]
    - listitem "踏实小灵菇（植物组）":
      - button "标记 踏实小灵菇（植物组） 已换到":
        - text: No.021 植物组 踏实
        - heading "小灵菇" [level=3]
    - listitem "沉默贝瑟（机械组）":
      - button "标记 沉默贝瑟（机械组） 已换到":
        - text: No.332 机械组 沉默
        - heading "贝瑟" [level=3]
    - listitem "聪明伊雷龙（龙组）":
      - button "标记 聪明伊雷龙（龙组） 已换到":
        - text: No.203 龙组 聪明
        - heading "伊雷龙" [level=3]
    - listitem "开朗豆丁鱼（龙组）":
      - button "标记 开朗豆丁鱼（龙组） 已换到":
        - text: No.239 龙组 开朗
        - heading "豆丁鱼" [level=3]
  - heading "配窝建议" [level=2]
  - paragraph: 还差 40 个目标： 能自己迭代 0 · 未收集 40
  - button "看缺口 ›"
  - button "看推荐种公 ›"
  - paragraph: 没有能自己孵的方案：缺可配对的母本 / 公本，先去覆盖度看每个缺口的判定。
  - paragraph:
    - text: 数据来源：
    - link "洛克王国：世界 Wiki":
      - /url: https://wiki.biligame.com/nrc/
    - text: （洛克王国：世界 Wiki (wiki.biligame.com/nrc)，版本 s5-2026-10-31）
  - paragraph:
    - text: 内容以
    - link "CC BY-SA 4.0":
      - /url: https://creativecommons.org/licenses/by-sa/4.0/
    - text: 许可授权。
```

# Test source

```ts
  1   | ﻿﻿import { mkdirSync, writeFileSync } from 'node:fs';
  2   | import { expect, test, type Page } from '@playwright/test';
  3   | import { expectProgressZero, progressOf } from './progress';
  4   | 
  5   | /**
  6   |  * 「数据管理」（导出全部数据 / 合并导入 / 重置）在「导入数据」页底部、**默认收起**（2026-10-06 重排）：
  7   |  * 用到里面的按钮或输入框之前先展开（幂等，已展开就不重复点）。
  8   |  */
  9   | const openMoreData = async (page: Page) => {
  10  |   const toggle = page.getByTestId('import-more-toggle');
  11  |   if ((await toggle.getAttribute('aria-expanded')) !== 'true') await toggle.click();
  12  | };
  13  | 
  14  | /**
  15  |  * 等导入真正落盘再切页：导入中导航会被拦住（点了也不动）。
  16  |  * 2026-10-25 起导入完成后不再自动跳看板，需要看板内容的用例要自己点过去。
  17  |  */
  18  | const waitImported = async (page: Page) => {
  19  |   await expect(page.getByTestId('import-outcome')).toContainText('已保存到本机');
  20  | };
  21  | 
  22  | /**
  23  |  * 切页签：导入进行中导航会被拦住（点了不动），所以点到页签真的选中为止。
  24  |  * 断点用 aria-current（TabNav 在选中页签上写 page）。
  25  |  */
  26  | const openTab = async (page: Page, name: string) => {
  27  |   const tab = page.getByRole('button', { name, exact: true });
  28  |   await expect(async () => {
  29  |     await tab.click();
  30  |     await expect(tab).toHaveAttribute('aria-current', 'page', { timeout: 1000 });
  31  |   }).toPass({ timeout: 15000 });
  32  | };
  33  | 
  34  | test('看板首页展示两块进度卡与署名', async ({ page }) => {
  35  |   await page.goto('/');
  36  |   // 无数据时默认落在「导入数据」页，这里切到看板看进度卡
  37  |   await openTab(page, '看板');
  38  | 
  39  |   await expect(page.getByRole('heading', { name: '小布助手' })).toBeVisible();
  40  |   await expect(page.getByRole('heading', { name: '种公全收集' })).toBeVisible();
  41  |   // 母本卡与下方筛选标题前缀相同，必须限定在各自的容器里（避免 strict mode 撞上）
  42  |   await expect(
  43  |     page.getByTestId('progress-card-action-mother').getByRole('heading', { name: '母本全收集' }),
  44  |   ).toBeVisible();
  45  | 
  46  |   // 两块进度卡都从 0 起（分母随图鉴变化，从卡上读，不写死）
  47  |   await expectProgressZero(page);
  48  | 
  49  |   const source = page.getByText('CC BY-SA 4.0');
  50  |   await expect(source).toBeVisible();
  51  |   await expect(page.getByRole('link', { name: '洛克王国：世界 Wiki' })).toBeVisible();
  52  | });
  53  | 
  54  | test('导入抓包数据后看板给出进度与建议', async ({ page }) => {
  55  |   await page.goto('/');
  56  |   await expect(page.getByText('还没有数据')).toBeVisible();
  57  | 
  58  |   await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  59  | 
  60  |   await expect(page.getByText('还没有数据')).toHaveCount(0);
  61  |   await waitImported(page);
  62  |   await openTab(page, '看板');
  63  |   await expect(
  64  |     page.getByTestId('progress-card-action-mother').getByRole('heading', { name: '母本全收集' }),
  65  |   ).toBeVisible();
> 66  |   await expect(page.getByRole('heading', { name: '种公推荐' })).toBeVisible();
      |                                                             ^ Error: expect(locator).toBeVisible() failed
  67  |   await expect(page.getByTestId('recommend-item').first()).toBeVisible();
  68  | });
  69  | 
  70  | test('母本进度：看板卡与点进去的母本页是同一口径（数字一致）', async ({ page }) => {
  71  |   await page.goto('/');
  72  |   await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  73  |   await waitImported(page);
  74  |   await openTab(page, '看板');
  75  | 
  76  |   const card = page.getByTestId('progress-card-action-mother');
  77  |   await expect(card).toBeVisible();
  78  |   // 卡上的分子（此前按单一档位「满分大婉」算，点进去却按达标条件算 → 数字对不上）
  79  |   const cardText = await card.innerText();
  80  |   const cardNum = Number(cardText.match(/(\d+)\s*\/\s*\d+/)?.[1]);
  81  |   expect(Number.isFinite(cardNum)).toBe(true);
  82  | 
  83  |   await card.click();
  84  |   await expect(page.getByTestId('mother-chain-summary')).toContainText(`已收集 ${cardNum}`);
  85  | });
  86  | 
  87  | test('种公推荐：勾选移入已换到折叠区，可展开还原', async ({ page }) => {
  88  |   await page.goto('/');
  89  |   await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  90  |   await expect(page.getByText('还没有数据')).toHaveCount(0);
  91  |   await waitImported(page);
  92  |   await openTab(page, '看板');
  93  | 
  94  |   // 首页推荐卡就是精灵卡：点卡面 = 标记「已换到」，条目收进折叠区（默认收起）
  95  |   await expect(page.getByTestId('recommend-done-toggle')).toHaveCount(0);
  96  |   await page
  97  |     .getByTestId('recommend-item')
  98  |     .first()
  99  |     .getByRole('button', { name: /已换到/ })
  100 |     .click();
  101 |   await expect(page.getByTestId('recommend-done-toggle')).toContainText('已换到 1 只');
  102 |   // 展开折叠区：能看到已换到条目（划掉样式）
  103 |   await page.getByTestId('recommend-done-toggle').click();
  104 |   const doneItems = page.getByTestId('recommend-done').getByTestId('recommend-item');
  105 |   await expect(doneItems).toHaveCount(1);
  106 |   await expect(doneItems.first().getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  107 |   // 再点一次 → 还原回主列表
  108 |   await doneItems.first().getByRole('button', { name: /已换到/ }).click();
  109 |   await expect(page.getByTestId('recommend-done-toggle')).toHaveCount(0);
  110 | });
  111 | 
  112 | test('重置按钮一键清空已导入的数据', async ({ page }) => {
  113 |   await page.goto('/');
  114 |   await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  115 |   await waitImported(page);
  116 |   await openTab(page, '看板');
  117 |   // 导入后母本全收集不再是 0（分子 > 0）
  118 |   expect((await progressOf(page, 'progress-card-action-mother')).numerator).toBeGreaterThan(0);
  119 | 
  120 |   // 重置按钮在「导入数据」页，先切过去
  121 |   page.on('dialog', (dialog) => dialog.accept());
  122 |   await openTab(page, '我的');
  123 |   await openMoreData(page);
  124 |   await page.getByRole('button', { name: '重置导入数据' }).click();
  125 | 
  126 |   await expect(page.getByText('还没有数据')).toBeVisible();
  127 |   // 清空后回到看板：两块进度归零、署名仍在
  128 |   await openTab(page, '看板');
  129 |   await expectProgressZero(page);
  130 | });
  131 | 
  132 | test('切页签不再闪"正在读取本地数据"', async ({ page }) => {
  133 |   await page.goto('/');
  134 |   await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  135 |   await expect(page.getByText('还没有数据')).toHaveCount(0);
  136 |   await waitImported(page);
  137 | 
  138 |   // 四个页签来回切，加载文案都不应再出现（数据已在内存缓存里）
  139 |   for (const tab of ['收集', '小组', '我的', '看板', '收集', '小组']) {
  140 |     await page.getByRole('button', { name: tab, exact: true }).click();
  141 |     await expect(page.getByText('正在读取本地数据')).toHaveCount(0);
  142 |   }
  143 | });
  144 | 
  145 | test('导出全部数据 → 清空 → 导入备份，数据完整恢复（"共用一份"的手动做法）', async ({ page }) => {
  146 |   await page.goto('/');
  147 |   await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  148 |   // 导入后停在导入页（不再自动跳看板），导出入口就在这里
  149 |   await waitImported(page);
  150 | 
  151 |   await openMoreData(page);
  152 |   const [download] = await Promise.all([
  153 |     page.waitForEvent('download'),
  154 |     page.getByTestId('export-button').click(),
  155 |   ]);
  156 |   expect(download.suggestedFilename()).toMatch(/小布助手备份-\d{4}-\d{2}-\d{2}\.json/);
  157 |   const backupPath = await download.path();
  158 |   expect(backupPath).not.toBeNull();
  159 | 
  160 |   // 清空本机数据（清空后仍停在导入页，空状态可见）
  161 |   page.on('dialog', (dialog) => dialog.accept());
  162 |   await page.getByRole('button', { name: '重置导入数据' }).click();
  163 |   await expect(page.getByText('还没有数据')).toBeVisible();
  164 | 
  165 |   // 用备份恢复（清空后合并 = 全部新增）
  166 |   await page.getByTestId('backup-input').setInputFiles(backupPath as string);
```