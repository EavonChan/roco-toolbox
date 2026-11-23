# progress-card · 进度卡

## 1. 一句话定义

进度卡：一块「分子 / 分母 + 进度条」的统计卡，回答「已经收了多少、还差多少」。

## 2. 何时用 / 何时不用

**用**
- 需要表达「已完成 / 总量」（种公全收集 9 / 14、母本全收集 78 / 209）；
- 数字比列表更重要，想一眼看到比例。

**不用**（反例）
- ❌ 单个计数（「11 个窝」「6 组配对」）→ 用 chip / 文本，不需要进度条；
- ❌ 需要看明细（哪几只没收集）→ 用 `pet-card` 网格 + 筛选；
- ❌ 多段占比（完成/进行中/未开始）→ 用分段条，不用单条进度。

## 3. Anatomy

```
┌──────────────────────────────┐
│ ①种公全收集           ②(?)  │
│ ③ 9 / 14                     │
│ ④ ████████░░░░░░             │
│ ⑤ 提示行（空态/完成态才有）   │
└──────────────────────────────┘
```

| # | 部件 | class |
| --- | --- | --- |
| ① | 标题 | `.progress-card__title`（14px，`--text-muted`） |
| ② | 说明按钮 | `.progress-card__help`（20px 圆圈，点击展开提示） |
| ③ | 分子 / 分母 | `.progress-card__value`（24px semibold；分母 24px 常规、`--text-faint`） |
| ④ | 进度条 | `.progress-card__track` + `.progress-card__fill`（8px 高、全圆角） |
| ⑤ | 提示行 | `.progress-card__hint`（12px，仅 0/0 或 n=N 时出现） |

## 4. Variants

| variant | 说明 |
| --- | --- |
| 静态 | `section`，只展示 |
| 可点 | `button.progress-card--clickable`，整卡可点（进收集页对应分类） |

## 5. States

| state | 视觉 |
| --- | --- |
| `default` | 白底 + `--shadow-sm` |
| `hover`（可点才有） | `--shadow-lg` |
| `empty`（0/0） | 条 0%，出现提示行，不显示百分比 |
| `loading` | 分子分母用 `—` 占位，条 0%，不闪动 |

## 6. Do / Don't

**Do**
1. 分母为 0 时给「还没设置目标」的提示行，不要显示 0%。
2. 分母固定为「目标总数」，不要用「当前已收集」当分母。
3. 可点的卡整块可点，不要只让标题可点。

**Don't**
1. ❌ 不要在一个页面并排放三个以上进度卡——超过两个就改成一行摘要。
2. ❌ 不要把百分比叠在条上（条只有 8px，字会看不清）。
3. ❌ 不要在进度卡里放列表或按钮组。

## 7. Token 引用表

| 用途 | token | 值 |
| --- | --- | --- |
| 圆角 / 内边距 | `--progress-card-radius` / `--progress-card-pad` | 16px / 16px |
| 数字 | `--progress-num-size` / `--progress-num-line` | 24px / 32px |
| 进度条高 | `--progress-bar-h` | 8px |
| 问号直径 | `--progress-help-size` | 20px |
| 底 / 轨道 / 填充 | `--bg-surface` / `--bg-muted` / `--accent-line` | 见 semantic.css |
| 文字 | `--text-strong` / `--text-muted` / `--text-faint` | 见 semantic.css |

## 8. 代码位置

| 位置 | 作用 |
| --- | --- |
| `src/ui/ProgressCard.tsx:14` | `ProgressCard`（props：`title` / `numerator` / `denominator` / `hint` / `onClick` / `testId`） |
| `src/ui/ProgressCard.tsx:74` | 可点版本（`button` 包一层） |
| 使用方 | 看板（种公/母本进度）、收集页 |

---

## 附：截图

- [`progress-card-375.png`](./progress-card-375.png)
- [`progress-card-390.png`](./progress-card-390.png)

```bash
node 原型/设计稿/_tools/capture-component.mjs progress-card
```
