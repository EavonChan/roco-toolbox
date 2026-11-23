# pet-card · 精灵卡

> 组件库第一个组件，用来验证「1 组件 × N variant × M state」这套模板跑得通。

## 1. 一句话定义

精灵卡：在看板、收集、背包、需求里展示「一只精灵 + 它的蛋组 / 性格 / 状态」的卡片。
**全站只有这一个卡片组件**，用途差异由 `size` / `variant` / `state` 三个维度表达，不另做卡片。

## 2. 何时用 / 何时不用

**用**：
- 需要「按精灵为单位」排列的一览（四列网格、堆叠、横向紧凑条）；
- 需要展示图鉴号、蛋组、性格、以及一个底部动作/状态位。

**不用**（反例）：
- ❌ **配窝卡**（母 + 公成对、带摆位色条、带概率头）→ 用 `NestPlanCard` 里的配对卡，它是「一对」不是「一只」；
- ❌ **需求卡/换蛋卡**（带进度、接单人、双列布局）→ 用 `EggDemandCard`，信息层级不同；
- ❌ **统计数字块**（如「种公全收集 9 / 14」）→ 用 `ProgressCard`，不是卡片网格。

判断标准：**如果两个「卡」的差别只有高度、字号、有没有底栏，那它们就是一个组件的 variant**（见指南 §二.3）。

## 3. Anatomy

```
┌─────────────────────────────┐
│ ①No.027        ②平和  固执  │  ← 卡头：图鉴号+蛋组 / 性格（贴右上）
│   巨灵组                    │
│                             │
│           ③ 头像            │  ← 48px，水平居中
│                             │
│          ④ 名字             │  ← 10px，长名字走精简形态
│        ⑤ 高100%·重98.3%     │  ← 细节行（仅 backpack / compact）
├─────────────────────────────┤
│ ⑥        计划               │  ← 满宽融合底栏 18px
└─────────────────────────────┘
```

| # | 部件 | class | 说明 |
| --- | --- | --- | --- |
| ① | 图鉴号 / 蛋组 | `.pc__left` | 左上；蛋组最多两行，超出截断 |
| ② | 性格 | `.pc__right` | 右上；未达标灰、已收集绿 |
| ③ | 头像 | `.pc__avatar` | 48px，位置随「尺寸档 × 有无底栏」变化 |
| ④ | 名字 | `.pc__name` | 10px；长名字用精简形态，不缩字号 |
| ⑤ | 细节行 | `.pc__details` | 仅 backpack / compact 出现（高 / 重 / 盒位） |
| ⑥ | 底栏 | `.pc__footer` | 满宽融合条，圆角跟随卡片 |

## 4. Variants（7 个）

| variant | size | 用在哪 | 差异 |
| --- | --- | --- | --- |
| `stud-recommend` | md 104 | 看板种公推荐 / 收集·种公 | 白底、无底栏、性格在右上 |
| `mother` | md 104 | 收集·母本 | 三态底色（白 / sky / emerald）+ 融合底栏（计划 / 已计划 / 查看） |
| `gap` | md 104 | 母本缺口 | 白底、无底栏、带图鉴号 |
| `inventory` | md 104 | 精灵背包 | 性别底色（粉 / 蓝）+ 细节行 + 账号·盒位底注 |
| `compact` | sm 96 | 家园配对 / 需求中心 | 定宽 160，细节行 + 盒位底注 |
| `stack` | sm 96 | 共用种公堆叠 | 三层错位，表示「多只共用」 |
| `demand` | md 104 | 换蛋需求 | 定宽，底栏写接单状态 |

全部 variant 的实际渲染见 [spec.html](./spec.html) 的 B 段。

## 5. States（5 个）

| state | 触发 | 视觉 |
| --- | --- | --- |
| `default` | 常态 | 白底 + `--state-default-line` 描边 |
| `hover` | 指针悬停 / 按压 | 阴影升一档 + 描边加深（移动端用 `:active`） |
| `selected` | 已勾选 / 当前目标 | 主色描边 + 2px 外发光 |
| `disabled` | 不可操作（如已收集后仍展示） | 整卡 50% 透明、`not-allowed` |
| `empty` | 该格没有数据 | 虚线框 + 浅底 + 「暂无数据」 |

见 [spec.html](./spec.html) 的 C 段。

## 6. Do / Don't

**Do**
1. 同屏同类卡只用一种 `size`，否则网格对不齐（本次收敛的起因）。
2. 长名字走「精简形态」：`乌达_极夜的样子 → 乌达·极夜`，超过 7 字退到基础名，完整名放 `title`。
3. 底栏只放一个动作或一个状态，不要塞两个按钮。

**Don't**
1. ❌ 不要为「母本」「缺口」各写一套高度——它们只是 variant。
2. ❌ 不要在页面里给卡片写 `style="height: …"`；高度只能来自 `--pet-card-height-*`。
3. ❌ 不要用缩小字号来塞长名字（旧实现 12→9→8→6px，导致同一行字号不一致）。

**变更记录（2026-11-22）**：母本卡原 **106px**，并入 `md` 的 **104px**；旧的 106 只保留在 spec 的 A 段对照图里，token 名为 `--pet-card-height-legacy-mother`（生产禁用）。

## 7. Token 引用表

组件只引用 ③ component 层；颜色引用 ② semantic 层。**本组件不出现裸色值 / 裸字号。**

| 用途 | token | 值 |
| --- | --- | --- |
| 高度 sm / md | `--pet-card-height-sm` / `-md` | 96px / 104px |
| 圆角 / 内边距 | `--pet-card-radius` / `--pet-card-pad` | 12px / 4px |
| 头像 | `--pet-card-avatar` | 48px |
| 头像纵向位置 | `--pet-card-avatar-top-{md,sm}-{footer,plain}` | 18 / 24 / 16 / 20 |
| 名字字号 / 行高 | `--pet-card-name-size` / `--pet-card-name-line` | 10px / 12px |
| 名字纵向位置 | `--pet-card-name-top-{md,sm}-{footer,plain}` | 66 / 72 / 62 / 66 |
| 底栏高度 | `--pet-card-footer-h` | 18px |
| 细节行 | `--pet-card-detail-size` + `--pet-card-detail-top-*` | 8px |
| 卡头元信息 | `--pet-card-meta-size` / `--pet-card-chip-size` | 7px / 9px |
| 紧凑卡 | `--pet-card-compact-*` | 160px 宽，行位整体上移 |
| 堆叠卡 | `--pet-card-stack-*` | 96px，三层错位 |
| 底色 / 描边 | `--state-default-*` / `--state-planned-*` / `--state-collected-*` / `--state-academy-*` | 见 semantic.css |
| 文字 / 线 | `--text-*` / `--line-*` | 见 semantic.css |

## 8. 代码位置

当前实现（**spec 是目标态，代码尚未按 size/variant 重命名**）：

| 位置 | 作用 | 现状 |
| --- | --- | --- |
| `src/ui/PetCardLayout.tsx` | 卡片主体（卡头 / 头像 / 名字 / 细节 / 底栏） | `size: 'default' \| 'tall' \| 'gap' \| 'suggest' \| 'compact'`，高度已统一 104，`tall` 仍是 44px 头像 |
| `src/ui/PetCard.tsx` | 背包卡（variant `inventory`） | `size="tall"`，48px 头像 |
| `src/ui/PetCompactCard.tsx` | 紧凑卡（variant `compact`） | `size="compact"` |
| `src/ui/SuggestionCard.tsx` | 种公推荐网格（variant `stud-recommend`） | `size="suggest"` |
| `src/ui/NestPlanCard.tsx` | 缺口卡 / 配对卡 / 共用种公堆叠 | `size="gap"`；配对卡与堆叠卡是另外的组件 |
| `src/ui/petNameLabel.ts` | 精简名字（`compactPetName`） | 已落地 |

映射关系：`suggest → stud-recommend`、`gap → gap`、`tall → inventory`、`compact → compact`、收集母本 → `mother`。
重命名与 `size` 收敛到 sm/md 属于实现步骤，需要单独一轮改动 + 全量截图。

---

## 附：截图

- [`pet-card-375.png`](./pet-card-375.png) — 375 宽整页（含 106→104 对照标注）
- [`pet-card-390.png`](./pet-card-390.png) — 390 宽整页

重新生成：

```bash
node 原型/设计稿/_tools/capture-component.mjs pet-card
```
