## 改了什么

- 把 `.rail-layout` / `.rail-main` / `.rail-filters` / `.rail-aside` / `.rail-title` / `.rail-back` / `.rail-nav*` / `.rail-toggle` 以及需求卡固定列宽规则，从 `src/index.css` 挪到 `src/ui/primitives/rail.css`。
- `RailLayout.tsx` 自己 `import './rail.css'`；`index.css` 只留页面专属横屏规则。
- 纯样式归位：选择器、尺寸、断点都不变。

## 为什么（对应 issue / 交接文档）

- 原 #10 的核（横屏骨架样式就近归位）。原 #10 叠在 #9 上，26 文件 / 2153 行，正文空模板，与 test 冲突，维护者暂缓。原 PR：https://github.com/sasaki-ishiran/roco-toolbox/pull/10
- 换蛋横屏的骨架和样式现在放在两个文件里；本片让 `RailLayout` 自带样式，后续页面复用不会漏样式，也不需要再往 `index.css` 塞骨架规则。

## 涉及的产品口径

- 无口径变化。纯 CSS 文件位置调整；换蛋横屏在 844 / 1120 的布局与量测和上一片完全一致。

## 验证

```text
$ npm run verify
> tsc -b && vitest run && vitest run --config vitest.functions.config.ts && node tools/lint-copy.mjs
 Test Files  202 passed | 1 skipped (203)
      Tests  1838 passed | 1 skipped (1839)
 Test Files  1 passed (1)
      Tests  5 passed (5)
文案 lint 通过：存量 13 条，新增 0 条。
EXIT=0
```

说明：跑了全量 `npm run verify`；另用同一套 Playwright 脚本复测 844 / 1120，量测与上一片逐项相同。

## 界面变更

- https://raw.githubusercontent.com/EavonChan/roco-toolbox/friend/pr-evidence-20261123/docs/screenshots/2026-11-23-slices/D-swap-l844.png
- https://raw.githubusercontent.com/EavonChan/roco-toolbox/friend/pr-evidence-20261123/docs/screenshots/2026-11-23-slices/D-swap-l1120.png

量测：844 屏 `rail=39 / filters=195 / main=477`，1120 屏 `filters=212 / main=733`，与上一片相同，说明只是搬家。

## 越界声明

- 无。只改 `src/index.css`、`src/ui/primitives/rail.css`、`src/ui/primitives/RailLayout.tsx`。

## 归属工作区

- 工作区：S3 收集计划与换蛋
- 分支：`friend/rail-css-20261123-v2` → `friend/swap-landscape-20261123-v2`（依赖上面的换蛋横屏；它合入 `test` 后请把本 PR 的 base 改成 `test`，diff 仍只有这 3 个文件）
- 规模：3 个文件，`+81 / -79` 行（协议上限：≤ 8 文件 / ≤ 400 行）
