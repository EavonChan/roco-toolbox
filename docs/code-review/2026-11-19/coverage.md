# 2026-11-19 审查覆盖看板

> 依据：`plan-revised.md`（31 个代码批 + 7 个文档批）。
> 复核时点：2026-11-19 08:45（以目录里**实际存在的报告文件**为准，不按计划推测）。
> 判定口径：报告文件存在 = **已出**；无文件且用户未说明在跑 = **未开始**；用户已说明派出、报告未落盘 = **进行中**。
> 行号基线：现有 9 份报告全部写「行号以 `894de06` 为准」；计划基线 `6aaf5e7` 之后只有 `894de06` 改代码，且只改了 R3a 的 3 个文件，其余批次文件内容一致、行号等价。9 份报告均有 `## 统计` 段，无缺失。

## 1. 代码批（31）

| 批名 | 文件范围（简写） | 报告路径 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| R1a | `src/shared/eggPatrol*`、`eggWorkflow*`、`eggTaskActions.ts`（5） | `R1.md` | 已出 | 与 R1b 共用 R1.md；基线 894de06、统计齐全 |
| R1b | `eggMatching*`、`eggMigration*`、`uuid`、`motherGroups`、`collectionGroups` + `src/domain/eggInventory*`、`parseBackup*`、`backup`、`types`（14） | `R1.md` | 已出 | 同上 |
| R2a | `functions/_lib/eggPatrol`、`eggPatrolStore`、`eggMatching`、`eggReminders`、`eggBotBridge`（5） | `R2a.md` | 已出 | 基线 894de06、统计齐全 |
| R2b | `functions/migrations/2026-11-16~18*`、`schema.sql`、`tools/test/egg-*-api`、`verify-mother-groups-schema`（9） | `R2b.md` | 已出 | 基线 894de06、统计齐全 |
| R3a | `src/ui/plan/EggMatchingHub*`、`EggTasksPanel*`、`EggDemandCard/Editor*`、`EggStockPanel*`、`EggLineSummary*`、`EggBotConnection*`、`useEggMatching*`（16） | `R3a.md` | 已出 | 行号以 894de06 为准；该批 3 文件在 894de06 有 +109 −34 改动，与 6aaf5e7 行号不同；统计齐全 |
| R3b1 | `src/ui/plan/eggStockModel*`、`eggTime*`、`homeEggAdapter*`、`usePlanBadge*`（8） | `R3b.md` | 已出 | 报告名 R3b（计划编号 R3b1）；基线 894de06、统计齐全 |
| R3b2 | `GroupPlanHub`、`GroupSquareView`、`MyCollectionView`、`useCollectionPlans`、`planAlertsStore*`（6） | `R3b2.md` | 未开始 | 删除面查引用 |
| R3b3 | `PlanCard`、`PlanDetailSheet`、`planCardModel*`、`planCard.css`（5） | `R3b3.md` | 未开始 | 删除面查引用 |
| R4 | `functions/_lib/auth`、`util`、`router`；`src/api/session`；`AccountPanel*`；账号迁移；`reset-*.mjs`（9） | `R4.md` | 已出 | 基线 894de06、统计齐全 |
| R5 | `src/domain/petFilters`、`motherCriteria`、`demandCriteria`、`catalog`、`petIcons`、`types` 等 + `src/shared/bodySize*` + `pcap/bodySize.test`（17） | `R5.md` | 已出 | 基线 894de06、统计齐全 |
| R6a | `src/ui/MyPets.tsx`、`MyPets.test.tsx`（2） | `R6a.md` | 已出 | 基线 894de06、统计齐全 |
| R6b | `Dashboard`、`Collection`、`Coverage*`、`coverageFilterStore`、`myPetsFilterStore` 等（13） | `R6b.md` | 已出 | 基线 894de06、统计齐全 |
| R7a | `PetCard`、`PetCardLayout`、`PetCompactCard`、`PetList`、`FilterAccordion`、`AccountFilterBar`、`FilterPanel`、`ProgressCard`（12） | `R7a.md` | 未开始 | — |
| R7b | `Home`、`HomePairDiagram`、`HomeDemandPlacements`、`MotherView`、`MotherCriteriaMedals`（10） | `R7b.md` | 未开始 | 承接 F-4 |
| R7c | `SuggestionCard`、`suggestionCardStore`、`NatureSelectionContent`、`TargetGradeSelector`、`CollectionTargetEditor`、`tour`、`useCollectionSummary`（10） | `R7c.md` | 未开始 | — |
| R8a1 | `NearbyPanelController.java`（1） | `R8a1.md` | 未开始 | 单文件例外（1354 行） |
| R8a2 | `NearbyOverlayModel*`、`OverlayGeometry*`（4） | `R8a2.md` | 未开始 | — |
| R8a3 | `BattleOverlayController`、`CaptureController/State/BridgePolicy/VpnService`、`capture-bridge.js`、`overlay-map.html`、`maps.json`（10） | `R8a3.md` | 未开始 | 承接 A-1/A-2/A-3 |
| R8a4 | `CaptureUpload*` 5 个删除 + 1 个 webp（6） | `R8a4.md` | 未开始 | 只查引用 |
| R8b1 | `update/UpdateController`、`UpdateManager`、`UpdateManifest` + tests（5） | `R8b1.md` | 未开始 | — |
| R8b2 | `ServerConfig*`、`MainActivity`、`IdentityRescue`、`build.gradle`、`Manifest`、`strings`、`file_paths`、`.gitignore`、`README`、`THIRD_PARTY`（11） | `R8b2.md` | 未开始 | — |
| R9-1 | `src/collector/**`（15） | `R9-1.md` | 未开始 | 承接 O-5/O-6 |
| R9-2a | `src/nearby/overlayPayload*`（2） | `R9-2a.md` | 未开始 | — |
| R9-2b | `useNearbyOverlayPush*`、`nearbyTargetStore*`、`nearbyFilterStore`（5） | `R9-2b.md` | 未开始 | — |
| R9-3 | `src/pcap/**`、`src/pcap-decoder/**`（18） | `R9-3.md` | 未开始 | — |
| R9-4a | `Nearby*`、`NearbyMap*`、`NearbyRadar`（6） | `R9-4a.md` | 未开始 | — |
| R9-4b | `ServerAddressPanel*`、`serverEnv*`、`Profile*`、`swapViewStore*`（8） | `R9-4b.md` | 未开始 | — |
| R9-5a | `api/collectionGroups*`、`api/analytics*`、`DemandPublishSheet*`、`useClaimedDemands*`、`useDemandCenter`、`useTabViewTracking`（10） | `R9-5a.md` | 未开始 | 承接 F-8、M-4 |
| R9-5b | `NativeCollectorPanel*`、`MotherGroupResources`、`CollectionGroups`、`collectionGroupStore`、`motherCriteriaStore`、`ImportPanel`、`api/sharedPrefs*`、`api/eggMatching`、`eggPatrol`（13） | `R9-5b.md` | 未开始 | — |
| R9-6 | `scripts/deploy-web*`、`scripts/design-assets*`、`e2e/**`、`tools/data-pipeline/**`（17） | `R9-6.md` | 未开始 | — |
| R10 | 根配置、`desktop/**`、`public/**`、`data/**`、`src/share/**`、数据资产、`App`/`sw` 等（约 30） | `R10.md` | 进行中 | 用户已派活；报告未落盘 |

## 2. 文档批（7）

| 批名 | 文件范围（简写） | 报告路径 | 状态 | 备注 |
| --- | --- | --- | --- | --- |
| R11a1 | `发版与更新规范`、`产品交互规范`、`手机悬浮窗-面板规格`、`手机端悬浮窗-方案`、`部署到公网`、`手机使用说明`、`PC版适配方案`、`待确认决策`、`domain/数据字段说明`（9） | `R11a1.md` | 未开始 | 承接 D-3 |
| R11a2 | `换蛋撮合-落地方案`、`换蛋-家蛋进蛋仓-方案/交接`、`换蛋撮合-工作交接`×2、`换蛋发布前检查`、`收集计划-上正式-评审清单`（7） | `R11a2.md` | 未开始 | — |
| R11a3 | `docs/superpowers/plans` 7 篇 + `specs` 2 篇（9） | `R11a3.md` | 未开始 | — |
| R11b | 根目录 9 个原型 html、`docs/prototypes/**`、`docs/设计资产/**`（约 30） | `R11b.md` | 未开始 | 登记 + 抽检 |
| R11c1 | 11-08 报告、11-18 计划、两份复盘（4） | `R11c1.md` | 未开始 | 只核对引用一致 |
| R11c2 | `协作/朋友协作与更新`、`机器人能力全景`、`远行商人推送`、`催进度执行手册`、`spec/tasks`（6） | `R11c2.md` | 未开始 | — |
| R11d | 122 个二进制文件登记 | `R11d.md` | 未开始 | 不审内容 |

## 3. 已出文件但对应批次未在修订计划里

| 文件 | 性质 | 处理建议 |
| --- | --- | --- |
| `verdicts/R1-verdict.md` | R1 的追加裁决记录（对 4 条结论做二次裁决），不是独立批次 | 归在 R1 报告下引用即可，不单列批次 |
| `verdicts/R2a-verdict.md` | R2a 的追加裁决记录 | 归在 R2a 报告下引用即可，不单列批次 |

> 说明：`R3b.md` 文件名与计划编号 `R3b1` 不同，但内容对应 R3b1，已计入上表，不算计划外批次。

## 4. 修订计划有、但没有报告也没有人在跑的批次（待派活）

**代码批（20 个）**：R3b2、R3b3、R7a、R7b、R7c、R8a1、R8a2、R8a3、R8a4、R8b1、R8b2、R9-1、R9-2a、R9-2b、R9-3、R9-4a、R9-4b、R9-5a、R9-5b、R9-6。

**文档批（7 个）**：R11a1、R11a2、R11a3、R11b、R11c1、R11c2、R11d。

> 建议派活顺序（不改变计划编号）：先 R3b2/R3b3（旧计划中心引用核对，影响 tsc/`--list`）；再 R7a–R7c（朋友 PR 剩余 UI）；然后 R8a1–R8b2（安卓壳）；R9-1–R9-6（网页采集/附近/e2e）；R10 完成后收口；文档批放最后，可与代码修复并行。

## 5. 汇总

| 类别 | 已出 | 进行中 | 未开始 | 合计 |
| --- | --- | --- | --- | --- |
| 代码批 | 10（9 份报告，R1.md 覆盖 R1a+R1b） | 1（R10） | 20 | 31 |
| 文档批 | 0 | 0 | 7 | 7 |
| 合计 | 10 | 1 | 27 | 38 |

> 报告缺失情况：9 份已出报告均有行号基线说明（894de06）与 `## 统计` 段；暂无「有报告但缺基线/统计」的批次。
