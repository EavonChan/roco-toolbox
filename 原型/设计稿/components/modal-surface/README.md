# modal-surface · 弹层外壳

## 1. 一句话定义

弹层外壳：遮罩 + 头（标题 / 关闭）+ 可滚动主体 + 可选底部操作区。所有悬浮窗、面板、确认框都套它。

## 2. 何时用 / 何时不用

**用**
- 需要打断当前流程、让用户聚焦一件事（怎么补、确认删除、切换账号）；
- 内容可能很长，需要「头脚固定、中间滚动」的容器。

**不用**（反例）
- ❌ 轻量提示（成功/失败）→ 用 [`state-notice`](../state-notice/README.md) 或 toast；
- ❌ 页面级跳转 → 用路由，不要用弹层冒充页面；
- ❌ 需要并排对比两块内容 → 用页面分栏，弹层会挡住一半。

## 3. Anatomy

```
┌──────────────────────────────┐
│ ①标题                ②关闭 × │  ← 头（固定）
├──────────────────────────────┤
│ ③主体内容（唯一滚动区）       │
│                              │
├──────────────────────────────┤
│ ④底部操作（可选）             │  ← 脚（固定）
└──────────────────────────────┘
```

| # | 部件 | class | 说明 |
| --- | --- | --- | --- |
| ① | 标题 | `.modal__title` | 16px semibold |
| ② | 关闭 | `.modal__close` | 44×44 触区 |
| ③ | 主体 | `.modal__body` | `overflow-y: auto` + `overscroll-behavior: contain` |
| ④ | 底部 | `.modal__foot` | 可选，主操作放这 |
| — | 遮罩 | `.modal` | 点空白关闭 |

## 4. Variants

| placement | 形态 | 用在哪 |
| --- | --- | --- |
| `sheet` | 底部上滑、只圆上两角 | 手机端主要形态（怎么补、详情） |
| `dialog` | 居中、四角圆、最大宽 448 | 确认框、短表单 |

## 5. States

| state | 说明 |
| --- | --- |
| `open` | 有遮罩、焦点进面板、Esc 关闭 |
| `closed` | 不渲染 DOM（不是 `display:none`） |
| `busy` | 主操作 loading 时按钮禁用，不关弹层 |

## 6. Do / Don't

**Do**
1. 头/脚固定，只有主体滚——不要把整块弹层做成滚动容器。
2. 标题写清「这是干什么」，不要只写「详情」。
3. 关闭后焦点回到触发元素。

**Don't**
1. ❌ 不要在弹层里再开弹层（最多一层）。
2. ❌ 不要把主操作放进主体滚动区底部（滚走了就找不到）。
3. ❌ 不要用弹层做「页面切换」。

## 7. Token 引用表

| 用途 | token | 值 |
| --- | --- | --- |
| 最大高 | `--modal-max-h` | 85vh |
| 遮罩 | `--modal-overlay` | black 40% |
| 圆角 | `--modal-radius` | 16px |
| 头内边距 | `--modal-head-pad-x` / `-y` | 16px / 8px |
| 脚内边距 | `--modal-foot-pad` | 12px |
| 标题 | `--modal-title-size` | 16px |
| 关闭触区 | `--modal-close-size` | 44px |
| 层级 | `--chrome-z` | 50（实现里弹层用 100） |

## 8. 代码位置

| 位置 | 作用 |
| --- | --- |
| `src/ui/primitives/ModalSurface.tsx:49` | `ModalSurface` |
| props | `{ open, title, onClose, children, footer?, size?, placement?, testId? }` |
| 无障碍 | `role="dialog"` `aria-modal` `aria-labelledby`，Esc 关闭，焦点回收 |

---

## 附：截图

- [`modal-surface-375.png`](./modal-surface-375.png)
- [`modal-surface-390.png`](./modal-surface-390.png)

```bash
node 原型/设计稿/_tools/capture-component.mjs modal-surface
```
