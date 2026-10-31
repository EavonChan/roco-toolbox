# R2 代码审查：计划与批次（2026-11-01）

> 第二轮审查。承接 [2026-10-29 那一轮](2026-10-29-审查计划与批次.md)，**不重审已修部分，只审差异面**。
> 流程依据：[REVIEW-PLAYBOOK.md](../REVIEW-PLAYBOOK.md) §11「增量审查」。

---

## 1. 事实

| 项 | 值 |
| --- | --- |
| 当前 HEAD | `15f004a chore: R2 审查前基线快照（代码与文档，内容未改动）` |
| 上一轮收口点 | `a2e9ed0`（B5/B6/B7 修复的部署记录） |
| R2 范围 | `a2e9ed0` → `15f004a`，**102 文件，+7,655 / −2,653**（含 3 份审查文档，代码约 +6,700 / −2,600） |
| 基线快照 | `15f004a`。工作区仅剩 `.shots/` 与 6 个临时 HTML/JSON 稿，**不纳入审查** |
| 基线验证 | `tsc -b` 0；`tsc -p functions` 0；`vitest run` **110 文件 / 913 用例全通过**；`test:data-pipeline` **6 文件 / 47 用例全通过** |

19e87e0 新增的关键文件：`src/domain/demandPlacement.ts`(+519)、`src/ui/HomeDemandPlacements.tsx`(+449)、
`src/ui/useClaimedDemands.ts`(+106)、`src/domain/studDemandCandidates.ts`(+84)、
`src/ui/demandPlacementStore.ts`、`demandPickStore.ts`、`demandCompletionReadStore.ts`。
删除的文件：`src/ui/GenderRatioSpecies.tsx`、`src/ui/Swap.tsx`、`src/ui/SwapWishCard.tsx`(+test)、`e2e/swap.spec.ts`。

---

## 2. 前置条件（✅ 已完成 2026-11-01）

1. 工作区 42 个已跟踪改动 + 4 个新代码文件（`TourOverlay.tsx`、`TourOverlay.test.tsx`、`tour.ts`、`e2e/tour.spec.ts`）已原样提交为 `15f004a`；`.shots/` 与 6 个临时 HTML/JSON 稿保留在工作区，不纳入审查。
2. **R2 总回滚点 = `15f004a`**。
3. 基线四件套已跑，全绿（见 §1）。因为基线全绿，之后任何新增失败都可直接归因于修复。

---

## 3. 上一轮的收口状态

| 批次 | 状态 | 说明 |
| --- | --- | --- |
| B1 / B2 | ✅ 全部修完 | 各 9 条；B1-L03 用户拍板不改，B1-U01 / B2-U01 被 M03 / H01 覆盖 |
| B3 | ⚠️ 修 5 / 剩 6 | 剩 M03、M04、L01~L04 |
| B4 | ⚠️ 修 2 / 剩 9 | 剩 M02、M03、L01~L06、U01、U02 |
| B5 | ⚠️ 修 3 / 剩 9 | 剩 M01(部分)、M02、U01、L01~L06 |
| B6 | ⚠️ 修 4 / 剩 7 | 剩 M04、M05、L01~L03、U01、M02 更深修复；另 changelog 缺「小组口径下线」说明 |
| B7 | ⚠️ 修 11 / 剩 2 | 剩 M01（紧凑卡昵称兜底）、U01（精灵库是否显示身高） |
| B8 | ❌ 未开始 | 且清单已被新提交改写，见 §4 |
| B9 | ⚠️ 修 3 / 剩 7 | 剩 L01~L05、U01、U02 |
| B10 | ❌ 未开始 | 移交 3 件：限流用例「1805 次未触发 429」复核、B9-M02 重复 key 复验、D1 外键开关实测 |

---

## 4. 旧项作废判定（`19e87e0` 是否改到该文件）

| 旧批 | 涉及文件 | 新提交是否改动 | 判定 |
| --- | --- | --- | --- |
| B5 全部剩余 | `MotherGroupResources.tsx` | ✅ **+1,382 行** | **作废**，进 R2-3 重看（行号与结论都不再成立） |
| B6-M04 | `useCollectionGroups.ts` | ✅ +76 | 需复核，进 R2-3 |
| B6-L01 / L03 | `listViewStore.ts`、`swapViewStore.ts` | ✅ | 需复核，进 R2-2 / R2-6 |
| B6-M05 | `useCollectionGroups.ts` 无单测 | ✅ 文件改了、仍无测试 | **仍有效**，进 R2-7 |
| B6 changelog 缺口 | `src/data/changelog.json` | ✅ +63 行 | 需复核是否已补「小组口径下线」 |
| B7-M01 | `PetCompactCard.tsx` | ✅ 改动（含测试） | 需复核（这批布局调整很可能已顺手改），进 R2-5 |
| B7-U01 | 精灵库是否显示身高 | ✅ `Collection.tsx` 改 103 行 | 需复核，进 R2-4 |
| B8 全部 | `Coverage.tsx`(−192 重写)、`DemandPublishSheet.tsx`、`StudMatrix.tsx`(+130)、`GenderRatioSpecies.tsx`(**已删**)、`SwapWishCard.tsx`(**已删**) | ✅ | **作废**，按新代码重审，拆进 R2-4 / R2-5 / R2-6 |
| B3 全部剩余 | `functions/_lib/collectionGroupsStore.ts`、`collectionGroupsValidation.ts` | ⚠️ 快照改了（+154/−69 等） | **需复核**，进 R2-7 逐条比对 |
| B4 全部剩余 | `functions/_lib/collectionGroups.ts`、`util.ts`、`router.ts`、`events.ts` | ⚠️ 快照全改了 | **需复核**，进 R2-7 |
| B9 全部剩余 | `src/api/collectionGroups.ts`、`motherGroups.ts`、`src/shared/**`、`src/pcap*` | ⚠️ `src/api` 两个文件被快照改过，`shared`/`pcap` 未改 | **需复核**，进 R2-7 |

**待拍板项重置**：B5-M02（结单后能否再发）、B5-U01（旧摘要口径）原先等业务口径，但 `MotherGroupResources` 已被重写，需在 R2-3 的新代码上重新提问，旧提问作废。

---

## 5. R2 批次

| 批次 | 主题 | 规模 | 核心文件 |
| --- | --- | --- | --- |
| **R2-1** | 域模型：上窝 / 种公候选 / 需求口径 | ≈1,600 | `domain/demandPlacement.ts`(+519)+测试(+352)；`studDemandCandidates.ts`(+84)+测试(+99)；`demandCriteria.ts`(+158/−38)+测试；`productionLines.ts`+测试；`petFilters.ts`(12)+测试；`petAvatar.ts`(2) |
| **R2-2** | 家园接单上窝与请求态 | ≈1,700 | `ui/HomeDemandPlacements.tsx`(+453)+测试(+286)；`ui/Home.tsx`；`useClaimedDemands.ts`(+106)；`demandPickStore` / `demandPlacementStore` / `demandCompletionReadStore`；`App.tsx`、`TabNav.tsx`、`navigation.ts`、`listViewStore.ts`、`AccountPanel.tsx`、`ImportPanel.tsx`、`resetImportedData.ts` |
| **R2-3** | 小组页改版 + 巨型组件 | ≈2,900 | `ui/MotherGroupResources.tsx`(+1,537/−424)+测试(+328/−61)★两轮读；`CollectionGroups.tsx`(+118/−181)；`MotherView.tsx`；`RecommendedNatureEditor.tsx`；`CollectionGroupSetup.tsx`；`MotherGroupMembers.tsx`；`useCollectionGroups.ts`(+138/−67)；`collectionGroupCache.ts`(+测试)；`collectionGroupStore.ts`(+测试) |
| **R2-4** | 覆盖度 / 筛选 / 精灵库 | ≈1,600 | `ui/Coverage.tsx`(+111/−83)；`CoverageFilterBar.tsx`；`CoverageIntroCard.tsx`；`coverageFilterStore.ts`；`myPetsFilterStore.ts`；`MyPets.tsx`(+83/−269)；`Collection.tsx`；`primitives/FilterPanel.tsx` |
| **R2-5** | 种公阵列 / 发需求 / 紧凑卡 | ≈900 | `ui/StudMatrix.tsx`(+130)+测试；`DemandPublishSheet.tsx`；`PetCompactCard.tsx`（含旧 B7-M01）；`GuideModal.tsx`；`Dashboard.tsx` |
| **R2-6** | 删除核对 + e2e 同步 | ≈900 | 删除：`GenderRatioSpecies.tsx`、`Swap.tsx`、`SwapWishCard.tsx`(+测试)、`e2e/swap.spec.ts`；`swapViewStore.ts`；`e2e/coverage|product-refactor|mother-sharing|refactor-fixes|changelog|guide.spec.ts`；`helpers/motherGroupsMock.ts`；`playwright.config.ts`、`tsconfig.e2e.json` |
| **R2-7** | 旧轮遗留复核（B3/B4/B9 + B6-M05） | 22 项 | 先逐条复核「仍成立 / 已被顺手修掉 / 已不适用」，再按实际剩余修；中风险优先 |
| **R2-9** | 新手引导（新增功能） | ≈800 | `ui/TourOverlay.tsx`(+218)+测试；`ui/tour.ts`(+167)；`e2e/tour.spec.ts`；与 `GuideModal` 的关系 |
| **R2-8** | 收尾验收（原 B10） | — | 全量单测、functions tsc、`test:mother-groups:api`、`playwright --list` + 2~3 个 spec、删除核对结论、三项移交 |

**顺序**：R2-1 → R2-2 → R2-3 →（R2-4 / R2-5 / R2-6 / R2-9 可并行，同时 ≤3 会话）→ R2-7 → R2-8。
R2-7 与其余批次无文件重叠，可随时插入并行；R2-9 只碰 `TourOverlay` / `tour.ts` / `e2e/tour.spec.ts`，同样可随时并行。

---

## 6. 各批任务简报（整段复制到新会话）

### R2-1 新域模型：上窝与种公候选

````text
你是资深代码审查工程师。项目：d:\desk\洛克工具箱（「洛克王国工具箱」）——React18+TS+Vite 前端（手机优先）+ Cloudflare Functions + D1。领域规则见 docs/domain/breeding-planner/、docs/domain/蛋组推荐性格.md。需求口径以 src/data/changelog.json 的 2026-10-29~2026-10-30 条目为准。

【任务】只读审查（先不改代码），范围：git a2e9ed0..15f004a 中
- src/domain/demandPlacement.ts（新增 +519）/ demandPlacement.test.ts（+352）
- src/domain/studDemandCandidates.ts（新增 +84）/ studDemandCandidates.test.ts（+99）
- src/domain/petFilters.ts（12 行）/ petFilters.test.ts（+14）
- src/domain/petAvatar.ts（2 行）
以及这四个模块的直接调用方（src/ui、src/api 里的引用）。

【审查重点】
1. 上窝（demandPlacement）：候选筛选、排序、名额与去重；同一只精灵被多个需求占用的冲突处理；空数据/单只/配对不成时的降级是否与 changelog 一致。
2. 种公候选（studDemandCandidates）：蛋组匹配、进化形态等价、目标性格/档位过滤，与 demandCriteria 的口径是否重复实现（重复实现记为中风险）。
3. 纯函数边界：0/负数/超大 id、空数组、未导入数据（species 为空）、浮点比较。
4. 是否在循环里重建图鉴索引（eggMapOf / eggInfoOf / groupsByGameId）——上一轮已确认 demandCriteria 每次调用都重建，这里若复制同样写法要指出来。
5. petFilters 的 12 行改动是否影响既有筛选口径（回归风险）。

【规范依据白名单】仓库无 .eslintrc/.editorconfig。中风险只能引：tsconfig（strict/noUnusedLocals/noUnusedParameters）；AGENTS.md；docs/产品交互规范.md；docs/domain/**；changelog 对应条目；同模块既有写法（写明「依据：参照 xxx 第 N 行」）。指不出依据降为「建议」。

【分级】高：逻辑错误/与需求不符/并发边界异常/明显性能/数据正确性/安全。中：违反明确规范/过度复杂/职责耦合/重复逻辑/错误处理不一致/可测试性差。低：死代码/无用导入/命名注释。不确定：证据不足或需业务判断，标置信度+需谁确认。

【输出】写文件 docs/code-review/2026-11-01-R2/R2-1.md。编号 R2-1-H01/M01/L01/U01。每条含：等级、文件:行号、标题、描述（含片段/调用链）、影响面、修复建议、置信度。末尾给：统计、最该先修的 1~3 条、范围外备注。

【纪律】审查阶段禁止改代码、禁止 git 写操作。修复按「高→中→低」，每批 ≤3 问题/3 文件，独立提交 fix(cr-R2-1-01): …，提交前记 git rev-parse HEAD 写入处理记录。
【验证】npx vitest run src/domain/demandPlacement.test.ts src/domain/studDemandCandidates.test.ts src/domain/petFilters.test.ts 与 npx tsc -b。基线数字见计划文档。
【硬性禁止】删文件/目录、重命名公共接口、改 migrations/schema、改 CI/CD、改 lockfile、git reset --hard/rebase/force push、顺带重构、升级依赖、为让测试通过改断言。
【遇以下立即停下问我】需要业务口径二选一、涉及线上数据、影响面无法静态确认。
````

### R2-2 家园接单上窝与请求态

````text
你是资深代码审查工程师。项目：d:\desk\洛克工具箱（「洛克王国工具箱」）——React18+TS+Vite 前端（手机优先，安卓 WebView）+ Cloudflare Functions + D1。需求口径以 src/data/changelog.json 的 2026-10-29~2026-10-30 条目为准，UI 规范见 docs/产品交互规范.md。

【任务】只读审查（先不改代码），范围：git a2e9ed0..15f004a 中
- src/ui/HomeDemandPlacements.tsx（新增 +449）/ HomeDemandPlacements.test.tsx（+286）
- src/ui/Home.tsx（46 行）/ Home.test.tsx（29 行）
- src/ui/useClaimedDemands.ts（新增 +106）
- src/ui/demandPickStore.ts（+47）、demandPlacementStore.ts（+78）、demandCompletionReadStore.ts（+39）+ 测试（+46）
- src/ui/App.tsx、navigation.ts（+10）+ 测试、listViewStore.ts、resetImportedData.ts

【审查重点】
1. 「接单上窝」闭环：从我接的单到上窝的候选、占位与撤销；上窝后本机宠物与需求的绑定是否会重复、错绑、漏释放。
2. 请求态：useClaimedDemands 的加载/错误/空态是否被 UI 消费；切换账号/小组后旧响应回写（epoch 守卫）。
3. 三个 store 的持久化键与清理：换号、重置导入数据后是否残留；同一需求重复 pick 是否幂等。
4. Home.tsx 的改动是否影响既有家园卡/配窝卡（上一轮 B7 修过「按实例 id 建索引」，确认没被回退）。
5. 导航与 listViewStore 的状态隔离（上一轮 B6/B7 有同类缺陷）。
6. 性能：渲染期重建大数组/Map、每个住户线性查找。

【规范依据白名单】仓库无 .eslintrc/.editorconfig。中风险只能引：tsconfig；AGENTS.md；docs/产品交互规范.md；docs/domain/**；changelog 条目；同模块既有写法（写明「依据：参照 xxx 第 N 行」）。

【分级】高：逻辑错误/与需求不符/并发边界异常/明显性能/数据正确性/安全。中：违反明确规范/过度复杂/职责耦合/重复逻辑/错误处理不一致/可测试性差。低：死代码/无用导入/命名注释。不确定：证据不足或需业务判断，标置信度+需谁确认。

【输出】写文件 docs/code-review/2026-11-01-R2/R2-2.md。编号 R2-2-H01…。每条含 7 项（等级/文件:行号/标题/描述/影响面/建议/置信度）。末尾给：统计、最该先修的 1~3 条、范围外备注。

【纪律】审查阶段禁止改代码、禁止 git 写操作。修复按「高→中→低」，每批 ≤3 问题/3 文件，独立提交 fix(cr-R2-2-01): …，提交前记 HEAD。
【验证】npx vitest run src/ui/HomeDemandPlacements.test.tsx src/ui/Home.test.tsx src/ui/navigation.test.ts src/ui/listViewStore.test.ts 与 npx tsc -b。
【硬性禁止】删文件/目录、重命名公共接口、改 migrations/schema、改 CI/CD、改 lockfile、git reset --hard/rebase/force push、顺带重构、升级依赖、为让测试通过改断言。
【遇以下立即停下问我】涉及布局细节（位置/大小/间距）按 AGENTS.md 先给可交互 HTML 或截图方案；业务口径二选一；影响面无法静态确认。
````

### R2-3 小组页改版 + 巨型组件

````text
你是资深代码审查工程师。项目：d:\desk\洛克工具箱（「洛克王国工具箱」）——React18+TS+Vite 前端（手机优先）+ Cloudflare Functions + D1。需求口径以 src/data/changelog.json 的 2026-10-29~2026-10-30 条目为准，交互约定见 docs/产品交互规范.md。

【任务】只读审查（先不改代码），范围：git a2e9ed0..15f004a 中
- src/ui/MotherGroupResources.tsx（+1,382 行，现约 3,900 行）★ / MotherGroupResources.test.tsx（+301）
- src/ui/CollectionGroups.tsx（−291 行重写）、MotherGroupMembers.tsx、CollectionGroupSetup.tsx
- src/ui/useCollectionGroups.ts（76 行）、collectionGroupStore.ts + 测试

【读法与汇报节奏】一个会话做完，不拆任务。MotherGroupResources 是巨型单组件：
- 第 1 轮：状态与派生、筛选、瀑布流、成员复选。读完写 R2-3.md「第 1 轮」并汇报一次。
- 第 2 轮：需求中心、发布、结单、二级页、渲染主体与辅助函数。写完「第 2 轮」再汇报一次。
第一轮汇报后不停下等确认，直接继续第二轮；两轮汇报完再进修复。

【审查重点】
1. 本轮改版是否破坏了上一轮修好的东西：红边沉底只看成员数据是否齐全（原 B5-H01）、撤回已接单需求的提示（原 B5-H02）、派生层复用 viewer 结果（原 B5-M01）。
2. 三视图（我缺的 / 我的 / 需求中心）状态隔离：切身份、切组时筛选与选择态是否串。
3. 瀑布流边界：默认条数、IntersectionObserver 追加的重复/漏项、筛选变化后滚动位置、observer 清理。
4. 严格结单判定：血脉（含进化形态）/性格/性别/体型/声音；「只认配对孵蛋」；一键结单触发条件。
5. 发布动作的并发（DEMAND_PUBLISH_CONCURRENCY）与部分失败提示。
6. CollectionGroups −291 行：是否漏掉旧入口、空态/错误态；useCollectionGroups 的请求守卫（scope/epoch）是否仍在所有回写路径生效——上一轮 B6-M04 的「withdrawDemand 本地回写缺组/epoch 守卫」若仍未修，这里要重新确认。
7. changelog 是否补了「小组不再设母本口径」的用户说明（上一轮 B6 遗留）。

【规范依据白名单】仓库无 .eslintrc/.editorconfig。中风险只能引：tsconfig；AGENTS.md；docs/产品交互规范.md；docs/domain/**；changelog 条目；同模块既有写法（写明「依据：参照 xxx 第 N 行」）。

【分级】高：逻辑错误/与需求不符/并发边界异常/明显性能/数据正确性/安全。中：违反明确规范/过度复杂/职责耦合/重复逻辑/错误处理不一致/可测试性差。低：死代码/无用导入/命名注释。不确定：证据不足或需业务判断，标置信度+需谁确认。

【输出】写文件 docs/code-review/2026-11-01-R2/R2-3.md，结构：`## 第 1 轮`、`## 第 2 轮`、`## 合并统计与修复顺序`（统计、最该先修 1~3 条并注明来自哪一轮、范围外备注）。编号 R2-3-H01…，两轮共用连续序号，每条含 7 项。

【纪律】审查阶段禁止改代码、禁止 git 写操作。修复按「高→中→低」，每批 ≤3 问题/3 文件，独立提交 fix(cr-R2-3-01): …，提交前记 HEAD。**不做拆分重构**。
【验证】npx vitest run src/ui/MotherGroupResources.test.tsx src/ui/collectionGroupStore.test.ts 与 npx tsc -b。
【硬性禁止】删文件/目录、重命名公共接口、改 migrations/schema、改 CI/CD、改 lockfile、git reset --hard/rebase/force push、顺带重构、升级依赖、为让测试通过改断言。
【遇以下立即停下问我】业务口径二选一（例如需求结单后能否再发同一条）、涉及布局细节按 AGENTS.md 先给方案、影响面无法静态确认。
````

### R2-4 覆盖度 / 筛选 / 精灵库

````text
你是资深代码审查工程师。项目：d:\desk\洛克工具箱（「洛克王国工具箱」）——React18+TS+Vite 前端（手机优先）+ Cloudflare Functions + D1。UI 规范见 docs/产品交互规范.md，需求口径以 src/data/changelog.json 的 2026-10-29~2026-10-30 条目为准。

【任务】只读审查（先不改代码），范围：git a2e9ed0..15f004a 中
- src/ui/Coverage.tsx（−192 行重写）、CoverageFilterBar.tsx、CoverageIntroCard.tsx(+测试)、coverageFilterStore.ts
- src/ui/myPetsFilterStore.ts（+89）/ myPetsFilterStore.test.ts（38 行）
- src/ui/Collection.tsx（103 行）/ Collection.test.tsx（23 行）
- src/ui/primitives/FilterPanel.tsx（8 行）

【审查重点】
1. Coverage 重写后，覆盖度口径是否与 src/domain（demandCriteria / petFilters / motherSharing）一致——同一判定不要两处实现。
2. 筛选状态：coverageFilterStore / myPetsFilterStore 的持久化键、默认值、换账号/重置后残留；多选与「全不选」的语义。
3. 精灵库 Collection.tsx 的改动：是否顺带回答了上一轮 B7-U01「精灵库是否要显示身高」；列表 key 与渲染性能。
4. FilterPanel 原语改动是否影响其它使用方（全局检索确认）。
5. 空数据（未导入）与超大列表（1000+ 条）下的表现。

【规范依据白名单】仓库无 .eslintrc/.editorconfig。中风险只能引：tsconfig；AGENTS.md；docs/产品交互规范.md；docs/domain/**；changelog 条目；同模块既有写法（写明「依据：参照 xxx 第 N 行」）。

【分级】高：逻辑错误/与需求不符/并发边界异常/明显性能/数据正确性/安全。中：违反明确规范/过度复杂/职责耦合/重复逻辑/错误处理不一致/可测试性差。低：死代码/无用导入/命名注释。不确定：证据不足或需业务判断，标置信度+需谁确认。

【输出】写文件 docs/code-review/2026-11-01-R2/R2-4.md。编号 R2-4-H01…。每条含 7 项。末尾给：统计、最该先修的 1~3 条、范围外备注。

【纪律】审查阶段禁止改代码、禁止 git 写操作。修复按「高→中→低」，每批 ≤3 问题/3 文件，独立提交 fix(cr-R2-4-01): …，提交前记 HEAD。
【验证】npx vitest run src/ui/Collection.test.tsx src/ui/CoverageIntroCard.test.tsx src/ui/myPetsFilterStore.test.ts 与 npx tsc -b。
【硬性禁止】删文件/目录、重命名公共接口、改 migrations/schema、改 CI/CD、改 lockfile、git reset --hard/rebase/force push、顺带重构、升级依赖、为让测试通过改断言。
【遇以下立即停下问我】涉及布局细节按 AGENTS.md 先给方案；业务口径二选一。
````

### R2-5 种公阵列 / 发需求 / 紧凑卡

````text
你是资深代码审查工程师。项目：d:\desk\洛克工具箱（「洛克王国工具箱」）——React18+TS+Vite 前端（手机优先，安卓 WebView）+ Cloudflare Functions + D1。UI 规范见 docs/产品交互规范.md，需求口径以 src/data/changelog.json 的 2026-10-29~2026-10-30 条目为准。

【任务】只读审查（先不改代码），范围：git a2e9ed0..15f004a 中
- src/ui/StudMatrix.tsx（130 行）/ StudMatrix.test.tsx（66 行）
- src/ui/DemandPublishSheet.tsx（23 行）
- src/ui/PetCompactCard.tsx + 测试
- src/ui/GuideModal.tsx、Dashboard.tsx

【审查重点】
1. **重点复核上一轮 B7-M01**（中风险，当时未修）：紧凑卡昵称超 5 字会不会压到右上角性格徽标；看本批是否已经修掉（改了就用测试或像素推演验证），没修就保留并给出按 AGENTS.md 的布局方案（可交互 HTML 或 375/390 截图）。
2. StudMatrix 改动是否破坏上一轮的「64×58 格子、名字超长只显示基础名、荐类格点击发需求」；触摸区与整页上下滑的冲突是否回退。
3. DemandPublishSheet 与新型 NatureSelect/候选源的配合：一行 3 只、性格 3 列、「更多」只展开当前这只；重新打开时选择态是否残留。
4. GuideModal / Dashboard 的小改动是否影响引导与看板口径。

【规范依据白名单】仓库无 .eslintrc/.editorconfig。中风险只能引：tsconfig；AGENTS.md；docs/产品交互规范.md；docs/domain/**；changelog 条目；同模块既有写法（写明「依据：参照 xxx 第 N 行」）。

【分级】高：逻辑错误/与需求不符/并发边界异常/明显性能/数据正确性/安全。中：违反明确规范/过度复杂/职责耦合/重复逻辑/错误处理不一致/可测试性差。低：死代码/无用导入/命名注释。不确定：证据不足或需业务判断，标置信度+需谁确认。

【输出】写文件 docs/code-review/2026-11-01-R2/R2-5.md。编号 R2-5-H01…。每条含 7 项。末尾给：统计、最该先修的 1~3 条、范围外备注（含 B7-M01 的复核结论）。

【纪律】审查阶段禁止改代码、禁止 git 写操作。修复按「高→中→低」，每批 ≤3 问题/3 文件，独立提交 fix(cr-R2-5-01): …，提交前记 HEAD。
【验证】npx vitest run src/ui/StudMatrix.test.tsx src/ui/PetCompactCard.test.tsx 与 npx tsc -b。
【硬性禁止】删文件/目录、重命名公共接口、改 migrations/schema、改 CI/CD、改 lockfile、git reset --hard/rebase/force push、顺带重构、升级依赖、为让测试通过改断言。
【遇以下立即停下问我】涉及布局细节（位置/大小/间距）按 AGENTS.md 先给可交互 HTML 或截图方案确认。
````

### R2-6 删除核对 + e2e 同步

````text
你是资深代码审查工程师。项目：d:\desk\洛克工具箱（「洛克王国工具箱」）——React18+TS+Vite 前端 + Cloudflare Functions + D1，e2e 用 Playwright。

【任务】只读审查（先不改代码，**不得删除任何文件**），范围：git a2e9ed0..15f004a 中
- 被删除的文件：src/ui/GenderRatioSpecies.tsx、src/ui/Swap.tsx、src/ui/SwapWishCard.tsx(+测试)、e2e/swap.spec.ts
- src/ui/swapViewStore.ts(+测试)：文件保留但语义是否随删除变化
- e2e：coverage.spec.ts、product-refactor.spec.ts、mother-sharing.spec.ts、refactor-fixes.spec.ts、helpers/motherGroupsMock.ts

【审查重点】
1. 删除是否干净：全局检索（代码、路由、动态 import、配置、序列化入口、导航入口、文档）确认无悬空引用；若整块功能下线（求换/性别比例），确认导航与用户可见文案没有留下死入口。
2. e2e 是否被改成迁就实现：对比 a2e9ed0 版本的断言强度，找出被放宽/删掉的关键断言（发现即报告，不改）。
3. mock（helpers/motherGroupsMock.ts）与真实接口是否仍一致（上一轮 B4 把旧 criteriaId 改成 400，mock 是否同步）。
4. 新 UI（紧凑卡、64×58 格子、弹层居中、瀑布流）与 e2e 选择器是否同步，避免假通过。
5. 只跑 `npx playwright test --list` 确认清单完整、无指向已删文件的 spec。

【规范依据白名单】仓库无 .eslintrc/.editorconfig。中风险只能引：tsconfig；AGENTS.md；docs/产品交互规范.md；changelog 条目；同模块既有写法。

【分级】高：逻辑错误/与需求不符/数据正确性/安全；测试覆盖不到的真实高风险分支也记为高（注明「测试缺口」）。中：断言过松、mock 与实现脱节、测试互相污染。低：命名/注释/重复夹具。不确定：证据不足，标置信度。

【输出】写文件 docs/code-review/2026-11-01-R2/R2-6.md。编号 R2-6-H01…。每条含 7 项。末尾给：统计、删除文件核对结论（可否安全删除）、最该先修的 1~3 条、范围外备注。

【纪律】审查阶段禁止改代码、禁止 git 写操作、不得删除文件。修复按「高→中→低」，每批 ≤3 问题/3 文件，独立提交 fix(cr-R2-6-01): …。**禁止为了让 e2e 通过而改断言**。
【验证】npx playwright test --list 与 npx tsc -b。
【硬性禁止】删文件/目录、重命名公共接口、改 migrations/schema、改 CI/CD、改 lockfile、git reset --hard/rebase/force push、顺带重构、升级依赖。
【遇以下立即停下问我】认为某条断言写错了、需要放宽超时、需要真正删除某文件。
````

### R2-7 旧轮遗留（后端与契约）

````text
你是资深代码审查工程师。项目：d:\desk\洛克工具箱（「洛克王国工具箱」）——React18+TS+Vite 前端 + Cloudflare Pages Functions + D1。

【任务】这批是上一轮（2026-10-29）**明确标注「未修」**的条目，文件未被新提交改动，结论仍然有效。请先读报告，再**重读当前代码确认行号与结论**（行号可能已漂移），然后按价值修复。

【来源报告（必须先读）】
- docs/code-review/2026-10-29/B3.md：剩 M03（额度先查后写）、M04（需求列表无分页）、L01（性格入库未 trim）、L02（种公组死代码 + allowEmptyStud 死参）、L03（resource_epoch 无人消费）、L04（承接人 NULL 也落 done）
- docs/code-review/2026-10-29/B4.md：剩 M02（两份 handler 复制 70 行）、M03（错误码语义重载）、L01（缺省默认值）、L02（Number() 宽松解析）、L03（性格未 trim）、L04（memberAccountId 无上限）、L05（种公组死分支）、L06（schema 与迁移顺序互斥）、U01（迁移幂等）、U02（D1 外键开关）
- docs/code-review/2026-10-29/B9.md：剩 L01~L05、U01、U02
- docs/code-review/2026-10-29/B6.md：剩 M05（useCollectionGroups 无单测）

【处理规则】
1. 先逐条复核：仍成立 / 已被其它改动顺手修掉 / 已不适用（给出证据）。
2. 按「同一根因合并修」排序：性格 trim 在 B3-L01 与 B4-L03 是同一件事，一次修两处；种公组死代码 B3-L02 与 B4-L05 一起清。
3. 中风险优先于低风险；L06 涉及 schema 与迁移，**只报告不改**；U01/U02 需要运维实测（`PRAGMA foreign_keys`），先问。
4. M05（无单测）若要补，只补关键路径（切组/切号后旧响应不回写、撤回本地回写），不要追求覆盖率。

【规范依据白名单】仓库无 .eslintrc/.editorconfig。中风险只能引：tsconfig；AGENTS.md；docs/产品交互规范.md；changelog 条目；同模块既有写法。

【分级/输出】沿用上一轮定义。写文件 docs/code-review/2026-11-01-R2/R2-7.md，编号 R2-7-H01…，开头放一张「旧项复核表」：旧编号 / 现结论（仍成立/已修/不适用）/ 证据 / 处理。每条含 7 项。

【纪律】禁止 git 写操作前先出报告。修复每批 ≤3 问题/3 文件，独立提交 fix(cr-R2-7-01): …，提交前记 HEAD。**禁止改 functions/migrations 与 schema.sql**。
【验证】npx tsc -b、npx tsc -p functions/tsconfig.json、npx vitest run（相关文件）、npm run test:mother-groups:api。
【硬性禁止】删文件/目录（死代码清理改成注释标注或保留，除非我明确同意）、重命名公共接口、改 migrations/schema、改 CI/CD、改 lockfile、git reset --hard/rebase/force push、为让测试通过改断言。
【遇以下立即停下问我】需要改表结构、需要删代码文件、D1 外键实测结果、业务口径二选一。
````

### R2-9 新手引导（新增功能）

````text
你是资深代码审查工程师。项目：d:\desk\洛克工具箱（「洛克王国工具箱」）——React18+TS+Vite 前端（手机优先，安卓 WebView）+ Cloudflare Functions + D1。UI 规范见 docs/产品交互规范.md。

【任务】只读审查（先不改代码），范围：git a2e9ed0..15f004a 中
- src/ui/TourOverlay.tsx（新增 +218）/ TourOverlay.test.tsx（新增）
- src/ui/tour.ts（新增 +167）
- e2e/tour.spec.ts（新增）
以及它们与 src/ui/GuideModal.tsx、App.tsx 的衔接。

【审查重点】
1. 引导状态机：步骤推进/回退、跳过后不再弹出、完成标记的持久化键与版本（升级后是否重复弹）。
2. 与 GuideModal 的职责是否重复（同一件事两套引导 → 记中风险），入口是否互相打架。
3. 遮罩定位：目标元素不存在（未导入数据、当前 tab 未渲染）时是否崩或指向错误位置；滚动/旋转后是否重算。
4. 无障碍与触摸：遮罩是否吃掉本该可点的区域、返回键/关闭是否可退出（安卓 WebView 返回键）。
5. e2e/tour.spec 的断言是否真的验证了引导（不是只点一下就通过）。
6. 是否在渲染期注册未清理的监听/定时器。

【规范依据白名单】仓库无 .eslintrc/.editorconfig。中风险只能引：tsconfig；AGENTS.md；docs/产品交互规范.md；changelog 条目；同模块既有写法（写明「依据：参照 xxx 第 N 行」）。

【分级】高：逻辑错误/与需求不符/并发边界异常/明显性能/数据正确性/安全。中：违反明确规范/过度复杂/职责耦合/重复逻辑/错误处理不一致/可测试性差。低：死代码/无用导入/命名注释。不确定：证据不足或需业务判断，标置信度+需谁确认。

【输出】写文件 docs/code-review/2026-11-01-R2/R2-9.md。编号 R2-9-H01…。每条含 7 项（等级/文件:行号/标题/描述/影响面/建议/置信度）。末尾给：统计、最该先修的 1~3 条、范围外备注。

【纪律】审查阶段禁止改代码、禁止 git 写操作。修复按「高→中→低」，每批 ≤3 问题/3 文件，独立提交 fix(cr-R2-9-01): …，提交前记 HEAD。**不做拆分重构**。
【验证】npx vitest run src/ui/TourOverlay.test.tsx 与 npx tsc -b。
【硬性禁止】删文件/目录、重命名公共接口、改 migrations/schema、改 CI/CD、改 lockfile、git reset --hard/rebase/force push、顺带重构、升级依赖、为让测试通过改断言。
【遇以下立即停下问我】涉及布局细节（遮罩位置/大小）按 AGENTS.md 先给可交互 HTML 或截图方案；引导步骤的文案与顺序需产品确认时先问。
````

---

### R2-8 收尾验收（原 B10）

````text
你是资深代码审查工程师兼验收负责人。项目：d:\desk\洛克工具箱（「洛克王国工具箱」）——React18+TS+Vite 前端 + Cloudflare Pages Functions + D1。

【任务】R2 收尾验收。前置条件：R2-1 ~ R2-7 的修复都已提交，工作区干净。若工作区不干净，先停下问我。

【必做（按顺序，结果全部写进报告）】
1. npx tsc -b
2. npx tsc -p functions/tsconfig.json
3. npx vitest run（全量，与基线对比，逐条列出新增失败）
4. npm run test:data-pipeline
5. npm run test:mother-groups:api（本地 wrangler + 临时 D1，只监听 127.0.0.1）
6. npx playwright test --list
7. npx playwright test <与本次改动最相关的 2~3 个 spec，建议 mother-sharing + refactor-fixes + coverage>
8. 数据库迁移执行顺序核对（迁移是否需先于 Functions 部署）；changelog 是否补齐用户可见说明

【专项复核（上一轮移交，逐条给结论）】
- 集成用例「读取限流按账号计…（约 1805 次请求未触发 429）」：是既有不稳定还是实现问题？给出 2 次重复运行结果。
- B9-M02 的「同一需求键同时存在 done 行与新行」导致的前端重复 key / 已结单计数短暂倒退：用真实小组数据或最小复现验证一次。
- D1 生产库是否开启外键（PRAGMA foreign_keys）：只给结论与验证方法，不连生产库。

【输出】写文件 docs/code-review/2026-11-01-R2/R2-8.md：每条命令的实测结果表（命令 / 结果 / 与基线对比）、专项复核结论、剩余风险与建议下一步、以及「R2 合并报告」所需的统计（按批 × 等级的问题数、已修/未修/失败清单）。

【纪律】只读 + 跑命令，不修产品代码。不得删除任何文件。禁止 git 写操作（除非用户明确要求提交报告）。**禁止为了让测试通过而改断言或放宽超时**——认为断言错就先报告。
【遇以下立即停下问我】需要连生产库、需要改断言、环境起不来（记录原因并标「未验证」）。
````

---

## 7. 状态与待办

- ✅ 基线快照 `15f004a`、基线四件套全绿（110 文件 / 913 用例、6 文件 / 47 用例）
- ✅ 旧项判定表已按快照重算：B3/B4/B9 的剩余项所在文件**都被快照改过**，一律转「需复核」
- ✅ 旧轮 22 项遗留：按「先复核再定」处理——R2-7 先出复核表（仍成立 / 已顺手修掉 / 已不适用），再定实际要修多少
- ⏳ **B3-U01 / B4-U02（D1 外键）**：能否在测试库执行 `PRAGMA foreign_keys`？这决定级联删除的真实行为，也是「已结单数倒退」是否彻底关闭的前提；最晚 R2-8 前要给结论
- ⏳ **R2-3 的业务口径**：需求结单后能否再发同一条——旧提问随 `MotherGroupResources` 重写而作废，需在新代码上重新确认
