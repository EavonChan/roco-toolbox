# 家园横屏：账号、接单上窝、蛋仓移到右侧，刷新留在页面

> 分支：`friend/home-landscape-rail-20261124` → `test` · 工作区：S2 母本与配窝（家园页）

## 改了什么

- 横屏家园屏不再渲染顶栏：**账号（可切换）、接单上窝、蛋仓**进右侧 2.6rem 纵向标题栏（一行两个字）；账号下拉从栏内向左弹，不被屏幕右缘裁掉。
- **刷新家园**留在主区标题行右侧；刷新状态提示仍整行放在标题下方。
- 配窝卡单 / 双列只看横屏高度（`max-height: 600px`）：手机横屏并排、高度够的平板横屏保持单列，不再按宽度铺多列。
- 横屏空态：未登录卡片放到内容区正中，去掉说明文字，只留 1/3 宽居中的「去登录」；未入组 / 读失败仍保留说明。
- `RailAside` 增加 `tour` 锚点（横屏新手引导跟到右侧栏）；`EggStockView` 空态复用蛋仓纵向标题栏。
- 文件：`src/ui/Home.tsx`、`src/ui/plan/EggStockView.tsx`、`src/ui/primitives/RailLayout.tsx`、`src/index.css`、`src/ui/Home.test.tsx`、`src/ui/plan/EggStockView.test.tsx`，同步 `docs/设计系统/横屏布局规范-2026-11-22.md`、`docs/项目记忆/决策.md`。

## 为什么

用户 2026-11-24 当轮原话：

- 「横屏的时候把账号，接单上窝，蛋仓移到右边」
- 「刷新家园留在家园页」
- 「未登录的卡片在屏幕正居中」「去登录按钮缩小 2/3。上方文案为两行」→ 后续改为「移除文案，按钮居中」
- 「只在屏幕高度不够才展示双列」（纠正第一版按宽度铺多列）

口径落点：`docs/设计系统/横屏布局规范-2026-11-22.md` §四；决策记录 `docs/项目记忆/决策.md` 2026-11-24 15:40。

## 涉及的产品口径

- 横屏家园顶栏位置变化（账号 / 蛋仓 / 接单上窝进右侧纵向标题栏）。
- 配窝卡并排只由高度触发，不再由宽度触发。
- 横屏未登录空态不再显示说明，只留「去登录」。
- 竖屏布局与文案均无变化。

## 验证

```text
$ npx tsc -b
（无输出，exit=0）

$ npx vitest run src/ui/Home.test.tsx src/ui/plan/EggStockView.test.tsx src/ui/plan/EggStockPanel.test.tsx
 Test Files  3 passed (3)
      Tests  55 passed (55)

$ node tools/lint-copy.mjs
文案 lint 通过：存量 13 条，新增 0 条。
```

只跑了相关文件 + 类型检查 + 文案检查；全量 `npm run verify` 留到合并前。

## 界面变更

尺寸：844×390、1120×500、1024×768、390×844（本地 Chromium 导入真实备份后截图），文件在 `docs/preview/home-landscape-rail-20261124/`。

![844×390 横屏：账号 / 接单上窝 / 蛋仓在右侧纵向标题栏](https://raw.githubusercontent.com/EavonChan/roco-toolbox/friend/home-landscape-rail-20261124/docs/preview/home-landscape-rail-20261124/home-844-rail.png)

![844×390：账号下拉从标题栏向左弹](https://raw.githubusercontent.com/EavonChan/roco-toolbox/friend/home-landscape-rail-20261124/docs/preview/home-landscape-rail-20261124/home-844-account.png)

![1120×500 横屏：右栏不变，配窝卡保持单列](https://raw.githubusercontent.com/EavonChan/roco-toolbox/friend/home-landscape-rail-20261124/docs/preview/home-landscape-rail-20261124/home-1120-rail.png)

![1024×768 横屏：平板高度够，配窝卡单列](https://raw.githubusercontent.com/EavonChan/roco-toolbox/friend/home-landscape-rail-20261124/docs/preview/home-landscape-rail-20261124/home-1024-rail.png)

![390×844 竖屏：顶栏与配窝卡保持原样](https://raw.githubusercontent.com/EavonChan/roco-toolbox/friend/home-landscape-rail-20261124/docs/preview/home-landscape-rail-20261124/home-390-portrait.png)

![844×390 未登录空态：卡片居中、按钮 1/3 宽](https://raw.githubusercontent.com/EavonChan/roco-toolbox/friend/home-landscape-rail-20261124/docs/preview/home-landscape-rail-20261124/home-844-empty.png)

整页长图：[home-844-rail-full.png](https://raw.githubusercontent.com/EavonChan/roco-toolbox/friend/home-landscape-rail-20261124/docs/preview/home-landscape-rail-20261124/home-844-rail-full.png)

## 越界声明

- 改了两个 docs（横屏规范、决策）：只更新本轮条目，未改历史结论。
- 其余文件均在家园 / 蛋仓相关清单内。

## 归属工作区

- 工作区：S2 母本与配窝（家园页）
- 分支：`friend/home-landscape-rail-20261124` → `test`
- 规模：代码 8 文件 `+339 / -56`，另附截图 7 张
