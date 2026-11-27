# DESIGN1 · tokens + 6 个基础原语（2026-11-28）

> 方案依据：[页面区块化与可回退](../方案-页面区块化与可回退-2026-11-28.md) 第 1 步；
> token 分层依据：[组件库建设指南](../设计系统/组件库建设指南-2026-11-22.md) §二（primitive → semantic → component）。

## 一句话

把现有页面里散着的 19 种字号、51 种内边距写法、7 种圆角、12 个色系，收敛成 **一套 tokens**；
再用这套 tokens 做了 **6 个原语**（Card / Row / Chip / Section / Skeleton / EmptyState）。
本轮**没有页面引用它们**，所以现有外观零变化；不想要了，删掉 `src/ui/kit/` 即回退。

## 边界（本轮只做了什么）

| 做了 | 没做 |
| --- | --- |
| 新增 `src/ui/kit/`（6 原语 + tokens.css + 6 份测试） | 没有改任何现有页面的 JSX / class |
| 根 `tailwind.config.js` 只**新增** token 名字（没覆盖任何旧档位） | 没有打包、没有发版、没碰线上 |
| `src/main.tsx` 加一行 `import './ui/kit/tokens.css'`（只定义变量，无选择器规则） | 没有动 `src/ui/plan/*`、`Profile*`、`Nearby*` |
| 新增静态画廊 `docs/preview/DESIGN-kit/index.html` + 截图 | 没有接入配方 / 区块层（第 2 步） |

证明「没改现有页面」的两个命令（输出见 §5）：

```bash
git diff --stat -- src/main.tsx tailwind.config.js   # 只有新增行
grep -r "ui/kit" src --include=*.tsx                 # 只有 main.tsx 的 CSS import
```

## 一、现状用了几套（数字表）

扫描脚本（可复算，不手抄）：`node docs/preview/DESIGN-kit/scan-tokens.mjs`

实际输出：

```text
扫描范围：src/ui/**（165 个文件，不含测试）+ src/index.css

字号         实际出现 19 种（1119 处）
           6px / 7px / 8px / 8.5px / 9px / 9.5px / 10px / 10.5px / 11px / 11.5px / 12px / 13px / 14px / 15px / 16px / 18px / 20px / 22px / 24px
  任意px     6 / 7 / 8 / 8.5 / 9 / 9.5 / 10 / 10.5 / 11 / 11.5 / 12 / 13 / 15 / 22（583 处）
  最常用      12px×352  11px×245  10px×209  14px×162  9px×72  16px×17  9.5px×11  8.5px×9
  Tailwind 2xl / base / lg / sm / xl / xs（536 处）
内边距        18 档（0 / 1 / 2 / 3 / 4 / 6 / 8 / 10 / 12 / 13 / 14 / 16 / 20 / 24 / 28 / 32 / 48 / 80），51 个 class 写法
外边距        11 档（0 / 2 / 3 / 4 / 6 / 7 / 8 / 9 / 12 / 13 / 16），23 个 class 写法
gap        10 档（1 / 2 / 3 / 4 / 6 / 7 / 8 / 10 / 12 / 16），25 个 class 写法
圆角         7 种（3 / 4 / 5 / 6 / 12 / 16 / 9999）
颜色         12 个色系 / 78 个档位
  色系       slate×1247  emerald×512  amber×183  rose×123  sky×78  pink×18  red×9  lime×8  indigo×4  violet×3  orange×3  teal×2
  前10      slate-500×293  slate-400×253  slate-200×201  emerald-700×163  slate-600×112  emerald-50×105  emerald-500×98  slate-50×96  slate-100×86  slate-700×72
CSS字号      0.62rem×5  0.8rem×4  11.33px×4  6.87px×4  0.58rem×3  inherit×3  0.72rem×2  6px×2  11px×2  8px×2  var(--sim-db)×2  5px×1  clamp(15px, calc(9px + 0.55vw), 21px)×1  0.92rem×1
CSS色值      27 个不同 hex
```

字号分布（合并 Tailwind 档位后）：

| 字号 | 处数 | 主要来源 |
| --- | --- | --- |
| 12px | 352 | `text-xs`（347）+ `text-[12px]`（5） |
| 11px | 245 | `text-[11px]` |
| 10px | 209 | `text-[10px]` |
| 14px | 162 | `text-sm` |
| 9px | 72 | `text-[9px]`（母本卡 / 蛋仓 / 需求卡） |
| 16px | 17 | `text-base` |
| 9.5px | 11 | `text-[9.5px]` |
| 8.5px | 9 | `text-[8.5px]`（蛋仓 / 种公堆叠） |
| 其余 | 42 | 6 / 7 / 8 / 10.5 / 11.5 / 13 / 15 / 18 / 20 / 22 / 24 |

结论：**光 10 / 10.5 / 11 / 11.5 这四个相邻档就占了 473 处**，
其中 10px 与 11px 的差别在手机上肉眼几乎不可辨 —— 这就是「每个区块各带一套字号」的直接证据。

## 二、收敛成的一套

落地文件：`src/ui/kit/tokens.css`（CSS 变量）+ 根 `tailwind.config.js`（同名 Tailwind 名字）。

### 字号（常规 5 档）

| Tailwind | CSS 变量 | 值 | 用途 | 谁会用 |
| --- | --- | --- | --- | --- |
| `text-caption` | `--fs-caption` | 10px | 说明文字 | 卡片里的补充说明 |
| `text-meta` | `--fs-meta` | 11px | 次要信息 / 数值 | 右侧计数、时间、状态 |
| `text-body` | `--fs-body` | 13px | 正文 | 列表主文案、段落 |
| `text-title` | `--fs-title` | 15px | 区块标题 | Section / Card 标题 |
| `text-hero` | `--fs-hero` | 18px | 数字 / 主标 | 大数字、页面主标 |

### 间距（4 档，4px 栅格）

| Tailwind | CSS 变量 | 值 |
| --- | --- | --- |
| `p-s1` / `m-s1` / `gap-s1` | `--space-1` | 4px |
| `p-s2` / `m-s2` / `gap-s2` | `--space-2` | 8px |
| `p-s3` / `m-s3` / `gap-s3` | `--space-3` | 12px |
| `p-s4` / `m-s4` / `gap-s4` | `--space-4` | 16px |

### 圆角（3 档）

| Tailwind | CSS 变量 | 值 | 用途 |
| --- | --- | --- | --- |
| `rounded-chip` | `--radius-sm` | 6px | 标签 / 骨架条 |
| `rounded-tile` | `--radius-md` | 8px | 小卡 / 输入 / 空态 |
| `rounded-card` | `--radius-lg` | 12px | 卡片 / 区块 / 画廊列 |

### 颜色（语义，不按色阶取用）

| Tailwind | CSS 变量 | 值 | 对比度（白底） | 用途 |
| --- | --- | --- | --- | --- |
| `text-ink` | `--color-ink` | #1e293b | 14.6:1 | 主文字 |
| `text-ink-soft` | `--color-ink-soft` | #475569 | 7.6:1 | 正文次级 |
| `text-ink-muted` | `--color-ink-muted` | #64748b | 4.8:1 | 次要信息 |
| `text-ink-faint` | `--color-ink-faint` | #94a3b8 | 2.6:1 | 占位 / 装饰（不承载正文） |
| `bg-surface` | `--color-surface` | #ffffff | — | 卡底 |
| `bg-surface-sunken` | `--color-surface-sunken` | #f8fafc | — | 页面底 / 空态底 |
| `border-line` | `--color-line` | #e2e8f0 | — | 描边 |
| `text-accent-strong` / `bg-accent` | `--color-accent-strong` / `--color-accent` | #047857 / #059669 | 5.5:1 / 3.8:1 | 强调文字 / 填充 |
| `text-warn` | `--color-warn` | #b45309 | 5.0:1 | 警告 |
| `text-danger` | `--color-danger` | #be123c | 6.3:1 | 危险 / 失败 |
| `text-info` | `--color-info` | #0369a1 | 5.9:1 | 信息 / 计划中 |

规则：**`accent`（#059669）只做填充、描边、图标（3.8:1），小字一律 `accent-strong`**；
`ink-faint` 只做占位与装饰。原语里已经按这条写。

### 具名例外（允许保留，但必须写理由）

| Tailwind | CSS 变量 | 值 | 理由 |
| --- | --- | --- | --- |
| `text-sim-cell` | `--fs-sim-cell` | 6px | 仿真背包一页必须放 6×5=30 格且不滚动，6px 已是可读上限 |
| `text-card-index` | `--fs-card-index` | 8px | 图鉴 / 种公矩阵卡内编号，卡宽不足 6rem，放大即挤掉主名 |
| `text-pet-micro` | `--fs-pet-card-micro` | 9px | 精灵背包卡 375 宽 4 列时，蛋组 / 性格一行放不下 11px |
| `text-egg-card` | `--fs-egg-card` | 10px | 蛋卡固定 5.1rem 宽、横屏一屏多列，12px 会把蛋名 / 编号裁掉 |

**原语不许用这四档**（测试与人工 review 都按这条查）；它们只给后续卡片家族收敛时用。

### 现状 → tokens 的映射

| 现状 | 收敛到 | 变化 |
| --- | --- | --- |
| 6 / 7px | `text-sim-cell` 6px | 7→6（−1） |
| 8 / 8.5px | `text-card-index` 8px | 8.5→8（−0.5） |
| 9 / 9.5px | `text-pet-micro` 9px | 9.5→9（−0.5） |
| 10 / 10.5px | `text-egg-card` 10px | 10.5→10（−0.5） |
| 11 / 11.5px | `text-meta` 11px | 11.5→11（−0.5） |
| 12 / 13px / `text-xs` | `text-body` 13px | 12→13（+1） |
| 14px / `text-sm` | `text-body` 13px | 14→13（−1） |
| 16px / `text-base` | `text-title` 15px | 16→15（−1） |
| 15px（1 处） | `text-title` 15px | 不变 |
| 18px / `text-lg` | `text-hero` 18px | 不变 |
| 20 / 22 / 24px | 暂不纳入 | 页级大标，留给后续页面层决策，原语最高到 hero |

**坦诚**：12→13 会让一部分 `text-xs` 变大 1px，14→13 会让 `text-sm` 小 1px；
这是「从 19 种收到 5 档」必然的搬家成本，等第 2 步逐页接入时按页确认，不会在本轮偷偷改。

### 数值口径：注释写 px，落地用 rem

横屏用 `html { font-size: clamp(...) }` 整体缩放（`src/index.css:61`）。
token 若写成 px，新原语在横屏不会跟着放大，会和现有页面脱节；写 rem 则 375 竖屏（根字号 16px）
与 px 完全等价，横屏继续跟随缩放。因此 `--fs-body: 0.8125rem` 就是 13px，`--space-2: 0.5rem` 就是 8px。

## 三、6 个原语

位置：`src/ui/kit/`（`index.ts` 统一出口）。

| 组件 | 职责 | 关键 API | 必须处理的状态 |
| --- | --- | --- | --- |
| `Card` | 容器：圆角 / 描边 / 内边距 / 标题行 | `title` `action` `dense` `headingLevel` | 有/无标题行、密集、空内容、长标题 |
| `Row` | 列表行：图标 / 主文案 / 副文案 / 右侧值 | `icon` `primary` `secondary` `value` `onClick` `disabled` | 长文案截断、可点、禁用、纯展示 |
| `Chip` | 状态 / 筛选标签 | `selected` `tone` `onToggle` `onRemove` | 选中 / 未选中 / 可关闭 / 4 种状态色 / 禁用 |
| `Section` | 区块外壳：标题 + 说明 + 内容 + 空态 | `action` `empty` `collapsible` `defaultOpen` | 空态、折叠展开、右侧动作 |
| `Skeleton` | 加载占位 | `lines` `height` `width` | 1 行 / 多行 / 列表行 / 卡片（高度固定） |
| `EmptyState` | 空态：一句事实 + 一个动作 | `icon` `title` `description` `action` | 只有事实 / 带动作 / 带图标 |

统一约束：

- 触区 ≥ 32px：`min-h-touch`（`--size-touch: 2rem`）；
- 间距只用 `s1~s4`、圆角只用 `chip/tile/card`、字号只用 `caption/meta/body/title/hero`；
- 长文本 `truncate` + 容器 `min-w-0`，芯片 `max-w-full` 不撑破父容器；
- 可点行/芯片用真 `<button>`，`aria-pressed` / `aria-expanded` / 读屏名齐全；
- 测试断言「className 里不出现 `数字px`」，防止以后又写回硬编码。

## 四、画廊与截图

| 文件 | 说明 |
| --- | --- |
| [docs/preview/DESIGN-kit/index.html](../preview/DESIGN-kit/index.html) | 单文件静态画廊，双击可看（CSS/JS 全内联） |
| [DESIGN-kit-375.png](../preview/DESIGN-kit/DESIGN-kit-375.png) | 375 档全量（752×7208） |
| [DESIGN-kit-390.png](../preview/DESIGN-kit/DESIGN-kit-390.png) | 390 档全量 |
| [DESIGN-kit-双档并排.png](../preview/DESIGN-kit/DESIGN-kit-双档并排.png) | 375 + 390 并排 |

画廊渲染的是 `src/ui/kit` 里的真实组件（esbuild 打包 + Tailwind 扫描），不是另画一套 HTML。
每个原语按「默认 / 密集 / 空 / 禁用 / 长文案」铺开，凡该原语没有的状态就不硬凑（例如 Chip 没有「空」）。

重建命令：

```bash
node docs/preview/DESIGN-kit/scan-tokens.mjs   # 现状数字
node tools/preview/design-kit/build.mjs        # 画廊 HTML
node tools/preview/design-kit/shot.mjs         # 375 / 390 / 并排三张截图
```

## 五、验证（命令 + 真实输出）

```text
$ npx vitest run src/ui/kit
 ✓ src/ui/kit/Row.test.tsx (6 tests)
 ✓ src/ui/kit/Chip.test.tsx (6 tests)
 ✓ src/ui/kit/Section.test.tsx (6 tests)
 ✓ src/ui/kit/EmptyState.test.tsx (5 tests)
 ✓ src/ui/kit/Skeleton.test.tsx (5 tests)
 ✓ src/ui/kit/Card.test.tsx (5 tests)
 Test Files  6 passed (6)
      Tests  33 passed (33)

$ npx tsc -b
（无输出 = 通过）

$ node tools/preview/design-kit/build.mjs
[design-kit] docs\preview\DESIGN-kit\index.html  344 KB（tokens 4.5 KB + tailwind 51 KB）

$ node tools/preview/design-kit/shot.mjs
[design-kit] 列宽 375 / 390，整页宽 900，横向溢出：无

$ node docs/preview/DESIGN-kit/scan-tokens.mjs
（见 §一）

$ Select-String -Path src/ui/kit/*.tsx -Pattern '\[\d+px\]|#[0-9a-f]{3,8}'
（无输出 = 原语里没有裸像素 / 裸色值）
```

## 六、已知取舍与未做的事

1. **触区 28 → 32**：现有 `CONTROL_XS` 是 28px，新原语统一 32px。本轮不改造旧控件，所以两套会并存一段时间。
2. **12 档变 13、14 档变 13**：见 §二「坦诚」。接入时必须按页截图确认。
3. **尚未做视觉回归**：原语没进页面，没有可比对的旧截图；第 2 步接入「我的」页时再建立基准。
4. **状态色只做了 4 组**（accent / warn / danger / info），性别粉蓝留了变量但没进原语。
5. **没有做暗色主题**：`tokens.css` 是单主题；若以后要加，按同一套语义变量覆盖即可。

## 七、怎么回退

本轮是纯新增，回退不需要 revert 提交：

1. 删 `src/ui/kit/`（6 个组件 + 6 份测试 + tokens.css）；
2. 删 `src/main.tsx` 里 `import './ui/kit/tokens.css';`（含注释两行）；
3. 把根 `tailwind.config.js` 的 `theme.extend` 整段删掉（恢复 `extend: {}`）；
4. 删 `tools/preview/design-kit/` 与 `docs/preview/DESIGN-kit/`。

因为没有页面引用原语，以上四步不会影响任何现有界面。

## 八、下一步（第 2 步，不在本轮）

按方案第 2 步：「我的」页拆成 5~7 个区块 + 配方，做出 `PROFILE_STABLE_V1` 快照。
接入前先确认两件事：① 12 / 14 → 13 的 1px 变化是否接受；② 触区 32 是否统一到旧控件。
