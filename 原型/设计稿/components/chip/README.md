# chip · 筛选 chip

## 1. 一句话定义

筛选 chip：可多选、可叠加、可全清的筛选小块（蛋组 / 性格 / 体型 / 声音 / 账号）。

## 2. 何时用 / 何时不用

**用**
- 多选筛选，且选项数量在 3~15 之间；
- 需要显示「已选中哪些」并能单个取消。

**不用**（反例）
- ❌ 互斥视角切换（种公推荐 / 母本缺口）→ 用 [`segmented-control`](../segmented-control/README.md)；
- ❌ 选项超过 15 个 → 用下拉或搜索；
- ❌ 只是标签展示（不可点）→ 用 `span`，不要给 chip 的交互样式。

## 3. Anatomy

```
┌──────────────────────┐
│ ①图标? ②文案 ③计数?   │
└──────────────────────┘
```

| # | 部件 | class | 说明 |
| --- | --- | --- | --- |
| ① | 图标 | `.chip__icon` | 体型/声音 chip 用（16px） |
| ② | 文案 | — | 必须完整显示，不截断 |
| ③ | 计数 | `.chip__count` | 该选项命中数（9px，75% 透明） |

## 4. Variants

| variant | 高度 | 字号 | 用在哪 |
| --- | --- | --- | --- |
| 默认 | 28px | 12px | 筛选面板主体 |
| 内联 `.chip--inline` | 26px | 10px | 标题行里的「性格：固执 / 开朗」 |
| 计数 | 28px | 12px | 「巨灵组 12」 |
| 图标 | 28px | 12px | 体型 / 声音 |

## 5. States

| state | 视觉 |
| --- | --- |
| `default` | 白底 + `--line` 描边 + `--text-body` |
| `selected` | `--accent` 实底 + 白字 + `--fw-semibold` + 阴影 |
| `pressed` | `scale(0.96)`（移动端反馈） |
| `disabled` | `--c-slate-300` 字、不可点 |

## 6. Do / Don't

**Do**
1. 容器 `flex-wrap: wrap` + `gap: 8px`，放不下就换行。
2. 选中的 chip 用实底，不只用描边（手机上描边看不清）。
3. 计数跟着文案，用更小字号和 75% 透明。

**Don't**
1. ❌ 不要缩字号或截断 chip 文案（跟分段控件同一条硬规则）。
2. ❌ 不要把 chip 做成单选（那是分段控件的活）。
3. ❌ 不要在一行里放超过 6 个 chip，超出就换行或折叠。

## 7. Token 引用表

| 用途 | token | 值 |
| --- | --- | --- |
| 高度 / 内联 | `--chip-h` / `--chip-h-inline` | 28px / 26px |
| 圆角 | `--chip-radius` | 6px |
| 内边距 | `--chip-pad-x` / `--chip-pad-y` | 8px / 4px |
| 字号 | `--chip-size` / `--chip-size-inline` / `--chip-count-size` | 12 / 10 / 9 |
| 描边 | `--line` / `--accent` | 见 semantic.css |
| 文字 | `--text-body` / `--text-inverse` / `--c-slate-300` | 见 semantic.css |

## 8. 代码位置

| 位置 | 作用 |
| --- | --- |
| `src/ui/FilterAccordion.tsx:166-180` | 现有 chip 实现（`min-h-[26px]/[28px]`、`aria-pressed`、选中 `bg-emerald-500`） |
| 待办 | 抽成 `primitives/Chip.tsx` 后页面只引用组件；目前是内联类名 |

> 说明：chip 目前**没有独立组件文件**，是内联在 `FilterAccordion` 里的类名组合。
> 本目录定义的是目标态；抽组件属于实现步骤。

---

## 附：截图

- [`chip-375.png`](./chip-375.png)
- [`chip-390.png`](./chip-390.png)

```bash
node 原型/设计稿/_tools/capture-component.mjs chip
```
