# components · 组件库

> 一个组件一个目录，固定四件套：`README.md`（八段）+ `spec.html`（只放这一个组件）+ `{name}-375.png` + `{name}-390.png`。
> 规格页共用文档排版 [`_doc.css`](./_doc.css)；组件样式只引用 `_tokens/component.css`（③ 层）。

## 已有组件（8 个）

| 组件 | 一句话 | 尺寸 / 变体 | 状态 |
| --- | --- | --- | --- |
| [pet-card](./pet-card/README.md) | 一只精灵 + 蛋组 / 性格 / 状态 | sm 96 / md 104 × 7 variant | ✅ 四件套齐 |
| [nest-pair-card](./nest-pair-card/README.md) | 一对配窝里的一只（母 / 公） | full 86 / home 70 | ✅ 四件套齐 |
| [segmented-control](./segmented-control/README.md) | 互斥视角切换 | 34 轨道 / 30 分段 | ✅ 四件套齐 |
| [progress-card](./progress-card/README.md) | 进度卡（9 / 14 + 条） | 静态 / 可点 | ✅ 四件套齐 |
| [state-notice](./state-notice/README.md) | 空态 / 失败 / 完成提示 | 4 语气 × 10 kind | ✅ 四件套齐 |
| [chip](./chip/README.md) | 多选筛选小块 | 28 / 26 内联 | ✅ 四件套齐（待抽组件） |
| [modal-surface](./modal-surface/README.md) | 弹层外壳 | sheet / dialog | ✅ 四件套齐 |
| [egg-demand-card](./egg-demand-card/README.md) | 换蛋需求卡 | 待接单 / 已接单 / 已换到 | ✅ 四件套齐 |

## 检查命令

```bash
# 组件规格截图（375 / 390，顺手报坏图与横向溢出）
node 原型/设计稿/_tools/capture-component.mjs <组件名>

# 门禁：高度枚举 / 无裸值 / 目录完整
node 原型/设计稿/_tools/gate.mjs
```

最近一次门禁结果：**8 个组件目录，3/3 规则全部通过**。

## 已知待办

| 项 | 说明 |
| --- | --- |
| `chip` 抽组件 | 现状是 `FilterAccordion` 里的内联类名，目标是 `primitives/Chip.tsx` |
| 配对卡名字字号 | 现状按长度 11/10/9，目标统一 10px + 精简形态（见其 README 第 6 段） |
| pet-card 命名收敛 | 现状 `default/tall/gap/suggest`，目标是语义 variant（见其 README 第 8 段映射表） |
