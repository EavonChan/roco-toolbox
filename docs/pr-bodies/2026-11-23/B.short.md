## 改了什么

- 新增 `src/ui/primitives/RailLayout.tsx`：横屏三栏骨架（主区 + 可收起功能列 + 纵向标题栏）。
- `EggMatchingHub.tsx`：横屏把搜索 / 去计划添加 / 只看我能接收进右侧列；我的收集、组内广场、蛋仓、我的换蛋进标题栏；竖屏保持原顺序。
- `EggStockPanel.tsx`：`railBack` 支持 `label`，换蛋子页显示「返回换蛋」。
- `index.css`：横屏 rail 样式、需求卡固定列宽；测试补 1 条横屏用例。

## 为什么

原 #8 的核。原 #8 叠在 #7 上，20 文件 / 1642 行，正文空模板，与 test 冲突。原 PR：https://github.com/sasaki-ishiran/roco-toolbox/pull/8

## 涉及的产品口径

- 横屏换蛋页三栏；竖屏不变（页签 + 搜索 + 蛋卡上下顺序）。
- 标题栏一行两个字，除筛选开关外纯文本；收起后主区加宽、标题栏原位；折叠偏好 `roco.swapRailCollapsed` 按设备存。
- 蛋仓子页沿用同一标题栏，返回文案「返回换蛋」。
- 本片不做「我的」页迁移，也不重构蛋仓筛选列。

## 验证

```text
$ npm run verify
 Test Files  202 passed | 1 skipped (203)
      Tests  1838 passed | 1 skipped (1839)
 Test Files  1 passed (1)
      Tests  5 passed (5)
文案 lint 通过：存量 13 条，新增 0 条。
EXIT=0
```

## 界面变更

390×844 / 844×390 / 1120×500 都看过，图在证据分支：

- https://raw.githubusercontent.com/EavonChan/roco-toolbox/friend/pr-evidence-20261123/docs/screenshots/2026-11-23-slices/B-swap-p390.png
- https://raw.githubusercontent.com/EavonChan/roco-toolbox/friend/pr-evidence-20261123/docs/screenshots/2026-11-23-slices/B-swap-l844.png
- https://raw.githubusercontent.com/EavonChan/roco-toolbox/friend/pr-evidence-20261123/docs/screenshots/2026-11-23-slices/B-swap-l844-collapsed.png

量测：844 屏 `rail=39 / filters=195 / main=477`，收起后 `main=679`；1120 屏 `filters=212 / main=733`；无横向溢出。

## 越界声明

碰了 `src/ui/plan/EggStockPanel.tsx`（蛋仓，S3/S4 交界）：只把 `railBack` 从 `{onClick}` 扩成 `{label?,onClick}` 并渲染文案，不改筛选/蛋卡逻辑；原因是换蛋子页返回按钮要显示「返回换蛋」。其余在 S3。

## 归属工作区

- 工作区：S3 收集计划与换蛋
- 分支：`friend/swap-landscape-20261123-v2` → `test`
- 规模：5 个文件，`+377 / -20` 行
