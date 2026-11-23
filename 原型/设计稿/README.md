# 原型 / 设计稿（P2 · 原型基准重建）

> 唯一标准：线上 `https://roco-toolbox.pages.dev`（截图基线取自 test 站当日构建）。
> 本目录只放**设计产物**；工具在 `_tools/`，基准图在 `_baseline/`。
> 铁律：不改 `src/`、不改线上、不打包、不发版。

## 目录

```
原型/设计稿/
├─ _tokens/          设计 token（三层，唯一来源）
│   ├─ primitive.css   ① 原值：调色板 / 字号阶 / 间距 / 圆角 / 阴影
│   ├─ semantic.css    ② 用途：文字 / 底色 / 描边 / 状态色
│   ├─ component.css   ③ 组件：pet-card 尺寸、控件高度、外壳骨架
│   └─ index.css       入口（只做三行 @import）
├─ _shell/           评审外壳（HTML + CSS + JS，只有一份）
├─ _tools/           脚本：截图 / 对账 / 自检 / 组件规格截图
├─ _baseline/        基准截图 375 / 390 + 登录态（`_work/`、`_prev-*/` 不入库，见其 .gitignore）
├─ components/       ★ 组件库：一组件一目录（README 八段 + spec.html + 2 张截图）
│   ├─ README.md       组件索引 + 待补清单
│   ├─ pet-card/       精灵卡（sm 96 / md 104 × 7 variant）
│   ├─ nest-pair-card/ 配对卡（full 86 / home 70）
│   └─ segmented-control/ 分段控件
├─ pages/            ★ 页面级设计稿（只组合组件，不复制样式）
│   ├─ dashboard/      看板（已完成 375/390）
│   ├─ collection/     收集（已完成 375/390）
│   └─ home/           家园（早期原型，未迁到组件库）
├─ _截图/            页面设计稿截图（<page>-<width>.png）
└─ _proposals/       专题方案稿（卡片方案 / 宽屏方案 / 精灵卡专题）
```

## token 三层怎么用

| 层 | 谁可以引用 | 例子 |
| --- | --- | --- |
| ① primitive | 只允许 ②③ 引用 | `--c-slate-200: #e2e8f0` |
| ② semantic | 页面 + ③ | `--line: var(--c-slate-200)` |
| ③ component | 页面 + 组件 | `--pet-card-height-md: 104px` |

页面写 `var(--text-body)`、`var(--line)`，**不要**写 `var(--c-slate-700)`；组件同理，颜色走 ②、尺寸走 ③。

## 常用命令

```bash
# 组件规格截图（375 / 390，顺手报溢出与坏图）
node 原型/设计稿/_tools/capture-component.mjs pet-card

# 页面整页截图
node 原型/设计稿/_tools/shoot.mjs pages/home

# token ↔ 线上 CSS 对账（34 条）
node 原型/设计稿/_tools/verify-tokens.mjs

# 外壳自检（20 条断言）
node 原型/设计稿/_tools/check-shell.mjs

# 组件库门禁（高度枚举 / 无裸值 / 目录完整）
node 原型/设计稿/_tools/gate.mjs
```

## 已完成 / 待办

- ✅ 目录分层（tokens 三层 / 工具 / 基准 / 外壳）
- ✅ `components/pet-card`：spec + 八段 README + 375/390 截图（含 106→104 对照）
- ✅ `components/nest-pair-card`、`components/segmented-control`：同模板铺开
- ⏳ 剩余组件（progress-card / empty-state / chip / modal-surface / egg-demand-card）
- ✅ 门禁脚本 `_tools/gate.mjs`：高度枚举 + 无裸值 + 目录完整性（3/3 通过）
- ⏳ 六个主页面（只组合组件，不出现新像素值）

## 页面进度

| 页面 | 设计稿 | 375 | 390 | 状态 |
| --- | --- | --- | --- | --- |
| 看板 | [pages/dashboard](./pages/dashboard/index.html) | [dashboard-375](./_截图/dashboard-375.png) | [dashboard-390](./_截图/dashboard-390.png) | ✅ 完成 |
| 收集 | [pages/collection](./pages/collection/index.html) | [collection-375](./_截图/collection-375.png) | [collection-390](./_截图/collection-390.png) | ✅ 完成 |
| 换蛋 | — | — | — | ⏳ 待画 |
| 家园 | [pages/home](./pages/home/index.html) | — | — | ⏳ 待迁组件库 |
| 我的 | — | — | — | ⏳ 待画 |

截图命令：

```bash
node 原型/设计稿/_tools/capture-page.mjs dashboard collection
```

## 已知差异

- 设计稿字体在 Windows 上落到微软雅黑，与手机真机（苹方 / 思源黑）字宽略有差异；
- **基准图来源：test 站，构建版本戳 `2026-11-22 21:07`（`index-B8gCjc1-.js`），捕获于 2026-11-22 21:58**；
  已包含当天全部改动（卡片 104/48/10、看板撤网格、家园溢出修复、异色炫彩筛选）。
  上一版基准（13:27 构建，改卡之前）归档在 `_baseline/_prev-2026-11-22-1327/`；
- 卡片 `spec.html` 是**目标态**（size sm/md + 语义 variant），`src` 目前仍是 `default/tall/gap/suggest` 命名，映射见 `components/pet-card/README.md` 第 8 段。
