# 2026-11-19 代码审查 · 修订版派活简报

> 与 `plan-revised.md` 配套使用。每份批次简报都可以整段复制给一个新会话；新会话不共享上下文，简报里不出现「如上所述」「刚才」。
> 已产出的原 `briefs.md` 仍被 R1–R4 执行会话引用，本文件不覆盖它，只作为修订版派活口径。

---

## §G 通用规则（派活时把本节与对应批次简报一起粘贴）

````text
【项目】洛克王国工具箱。`src/` React + TypeScript（Vite）前端；`functions/` Cloudflare Pages Functions（D1 + KV）；`android-shell/` WebView 壳（Java）；`tools/`、`scripts/` 构建与数据管线；`e2e/` Playwright。
【基线】审查范围 `779b08c..6aaf5e7`（51 个提交，523 文件，+37061 −10025）。行号一律以 `6aaf5e7` 为基准；若执行时 `test` 已到 `d00739c`，只需把 `894de06` 的 3 个文件（src/ui/plan/EggMatchingHub.tsx、EggMatchingHub.test.tsx、EggTasksPanel.tsx）按最新版重读。
【规范依据白名单】只能引这些判「中风险」：
1) tsconfig.json / tsconfig.node.json / functions/tsconfig.json 的 strict、noUnusedLocals、noUnusedParameters、noFallthroughCasesInSwitch、isolatedModules；
2) AGENTS.md 工作约定；
3) docs/产品交互规范.md；
4) docs/domain/**；
5) src/data/changelog.json 对应条目；
6) 同模块既有写法（必须写「依据：参照 xxx 第 N 行」）。
仓库无 eslint / editorconfig。指不出依据的一律记为「建议」，不计中风险。
【分级】高：逻辑错误、与需求不符、并发/边界/异常缺陷、明显性能问题、数据正确性、安全。中：违反白名单明确规范、明显过度复杂、职责耦合、重复逻辑、错误处理不一致、可测试性差。低：死代码、无用导入、命名/注释/格式。不确定：证据不足或需业务语义，标置信度 + 需要谁确认。
【输出格式】每条严格三段式：
- 第一行：`<批次>-H01 · 高风险 · 一句话说清用户能看到的现象`（禁止「XxxStore 缺少校验」这类代码名词）；
- ① 问题描述：现状 / 用户影响 / 触发条件各一句；技术证据压成一行括号附录，如（src/ui/x.ts:41 未持久化）；
- ② 优化方案：把 X 改成 Y，2~3 句，不贴代码；改动 >30 行、涉及表结构或影响其它功能时写代价与风险，多方案给 A/B + 推荐；
- ③ 优化后表现：解决什么（一句）+ 验收（可点路径或可执行命令）。
报告末尾必备：统计表（高/中/低/不确定）、最该先修的 1~3 条（同样三段式）、范围外备注、待裁决清单。
【纪律】审查阶段禁止改代码、禁止任何 git 写操作（不 add/commit/checkout/restore/stash/reset/建分支）。只允许 git diff/show/log/grep。唯一允许写的文件是本批报告。可跑只读验证（tsc、指定 vitest、node --test），不要跑全量 vitest、Playwright、打包、部署。
【必须停下问】业务口径二选一、涉及线上数据或已执行迁移、影响面无法静态确认、需要改表结构、发现测试断言被改松（只报告不改）。
【待裁决清单】报告末尾必须附，最多 3 条，每条只放一个争议点，只放真正拿不准的（能跑测试或读代码直接定案的不算），格式：
## <文件:行区间> <一句话标题>
- 现状：<5 行以内的关键代码片段>
- 疑点：<可能错在哪>
- 我的倾向：<结论 + 置信度>
- 要裁决的：<一个能用「是/否/还有第三种」回答的具体问题>
【通过标准（每批通用）】
1) 本批文件清单每一个都被读到，结论都有 文件:行 证据；
2) 本批验证命令通过，且与基线相比无新增失败（跑不了要注明原因与替代核对）；
3) 高风险与中风险每条都给出可执行验收；「不确定」条目标了置信度与需要谁拍板；
4) 报告含统计、最该先修 1~3 条、范围外备注、待裁决清单（≤3 条）；
5) 删除文件只核对引用，不审被删内容（引用核对表须为 0 残留）。
````

---

## 已执行批次（R1–R4，仅留档，不要重复派活）

````text
R1（R1a 巡查域 + R1b 换蛋撮合/迁移/蛋仓）→ 报告 docs/code-review/2026-11-19/R1.md（已产出）
R2a 换蛋后端逻辑 → R2a.md（已产出）
R2b 迁移/schema/换蛋接口测试 → R2b.md（已产出）
R3a 换蛋前端主流程（16 文件，含曾列出的 3 个未提交文件）→ R3a.md（已产出）
R3b1 需求中心模型/适配/角标 → R3b.md（已产出）
R4 账号体系 → R4.md（已产出）
R5 领域规则 → R5.md（已产出，08:37）
R6a 我的精灵背包 → R6a.md（已产出，08:38）
R6b 看板/收集/覆盖度 → R6b.md（已产出，08:38）
以上批次如需补漏，只允许按原编号追加，不得重命名或重跑整批。
````

---

## R3b2 旧计划中心下线 A（删除 + 引用核对）

````text
【任务】只读审查。范围：git 779b08c..6aaf5e7 中下列文件的变更，及其直接调用方。
【文件（6，+4 −1294）】
src/ui/plan/GroupPlanHub.tsx（+4 −506，改为 EggMatchingHub 包装）
src/ui/plan/GroupSquareView.tsx（删除 −232）
src/ui/plan/MyCollectionView.tsx（删除 −233）
src/ui/plan/useCollectionPlans.ts（删除 −148）
src/ui/plan/planAlertsStore.ts（删除 −67）
src/ui/plan/planAlertsStore.test.ts（删除 −108）
【审查重点】
1. 按「删除文件只看引用」：全局检索上述模块名（含路由、动态 import、测试、e2e、样式类名），列出 0 残留证据；
2. GroupPlanHub 只做包装后，props（groupId/viewerAccountId/species/members/snapshots）是否全部透传，className 是否保留；
3. 旧深链/收藏入口是否还有指向 pages 的路由。
【通过标准】引用核对表 0 残留；npx tsc -b 通过；npx vitest run src/ui/plan 通过。
【输出】写 docs/code-review/2026-11-19/R3b2.md，编号 R3b2-H01…；末尾附待裁决清单（≤3 条，格式见通用规则）。
【验证】npx tsc -b；npx vitest run src/ui/plan
【已知线索（未复核）】GroupPlanHub 现在只有 4 行实现，重点看它包装后是否丢 props 或 className。
````

---

## R3b3 旧计划中心下线 B（删除 + 引用核对）

````text
【任务】只读审查。范围：git 779b08c..6aaf5e7 中下列文件的变更，及其直接调用方。
【文件（5，+0 −1292）】
src/ui/plan/PlanCard.tsx（−342）
src/ui/plan/PlanDetailSheet.tsx（−323）
src/ui/plan/planCardModel.ts（−296）
src/ui/plan/planCardModel.test.ts（−278）
src/ui/plan/planCard.css（−53）
【审查重点】
1. 只核对引用：planCard/PlanDetailSheet/PlanCard 的 import、样式类名、e2e 选择器、深链；
2. `npx playwright test --list` 是否因删除用例引用失败；
3. 旧计划中心下线后，需求/换蛋入口是否都能从 EggMatchingHub 到达（只读确认，不改）。
【通过标准】引用核对表 0 残留；npx playwright test --list 通过；npx tsc -b 通过。
【输出】写 docs/code-review/2026-11-19/R3b3.md，编号 R3b3-H01…；附待裁决清单。
【验证】npx tsc -b；npx playwright test --list
````

---

## R5 领域规则（体型/奖牌/档位）

````text
【任务】只读审查。范围：git 779b08c..6aaf5e7 中下列文件的变更，及其直接调用方。
【文件（17，+394 −92）】
src/domain/petFilters.ts（+85 −8）、petFilters.test.ts（+74 −13）
src/domain/motherCriteria.ts（+23 −10）、motherCriteria.test.ts（+40 −10）
src/domain/demandCriteria.ts（+12 −2）、demandCriteria.test.ts（+18 −5）
src/domain/catalog.ts（+65 −12）、catalog.test.ts（+3 −1）
src/domain/petIcons.ts（+15 −7）、petIcons.test.ts（+8 −3）
src/domain/productionLines.test.ts（+3 −3）、motherResource.test.ts（+2 −2）、motherSharing.test.ts（+2 −2）
src/domain/types.ts（+13）
src/shared/bodySize.js（+19 −8）、bodySize.d.ts（+7 −1）
src/pcap/bodySize.test.ts（+18 −5）
【审查重点】
1. `dd23006`「奖牌与孵蛋判定分离、目标档位改单选」：奖牌判定与孵蛋判定是否真正分离；旧多选字段是否还有调用方；
2. 档位边界（恰好等于阈值）归上还是归下，是否与 docs/domain/** 一致；
3. 身高/体重双维度：0、负数、超大、NaN 的退化；`081b604` 展示开关是否只影响展示不影响判定；
4. 目标性格/蛋组的大小写、别名、空值、未知值是否安全退化；
5. 排序稳定性（同分是否抖动）。
【通过标准】npx vitest run src/domain src/pcap/bodySize.test.ts 通过；每条中风险引 docs/domain/** 或既有写法。
【输出】写 docs/code-review/2026-11-19/R5.md，编号 R5-H01…；附待裁决清单。
【验证】npx vitest run src/domain src/pcap/bodySize.test.ts
【已知线索】dd23006 是本批最高风险改动；081b604 会改 bodySize 的展示口径，注意与判定口径别混用。
````

---

## R6a 我的精灵背包（大组件）

````text
【任务】只读审查。范围：git 779b08c..6aaf5e7 中下列文件的变更，及其直接调用方。
【文件（2，+1207 −73）】
src/ui/MyPets.tsx（+785 −73）
src/ui/MyPets.test.tsx（+422）
【审查重点】
1. 785 行单组件的渲染成本：列表是否虚拟化/分页，useMemo 依赖是否漏项或过度，输入时是否全量重算；
2. 筛选计数与列表是否一致，清空筛选是否回到默认；
3. 空账号/无数据时「共 N 只」口径与空态是否误导；
4. 卡片展示开关（身高/体重共用）是否持久化，刷新是否回默认；
5. 375/390 下筛选面板展开是否遮挡操作区（能静态判断的）。
【通过标准】npx vitest run src/ui/MyPets.test.tsx 通过；npx tsc -b 通过。
【输出】写 docs/code-review/2026-11-19/R6a.md，编号 R6a-H01…；附待裁决清单。
【验证】npx vitest run src/ui/MyPets.test.tsx
【已知线索】dd23006 档位单选、081b604 身高体重开关都在本组件；注意测试断言是否跟着改松。
````

---

## R6b 看板/收集/覆盖度 + 筛选 store

````text
【任务】只读审查。范围：git 779b08c..6aaf5e7 中下列文件的变更，及其直接调用方。
【文件（13，+871 −292）】
src/ui/Dashboard.tsx（+195 −96）、Dashboard.test.tsx（+214 −22）
src/ui/Collection.tsx（+32 −47）、Collection.test.tsx（+40 −9）
src/ui/Coverage.tsx（+1 −19）、Coverage.test.tsx（+28 −26）
src/ui/CoverageFilterBar.tsx（+57 −33）、CoverageIntroCard.tsx（+7 −3）、CoverageIntroCard.test.tsx（+5 −3）
src/ui/coverageFilterStore.ts（+9 −6）、coverageFilterStore.test.ts（+6 −8）
src/ui/myPetsFilterStore.ts（+155 −13）、myPetsFilterStore.test.ts（+122 −7）
【审查重点】
1. 看板空账号是否出现 NaN/报错；Dashboard.test 是否覆盖；
2. 「共 N 只」是去重种类还是条目、是否含未收集占位、筛选后是否同步；
3. 覆盖度边界：0 覆盖、100%、分母 0；
4. 筛选持久化迁移：旧键升级、未知字段是否整份重置（用户丢失已选）；
5. Coverage.tsx 删 19 行后是否留下死链接/死选择器。
【通过标准】npx vitest run src/ui/Dashboard.test.tsx src/ui/Collection.test.tsx src/ui/Coverage.test.tsx src/ui/myPetsFilterStore.test.ts 通过。
【输出】写 docs/code-review/2026-11-19/R6b.md，编号 R6b-H01…；附待裁决清单。
【验证】npx vitest run src/ui/Dashboard.test.tsx src/ui/Collection.test.tsx src/ui/Coverage.test.tsx src/ui/myPetsFilterStore.test.ts
````

---

## R7a 朋友 PR 剩余：列表与卡片

````text
【任务】只读审查。范围：git 8b97e48..081b604 中下列文件的变更（R5/R6 已独立审过的文件不在本批）。
【文件（12，+729 −425）】
src/ui/PetCard.tsx（+96 −58）、PetCard.test.tsx（+72）
src/ui/PetCardLayout.tsx（+157）
src/ui/PetCompactCard.tsx（+51 −145）、PetCompactCard.test.tsx（+28 −17）
src/ui/PetList.tsx（+34 −97）、PetList.test.tsx（+18 −16）
src/ui/FilterAccordion.tsx（+118 −36）
src/ui/AccountFilterBar.tsx（+105 −49）、AccountFilterBar.test.tsx（+43）
src/ui/primitives/FilterPanel.tsx（+7 −3）、src/ui/ProgressCard.tsx（−4）
【审查重点】
1. 卡片布局重排后各断点是否溢出/截断，密集信息（身高体重、档位、奖牌）是否还可读；
2. PetCompactCard/PetList 大幅瘦身：被移除字段是否还有使用方，是否出现空卡片；
3. FilterAccordion 展开态是否在筛选变化后被重置；键盘与点击区域；
4. AccountFilterBar 多账号与「全部账号」互斥；账号删除后的陈旧选中项；
5. props 契约变化是否影响其它调用方（全局检索确认）。
【通过标准】npx vitest run src/ui/PetCard.test.tsx src/ui/PetCompactCard.test.tsx src/ui/PetList.test.tsx src/ui/AccountFilterBar.test.tsx 通过；全局检索无残留调用。
【输出】写 docs/code-review/2026-11-19/R7a.md，编号 R7a-H01…；附待裁决清单。
【验证】上述 vitest 命令
【已知线索】081b604 身高体重共用一个开关，检查两个卡片组件是否都生效、是否各自持久化导致不同步。
````

---

## R7b 朋友 PR 剩余：家园/母本

````text
【任务】只读审查。范围：git 8b97e48..081b604 中下列文件的变更（R5/R6 已独立审过的文件不在本批）。
【文件（10，+768 −269）】
src/ui/Home.tsx（+158 −75）、Home.test.tsx（+49 −13）
src/ui/HomePairDiagram.tsx（+106 −30）、HomePairDiagram.test.tsx（+134）
src/ui/HomeDemandPlacements.tsx（+30 −14）、HomeDemandPlacements.test.tsx（+13 −3）
src/ui/MotherView.tsx（+62 −134）、MotherView.test.tsx（+49）
src/ui/MotherCriteriaMedals.tsx（+103）、MotherCriteriaMedals.test.tsx（+64）
【审查重点】
1. 配对图与需求落位的数据来源是否一致，空/缺数据占位；
2. MotherView 删 134 行后，母本详情是否丢信息、入口是否还有别处引用；
3. 奖牌展示与 R5「奖牌/孵蛋分离」口径一致；
4. 承接 11-08 F-4：「已上窝」取消勾选仍不同步（src/ui/HomeDemandPlacements.tsx:336 `if (!next) return;`），请确认现状与影响，不要直接改；
5. 2095137 家园蛋接蛋仓后，父母缺失/属性越界的兜底。
【通过标准】npx vitest run src/ui/Home.test.tsx src/ui/HomePairDiagram.test.tsx src/ui/MotherView.test.tsx src/ui/HomeDemandPlacements.test.tsx 通过。
【输出】写 docs/code-review/2026-11-19/R7b.md，编号 R7b-H01…；附待裁决清单。
【验证】上述 vitest 命令
【已知线索】dd23006 与 2095137 都影响本批；F-4 已确认仍有效，按现状记录。
````

---

## R7c 朋友 PR 剩余：建议/编辑/引导

````text
【任务】只读审查。范围：git 8b97e48..081b604 中下列文件的变更（R5/R6 已独立审过的文件不在本批）。
【文件（10，+546 −296）】
src/ui/SuggestionCard.tsx（+96 −116）、SuggestionCard.test.tsx（+57 −7）
src/ui/suggestionCardStore.ts（+18 −14）
src/ui/NatureSelectionContent.tsx（+191）
src/ui/TargetGradeSelector.tsx（+76）
src/ui/CollectionTargetEditor.tsx（+18 −127）、CollectionTargetEditor.test.tsx（+48 −17）
src/ui/tour.ts（+26 −15）、tour.test.ts（+14）
src/ui/useCollectionSummary.ts（+2）
【审查重点】
1. 建议卡排序/去重/空态是否完整；store 迁移是否丢状态；
2. TargetGradeSelector 改单选后，存储里旧的数组值如何兼容；
3. CollectionTargetEditor 删 127 行后入口是否还完整；
4. tour 分段是否指向已删除元素，导致引导卡住。
【通过标准】npx vitest run src/ui/SuggestionCard.test.tsx src/ui/tour.test.ts src/ui/CollectionTargetEditor.test.tsx 通过。
【输出】写 docs/code-review/2026-11-19/R7c.md，编号 R7c-H01…；附待裁决清单。
【验证】上述 vitest 命令
````

---

## R8a1 Android 附近悬浮面板（单文件例外）

````text
【任务】只读审查。范围：git 779b08c..6aaf5e7 中的单个文件。
【文件（1，+1354）】
android-shell/app/src/main/java/com/localdatatool/toolbox/capture/NearbyPanelController.java
【审查重点】
1. UI 线程阻塞：文件 IO、JSON、WebView 操作是否在主线程；
2. WebView 生命周期：重复 loadUrl、未 destroy、页面切换泄漏；
3. 面板定位公式 panel=f(orb)：半屏/边缘/旋转时是否越界；
4. 高频刷新导致的内存抖动与 Handler/Runnable 清理；
5. 异常捕获是否吞错、是否如实返回状态。
【通过标准】单会话两轮读、两轮汇报；cd android-shell; ./gradlew compileReleaseJavaWithJavac（不可用则注明并静态审）；报告注明 >1300 行例外。
【输出】写 docs/code-review/2026-11-19/R8a1.md，编号 R8a1-H01…；附待裁决清单。
【验证】compileReleaseJavaWithJavac
````

---

## R8a2 附近面板模型/几何

````text
【任务】只读审查。范围：git 779b08c..6aaf5e7 中下列文件的变更，及其直接调用方。
【文件（4，+949）】
NearbyOverlayModel.java（+434）、NearbyOverlayModelTest.java（+348）
OverlayGeometry.java（+96）、OverlayGeometryTest.java（+71）
【审查重点】
1. 坐标换算：屏幕方向、缩放、状态栏偏移；
2. 无标定场景兜底是否产生 NaN/越界；
3. 标签与箭头方向是否一致（与地图同一套 y 轴口径）；
4. 模型与测试断言是否互相迁就。
【通过标准】cd android-shell; ./gradlew test（不可用则静态审并注明）；断言与实现一致。
【输出】写 docs/code-review/2026-11-19/R8a2.md，编号 R8a2-H01…；附待裁决清单。
【验证】./gradlew test
````

---

## R8a3 采集控制/战斗悬浮/资源

````text
【任务】只读审查。范围：git 779b08c..6aaf5e7 中下列文件的变更，及其直接调用方。
【文件（10，+872 −164）】
BattleOverlayController.java（+387 −121）
CaptureController.java（+16 −34）
CaptureState.java（+15 −1）、CaptureStateTest.java（+13）
CaptureBridgePolicy.java（+13 −3）、CaptureBridgePolicyTest.java（+10）
CaptureVpnService.java（+4 −4）
assets/capture-bridge.js（+5 −1）
assets/overlay-map.html（+389）
assets/maps/maps.json（+20）
【审查重点】
1. 承接 11-08 A-1：裁剪（PcapWriter.trimIfNeeded）没有代次，网页增量拼接可能错帧；当前无 trimVersion/X-Capture-Generation，请确认影响；
2. 承接 A-2：orb 被系统回收后，重建仍只看 orb==null（:247），无 isAttachedToWindow；need-permission 已能返回；
3. 承接 A-3：通知 id 固定 9528 + 10 秒取消（:199-200），连续两只稀有会互相取消；
4. 战斗守卫卡清理（736e181）是否覆盖所有分支；
5. Handler/Runnable、Bitmap/WebView 释放。
【通过标准】compileReleaseJavaWithJavac 通过；三条承接项的现状写进报告（不改代码）。
【输出】写 docs/code-review/2026-11-19/R8a3.md，编号 R8a3-H01…；附待裁决清单。
【验证】cd android-shell; ./gradlew compileReleaseJavaWithJavac
````

---

## R8a4 上传链路删除（只查引用）

````text
【任务】只读审查。范围：git 779b08c..6aaf5e7 中下列删除文件的引用面。
【文件（6，−951）】
CaptureUploader.java（−350）、CaptureUploaderTest.java（−282）
CaptureUploadManager.java（−127）、CaptureUploadStore.java（−133）、CaptureUploadStoreTest.java（−59）
assets/maps/10003.webp（二进制，登记）
【审查重点】
只做引用核对：MainActivity、capture-bridge.js、AndroidManifest 权限、strings.xml、build.gradle 是否还有 CaptureUpload* 或上传权限残留；编译是否通过。
【通过标准】引用核对表 0 残留；compileReleaseJavaWithJavac 通过。不审被删内容。
【输出】写 docs/code-review/2026-11-19/R8a4.md，编号 R8a4-H01…；附待裁决清单。
【验证】git grep "CaptureUpload\|UPLOAD" HEAD -- android-shell；./gradlew compileReleaseJavaWithJavac
````

---

## R8b1 壳更新链路

````text
【任务】只读审查。范围：git 779b08c..6aaf5e7 中下列文件的变更，及其直接调用方。
【文件（5，+1127）】
update/UpdateController.java（+583）、UpdateManager.java（+171）、UpdateManagerTest.java（+238）
update/UpdateManifest.java（+57）、UpdateManifestTest.java（+78）
【审查重点】
1. e7422f0 改强引用：Activity 泄漏、回调线程、失败原因可读；
2. 强更门槛：低于门槛是否阻断；下载 APK 的大小/哈希/签名校验与 FileProvider 配置；
3. 清单版本号/通道校验是否能被绕过；
4. 下载失败/断网/半包的重试与幂等。
【通过标准】compileReleaseJavaWithJavac + 相关单测通过（不可用则注明）。
【输出】写 docs/code-review/2026-11-19/R8b1.md，编号 R8b1-H01…；附待裁决清单。
【验证】cd android-shell; ./gradlew test compileReleaseJavaWithJavac
````

---

## R8b2 切服/身份/主 Activity/构建配置

````text
【任务】只读审查。范围：git 779b08c..6aaf5e7 中下列文件的变更，及其直接调用方。
【文件（11，+1197 −79）】
ServerConfig.java（+261）、ServerConfigTest.java（+83）
MainActivity.java（+343 −49）、IdentityRescue.java（+232）
app/build.gradle（+262 −11）
AndroidManifest.xml（+5 −3）、res/values/strings.xml（+1 −1）、res/xml/file_paths.xml（+2）
android-shell/.gitignore（+5）、README.md（+5 −6）、THIRD_PARTY.md（+3 −4）
【审查重点】
1. AGENTS.md 铁律：不允许内测包/测试默认站进入正式线；默认站与通道断言是否可绕过；
2. 切服后 localStorage 身份按 origin 处理，是否给用户明确提示；
3. IdentityRescue 是否覆盖现有身份、是否有不可逆操作缺确认；
4. 保活/重建、前台服务、通知渠道、onDestroy 清理；
5. 6aaf5e7 版本号 42 与 build.gradle/Manifest/清单是否一致。
【通过标准】compileReleaseJavaWithJavac 通过；版本号三处一致；报告中列出通道校验证据。
【输出】写 docs/code-review/2026-11-19/R8b2.md，编号 R8b2-H01…；附待裁决清单。
【验证】cd android-shell; ./gradlew compileReleaseJavaWithJavac
````

---

## R9-1 采集链路（collector）

````text
【任务】只读审查。范围：git 779b08c..6aaf5e7 中下列文件的变更，及其直接调用方。
【文件（15，+730 −130）】
src/collector/useCaptureProgress.ts（+234 −17）、useCaptureProgress.test.tsx（+66 −3）
src/collector/appUpdate.ts（+111）、nativeCollector.ts（+41 −37）、nativeCollector.test.ts（−15）
src/collector/battleTargetStore.ts（+44 −14）、captureProgress.ts（+5 −2）、desktopOverlay.ts（+13）
src/collector/nearbySelfTrack.ts（+29）、nearbyStore.ts（+39）、nearbyStore.test.ts（+34）
src/collector/perfProbe.ts（+89）、useNearbyFeed.ts（+24 −7）、inspectCapture.ts（+1 −1）
【审查重点】
1. 承接 11-08 O-6：useCaptureProgress.ts:225-230 仍把累计全量 bytes.slice() 后送 worker，主线程每轮复制整份；
2. 承接 O-5：nativeCollector.ts:107,122 把 >128MiB 判为无效状态，collectorUrl.ts:12 上限 128MiB；
3. 定时器/订阅是否在卸载清理；进度状态是否回退；
4. 旧壳不支持 from 时的全量回退是否正确；
5. battleTargetStore 的守卫卡清理（736e181）是否生效。
【通过标准】npx vitest run src/collector 通过；O-5/O-6 现状写进报告（不改）。
【输出】写 docs/code-review/2026-11-19/R9-1.md，编号 R9-1-H01…；附待裁决清单。
【验证】npx vitest run src/collector
````

---

## R9-2a 附近 payload 契约

````text
【任务】只读审查。范围：git 779b08c..6aaf5e7 中下列文件的变更，及其直接调用方。
【文件（2，+611 −44）】
src/nearby/overlayPayload.ts（+223 −16）
src/nearby/overlayPayload.test.ts（+388 −28）
【审查重点】
1. demand 与 alert 语义是否彻底分离（:67-68、:237、:255）；
2. self/selfEstimated 与 NaN 兜底（:194-215、:207）；
3. 字段缺省对旧壳的兼容（旧客户端收到新字段是否崩）；
4. payload 体积与序列化成本（列表 + 地图全量精灵）。
【通过标准】npx vitest run src/nearby/overlayPayload.test.ts 通过；确认 11-08 O-3/O-4/O-8 未回归。
【输出】写 docs/code-review/2026-11-19/R9-2a.md，编号 R9-2a-H01…；附待裁决清单。
【验证】npx vitest run src/nearby/overlayPayload.test.ts
````

---

## R9-2b 附近推送/目标/筛选

````text
【任务】只读审查。范围：git 779b08c..6aaf5e7 中下列文件的变更，及其直接调用方。
【文件（5，+528 −252）】
src/nearby/useNearbyOverlayPush.ts（+209）、useNearbyOverlayPush.test.tsx（+185）
src/nearby/nearbyTargetStore.ts（+90）、nearbyTargetStore.test.ts（+66）
src/nearby/nearbyFilterStore.ts（+100）
【审查重点】
1. 推送节流/合并：是否每次坐标变化都 postMessage；页面隐藏/锁屏后是否停；
2. 应用级 hook 的生命周期与清理（卸载/切页是否推 visible=false）；
3. 目标/筛选口径与需求命中是否一致；
4. 与 R9-2a 的字段契约是否匹配。
【通过标准】npx vitest run src/nearby 通过；确认 11-08 O-1 未回归。
【输出】写 docs/code-review/2026-11-19/R9-2b.md，编号 R9-2b-H01…；附待裁决清单。
【验证】npx vitest run src/nearby
````

---

## R9-3 PCAP 解析/雷达/稀有规则

````text
【任务】只读审查。范围：git 779b08c..6aaf5e7 中下列文件的变更，及其直接调用方。
【文件（18，+886 −106）】
src/pcap/wildNearby.ts（+13 −1）、wildNearby.test.ts（+207 −2）
src/pcap/nearbyRadar.ts（+23 −7）、nearbyRadar.test.ts（+37 −4）
src/pcap/selfOdometry.ts（+29 −5）、selfOdometry.test.ts（+37 −4）
src/pcap/nearbyRetain.ts（+5 −3）、nearbyRetain.test.ts（+6 −4）
src/pcap/rareRules.ts（+15 −8）、rareRules.test.ts（+29 −16）
src/pcap/demandMatch.ts（+6 −4）、demandMatch.test.ts（+18 −5）
src/pcap/liveWindow.test.ts（+36）、readCaptureFile.ts（+1 −1）、decodeCapture.worker.ts（+1 −1）
src/pcap-decoder/tools/pcap-json-app/src/core.js（+393 −40）、core.d.ts（+29 −3）
src/pcap-decoder/tools/pcap-json-app/src/generated/catalog.json（+1 −1）
【审查重点】
1. 二进制边界检查（长度、偏移、越界读取）；异常包是否中断整个解析；
2. 雷达方位与地图一致性（11-08 O-2 已修，复核不回归）；
3. 稀有规则/需求匹配与 docs/domain/** 一致；
4. 自身坐标非有限值的过滤链路。
【通过标准】npx vitest run src/pcap src/pcap-decoder 通过。
【输出】写 docs/code-review/2026-11-19/R9-3.md，编号 R9-3-H01…；附待裁决清单。
【验证】npx vitest run src/pcap src/pcap-decoder
````

---

## R9-4a 附近页/地图/错误边界

````text
【任务】只读审查。范围：git 779b08c..6aaf5e7 中下列文件的变更，及其直接调用方。
【文件（6，+726 −190）】
src/ui/Nearby.tsx（+377 −103）、Nearby.test.tsx（+84 −34）
src/ui/NearbyErrorBoundary.tsx（+88）
src/ui/NearbyMap.tsx（+104 −48）、NearbyMap.test.ts（+63 −1）
src/ui/NearbyRadar.tsx（+10 −4）
【审查重点】
1. 错误边界是否能兜住渲染异常而不白屏；
2. 列表/地图切换是否保持状态；
3. 大列表渲染性能与大对象重算；
4. 推送已迁到应用级后，页面只负责展示的职责边界是否干净。
【通过标准】npx vitest run src/ui/Nearby.test.tsx src/ui/NearbyMap.test.ts 通过。
【输出】写 docs/code-review/2026-11-19/R9-4a.md，编号 R9-4a-H01…；附待裁决清单。
【验证】上述 vitest 命令
````

---

## R9-4b 服务器地址/Profile/换页 store

````text
【任务】只读审查。范围：git 779b08c..6aaf5e7 中下列文件的变更，及其直接调用方。
【文件（8，+668 −8）】
src/ui/ServerAddressPanel.tsx（+230）、ServerAddressPanel.test.tsx（+165）
src/ui/serverEnv.ts（+11）、serverEnv.test.ts（+23）
src/ui/Profile.tsx（+110 −5）、Profile.test.tsx（+72 −3）
src/ui/swapViewStore.ts（+33）、swapViewStore.test.ts（+24）
【审查重点】
1. 允许改服务器地址是否会把正式用户导到测试站（AGENTS.md：换站等于换身份）；
2. 默认站与通道断言；保存前探活；
3. Profile 字段迁移与清理；
4. swapViewStore 的旧键兼容。
【通过标准】npx vitest run src/ui/ServerAddressPanel.test.tsx src/ui/Profile.test.tsx src/ui/swapViewStore.test.ts 通过。
【输出】写 docs/code-review/2026-11-19/R9-4b.md，编号 R9-4b-H01…；附待裁决清单。
【验证】上述 vitest 命令
````

---

## R9-5a 需求中心残余/埋点/发布弹层

````text
【任务】只读审查。范围：git 779b08c..6aaf5e7 中下列文件的变更，及其直接调用方。
【文件（10，+142 −905）】
src/api/collectionGroups.ts（+4 −320）、collectionGroups.test.ts（+1 −123）
src/api/analytics.ts（+3 −75）、analytics.test.ts（−90）
src/ui/DemandPublishSheet.tsx（+24 −179）、DemandPublishSheet.test.tsx（删除 −68）
src/ui/useClaimedDemands.ts（+25 −5）、useClaimedDemands.test.tsx（+57 −8）
src/ui/useDemandCenter.ts（+9 −2）、useTabViewTracking.ts（+19）
【审查重点】
1. 大幅删减后是否留死导出/半截 UI/无调用方的函数；
2. 承接 11-08 F-8：DemandPublishSheet.tsx:93-100 的 reset effect 仍依赖 items，父组件轮询会清掉用户已选；
3. 承接 M-4：App.tsx:158-164 的 tab_view effect 依赖 navigation，可能重复上报；
4. 失败埋点随功能移除后，是否还有调用方期待旧事件。
【通过标准】npx tsc -b 通过；相关 vitest（DemandPublishSheet.test 已删，跑剩余）通过。
【输出】写 docs/code-review/2026-11-19/R9-5a.md，编号 R9-5a-H01…；附待裁决清单。
【验证】npx tsc -b；npx vitest run src/api src/ui/useClaimedDemands.test.tsx
````

---

## R9-5b 采集面板/小组资源/共享偏好

````text
【任务】只读审查。范围：git 779b08c..6aaf5e7 中下列文件的变更，及其直接调用方。
【文件（13，+297 −263）】
src/ui/NativeCollectorPanel.tsx（+14 −59）、NativeCollectorPanel.test.tsx（+3 −38）、NativeCollectorPanel.completion.test.tsx（+1 −6）
src/ui/MotherGroupResources.tsx（+29 −43）
src/ui/CollectionGroups.tsx（+12 −7）
src/ui/collectionGroupStore.ts（+13）
src/ui/motherCriteriaStore.ts（+8 −2）
src/ui/ImportPanel.tsx（+11 −10）
src/api/sharedPrefs.ts（+124）、sharedPrefs.test.ts（+65）
src/api/eggMatching.ts（+56）、eggMatching.test.ts（+33）
src/api/eggPatrol.ts（+26）
【审查重点】
1. 上传链路移除后，面板空实现是否静默失败；
2. sharedPrefs 跨设备合并策略（后写覆盖/冲突）、敏感字段；
3. 小组资源页删减后的入口完整性；
4. 新增 API 的严格解析与错误码一致性。
【通过标准】npx vitest run src/api src/ui/ImportPanel.test.tsx 通过。
【输出】写 docs/code-review/2026-11-19/R9-5b.md，编号 R9-5b-H01…；附待裁决清单。
【验证】上述 vitest 命令
````

---

## R9-6 e2e/脚本/数据管线

````text
【任务】只读审查。范围：git 779b08c..6aaf5e7 中下列文件的变更，及其直接调用方。
【文件（17，+464 −682）】
scripts/deploy-web.mjs（+158）、tools/test/deploy-web.test.mjs（+26）
scripts/design-assets.mjs（+110）、design-assets.test.mjs（+25）
e2e/collection-plans.spec.ts（删除 −290）、e2e/helpers/motherGroupsMock.ts（+5 −334）
e2e/android-collector.spec.ts（+2 −27）、coverage.spec.ts、dashboard.spec.ts、pwa.spec.ts、tour.spec.ts、product-states.spec.ts、mother-sharing*.spec.ts、share-target.spec.ts
tools/data-pipeline/sync-decoder-catalog.mjs（+89）、trim-catalog.mjs（+17）
【审查重点】
1. deploy-web.mjs：正式站保护（--branch main --approve-production）能否绕过；bundle 断言是否仍生效；失败是否中止；
2. 脚本是否会把内测包/测试默认站写进正式清单（AGENTS.md 发版通道单一来源）；
3. 删除 e2e 后是否还有残留 import（--list 会失败）；
4. 数据管线写入 src/data/* 是否幂等、是否有未排序 diff 噪声。
【通过标准】node --test tools/test/deploy-web.test.mjs scripts/design-assets.test.mjs + npx playwright test --list 通过。
【输出】写 docs/code-review/2026-11-19/R9-6.md，编号 R9-6-H01…；附待裁决清单。
【验证】node --test tools/test/deploy-web.test.mjs scripts/design-assets.test.mjs；npx playwright test --list
````

---

## R10 工程配置/桌面/分享/数据资产

````text
【任务】只读审查。范围：git 779b08c..6aaf5e7 中下列文件的变更，及其直接调用方。
【文件（约 30，约 +880 −70）】
根配置：package.json（+7 −6）、vite.config.ts（+5 −5）、index.html（+1 −1）、tsconfig.e2e.json（+1 −1）、AGENTS.md（+60 −3）、README.md（+1 −1）、.gitignore（−5）、package-lock.json（格式差异，登记）
desktop/：main.cjs（+17 −3）、userdata.cjs（+82）、capture/manager.cjs（−1）
public/：_headers（+5）、android/version.json（+7）、android/version-18.json（+7）
data/：changes/2026-11-10-s5-2026-10-31.md（+8）
src/share/：shareTarget.ts（+1 −1）、androidShell.test.ts（+4 −3）
数据资产：src/data/eggIconUrls.json（+626）、catalog.gen.json（+1 −1）
其它：src/App.tsx（+15 −25）、src/sw.ts（+1 −1）、src/ui/formatPercent.ts（+5）、StudMatrix.tsx（+4 −4）、BattleHudOrb.tsx（+4 −3）、CaptureProgressView.tsx（+1 −1）、CaptureProgressView.rareAlert.test.tsx（+1 −1）、LiveCaptureBanner.tsx（+1 −1）、LiveCaptureBanner.test.tsx（+1 −1）、navigation.ts（+1 −1）、listViewStore.test.ts（+1 −1）、groupAutoPublish.test.ts（+1 −1）、CollectionGroupSetup.test.tsx（+1 −1）、TourOverlay.test.tsx（+1 −1）
【审查重点】
1. package.json 的 main 字段（承接 11-08 E-2）与版本号/脚本；
2. desktop/userdata.cjs 改名迁移是否可逆、是否覆盖用户数据；
3. desktop/capture/manager.cjs 与 nativeCollector 的 128MiB 行为（承接 O-5）；
4. public/android/version*.json 与正式清单是否一致（只核对，不改、不发版）；
5. App.tsx 的路由/埋点/Tab 恢复；sw.ts 缓存版本。
【通过标准】npx tsc -b 通过；node tools/lint-copy.mjs 与基线一致；相关 vitest 通过。
【输出】写 docs/code-review/2026-11-19/R10.md，编号 R10-H01…；附待裁决清单。
【验证】npx tsc -b；npx vitest run src/ui/TourOverlay.test.tsx src/ui/LiveCaptureBanner.test.tsx；node tools/lint-copy.mjs
````

---

## R11a1 规范类文档

````text
【任务】只读核对文档与代码是否一致（不改文档）。
【文件（9，约 760 行）】
docs/发版与更新规范.md、docs/产品交互规范.md、docs/手机悬浮窗-面板规格.md、docs/手机端悬浮窗-方案.md、docs/部署到公网.md、docs/手机使用说明.md、docs/PC版适配方案.md、docs/待确认决策.md、docs/domain/数据字段说明.md
【审查重点】
1. 发版规范里的通道/默认站/清单顺序是否与 AGENTS.md、scripts/deploy-web.mjs 一致；
2. 面板规格里的尺寸/字段是否与 android-shell 当前实现一致（52dp 等）；
3. 部署文档的域名/默认站是否仍是正式站；
4. 承接 11-08 D-3：docs/domain/数据字段说明.md:8 的 625 / s4-2026-09-24 与 catalog.gen.json 的 s5-2026-10-31 不一致。
【通过标准】每条差异有 文档行 + 代码行；不改文档；给出「建议改哪句」。
【输出】写 docs/code-review/2026-11-19/R11a1.md，编号 R11a1-H01…；附待裁决清单。
````

---

## R11a2 换蛋方案与交接文档

````text
【任务】只读核对文档与代码是否一致（不改文档）。
【文件（7，约 1276 行）】
docs/换蛋撮合-落地方案-2026-11-15.md、docs/换蛋-家蛋进蛋仓-方案-2026-11-17.md、docs/换蛋-家蛋进蛋仓-交接-2026-11-17.md、docs/换蛋撮合-工作交接-2026-11-15.md、docs/换蛋撮合-工作交接-2026-11-16.md、docs/换蛋发布前检查-2026-11-16.md、docs/收集计划-上正式-评审清单-2026-11-14.md
【审查重点】
1. 方案里的接口路径/字段/状态机与 functions/_lib/egg*.ts、src/shared/egg*.ts 是否一致；
2. 交接文档里的"已完成/未完成"是否与当前代码一致；
3. 收集计划评审清单：功能已下线，注明为历史方案即可。
【通过标准】每条差异有 文档行 + 代码行；不改文档。
【输出】写 docs/code-review/2026-11-19/R11a2.md，编号 R11a2-H01…；附待裁决清单。
````

---

## R11a3 superpowers 计划与设计记录

````text
【任务】只读核对文档与代码是否一致（不改文档）。
【文件（9，约 674 行）】
docs/superpowers/plans/2026-11-16-家园巡查与QQ提醒.md、2026-11-16-换蛋撮合移动端原型改版.md、2026-11-16-换蛋撮合开发首批.md、2026-11-16-换蛋撮合共用外壳-执行记录.md、2026-11-16-换蛋原型17条批注-执行记录.md、2026-11-16-换蛋真实链路与迁移.md、2026-11-16-设计资产归档.md；docs/superpowers/specs/2026-11-16-家园巡查与QQ提醒-design.md 等 2 篇
【审查重点】计划中的"已完成"是否与代码一致；QQ 提醒是否只做了接口未发真实消息（AGENTS.md 授权范围）。
【通过标准】每条差异有 文档行 + 代码行。
【输出】写 docs/code-review/2026-11-19/R11a3.md，编号 R11a3-H01…；附待裁决清单。
````

---

## R11b 原型/设计资产（登记 + 抽检）

````text
【任务】只读登记与一致性抽检，不逐行审。
【文件】根目录 9 个 *.html 原型、docs/prototypes/**、docs/设计资产/**（约 30 个文本文件 + 图片）
【审查重点】
1. docs/设计资产/registry.json 与实际文件是否一一对应，有无登记了但不存在、或存在未登记；
2. 原型是否与现行规范冲突（只标记，不改）；
3. 图片/二进制只登记用途，不审内容。
【通过标准】登记表完整；冲突项有文件名与规范条目。
【输出】写 docs/code-review/2026-11-19/R11b.md，编号 R11b-H01…；附待裁决清单。
````

---

## R11c1 评审与复盘归档

````text
【任务】只读登记，不重审历史结论。
【文件（4）】docs/code-review/2026-11-08/review-report.md、docs/code-review/2026-11-18/plan.md、docs/复盘-2026-11-08-踩坑与改进.md、docs/复盘-2026-11-11-更新事故.md
【审查重点】只核对本次 legacy-triage 引用的结论是否与原文一致；历史报告不重审。
【通过标准】引用一致；不改文档。
【输出】写 docs/code-review/2026-11-19/R11c1.md，编号 R11c1-H01…；附待裁决清单。
````

---

## R11c2 协作/手册/机器人文档

````text
【任务】只读核对文档与代码是否一致（不改文档）。
【文件（6，约 1042 行）】docs/协作/朋友协作与更新.md、docs/机器人能力全景-2026-11-17.md、docs/远行商人推送执行手册-2026-11-17.md、docs/催进度执行手册-2026-11-17.md、docs/spec/1.3.6-1.3.7-nearby/spec.md、tasks.md
【审查重点】机器人/推送命令与 functions/_lib/eggBotBridge.ts 等实现是否一致；AGENTS.md 的"本次不向 QQ 发真实消息"是否被文档违反。
【通过标准】每条差异有 文档行 + 代码行。
【输出】写 docs/code-review/2026-11-19/R11c2.md，编号 R11c2-H01…；附待裁决清单。
````

---

## R11d 图片与二进制登记

````text
【任务】只登记，不审内容。
【文件】122 个二进制（docs/**/*.png|webp、android-shell/**/10003.webp 等）
【审查重点】确认没有生产代码引用截图/临时图；确认新增图片属于文档/原型，不进打包产物。
【通过标准】清单完整；无生产引用。
【输出】写 docs/code-review/2026-11-19/R11d.md，只列登记表（可无问题条目）。
````
