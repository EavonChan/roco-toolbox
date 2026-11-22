# segmented-control · 分段控件

## 1. 一句话定义

互斥视角切换：一排按钮里只有一个是「当前项」，用来切换同一块内容的观察角度。

## 2. 何时用 / 何时不用

**用**
- 同一份数据换角度看：种公推荐 / 母本缺口、未收集 / 收集中 / 已收集；
- 互斥的少量选项（2~4 个），且切换后**内容区整体替换**。

**不用**（反例）
- ❌ 多选筛选（蛋组、性格、体型）→ 用 chip，可叠加、可清空；
- ❌ 页面级导航（看板/家园/收集…）→ 用底部/左侧页签；
- ❌ 点一下立即执行的动作（刷新、导入）→ 用按钮；
- ❌ 超过 4 个选项 → 用下拉（`InlineSelect`）或页签。

## 3. Anatomy

```
┌─ 轨道 (--bg-muted, 圆角 8) ───────────────┐
│ ┌─分段1(白底, 主色字)─┐ ┌─分段2(透明,灰字)─┐ │
│ │      种公推荐        │ │     母本缺口      │ │
│ └─────────────────────┘ └──────────────────┘ │
└──────────────────────────────────────────────┘
   2px 内边距 + 2px 间隙，分段高 30
```

| 部件 | class | 说明 |
| --- | --- | --- |
| 容器 | `.seg` | `role="group"` + `aria-label`（不用 tablist） |
| 分段 | `.seg__item` | `aria-pressed` 表示选中；`disabled` 表示不可选 |

## 4. Variants

| variant | 说明 |
| --- | --- |
| 两段 | 最常见的互斥视角（种公推荐/母本缺口、追满分/追双牌） |
| 三段 | 收集页状态（未收集/收集中/已收集） |
| 铺满父级 | `.seg--fit`：宽 100%，分段按剩余空间等分；**不强制整行**，也可以只占一格 |

见 [spec.html](./spec.html) 的 A / B 段。

## 5. States

| state | 视觉 |
| --- | --- |
| `default` | 透明底、`--text-muted` 字 |
| `selected` | 白底、`--accent-text` 字、`--fw-medium`、`--shadow-sm` |
| `hover`（仅桌面） | 字色加深到 `--text-body` |
| `disabled` | `--c-slate-300` 字、`not-allowed` |

## 6. Do / Don't

**Do**
1. **标签必须完整显示**（2026-11-22 用户口径）：分段用 `flex: 1 0 auto` + `min-width: min-content`，
   只长不缩、不做省略号。控件本身**没有固定宽度要求**，插到窄容器里也不许挤掉文字。
2. 分段文案用名词短语（「种公推荐」而不是「看种公」）。
3. 两段时用 `.seg--fit` 铺满，避免右侧留白。
4. 切换后保持滚动位置在内容区顶部。

**Don't**
1. ❌ 不要把不同维度混成一排（如「种公」+「追满分」）。
2. ❌ 不要用它承载「提交/保存」这类动作。
3. ❌ 不要给单个分段加图标而不加文字——窄屏会挤成两个符号。
4. ❌ 不要为了塞进窄容器去缩字号或截断标签：容器窄就让控件保持自身宽度，由父级让位。

## 7. Token 引用表

| 用途 | token | 值 |
| --- | --- | --- |
| 轨道高 | `--segmented-track-h` | 34px |
| 分段高 | `--segmented-item-h` | 30px |
| 轨道 / 分段圆角 | `--segmented-radius` / `--segmented-item-radius` | 8px / 6px |
| 内边距 / 间隙 | `--segmented-pad` / `--segmented-gap` | 2px / 2px |
| 轨道底 | `--bg-muted` | slate-100 |
| 选中底 / 字 | `--bg-surface` / `--accent-text` | 白 / emerald-700 |
| 未选中字 | `--text-muted` | slate-500 |
| 禁用字 | `--c-slate-300` | slate-300 |

> 标签宽度：`flex: 1 0 auto` + `min-width: min-content`，**不缩、不截断**；容器放不下时由使用方换布局。

## 8. 代码位置

| 位置 | 作用 |
| --- | --- |
| `src/ui/primitives/SegmentedControl.tsx:19` | 组件实现（`role="group"` + `aria-pressed`） |
| props | `{ label, value, options, onValueChange, optionTestId?, className? }` |
| 使用方 | 看板（种公推荐/母本缺口）、收集（状态）、我的（目标模式）等 |

---

## 附：截图

- [`segmented-control-375.png`](./segmented-control-375.png)
- [`segmented-control-390.png`](./segmented-control-390.png)

```bash
node 原型/设计稿/_tools/capture-component.mjs segmented-control
```
