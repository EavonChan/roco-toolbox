# R7b 朋友 PR 剩余：家园 / 母本（只读审查）

- 批次：R7b（简报 `docs/code-review/2026-11-19/briefs-revised.md` §R7b）
- 基线：`894de06`（`test` 当前为 `d00739c`，本批 10 个文件与 `894de06` 完全一致，`git diff 894de06 -- <本批文件>` 为空）
- 范围：`git 8b97e48..081b604` 中下列文件的变更
- 验证：`npx tsc -b` 通过（无输出，exit 0）；`npx vitest run src/ui/Home.test.tsx src/ui/HomePairDiagram.test.tsx src/ui/MotherView.test.tsx src/ui/HomeDemandPlacements.test.tsx` 4 文件 54 用例全通过
- 承接：11-08 报告 F-4（「已上窝」取消勾选不同步），结论以当前基线代码为准

## 一、已读文件与变更规模

| 文件 | 变更 |
| --- | --- |
| src/ui/Home.tsx | +158 −75 |
| src/ui/Home.test.tsx | +49 −13 |
| src/ui/HomePairDiagram.tsx | +106 −30 |
| src/ui/HomePairDiagram.test.tsx | +134 |
| src/ui/HomeDemandPlacements.tsx | +30 −14 |
| src/ui/HomeDemandPlacements.test.tsx | +13 −3 |
| src/ui/MotherView.tsx | +62 −134 |
| src/ui/MotherView.test.tsx | +49 |
| src/ui/MotherCriteriaMedals.tsx | +103（新文件） |
| src/ui/MotherCriteriaMedals.test.tsx | +64 |

关联只读确认：src/domain/motherCriteria.ts、src/ui/motherCriteriaStore.ts、src/ui/PetCompactCard.tsx、src/ui/PetCardLayout.tsx、src/domain/nestGeometry.ts、src/ui/primitives/*。

## 二、审查重点逐条结论

1. **配对图与需求落位的数据来源**：两者刻意不同源——`HomePairDiagram` 画的是游戏实际配对 `home.layEggCouples` + `home.residents`（Home.tsx:203、287），`HomeDemandPlacements` 画的是"我接的单"经 `buildDemandPlacements` 算出的推荐配对（HomeDemandPlacements.tsx:284-287）。空/缺数据都有占位：无配对写 `home-no-pairs`（Home.tsx:281-289），配对里缺公本写「公本未知」虚线块（HomePairDiagram.tsx:149-167、223-239 的测试），排不上单独列出原因（HomeDemandPlacements.tsx:677-682）。来源不一致是设计意图（实际 vs 建议），文案已分别标明「按游戏实际配对」（Home.tsx:279）。
2. **MotherView 删 134 行后**：删掉的是「我的母本达标条件」整块（体型 / 声音摘要 + `ScopeSummary` + 编辑入口），换成页首的 `MotherCriteriaMedals`（MotherView.tsx:406）；母本详情（展开后的 `mother-chain-mothers` 列表）保留（:592-622），入口仍能从收集页到达（Collection.tsx:48-56）。丢失的是"实际生效条件"的可读摘要，与 H01 合并说明。
3. **奖牌展示与 R5 口径**：展示侧强制单选（MotherCriteriaMedals.tsx:50-55、TargetGradeSelector），判定侧对"旧数据没有 `grades`"仍走体型 + 声音四档老逻辑（motherCriteria.ts:88-94，默认数据本身无 `grades`：:41-44）——展示与判定不一致，见 H01。
4. **受理 11-08 F-4**：`if (!next) return;`（HomeDemandPlacements.tsx:336）确认仍在，取消勾选只写本机、不调服务端；另有 `disabled={!!item.placedAt}`（:643）让已同步的任务永远点不了。属仍有效，见 H02。
5. **2095137 家园蛋接蛋仓后的兜底**：本批文件只展示 `home.sceneEggs` 的枚数与位置（Home.tsx:319-326），父母推算与属性兜底在 `src/ui/plan/homeEggAdapter.ts` / `src/shared/eggWorkflow.ts`，不在本批 10 个文件内，本批未复核（见范围外备注）。

## 三、问题清单

### R7b-H01 · 高风险 · 母本页只勾着「大婉」，但小粗母本照样算已收集

- ① 问题描述：新奖牌选择器"强制单选"，没有 `grades` 的旧数据会被显示成只选中「大婉」（src/ui/MotherCriteriaMedals.tsx:81-95，兜底 `DEFAULT_GRADE='大婉'`），而判定函数只要 `criteria.grades` 为 `undefined` 就走旧版"体型 + 声音"分支（src/domain/motherCriteria.ts:88-94），默认体型 / 声音又是四档全含（:41-44）；用户影响有两层：a) 母本页自己把"小不点 + 粗嗓门"也算成已收集，但屏幕上只写着大婉；b) 在母本页把奖牌改成「小粗」后，看板「母本全收集」仍按它自己的目标档位（默认大婉）计数——`Dashboard.tsx:53-58` 优先取 `coverageFilter.grades`，只有没有目标档位时才用 `motherCriteria.grades`，于是母本页改了档、看板数字不动，两页"已收集"互相打架。触发条件：从没点过奖牌的老用户（默认数据没有 `grades`），或在母本页切换达标奖牌。（技术证据：motherCriteriaStore.ts:39-49 缺 `grades` 不补；MotherView.tsx:254-260 原样传 `criteria.grades`；coverageTargets.ts:32 默认档位 `['大婉']`）
- ② 优化方案：A 显示侧不再"假装选中"：`selectedGradesFor` 在 `criteria.grades === undefined` 时返回空数组，并在奖牌上方写明"未设置组合，当前按体型 / 声音不限档判定"；B 在首次渲染或迁移时把旧数据规范化为 `grades: ['大婉']`，与显示对齐；C 先把两页口径合并成一份（看板与母本页都只认 `motherCriteria.grades`，或都只认覆盖度目标档位），再处理 A/B。推荐 C + A 组合：口径只有一个、显示不撒谎；B 的代价是会改变看板分母 / 分子与用户历史观感，需要用户拍板。C 涉及看板（R6b 已审文件），改动约 10 行。
- ③ 优化后表现：屏幕选中档位、母本页计数、看板计数三者一致，或明确写出各自口径；验收：`npx vitest run src/ui/MotherCriteriaMedals.test.tsx` 新增「默认数据下不显示任何档位 selected」，并手工验证"母本页选小粗 → 看板母本全收集数字随之变化"；默认数据 + 一只「小不点 + 粗嗓门」母本，确认它是否被算已收集且页面有对应说明。

### R7b-H02 · 高风险 · 误点「已上窝」后本机取消掉了，组员那边仍显示已上窝，且已同步的任务再也点不动

- ① 问题描述：勾选时先写本机再调服务端（`type:'place'`），取消勾选直接 `return`，没有任何服务端调用（src/ui/HomeDemandPlacements.tsx:331-336）；已同步过的工作流任务行把复选框 `disabled={!!item.placedAt}` 写死（:643）；用户影响是本机已经取消、发布方 / 组员仍看到"已上窝"卡在待确认，而且没有任何入口能撤回；触发条件是勾选后再点一次，或勾选成功后重新进入「接单上窝」。（技术证据：:336 `if (!next) return;`；:342 失败回滚只覆盖"勾选失败"；:643 `disabled={!!item.placedAt}`）
- ② 优化方案：A 需要服务端支持撤回：工作流新增 `{ type: 'unplace' }`（或对应 DELETE），前端取消勾选时调用并在失败时把本机勾选加回去，`fixedTasks` 行也走同一条撤回；B 若本轮不想动服务端，把勾选改成显式不可逆——成功后置灰并写"已上窝（不可撤回，如需更正请联系发布方）"，删掉"能取消"的错觉。推荐 A（承接 11-08 F-4）；A 涉及线上数据与接口，需先拍板。
- ③ 优化后表现：取消勾选后服务端状态真的清空，双方看到一致；验收：`npx vitest run src/ui/HomeDemandPlacements.test.tsx` 新增「取消勾选调用 unplace 且失败回滚」用例；手工路径：勾选 → 取消 → 重新进入页面仍为未上窝。

### R7b-H03 · 高风险 · 存储被禁用的安卓 WebView 打开家园页会直接白屏（既有问题，本批未引入）

- ① 问题描述：`readHomeView()` 直接 `window.localStorage.getItem` 且没有 try/catch（src/ui/Home.tsx:335-338），并在 `useState` 初始化时调用（:360）；同文件写路径 `saveHomeView` 有 try/catch（:344-352），旧 `PetList` 也专门为这种机型写过 `safeGetItem`（本次删掉的旧实现注释里写明"部分安卓 WebView 访问 window.localStorage 直接抛 SecurityError"）；用户影响是隐私模式 / 关闭存储的机型一进家园页整页崩掉，触发条件是浏览器或壳内禁用了本地存储。该问题在基线 `8b97e48` 就已存在，不属于本批改动，但本批正在重写这一段的相邻代码，建议一并修。
- ② 优化方案：把 `readHomeView` 包进 try/catch，异常时返回 `'nests'`（与 `saveHomeView` 的兜底一致）；顺便把 `saveHomeView` 里的 `localStorage.setItem` 保持现状即可。改动 5 行内，无副作用。
- ③ 优化后表现：禁用存储时家园页正常打开、只是不记住上次分页；验收：在 `window.localStorage` 访问抛错的测试里 `render(<HomeLand />)` 不抛错（可参照 PetList.test.tsx:24-38 的 stub 写法）。

### R7b-M01 · 中等 · 母本卡底部「计划 / 查看 N 只」按钮只有 12px 高，手机上很难点中

- ① 问题描述：`MotherEggRow` 把动作做成卡片 footer 按钮，高度是 `min-h-3`（12px）、字号 7px（src/ui/MotherView.tsx:567、578），同页其它操作都是 `min-h-[28px]`（:370、:418、:447、:459）；用户影响是在四列小卡上点"计划"经常点到卡片或相邻卡，触发条件是 375 宽触屏操作。（依据：docs/产品交互规范.md:61-64 按钮最小档 `xs=28px`）
- ② 优化方案：A 把 footer 按钮提升到 28px，需要重新分配 98px 卡内空间（名字行或详情行让位），约 10 行类名调整；B 把"计划 / 查看"挪到卡片外一行小按钮（28px），卡片只做展示。A 改动小但卡内更挤，B 更稳但会加高网格行。
- ③ 优化后表现：母本清单的动作可稳定点中；验收：375 截图 + `getBoundingClientRect().height >= 28`。

### R7b-M02 · 中等 · 配对里缺母本时，图上写成「公本未知」

- ① 问题描述：`nodeOf` 找不到住户时统一返回 `name: '公本未知'`（src/ui/HomePairDiagram.tsx:152），但 `femaleActorId` 同样可能不在快照里（增量快照 / 换过采集）；用户影响是母本缺失时图上标注成"公本未知"，会让人去查种公数据，触发条件是 `layEggCouples.femaleActorId` 不在 `residents` 中。
- ② 优化方案：`nodeOf` 增加角色参数（`female` / `male`），缺失时分别写「母本未知」「公本未知」；改动 4 行，测试补一条 female 缺失用例。
- ③ 优化后表现：缺失提示指向真正的缺失方；验收：`npx vitest run src/ui/HomePairDiagram.test.tsx`，新增用例断言 `data-name` 为「母本未知」。

### R7b-L01 · 低 · 母本链清单的 memo 依赖漏了 `mode`，目前靠声音字符串差异侥幸正确

`chainSections` 的依赖写成 `[matchedGroups, chainFilter, owned, criteria, activeVoices.join(','), naturesOf]`（src/ui/MotherView.tsx:337），而判定用的 `effectiveCriteria.targetMode` 取自 `mode`（:254-260，motherCriteria.ts:89）；现在两种模式的声音字符串不同（`+100/-100` vs `婉转声/粗嗓门`），切换模式会顺带重算，但只要出现"`grades` 有值 + `voices` 为空"的组合，切模式就不会重算，已收集标记滞后一次渲染。建议把 `mode` 显式加进依赖并删掉 `eslint-disable`。

### R7b-L02 · 低 · 接单上窝里有三处压成一行的 JSX，函数已超过 150 行

`workflow` 查找（src/ui/HomeDemandPlacements.tsx:339）、`fixedTasks/taskAccounts/taskParents` 三个集合（:571-573）、任务行整段 JSX（:643）都写成单行，读不出分支，且 `renderRow` 内联了 180 行。建议拆出 `FixedTaskRow` 与 `summarizeTasks()`，不改行为。

### R7b-L03 · 低 · 家园账号切换用显示名当 key，重复快照会撞 key

切换器以 `account`（显示名）做 `key` 与选中值（src/ui/Home.tsx:416-438），而 `labelerFor` 只用"昵称同名时补 gameId"来区分（src/ui/useOwnedPets.ts:12-17）；同一个 `gameId` 在换服后可能对应两个 `accountKey`，两者显示名完全相同，就会撞 `key` 且只能选到第一个快照。建议 key / 选中值改用 `accountKey`，显示仍用 `labelOf`。

### R7b-U01 · 不确定（置信度中）· 一簇 8 只以上的配窝图放在半栏 58% 宽里，方块文字可能小到不可读

- ① 问题描述：每个配窝簇只占 `w-[calc(50%-4px)]` 的一格，SVG 再缩到 `w-[58%]`（src/ui/HomePairDiagram.tsx:258、267）；"三公八母"要排 5 列 × 3 行（:47-63），375 宽下每个方块只有十几像素，名字 4 字会挤成一团；触发条件是家园出现 1:2 共享 + 多窝配对。
- ② 优化方案：A 大簇独占整行（`w-full`）、小簇仍两列；B 保持两列但把方块文字缩到 5px 并只留性别。需要截图确认哪个可读。
- ③ 优化后表现：配窝图在 375 下名字仍可辨认；验收：375 / 390 截图（审查阶段不跑 Playwright）。

## 四、统计

| 风险 | 条数 | 编号 |
| --- | --- | --- |
| 高 | 3 | H01、H02、H03（H03 为既有问题） |
| 中 | 2 | M01、M02 |
| 低 | 3 | L01、L02、L03 |
| 不确定 | 1 | U01 |
| 合计 | 9 | |

## 五、最该先修的三条

### 1. R7b-H02 · 高风险 · 「已上窝」取消不同步（11-08 F-4 仍有效）

- ① 现状 / 影响 / 触发：`HomeDemandPlacements.tsx:336` 取消勾选直接 `return`，`:643` 已同步任务被禁用；误点后无法撤回，双方状态分叉。
- ② 方案：A 新增 `unplace` 工作流动作并在取消时调用（需服务端配合）；B 改成"不可撤回 + 文案说明"。
- ③ 表现与验收：取消后服务端 `placedAt` 清空；`npx vitest run src/ui/HomeDemandPlacements.test.tsx` 新增对应用例。

### 2. R7b-H01 · 高风险 · 母本奖牌显示单选、判定仍四档，且两页口径不一致

- ① 现状 / 影响 / 触发：`MotherCriteriaMedals.tsx:81-95` 显示大婉，`motherCriteria.ts:88-94` 缺 `grades` 时按体型 + 声音全档判定；`Dashboard.tsx:53-58` 又优先用覆盖度目标档位，母本页改了奖牌看板不变。
- ② 方案：C 先合并两页口径（统一认 `motherCriteria.grades`），A 让未设置组合时显示"未设置"；B 迁移到 `grades: ['大婉']` 需拍板（数字会变）。
- ③ 表现与验收：三处一致；见 H01 ③。

### 3. R7b-M01 · 中等 · 母本卡动作按钮 12px 高

- ① 现状 / 影响 / 触发：`MotherView.tsx:567、578` 的 `min-h-3`，触屏难以点中。
- ② 方案：提到 28px 或挪到卡外。
- ③ 表现与验收：375 截图 + 按钮高度 ≥28px。

## 六、范围外备注

- `R7b-H03` 为基线前既有问题（`8b97e48` 已存在），不影响本批 PR 的判定，但建议随本批顺手修。
- 简报第 5 条「2095137 家园蛋接蛋仓后的父母缺失 / 属性越界兜底」：该链路在 `src/ui/plan/homeEggAdapter.ts`（+193）、`src/shared/eggWorkflow.ts`（+86 −），不在本批 10 个文件内，本批未复核，建议归到换蛋 / 收集计划批次补审。
- 家园页由"全部账号平铺 + 账号筛选"改成"一次一个账号 + 页头切换"是产品口径变化（Home.tsx:392-441、493-499），测试已固化（Home.test.tsx:258-285），本批不按缺陷计。
- `HomeDemandPlacements.test.tsx` 只覆盖"勾选写本机 / 勾选调 place / 撤回重发不继承勾选"，没有任何"取消勾选"的断言，这也是 F-4 长期漏网的原因（只记录，不改测试）。
- 母本 / 家园的卡片尺寸、`PetCardLayout` 两档高度问题属 R7a（M01），本批不重复计。

## 七、待裁决清单

## src/ui/MotherCriteriaMedals.tsx:81-95 母本达标档位以哪一份为准（母本页奖牌 vs 看板目标档位）
- 现状：

```ts
if (criteria.grades !== undefined) {
  return [criteria.grades[0] ?? DEFAULT_GRADE];
}
const matched = GRADES.filter(...);
return [matched[0] ?? DEFAULT_GRADE];
```
- 疑点：显示永远有一个选中档，判定却按体型 + 声音四档走；而看板又优先用覆盖度目标档位（Dashboard.tsx:58），同一只母本可能在两页得到不同结论。
- 我的倾向：先把两页口径合并成一份（建议统一认 `motherCriteria.grades`），再处理显示；置信度中高。
- 要裁决的：母本达标档位以哪一份为准——母本页的奖牌选择，还是看板 / 覆盖度的目标档位？

## src/ui/HomeDemandPlacements.tsx:331-336 取消「已上窝」要不要新增服务端撤回接口
- 现状：

```ts
setMarks(togglePlacementMark(accountId, rowKey, next));
if (!next) return;
```
- 疑点：撤回只能改本机，发布方永远看到已上窝；若加接口，涉及 workflow 状态机与线上数据。
- 我的倾向：需要新增 `unplace` 动作（承接 11-08 F-4），但必须先确认服务端状态机允许回退；置信度中。
- 要裁决的：本轮是否发版前补 `unplace`，还是先改成"不可撤回"文案？

## src/ui/Home.tsx:392-441 家园页一次只展示一个账号是否已定稿
- 现状：

```tsx
{view === 'nests' && loaded && activeAccount ? (
  <section className="relative min-w-0 flex-1" data-testid="home-account-switcher">
```
- 疑点：旧版平铺全部账号、上方带账号筛选；新版把多号对比变成逐个切换，Home.test 已按新版固化。
- 我的倾向：按新口径保留，但需要确认这是 11-18 的定稿而非顺手改；置信度中。
- 要裁决的：多账号用户是否接受"一次只看一个家园"（还是保留全部平铺 + 切换）？
