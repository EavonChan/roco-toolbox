# R3b · 需求中心模型与旧计划中心下线

> 审查基线 `894de06`，范围 `779b08c..894de06`，**行号以 `894de06` 为准**。
> 只读审查，未改任何代码；工作区未提交的原型/截图不计入。
> 已执行：`npx tsc -b`（通过，0 错误）、`npx vitest run src/ui/plan`（12 文件 / 63 用例全过）。

## 一、先给结论：删除本身是干净的

被删模块（`GroupSquareView` / `MyCollectionView` / `PlanCard` / `PlanDetailSheet` / `planCardModel` / `useCollectionPlans` / `planCard.css`）在 `src`、`e2e`、`scripts`、`functions` 内**已无任何 import 或动态 import 残留**；
`planCard.css` 的 `.pc-steps / .pc-step` 类名在 `src` 内也无引用，`index.css` 没有 `@import` 它；
`planAlertsStore` 删掉的 `readPlanAlertSeen / savePlanAlertSeen / planAlertCounts` 与 `roco.planAlertsSeen:*` 键同样零引用。
`GroupPlanHub.tsx` 与 `planAlertsStore.ts` 不是删除而是**收成薄壳**（前者只剩一行转 `EggMatchingHub`），所以「删除导致构建失败/运行期崩溃」这一类问题**未发现**。

问题集中在下线后的**残留语义**：家蛋推算的边界、旧界面文案与类型。

---

## R3b-M01 · 中风险 · 家园里明明还有蛋，蛋仓里那颗却会自己消失

**① 问题描述**
- **现状**：完整家园抓包里只要有蛋「算不出母本或物种」（母本已换窝/离窝、住户数据缺、该母本不在背包也没 confId 映射），适配器就把蛋跳过、只把计数 `unresolvedCount` 加一，但返回的 `complete` 仍按 `snapshotKind !== 'delta'` 判成「完整」。
- **用户影响**：蛋仓里这颗家蛋被当成「已经取走」删掉（服务端也会把它标 `missingFromCapture` 并从库存过滤），原本「已挂出」的挂出状态一并丢失；用户只看到蛋仓少一颗，没有任何提示，要等下一次能算出来的抓包才会重新出现。
- **触发条件**：一次非 delta 的家园抓包里存在至少一颗算不出母本/物种的地面蛋（`homeEggAdapter.ts:143-146` 跳过，`:188` 仍给 `complete: true`；背包侧同类情况明确不删——`src/domain/eggInventory.ts:52` 用 `complete && unresolvedCount === 0`；服务端删除逻辑见 `src/shared/eggWorkflow.ts:218-222`）。

**② 优化方案**
把家蛋的完整性判成「`snapshotKind !== 'delta'` **且** `unresolvedCount === 0 && ambiguousCount === 0`」，与背包侧 `eggInventory` 的口径对齐；被跳过的那颗蛋同时把 `unresolvedCount` 透出到 `EggMatchingHub` 的同步提示里（现在这个计数算出来没人用）。代价很小，只改 `homeEggAdapter` 一个返回值与一处调用点。

**③ 优化后表现**
- **解决**：家蛋推算失败时蛋仓保持原样，不会「凭空少一颗」。
- **验收**：`npx vitest run src/ui/plan/homeEggAdapter.test.ts`，补一条「母本不可解析时 `complete` 必须为 false」的用例；手工路径：蛋仓里有一顆家蛋 → 让母本离开该窝后重新抓包 → 蛋仓仍是这颗蛋。

---

## R3b-M02 · 中风险 · 还长在地家园里的蛋，能被当成「我能提供」的现蛋发起换蛋

**① 问题描述**
- **现状**：换蛋广场判断「我能给蛋」的供给索引 `myEggs` 只过滤 `status !== 'transferred' && canCirculateEgg`，不看蛋在哪；而家园蛋永远 `listed=false`、状态仍是 `available`，因此在「我能提供」里照样出现，并被允许「选这颗」发起换蛋。
- **用户影响**：同一颗蛋，蛋仓详情写着「在地家园，收进背包后才能挂出」，广场上却显示「我能给蛋」并能直接发起；对方接受后这条任务实际给不出去，双方都得手工收尾。
- **触发条件**：`state.eggs` 里有 `location === 'home'` 的蛋时查看自己能接的需求（`EggMatchingHub.tsx:158` 的 `myEggs` → `:161-162` 的 `supplyOf` → `:206` 的 `supplyEggs`；服务端只校验 `status === 'available'`，不校验位置：`src/shared/eggWorkflow.ts:292-293`；同模块相反口径：`EggStockPanel.tsx:57`）。

**② 优化方案**
把 `myEggs`（以及 `peerEggs`）的过滤条件补上 `(e.location ?? 'bag') === 'bag'`，让「现蛋」只来自背包；家园蛋仍然只通过「产线（推荐配窝）」参与换蛋。改动 1~2 行，不影响已有的现蛋匹配。

**③ 优化后表现**
- **解决**：用户只会看到自己真能马上交出去的蛋。
- **验收**：`npx vitest run src/ui/plan/EggMatchingHub.test.tsx`，补一条「家园蛋不出现在『我能提供』且 `supplyOf` 不返回 `give`」；手工路径：家园放一颗蛋 → 组内广场的需求卡不再显示「我能给蛋」。

---

## R3b-M03 · 中风险 · 普通窝「60% 遗传」的蛋被当成确定性格展示并参与匹配

**① 问题描述**
- **现状**：普通窝双亲同性格时，适配器直接把母本性格写成蛋的性格，并给 `confidence/labelSource = 'system'`；只有「推不出」时才是空串。
- **用户影响**：这颗蛋实际只有 60% 是该性格，界面（蛋卡、蛋详情）却按确定值展示，「可能性格」提示只在性格为空时才出现；更实际的影响是配需求时按该性格命中，对方照此接单约有 40% 落空。
- **触发条件**：普通窝、父母性格相同（`homeEggAdapter.ts:151-153` 的 60% 分支 → `:178-179` 的 `confidence: 'system'`；`EggStockPanel.tsx:66` 只在 `!egg.nature` 时才显示「可能性格」；领域口径见 `docs/domain/数据字段说明.md:68-70`）。

**② 优化方案**
A：普通窝同性格分支不再落值，性格留空，由详情的「可能性格（各 30%）」承接（与绿窝 100% 区分最干净）；B：保留落值，但把该蛋的 `labelSource` 标成「推算 / 60%」并在卡面和详情加「60%」角标，且需求匹配只按「可能性格」集合比。推荐 B（信息不丢，但要动一处 UI 角标），A 更省事。

**③ 优化后表现**
- **解决**：用户不会再把这颗蛋当成「性格已确定」，接单人也不会按 100% 预期接单。
- **验收**：`npx vitest run src/ui/plan/homeEggAdapter.test.ts`，把现有「same-nature parents give a 60% nature」用例改为断言标记为 60% 或性格留空；手工路径：普通窝两只同性格 → 蛋仓卡片上能看出这是 60%。

---

## R3b-L01 · 低风险 · 小组页引导第 3 段还在讲已经删掉的「我缺的 / 需求中心 / 共同寻找」

**① 问题描述**
- **现状**：引导文案仍是「『我缺的』发需求，『需求中心』接别人的单，『共同寻找』一起认领缺口」，锚点 `group-demands` 只存在于 `MotherGroupResources.tsx:2483`，而新的 `GroupPlanHub` 已不再挂载它。
- **用户影响**：新手走到这一段时，聚光框找不到位置、退化成居中说明卡，讲的是页面上已经不存在的三个视图（现在只有「我的收集 / 组内广场」）。
- **触发条件**：首次进入小组页触发分段引导（`src/ui/tour.ts:165-170`；`GroupPlanHub.tsx:4-5` 已改为只渲染 `EggMatchingHub`；`TourOverlay` 找不到锚点时按居中卡降级，不会卡住）。

**② 优化方案**
把这一段改成新口径（我的收集 / 组内广场 / 我的换蛋），锚点换成 `EggMatchingHub` 现有元素（如 `data-testid="egg-matching-hub"` 外的 tab 区）并补 `data-tour`；若这段暂不上线，直接删掉该 step 更省事。文案口径需与 `docs/产品交互规范.md` 同步（该文档 261 行仍写着三视图）。

**③ 优化后表现**
- **解决**：引导讲的就是用户眼前这一屏。
- **验收**：清空引导已读记录后进小组页，第 3 段框在真实元素上；`npx vitest run src/ui/TourOverlay.test.tsx`。

---

## R3b-L02 · 低风险 · 蛋仓模型里两个导出只有测试在用

**① 问题描述**
- **现状**：`setEggListed` 与 `sortEggStock` 在生产代码里没有任何调用，只有 `eggStockModel.test.ts` 引用；实际挂出走服务端 `{type:'list'}`，排序由 `EggStockPanel` 自己 `sort` 一遍。
- **用户影响**：无直接现象，但这意味着模型层「挂出校验 / 特殊蛋后置」的规则没有被真正接线，读代码的人会以为已经在用。
- **触发条件**：全局检索确认（`eggStockModel.ts:113`、`:122`）。

**② 优化方案**
二选一：删掉这两个导出连同对应用例；或让 `EggStockPanel` 改用 `sortEggStock`、挂出前用 `setEggListed` 做本地预校验。建议先删，等真需要本地态时再加。

**③ 优化后表现**
- **解决**：模型层不留「看起来在用、其实没人调」的规则。
- **验收**：`npx tsc -b` + `npx vitest run src/ui/plan` 仍全绿。

---

## R3b-L03 · 低风险 · 红点相关注释还在写「新提供 + 本机已读水位」

**① 问题描述**
- **现状**：`usePlanBadge` 的注释写「算『待我确认 + 新提供』…进小组页后由 `GroupPlanHub` 接管实时计数与已读水位」，`TabNav` 也写「= 待我确认 + 新提供（本机已读水位）」，但本轮已把已读水位整段删掉，现在只是「可操作的换蛋任务数」。
- **用户影响**：暂时没有可见异常，但下次有人按注释去调「进组清零」会找不到实现。
- **触发条件**：注释与 `planAlertsStore.ts` 现状不符（`usePlanBadge.ts:15`、`TabNav.tsx:27`）。

**② 优化方案**
两处注释改成「小组页签数字 = 当前组里需要我处理的换蛋任务数，进入组页不会清零，任务处理完自然归零」。

**③ 优化后表现**
- **解决**：注释与实现一致。
- **验收**：读代码即可，无需运行。

---

## R3b-L04 · 低风险 · 旧「计划」状态还留在导航类型里，但没有任何页面消费它

**① 问题描述**
- **现状**：`CollectionLocation` 仍保留 `status: 'plan'`，`tour.ts` 的同款联合类型也保留，`MotherView` 接收 `status` 后只处理 `missing / collected`，`'plan'` 分支不存在。
- **用户影响**：不存在可达入口，属隐藏死类型；但任何按 `status === 'plan'` 写的旧链接或后续代码会静默落到「未筛选」。
- **触发条件**：类型定义处（`navigation.ts:16`、`tour.ts:32`、`MotherView.tsx:43` 与 `:230-232`）。

**② 优化方案**
把 `'plan'` 从两处联合类型里删掉（`MotherView` 的 prop 类型随之收窄），并确认没有调用方传 `'plan'`（当前只有 `navigation.test.ts` 一条断言在用它，需要同步改）。

**③ 优化后表现**
- **解决**：导航合同与新界面一致，不残留已下线状态。
- **验收**：`npx tsc -b` + `npx vitest run src/ui/navigation.test.ts`。

---

## R3b-L05 · 低风险 · 家蛋适配器里的几处小瑕疵

**① 问题描述**
- **现状**：(a) `homeStockFromSnapshot(snapshot, _accountId?)` 第二个参数从未使用，调用方却认真传了 `me`；(b) 母本兜底 `if (!mother && couple) mother = …` 与上面三元里的同一分支重复写了两遍；(c) `capturedAt` 用 `Date.parse(home.capturedAt) || …` 判空，时间戳恰好为 0 时会误落到导出时间；(d) 有一条用例名写「unknown residents are counted and skipped」，断言的却是「照样出 1 颗蛋」。
- **用户影响**：无可见影响，属可读性与可维护性。
- **触发条件**：`homeEggAdapter.ts:130 / :107-111 / :133`、`homeEggAdapter.test.ts:89`。

**② 优化方案**
删掉未用参数（或改成真正按账号过滤家蛋）；合并重复的母本兜底；把 `||` 改成「先判 `Number.isFinite` 再兜底」；用例名与断言对齐。

**③ 优化后表现**
- **解决**：后来人不需要猜测参数与用例在表达什么。
- **验收**：`npx vitest run src/ui/plan/homeEggAdapter.test.ts`。

---

## R3b-U01 · 不确定（置信度中） · 家园蛋一律按「普通蛋 / 自产」入库

**① 问题描述**
- **现状**：家蛋固定写 `kind: 'ordinary'`、`provenance: 'self-bred'`，不读任何异色/特殊信号。
- **用户影响**：如果家园地面可能出现异色蛋或特殊蛋，它会被当成普通可交换蛋（`canCirculateEgg` 只拦 `kind === 'shiny' | 'special'`），可能被挂出或换出去。
- **触发条件**：`homeEggAdapter.ts:177`、`:180`；当前抓包是否带得出家蛋的异色/特殊标记，静态无法确认。

**② 优化方案**：需要领域口径二选一——A「家园地面不会出现异色/特殊蛋，现状正确，补一条注释与测试断言」；B「会出现，按背包口径从抓包字段判 kind」。**需要 `rock-kingdom-breeding-planner` 领域文档持有人 + 产品确认。**

**③ 优化后表现**
- **解决**：家蛋的稀有度不会被误判。
- **验收**：确认后补一条 `homeEggAdapter.test.ts` 用例，说明依据哪份领域文档。

---

## R3b-U02 · 不确定（置信度中） · 这次大改没有 changelog 条目

**① 问题描述**
- **现状**：`src/data/changelog.json` 最新条目是 `2026-11-17a`，本轮「旧计划中心下线 + 换蛋中心上线」没有任何条目。
- **用户影响**：更新后用户看不到这次改了什么（尤其是小组页整块换掉、老计划去哪了）。
- **触发条件**：`src/data/changelog.json:2-10`（首条即 2026-11-17a）。

**② 优化方案**：确认发版前是否需要补一条面向用户的更新说明；若要补，口径按 `docs/发版与更新规范.md`，只写用户能看到的变化。**需要产品/发版负责人拍板。**

**③ 优化后表现**
- **解决**：用户升级后能看到本次变更说明。
- **验收**：打开 changelog 弹层能看到新条目。

---

## 统计

| 级别 | 数量 | 编号 |
| --- | --- | --- |
| 高 | 0 | — |
| 中 | 3 | M01、M02、M03 |
| 低 | 5 | L01、L02、L03、L04、L05 |
| 不确定 | 2 | U01、U02 |
| **合计** | **10** | |

## 最该先修的 3 条

**R3b-M01 · 家园蛋算不出母本时会被从蛋仓删掉**
① 现状：完整家抓包里一颗算不出母本的蛋不写进快照，`complete` 仍为 true；用户影响：蛋仓少一颗且挂出状态丢失；触发：母本离窝/物种映射缺失时重新抓包。② 方案：`complete` 与背包侧对齐为「非 delta 且无未解析/歧义」。③ 表现：推算失败时蛋仓不变；验收补 `homeEggAdapter.test.ts` 用例。

**R3b-M02 · 地家园里的蛋被当成「我能提供」**
① 现状：供给索引不看 `location`，家蛋可被「选这颗」发起换蛋；用户影响：发起后对方拿不到蛋；触发：自己有家蛋时看组内广场。② 方案：`myEggs/peerEggs` 只取 `bag`。③ 表现：指「我能给蛋」的只剩背包里真能给的蛋；验收 `EggMatchingHub.test.tsx`。

**R3b-M03 · 60% 遗传的性格被当成确定值**
① 现状：普通窝同性格直接落值并标 `system`；用户影响：接单人按 100% 预期接单，约 40% 落空；触发：普通窝双亲同性格。② 方案：留空或标 60% 并只在「可能性格」里提示。③ 表现：用户能看出这是概率而非确定；验收 `homeEggAdapter.test.ts`。

## 范围外备注（只记录，不展开）

1. `MotherSharing.tsx` + `MotherGroupResources.tsx`（合计约 4.5k 行：4203 + 269）在本轮之前就没有任何页面挂载，只剩各自的测试；本轮又让 `MotherGroupResources` 失去了最后一个挂载点（旧 `GroupPlanHub`），属既有死代码被进一步孤立，不按本轮问题计。
2. `EggMatchingHub.tsx` 的「同步/共享范围」归 R3a：它把 `snapshots` 里**所有**本机账号的蛋都 `stock-sync` 到小组，而 `docs/产品交互规范.md` 允许用户只共享部分账号；是否越权共享需 R3a 与后端一起确认。
3. `GroupPlanHubProps` 仍 extends `MotherGroupResourcesProps`，`CollectionGroups` 继续传 `tasks / demands / onPublishDemand …` 等十余个已无人消费的 props，属死 props，与 R9b（`DemandPublishSheet` 等删减）一并收口更合适。
4. `e2e/mother-sharing.spec.ts` 访问的 `MotherSharing` 页面同样早已没有路由入口，若该 spec 仍在跑，失败原因不在本轮，归 R9c。
5. 本轮 `eggTime` 只做「获得时间/最后确认」格式化（无倒计时、无到期文案），简报第 4 点里的「倒计时/后台恢复负值」在本模块不成立；已核对非法值与空值均返回空串。
