# state-notice · 状态提示

## 1. 一句话定义

状态提示：告诉用户「现在为什么没有内容 / 为什么不能算 / 已经算完了」，只陈述事实，并给一个可选入口。

## 2. 何时用 / 何时不用

**用**
- 列表为空（真没数据 / 筛选后为空，两者文案必须不同）；
- 缺前置条件（没设目标、没选账号、没导入）；
- 操作结果（全收齐、导入成功、导入失败）。

**不用**（反例）
- ❌ 页面级教学 → 走 `tour.ts` 分段引导；
- ❌ 表单校验错误 → 贴在字段下方的行内错误，不用整块提示；
- ❌ 朋友圈式的鼓励文案（「加油！」）→ 只写事实和下一步。

## 3. Anatomy

```
┌──────────────────────────────────┐
│ ①标题（14 medium）                │
│ ②说明（12，opacity .9）           │
│ ③动作（可选，mt 8）               │
└──────────────────────────────────┘
```

| # | 部件 | class | 说明 |
| --- | --- | --- | --- |
| ① | 标题 | `.notice__title` | 一句话说状态，不带情绪 |
| ② | 说明 | `.notice__desc` | 补充「为什么 / 怎么做」，可省略 |
| ③ | 动作 | `.notice__action` | 最多一个按钮 |

## 4. Variants

| tone | kind |
| --- | --- |
| `neutral` | `loading` / `empty-data` / `empty-query` / `cached` |
| `warn` | `unset-scope` / `incomparable` / `unknown` |
| `success` | `complete` / `success` |
| `error` | `error`（`role="alert"`） |

## 5. States

| state | 说明 |
| --- | --- |
| `default` | 静态展示 |
| `with-action` | 出现底部动作按钮 |
| `alert` | `error` 专用，`role="alert"` 会被读屏立即播报 |

## 6. Do / Don't

**Do**
1. 「真没数据」和「筛选后为空」文案必须分开（前者给导入入口，后者给清空筛选）。
2. 标题一句话讲状态，说明讲原因/下一步。
3. 动作最多一个。

**Don't**
1. ❌ 不要在这里推断领域结论（如「你缺 5 个种公」——那是计算结果的活）。
2. ❌ 不要用 emoji 或感叹号。
3. ❌ 不要同一屏叠两个以上提示条。

## 7. Token 引用表

| 用途 | token | 值 |
| --- | --- | --- |
| 圆角 | `--notice-radius` | 12px |
| 内边距 | `--notice-pad-x` / `--notice-pad-y` | 12px / 8px |
| 标题 / 说明 | `--notice-title-size` / `--notice-desc-size` | 14px / 12px |
| 动作间距 | `--notice-action-gap` | 8px |
| 底色 | `--bg-inset` / `--warn-soft` / `--accent-soft` / `--danger-soft` | 见 semantic.css |
| 文字 | `--text-muted` / `--warn-text` / `--danger-text` / `--c-emerald-800` | 见 semantic.css |

## 8. 代码位置

| 位置 | 作用 |
| --- | --- |
| `src/ui/primitives/StateNotice.tsx:43` | `StateNotice`（props：`kind` / `title` / `description` / `action` / `testId`） |
| `src/ui/primitives/StateNotice.tsx:23` | `STYLE`：kind → 语气映射 |
| `src/ui/EmptyState.tsx:16` | `EmptyState` 预设（kind=`empty-data` + 导入按钮） |

---

## 附：截图

- [`state-notice-375.png`](./state-notice-375.png)
- [`state-notice-390.png`](./state-notice-390.png)

```bash
node 原型/设计稿/_tools/capture-component.mjs state-notice
```
