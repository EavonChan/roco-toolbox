# egg-demand-card · 换蛋需求卡

## 1. 一句话定义

换蛋需求卡：需求列表里的一张「想要什么 + 目标 + 当前状态」，窄卡竖排，靠底部状态条收口。

## 2. 何时用 / 何时不用

**用**
- 需求池 / 我的需求 / 接单列表里，一张卡代表一条需求；
- 需要表达「这条需求走到哪一步了」（待接单 / 已接单 / 已换到）。

**不用**（反例）
- ❌ 展示「我有什么」→ 用 [`pet-card`](../pet-card/README.md)；
- ❌ 展示「一对怎么配」→ 用 [`nest-pair-card`](../nest-pair-card/README.md)；
- ❌ 需求详情（要展示长说明、协商记录）→ 用 `modal-surface` 承载。

## 3. Anatomy

```
┌──────────────┐
│   ①立绘      │
│ ②名字        │
│ ③性格 · 奖牌 │
│ ④奖牌图标行  │
├──────────────┤
│ ⑤状态条      │
└──────────────┘
```

| # | 部件 | class | 说明 |
| --- | --- | --- | --- |
| ① | 立绘 | `.demand-card__art` | 官方头像，最大高 48 |
| ② | 名字 | `.demand-card__name` | 11px semibold，单行截断，全名进 `title` |
| ③ | 元信息 | `.demand-card__meta` | 10px：性格 · 目标奖牌 |
| ④ | 奖牌图标 | `.demand-card__medals` | 16px，最多 3 个（体型/声音/绿窝） |
| ⑤ | 状态条 | `.demand-card__footer` | 20px 高、主色浅底 |

## 4. Variants

| variant | 说明 |
| --- | --- |
| 需求卡（默认） | 立在需求池里，底条写状态 |
| 接单卡 | 同一结构，底条写「已接单」并高亮 |

## 5. States

| state | 底条 | 说明 |
| --- | --- | --- |
| 待接单 | `--accent-soft` / `--accent-text` | 还在池子里 |
| 已接单 | 同上 | 等交付 |
| 已换到 | 同上 | 完成，仍保留可查来源 |
| 不可选（自己发的） | `--bg-muted` / `--text-faint` | 不能接自己的单 |

## 6. Do / Don't

**Do**
1. 状态只用底条表达，不要在卡里再放按钮。
2. 名字单行截断 + `title` 兜底；不要缩字号。
3. 立绘保持比例（`object-fit: contain`）。

**Don't**
1. ❌ 不要把「当前进度」写成百分比条——需求卡只表达阶段，不表达比例。
2. ❌ 不要在卡里塞下单人信息（详情弹层里再说）。
3. ❌ 不要用绿色以外的强调色混合（状态色只有一套主色）。

## 7. Token 引用表

| 用途 | token | 值 |
| --- | --- | --- |
| 圆角 / 内边距 | `--demand-card-radius` / `--demand-card-pad` | 12px / 4px |
| 名字 / 元信息 | `--demand-name-size` / `--demand-meta-size` | 11px / 10px |
| 奖牌 | `--demand-medal-size` | 16px |
| 状态条高 | `--demand-footer-h` | 20px |
| 颜色 | `--line` / `--bg-surface` / `--accent-soft` / `--accent-text` | 见 semantic.css |

## 8. 代码位置

| 位置 | 作用 |
| --- | --- |
| `src/ui/plan/EggDemandCard.tsx:15` | `EggDemandCard` |
| props | `{ demand, name, ownerLabel, statusLabel, onOpen }` |
| 使用方 | 换蛋（需求池 / 我的需求 / 接单） |

---

## 附：截图

- [`egg-demand-card-375.png`](./egg-demand-card-375.png)
- [`egg-demand-card-390.png`](./egg-demand-card-390.png)

```bash
node 原型/设计稿/_tools/capture-component.mjs egg-demand-card
```
