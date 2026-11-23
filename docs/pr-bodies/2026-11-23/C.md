## 改了什么

- `src/ui/plan/EggStockPanel.tsx`：蛋详情从单列改高密度两栏 —— 左侧蛋信息 + 标注入口，右侧「实际父母」；父母卡复用配窝精灵卡（蛋组 / 奖牌 / 性格 / 分贝 / 体型）。
- 学院小窝的父母卡卡底写「学院小窝 · 100%性格」，不只靠绿框。
- 补回「按采集时配对推算」、过期提示、「游戏未确认亲子关系，收进背包后以实物为准」。
- 横屏左栏两列、竖屏三列；标注编辑器保留。
- `EggStockPanel.test.tsx`：补 2 条断言。

## 为什么（对应 issue / 交接文档）

- 原 #9 的核（蛋详情两栏、复用配窝卡、学院 100%）。原 #9 叠在 #8 上，24 文件 / 2120 行，正文空模板，与 test 冲突，维护者暂缓。原 PR：https://github.com/sasaki-ishiran/roco-toolbox/pull/9
- 用户 2026-11-22 口径：蛋详情要高密度、父母本用配窝卡、学院 100% 不能只靠绿框暗示。

## 涉及的产品口径

- 蛋详情横屏两栏、竖屏单列可滚；信息不删，只压缩排版。
- 父母本卡显示蛋组、奖牌、性格、分贝、体型；学院那只卡底写「· 100%性格」。
- 补回说明：按采集时的当前配对与父母属性推算；游戏未确认亲子关系，收进背包后以实物为准。
- 本片不拆 `EggDetailModal` / `eggArt` 文件（纯重构，留给后续）；不改蛋仓筛选、标注、挂出逻辑。

## 验证

```text
$ npm run verify
> tsc -b && vitest run && vitest run --config vitest.functions.config.ts && node tools/lint-copy.mjs
 Test Files  202 passed | 1 skipped (203)
      Tests  1837 passed | 1 skipped (1838)
 Test Files  1 passed (1)
      Tests  5 passed (5)
文案 lint 通过：存量 13 条，新增 0 条。
EXIT=0
```

说明：跑了全量 `npm run verify`；`EggStockPanel.test.tsx` 16 条全过，新增断言覆盖两栏与学院 100%。

## 界面变更

390×844 / 844×390 / 1120×500 都看过，截图在证据分支（不进入本 PR 的 diff）：

- https://raw.githubusercontent.com/EavonChan/roco-toolbox/friend/pr-evidence-20261123/docs/screenshots/2026-11-23-slices/C-detail-p390.png
- https://raw.githubusercontent.com/EavonChan/roco-toolbox/friend/pr-evidence-20261123/docs/screenshots/2026-11-23-slices/C-detail-l844.png
- https://raw.githubusercontent.com/EavonChan/roco-toolbox/friend/pr-evidence-20261123/docs/screenshots/2026-11-23-slices/C-detail-l844-edit.png
- https://raw.githubusercontent.com/EavonChan/roco-toolbox/friend/pr-evidence-20261123/docs/screenshots/2026-11-23-slices/C-detail-l1120.png

量测：390 面板 358×485、844 面板 630×327、1120 面板 637×328；父母 3 张卡在 844 / 1120 都不被拉宽。

## 越界声明

- 无。改动都在 `src/ui/plan/EggStockPanel.tsx`、它自己的测试与 `src/index.css` 的蛋详情网格规则。

## 归属工作区

- 工作区：S3 收集计划与换蛋
- 分支：`friend/egg-detail-20261123-v2` → `test`
- 规模：3 个文件，`+109 / -35` 行（协议上限：≤ 8 文件 / ≤ 400 行）
