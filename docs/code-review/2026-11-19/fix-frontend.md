# 前端界面与 e2e 修复记录（2026-11-19）

范围：`R3a/R3b/R3b2/R3b3/R6a/R6b/R7a/R7b/R7c/R9-2a/R9-2b/R9-4a/R9-4b/R9-5a/R9-5b/R9-6` 中属于前端界面与 e2e 的问题。
纪律：未打包、未部署、未改 `version.json`、未做 git 写操作；只跑相关单测，未跑全量 vitest、未实跑 Playwright。

| 条目 | 改了什么 | 验证命令与真实输出 | 未修原因 |
| --- | --- | --- | --- |
| R7b-H01 母本达标口径统一 | `Dashboard.tsx`：母本「已收集」不再用看板目标档位 `coverageFilter.grades` 覆盖，改为直接读母本页的 `motherCriteria.grades`；`MotherCriteriaMedals.tsx`：旧数据（无 `grades`）不再假装选中「大婉」，改为显示「未设置组合：当前按体型 / 声音条件判定」，与四档判定一致；旧多选值只展示第一个 | `npx vitest run src/ui/MotherCriteriaMedals.test.tsx src/ui/Dashboard.test.tsx src/ui/CollectionTargetEditor.test.tsx` → `Test Files 3 passed / Tests 25 passed` | — |
| R7b-H01 口径锁测试 | `Dashboard.test.tsx` 新增「看板母本进度只跟母本页奖牌走」「未设置组合时按体型 / 声音四档判定」；`MotherCriteriaMedals.test.tsx` 改为断言默认无选中 + 提示、旧多选只显示第一个 | 同上 | — |
| R7a-H01 精灵背包全量渲染 | `PetList.tsx`：分段渲染（首屏 60 张，滚动距底 400px 内再续 60 张；结果集变化时重置），仍保持「全部展示、不分页」；`PetList.test.tsx` 新增 500 只用例 | `npx vitest run src/ui/PetList.test.tsx src/ui/MyPets.test.tsx` → `Test Files 2 passed / Tests 9 passed` | — |
| R7a-H01 e2e | `e2e/my-pets.spec.ts`：旧的「每页 20 只」分页用例改写为「首屏 60 张 + 滚到底续档 + 无分页控件」 | `npx tsc -p tsconfig.e2e.json --noEmit` 退出码 0 | 按纪律未实跑 Playwright |
| R7b-H02 「已上窝」不可撤回 | `HomeDemandPlacements.tsx`：已同步的固定任务不再给点不动的勾选框，改显示「已上窝（已同步，不可撤回）」；取消本机标记时提示「已同步到服务端的『已上窝』不会撤回，如需更正请联系发布方」；`HomeDemandPlacements.test.tsx` 新增两条用例 | `npx vitest run src/ui/HomeDemandPlacements.test.tsx` → `Tests 27 passed` | 服务端撤回接口仍未补（本轮约定不动后端） |
| R9-6 e2e 残留 | `my-pets.spec.ts`：`mother-chain-status`→`mother-chain-expand`/`mother-plan-toggle`，`mother-chain-detail`→「查看 N 只」，`mother-egg-group`→`mother-card-egg-groups`，`mother-rec-nature`→`mother-card-natures`，达标条件收窄改用 `mother-criteria-grade-小婉`，账号筛选改用 `account-filter-summary` + `account-filter-*`（并去掉已禁止的「全不选」步骤），`pet-card-note` 恒真断言改为 `pet-card-gender` | `npx tsc -p tsconfig.e2e.json --noEmit` 退出码 0 | 按纪律未实跑 Playwright |
| R9-6 e2e 残留（续） | `dashboard.spec.ts`：旧「已换到」勾选改为点推荐卡按钮（`/已换到/`），去掉 `recommend-quantity-*`；`stud-view-hint` 恒真断言改为「精灵库页签未选中」的正向断言；账号筛选改用 `dashboard-account-*` + `account-filter-*`；`coverage.spec.ts` 的 `coverage-grade-readonly`→`coverage-target-grade-小婉`；`product-refactor.spec.ts` 去掉已删除的 `recommend-quantity-all`；`refactor-fixes.spec.ts` 的 `import-guide` 恒真断言改为 `import-input` 存在；`pwa.spec.ts` 版本标记改到「我的」页 | 同上 | — |
| R9-6 无对应功能的用例 | 删除 `mother-sharing.spec.ts` 中依赖已下线小组资源 / 需求中心 / 抢单界面的 3 条用例（`mother-view-*`、`mother-task-*`、`mother-intake-empty`、`mother-resource-row`）；375 溢出用例去掉 `mother-view-mine` 点击；`mother-sharing-live.spec.ts` 唯一用例标记 `test.skip` 并注明原因 | 同上 | 小组资源浏览 / 需求中心界面仍未挂载（R3b3-H01 待产品裁决） |
| 引导 `tourSuppressed()` | `App.tsx`：首启与切页签自动弹引导前都先判 `tourSuppressed()`，测试站不再自动弹；顶部「教程」仍可手动重播 | `npx vitest run src/App.test.tsx src/ui/tour.test.tsx` → `Tests 9 passed` | — |
| `TOUR_VERSION` | `src/ui/tour.ts`：`'3'` → `'4'`（看板分段文案已改，需重新告知老用户）；Playwright 预置已读从常量解析，无需改配置 | 同上；`npx tsc -b` 退出码 0 | — |
| `syncTourSeen()` 接线 | `App.tsx` 启动 effect（`app_open` 同处）调用 `syncTourSeen()`，把已有已读进度灌进壳，切服后不再重弹教程 | `npx vitest run src/App.test.tsx` → `Tests 7 passed` | 未处理 R9-5b-L01（同步时间戳刷新）——不在本轮必修清单 |
| `tab_view` 去重 | `App.tsx`：删掉依赖整个 `navigation` 的 `track('tab_view')`，改为已写好的 `useTabViewTracking(navigation.page, activeTab, Boolean(tour))`；保留记住页签的 effect | `npx vitest run src/ui/useTabViewTracking.test.tsx src/App.test.tsx` → `Tests 9 passed` | — |
| 再点已选组合 = 取消选择 | 看板原本已取消；`MotherCriteriaMedals.selectGrade` 改为再点已选中的档位写入 `grades: []`（取消选择），旧数据切模式不再顺手清空判定条件；`Dashboard.test.tsx` 增加「再点取消」断言 | `npx vitest run src/ui/Dashboard.test.tsx src/ui/MotherCriteriaMedals.test.tsx src/ui/CollectionTargetEditor.test.tsx` → `Tests 25 passed` | — |
| R9-2b-M01 悬浮窗需求命中刷新 | `useNearbyOverlayPush.ts`：采集期间每 60 秒（页面可见时）+ 页面重新可见时调用 `reloadDemands()`，需求条件不必等重进页面；`useNearbyOverlayPush.test.tsx` 新增「采集中刷新、停止后不刷新」用例 | `npx vitest run src/nearby/useNearbyOverlayPush.test.tsx` → `Tests 7 passed` | — |
| R9-4b-M01 服务器面板文案 | `ServerAddressPanel.tsx`：默认站是正式站时显示「正式服（默认）」（此前公开包一律写「测试服（默认）」）；新增一句「换站等于换身份：账号和采集数据按站点分别保存，切换后要在新站点重新登录 / 导入」；补公开包默认站用例 | `npx vitest run src/ui/ServerAddressPanel.test.tsx` → `Tests 13 passed` | — |
| R7c-L05 缺图白屏 | `TargetGradeSelector.tsx`：奖牌图标缺失时不再 `throw` 拖白整页，改为在该位置显示文字兜底（从源头消除白屏，等价于给卡片兜底；不新增全局错误边界以免掩盖其它错误） | `npx tsc -b` 退出码 0；`npx vitest run src/ui/Dashboard.test.tsx src/ui/CollectionTargetEditor.test.tsx` 通过 | — |
| R9-2a-M01 悬浮球 / 「还有 N 只未显示」用 matched | 未改 | — | **受约束**：这两个数字由安卓壳读取 payload 的 `total` 渲染，网页侧唯一改动点是 `src/nearby/overlayPayload*`（本路明确只读不动），壳 Java 亦在本轮禁止改动；需另开壳修复 + payload 增加 `nearbyTotal` 字段，故登记待确认 |

## 验证汇总

- 相关单测：最终合并跑一次为 `Test Files 12 passed / Tests 95 passed`；`src/ui/tour.test.ts` 单独跑 `2 passed`（见上表分命令输出）。
- `npx tsc -b`：退出码 0，无输出。
- `npx tsc -p tsconfig.e2e.json --noEmit`：退出码 0，无输出。
- 未执行：全量 `vitest run`、Playwright 实跑、打包、部署。

## 待确认

1. **matched 计数**：需要安卓壳把悬浮球与「还有 N 只未显示」改读 `matched`（并在 payload 保留 `nearbyTotal` 供标题使用）。当前受「不改壳 Java / 不动 overlayPayload」约束无法落地。
2. **小组资源与需求中心界面**：`GroupPlanHub` 现在只挂换蛋流程，相关 e2e 已删除 / 跳过；若产品决定恢复该界面，需要重新恢复对应用例。
