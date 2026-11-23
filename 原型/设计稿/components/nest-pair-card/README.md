# nest-pair-card · 配对卡

## 1. 一句话定义

配对卡：一对配窝里的**一只**精灵（母本或种公）——两张并排才算「一对」，
外层的组卡用左侧色条标出这是第几条摆位线。

## 2. 何时用 / 何时不用

**用**
- 需要表达「哪只母本 × 哪只种公」这一对（看板配窝建议、家园现状、接单上窝）；
- 需要同时显示：蛋组（含是否已收齐）、性别、性格、分贝、身高/体重、盒位。

**不用**（反例）
- ❌ 只要「一只精灵一览」→ 用 [`pet-card`](../pet-card/README.md)；
- ❌ 单只精灵的详情/背包列表 → 用 `pet-card` 的 `inventory` 变体；
- ❌ 需求/换蛋的接单进程卡 → 用 `EggDemandCard`，它的主体是「进度」不是「一对」。

判断：**出现「母/公配对关系」时用它；只出现「一只」时用 pet-card。**

## 3. Anatomy

```
┌─ 组卡（左侧 4px 摆位色条）──────────────┐
│ ┌── 母本卡 ────────┐ ┌── 种公卡 ──────┐ │
│ │ ①蛋组(chip)  ②♀性格│ │ ①蛋组  ②♂性格 │ │
│ │  奖牌          dB  │ │  奖牌     dB   │ │
│ │      ③头像        │ │      ③头像     │ │
│ │      ④名字        │ │      ④名字     │ │
│ │     ⑤盒位(full)   │ │     ⑤盒位      │ │
│ └───────────────────┘ └────────────────┘ │
└──────────────────────────────────────────┘
```

| # | 部件 | class | 说明 |
| --- | --- | --- | --- |
| ① | 蛋组 chip | `.pair-card__egg` | 最多两行；已收齐的蛋组变绿（`data-collected="true"`） |
| ② | 性别 + 性格 | `.pair-card__gender` / `.pair-card__nature` | 母粉 ♀ / 公蓝 ♂；性格琥珀底 |
| ③ | 头像 | `.pair-card__avatar` | 44px，距顶 6px |
| ④ | 名字 | `.pair-card__name` | 目标态 10px + 精简形态（现状见第 6 段） |
| ⑤ | 盒位 | `.pair-card__position` | 只有 `full` 档有；`home` 档不写 |
| — | 摆位色条 | `.pair-group` 的 `--pair-color` | 12 色轮转，第 13 条起虚线 |

## 4. Variants

| variant | 高度 | 用在哪 | 差异 |
| --- | --- | --- | --- |
| `full` | 86px | 看板配窝建议、接单上窝 | 带盒位一行 |
| `home` | 70px | 家园现状 | 不带盒位 |

底色按性别：母 `pink-50/pink-200`、公 `sky-50/sky-200`、未知 `slate-50/slate-200`；
住学院小窝时整卡 2px 绿框（`data-academy="true"`）。

见 [spec.html](./spec.html) 的 A~C 段。

## 5. States

| state | 触发 | 视觉 |
| --- | --- | --- |
| `default` | 常态 | 性别底色 + 1px 同色系描边 |
| `collected` | 蛋组已收齐 | 该 chip 变 `emerald-100/700` |
| `academy` | 住学院小窝 | 2px `emerald-500` 整卡框 |
| `hover` | 仅桌面 | 沿用 pet-card 的 hover 规则（移动端不启用） |

配对卡没有 `disabled` / `empty`：不可配的情况由「求助卡」替代（见 8 段）。

## 6. Do / Don't

**Do**
1. 一对一定成对出现，左母右公，顺序固定。
2. 蛋组用「是否已收齐」的两个色，别在卡里再写「已收齐」文字。
3. 名字用精简形态（`乌达_极夜的样子 → 乌达·极夜`）。

**Don't**
1. ❌ 不要把「一只精灵」硬塞进配对卡——那是 pet-card。
2. ❌ 不要给 `home` 档加盒位行（70px 放不下，会压住名字）。
3. ❌ 不要再按名字长度缩字号（现状仍保留 11/10/9 三档，属于待收敛项）。

**变更记录**：
- 2026-11-19 统一为「家园与配窝建议共用同一张卡，只差高度与盒位行」；
- 名字字号仍是按长度 11/10/9（源实现 `NestPlanCard.tsx:352-358`），**目标态统一 10px + 精简形态**，与 pet-card 对齐；这一项还没落代码。

## 7. Token 引用表

| 用途 | token | 值 |
| --- | --- | --- |
| 高度 full / home | `--pair-card-height-full` / `-home` | 86px / 70px |
| 圆角 | `--pair-card-radius` | 12px |
| 内边距 / 卡间距 | `--pair-card-pad` / `--pair-card-gap` | 6px / 2px |
| 摆位色条宽 | `--pair-card-stripe-w` | 4px |
| 头像 / 距顶 | `--pair-card-avatar` / `-avatar-top` | 44px / 6px |
| 名字 | `--pair-card-name-size` / `-line` | 10px / 12px |
| 蛋组 chip | `--pair-card-chip-size` / `-line` | 9px / 12px |
| 数值行 | `--pair-card-meta-size` / `-line` | 10px / 13px |
| 底色 / 描边 | `--c-pink-*/sky-*/slate-*`（经 ② `--line`、`--bg-inset`） | 见 semantic.css |
| 学院框 | `--state-academy-line` | emerald-300… 见 semantic |

## 8. 代码位置

| 位置 | 作用 |
| --- | --- |
| `src/ui/NestPlanCard.tsx:325` | `PairingPetCard`（props：`pet` / `collectedGroupIds` / `academy` / `home` / `hideMeasurements` / `testId`） |
| `src/ui/NestPlanCard.tsx:192` | 组卡渲染：`color: pairingColor(views.length)`、左侧 4px 色条 |
| `src/ui/pairingColors.ts` | 12 色与「第 13 条起虚线」规则 |
| `src/ui/HomePairCards.tsx` | 家园侧的组卡包装（`border-l-4` + `bg-slate-50`） |

---

## 附：截图

- [`nest-pair-card-375.png`](./nest-pair-card-375.png)
- [`nest-pair-card-390.png`](./nest-pair-card-390.png)

```bash
node 原型/设计稿/_tools/capture-component.mjs nest-pair-card
```
