# R7c 朋友 PR 剩余：建议 / 编辑 / 引导（只读审查）

- 审查基线：`8b97e48..081b604`（`081b604` = 精灵背包身高体重共用开关）。行号均以 `081b604` 为准；`tour.test.ts` 在基线上不存在（`85df1cd` 新增），按其当前内容审。
- 验证命令与结果（只读）：
  - `npx vitest run src/ui/SuggestionCard.test.tsx src/ui/tour.test.ts src/ui/CollectionTargetEditor.test.tsx` → 3 个文件 / 11 个用例全过。
  - `npx tsc -b` → 无输出，通过。
  - 未跑全量 vitest / Playwright / 打包（按纪律）。
- 工作区未提交的原型、截图、`docs/设计资产/registry.json` 未纳入审查。

## 一、本批文件覆盖与结论

| 文件 | 变更 | 是否读完 | 结论 |
| --- | --- | --- | --- |
| src/ui/SuggestionCard.tsx | +96 −116 | 是 | 分组/去重/折叠排序逻辑正确；无高、中风险；L03 |
| src/ui/SuggestionCard.test.tsx | +57 −7 | 是 | 断言与新交互一致；但 e2e 未跟着改（M01） |
| src/ui/suggestionCardStore.ts | +18 −14 | 是 | 迁移不丢 `doneAt`/`doneOpen`；L02 |
| src/ui/NatureSelectionContent.tsx | +191 | 是 | 全库 0 引用（L01） |
| src/ui/TargetGradeSelector.tsx | +76 | 是 | 单选渲染正确；L05 |
| src/ui/CollectionTargetEditor.tsx | +18 −127 | 是 | studs 入口完整；mothers 分支无生产入口（已在 R7b-L04 记录，不重复计数） |
| src/ui/CollectionTargetEditor.test.tsx | +48 −17 | 是 | 6 个用例中 4 个跑的是 mothers 死分支（同 R7b-L04） |
| src/ui/tour.ts | 区间内 +2 −2 | 是 | 19 个锚点全部存在；L04 |
| src/ui/tour.test.ts | +14（`85df1cd` 新增） | 是 | 被测函数无调用点（M02） |
| src/ui/useCollectionSummary.ts | +2 | 是 | `grades`/`targetMode` 与 MotherView 的 `effectiveCriteria` 同口径，无问题 |

引用核对（0 残留/有残留都已列明）：
- `SuggestionCard` 全库唯一调用方 `src/ui/Dashboard.tsx:318`，`title`/`onOpenSwap` 删除后无残留传参。
- `NatureSelectionContent` / `groupNatureOptions` / `NatureSelectionGroups`：0 处 import（`git grep` 全仓，仅自身文件命中）。
- 被删除的 testid `recommend-item-check` / `recommend-quantity-*`：`src/` 内 0 残留，`e2e/` 有 2 处残留（M01）。

## 二、问题清单

### R7c-M01 · 中风险 · 端到端用例还在点「勾选框 / 数量 3·15·全部」，按新建议卡跑必失败

① 问题描述：现状是种公推荐已从「复选框列表」改为「四列卡片 + 点卡片移入已换到」，`recommend-item-check`、`recommend-quantity-3/15/all`、`已换到 N 条`、`line-through` 都不再产出；用户影响是目前没有任何可见影响，但这两条 e2e 一旦在发版前跑起来就会红，等于把端到端门禁作废；触发条件是执行 `npx playwright test e2e/dashboard.spec.ts e2e/product-refactor.spec.ts`（e2e/dashboard.spec.ts:96,97,102,104,107-109 点旧 testid、断言「已换到 1 条」与删除线；e2e/product-refactor.spec.ts:24 点已删除的 `recommend-quantity-all`；对应新实现 src/ui/SuggestionCard.tsx:96-121、130-158 只输出 `recommend-item` / `recommend-done-toggle`）。

② 优化方案：把 `e2e/dashboard.spec.ts:87-110` 改写成点卡片本身（不再找 checkbox）、断言 `已换到 1 只`、断言卡片 `aria-pressed="true"`；`e2e/product-refactor.spec.ts:12-30` 的「点全部跳种公阵列」前提已随 `onOpenSwap` 一起删除，建议改成从「收集 → 种公」页签进入。代价：两个文件约 30 行改动，只影响测试资产，不动产品代码。注意这两个 e2e 文件在 R9-6 的清单内，改动建议由 R9-6 一并落地，本批只登记。

③ 优化后表现：解决「端到端只验证旧交互」的假绿。验收：`npx playwright test e2e/dashboard.spec.ts e2e/product-refactor.spec.ts` 全过；且把 SuggestionCard 改回 checkbox 时应立刻变红。

### R7c-M02 · 中风险 · 新加的测试说「测试站不自动弹引导」，但应用里没人调用这个判断，测试站照样弹

① 问题描述：现状是 `tourSuppressed()` 只在测试里被引用，`App.tsx` 的首启与切页签自动弹逻辑完全没有调用它；用户影响是自己验收用的 test / internal 站每进一个页签就弹一次引导卡（2026-11-09 口径是只关自动弹、保留顶部「教程」）；触发条件是 `tour.test.ts` 通过但真机在 `test.roco-toolbox.pages.dev` 打开应用（src/ui/tour.ts:253-262 定义并被 src/ui/tour.test.ts:1-13 覆盖，src/App.tsx:107-134 三处自动弹入口均无 `tourSuppressed`；`git grep Suppressed` 全仓仅命中 tour.ts 与 tour.test.ts）。

② 优化方案：A（推荐）在 `App.tsx` 恢复三处调用——初始 `tour` 取 `tourSuppressed() ? null : startTourPending() ? 'start' : null`、切页签 effect 里 `if (tourSuppressed()) return;`、`changelog` 初始化保持「引导让路」判断；B 若产品已不再需要该策略，就删除 `tourSuppressed` 与 `tour.test.ts`，避免测试继续装作功能存在。改动 <10 行，风险低；但 App.tsx 属 R10 清单，落地时与 R10 协调一次。

③ 优化后表现：解决「测试通过但功能没接线」。验收：把 hostname 模拟成 `test.roco-toolbox.pages.dev` 打开应用，首启与首次进各页签都不自动弹，点顶部「教程」仍能手动重播；正式域名与 localhost 行为不变。

### R7c-L01 · 低风险 · 新增的 191 行性格筛选组件没有任何页面在用，背包页还留着同一套逻辑的副本

① 问题描述：现状是 `NatureSelectionContent.tsx` 的组件与分组函数全库 0 引用，而 `MyPets.tsx:65-90` 仍在使用一份结构几乎相同的 `groupNatureTags`（连 `NATURE_STAT_ORDER` 都各写一份）；用户影响是无（未打包进渲染路径，被 tree-shaking 掉），但下次改性格分组要改两处，容易改漏；触发条件是后续维护（src/ui/NatureSelectionContent.tsx:13-43,45-191 无 import；src/ui/MyPets.tsx:62-90、79-82 重复定义）。

② 优化方案：二选一——A 让 `MyPets` 改用 `groupNatureOptions` + `NatureSelectionContent`，删掉本地副本（需按 R6a 已审的背包筛选行为回归一次）；B 若这次不打算重构背包，直接删除该文件，等真要抽公共组件时再加。推荐 B（本批目标是发版，不在发版前做背包重构）。

③ 优化后表现：解决「同名逻辑两份、新文件没人用」。验收：方案 B 后 `npx tsc -b` 与 `npx vitest run src/ui/MyPets.test.tsx` 通过，`git grep NatureSelection` 为 0。

### R7c-L02 · 低风险 · 单条「已换到」的切换函数已没有生产调用方，只剩一个测试在点它

① 问题描述：现状是 `toggleSuggestionDone` 改版后没人调用（卡片改走 `setSuggestionGroupDone` 批量），只有 `resetImportedData.test.ts` 还在用它造状态；用户影响无；触发条件是后续有人以为它仍被 UI 使用而改坏（src/ui/suggestionCardStore.ts:37-44；调用点仅 src/ui/resetImportedData.test.ts:10,18）。

② 优化方案：把 `resetImportedData.test.ts` 改用 `setSuggestionGroupDone(['rec-1'], true)`，然后删除 `toggleSuggestionDone`。约 8 行改动，无行为变化。

③ 优化后表现：解决死导出。验收：`npx vitest run src/ui/resetImportedData.test.ts src/ui/SuggestionCard.test.tsx` 通过。

### R7c-L03 · 低风险 · 「已换到」记录只增不减，换过目标档位后旧键永久留在本机

① 问题描述：现状是 `doneAt` 以推荐 id 为键，而 id 含 `gameId|性格|档位|补位蛋组`，档位/蛋组一变旧键就再也不会被任何卡片引用，也没有任何清理；用户影响是长期使用后本机存储里堆一批永远用不到的键（体量很小，不会影响功能）；触发条件是改目标档位（现在档位改单选后更容易发生）（src/domain/suggestions.ts:51 生成 id；src/ui/suggestionCardStore.ts:47-58 只增删当前传入 id；src/ui/SuggestionCard.tsx:67-85 只按当前 items 过滤，从不回写清理）。

② 优化方案：在 `setSuggestionGroupDone` / 新加的一个 `pruneSuggestionDone(validIds)` 里，把 `items` 中不存在的键删掉，由 `SuggestionCard` 在 items 变化时调用一次（或只在 `clearSuggestionCard` 之外加一个显式「目标变了」重置）。推荐前者，改动 <15 行。

③ 优化后表现：解决无界增长。验收：把目标档位从大婉切到小婉再切回，`localStorage['roco.suggestionCard']` 的 `doneAt` 只保留当前推荐能对上的键；`npx vitest run src/ui/SuggestionCard.test.tsx` 通过。

### R7c-L04 · 低风险 · 看板那一步引导的标题和正文都重写了，但引导版本号没升，老用户看不到新说法

① 问题描述：现状是 `dashboard` 分段第一步从「先定目标档位」改成「先定种公目标」，正文改成「四种组合选一项…」，而 `TOUR_VERSION` 仍是 `'3'`；用户影响是已看过 v3 引导的老用户不会再看到这段新说明，仍按旧「模式 + 档位」理解新界面；触发条件是老身份打开看板（src/ui/tour.ts:17-18 版本注释要求「改任一分段的步骤时 +1」；src/ui/tour.ts:92-99 已改文案）。

② 优化方案：若这段属于要重新告知用户的改动，把 `TOUR_VERSION` 升到 `'4'`（会让所有分段各再弹一次，e2e/tour.spec.ts 已按该常量预置已读，不需改）；若只当作措辞微调，则保持不动，但请在报告外同步一句口径，避免以后有人把它当漏改。

③ 优化后表现：解决「改了文案但没人看到」。验收：升版后用老身份打开看板，应再弹一次该段；`npx vitest run src/ui/tour.test.ts` 与 `npx playwright test e2e/tour.spec.ts` 通过。

### R7c-L05 · 低风险（建议级）· 目标组合少一张奖牌图就直接抛错，看板又没有错误边界，会整页白屏

① 问题描述：现状是 `TargetGradeSelector` 在图标映射缺失时 `throw new Error`，而看板 / 覆盖度都没有错误边界（只有附近页有）；用户影响是映射一旦与档位对不上，整站看板直接白屏而不是少一张图；触发条件是领域常量或图标表被改动后不一致（实际当前四档 × 两模式全部有图，属防御性风险）（src/ui/TargetGradeSelector.tsx:38-42；src/App.tsx:259 的错误边界只包附近页）。

② 优化方案：把 `throw` 改成「缺图就不渲染该 `<img>`（或用占位文字）」，与 `src/domain/petIcons.ts:8-12` 既有「查不到返回 null」的写法保持一致。约 5 行改动。

③ 优化后表现：解决「数据小缺口引发白屏」。验收：临时把某档图标映射改成返回 null，看板仍能渲染并保留文字档位；恢复后 `npx vitest run src/ui/Dashboard.test.tsx src/ui/Coverage.test.tsx src/ui/MotherCriteriaMedals.test.tsx` 通过。

## 三、统计

| 级别 | 数量 | 编号 |
| --- | --- | --- |
| 高 | 0 | — |
| 中 | 2 | R7c-M01、R7c-M02 |
| 低 | 5 | R7c-L01 ~ L05 |
| 不确定 | 0 | — |

已确认无问题的检查点（供复核）：建议卡按 `gameId` 合并、组内性格/蛋组去重、已换到按完成时间倒序（先完成沉底）、空态沿用页面给的 `emptyNote` 且不再出现页内标题；`suggestionCardStore` 迁移丢弃已废弃的 `quantity` 但不丢 `doneAt`/`doneOpen`；`CollectionTargetEditor` 删掉的目标模式与档位已在看板（`TargetGradeSelector` + 模式切换）与母本页（`MotherCriteriaMedals`）各有入口；`useCollectionSummary` 新增的 `grades`/`targetMode` 与 `MotherView.tsx:254-260` 传参一致。

## 四、最该先修（1~3 条）

### 1. R7c-M02 · 中风险 · 测试站仍会自动弹引导，「不自动弹」只在测试里成立

① 问题描述：`tourSuppressed()` 无调用点，`tour.test.ts` 通过但功能未接线（src/ui/tour.ts:259、src/App.tsx:107-134）。

② 优化方案：按 A 方案在 `App.tsx` 恢复三处调用；与 R10 协调（App.tsx 在其清单）。

③ 优化后表现：测试站不再自动弹、正式站不受影响。验收：hostname 为 `test.…` 时首启/切页签静默，`教程` 仍可手动重播。

### 2. R7c-M01 · 中风险 · 两条端到端用例还在点已被删除的勾选框与数量按钮

① 问题描述：`e2e/dashboard.spec.ts:87-110`、`e2e/product-refactor.spec.ts:12-30` 与新的建议卡不匹配，按现状必失败（src/ui/SuggestionCard.tsx:96-121）。

② 优化方案：改写为点卡片 + 断言 `已换到 N 只` 与 `aria-pressed`；「点全部」用例改为从收集 · 种公进入。交 R9-6 一并落地。

③ 优化后表现：端到端恢复有效。验收：`npx playwright test e2e/dashboard.spec.ts e2e/product-refactor.spec.ts` 全过。

### 3. R7c-L01 · 低风险 · 新加的 191 行性格筛选组件没人用，背包页还留副本

① 问题描述：`NatureSelectionContent.tsx` 全库 0 引用，`MyPets.tsx:62-90` 自有同一套分组逻辑。

② 优化方案：本批发版前直接删该文件（B 方案），重构留到后面。

③ 优化后表现：少一处重复逻辑。验收：`npx tsc -b` + `npx vitest run src/ui/MyPets.test.tsx` 通过。

## 五、范围外备注

- 母本默认达标条件是「任意四档」，而新界面只高亮「大婉」——已在 **R7b-H01** 记录，本批不重复计数；相关文件 `MotherCriteriaMedals.tsx` 属 R7b 清单。
- `CollectionTargetEditor` 的 mothers 分支没有任何生产入口（`Coverage.tsx:328` 只传 `section="studs"`，母本条件已内联到 `MotherView.tsx:406`）——已在 **R7b-L04** 记录，本批只作交叉引用。
- `src/ui/App.tsx`、`e2e/dashboard.spec.ts` 属 R10 / R9-6 清单；本批仅从「R7c 改动的后果」角度登记 M01、M02 的修复建议。
- `2026-11-17/pc-package/work/repo/**` 是历史快照目录，其中的同名文件未纳入审查。
- 已确认 19 个 `data-tour` 锚点在当前代码中全部存在（含 `data-tour={`tab-${id}`}` 模板与 `guide-open`），不存在「指向已删除元素」的引导步骤。

## 六、待裁决清单

## src/App.tsx:107-134 测试站禁弹引导：恢复接线还是删掉函数与测试

- 现状：

```ts
const [tour, setTour] = useState<TourSegment | null>(() => {
  migrateLegacyTourSeen();
  return startTourPending() ? 'start' : null;
});
```

- 疑点：`tourSuppressed()` 定义在 `src/ui/tour.ts:259` 且被新测试覆盖，但 App 三处自动弹入口都没有调用它；究竟是「接线被误删」还是「策略已废弃、忘了删代码」。
- 我的倾向：误删（`tour.ts:253-258` 仍写着 2026-11-09 用户口径），应恢复接线；置信度 0.8。
- 要裁决的：是否恢复接线（是 / 否，直接删函数与测试 / 还有第三种：只在首启禁弹、页签仍弹）？

## src/ui/Dashboard.tsx:204-211 与 src/ui/MotherCriteriaMedals.tsx:50-55 同一组奖牌，点已选中的结果不同

- 现状：

```tsx
onSelect={(grade) => setTargetGrade(selectedGrade === grade ? null : grade)}   // 看板：点已选 = 清空
// 母本页：if (selected.length === 1 && selected[0] === grade) return;        // 点已选 = 不变
```

- 疑点：同一个四宫格组件，看板点已选组合会变成「未设目标」（并弹出琥珀色提示），母本页点已选什么都不发生；用户按同一手感操作会得到相反结果。
- 我的倾向：统一为「点已选不取消」（母本页口径），清空目标另给一个显式入口；置信度 0.6。
- 要裁决的：是否统一为「点已选不清空」（是 / 否，保留看板可清空 / 还有第三种：两处都可清空但加确认）？

## src/ui/tour.ts:17-18 看板段文案已改，TOUR_VERSION 是否要 +1

- 现状：

```ts
/** 引导版本：改任一分段的步骤时 +1（1 = 固定 15 步；2 = 按场景分段；3 = 首启改为「开始采集」） */
export const TOUR_VERSION = '3';
```

- 疑点：`dashboard` 首步标题/正文在本区间内重写（`先定目标档位` → `先定种公目标`），版本号未动，老用户不会重看；文件自述规则是「改任一分段步骤时 +1」。
- 我的倾向：这次是口径变更（档位改单选）的配套说明，建议 +1；置信度 0.7。
- 要裁决的：是否把 `TOUR_VERSION` 升到 `'4'`（是 / 否，只算措辞微调 / 还有第三种：只对看板段单独升版）？
