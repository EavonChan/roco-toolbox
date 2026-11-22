# 2026-11-19 旧项三态核对（11-08 报告）

> 输入：`docs/code-review/2026-11-08/review-report.md`（2 条 P0、18 条 P1、17 条 P2、3 条待拍板、20 条修复清单）。
> 核对对象：当前 `test`（`d00739c`，代码等价于审查基线 `6aaf5e7` + `894de06` 的 3 个文件）。
> 方法：逐条 `git grep` / 读当前文件 / 对比删除文件清单；**只看当前代码事实，不按记忆判断**。
> 三态定义：**仍有效** = 问题仍能在当前代码复现；**已修** = 当前代码已有对应修复；**已作废** = 指向的模块/文件已被删除或整体下线，问题不再成立。

---

## 1. 20 条修复清单逐条核对

| # | 11-08 原项 | 判定 | 证据（文件:行 / 命令） | 本轮处置 |
| --- | --- | --- | --- | --- |
| 1 | `DemandPublishSheet.tsx` 发需求草稿重置依赖 `items`，父组件刷新会清掉已选（F-8） | **仍有效** | `src/ui/DemandPublishSheet.tsx:93-100`：`useEffect(..., [open, items, defaultCriteria?.gender, defaultCriteria?.body, defaultCriteria?.voice])` 仍包含 `items` | 进 R9-5a，承接 F-8 |
| 2 | 悬浮窗推送 effect 搬到全局组件，卸载兜底隐藏（O-1，P0） | **已修** | `src/App.tsx:25,70` 调用 `useNearbyOverlayPush()`；`src/nearby/useNearbyOverlayPush.ts:41` 为应用级 hook；`src/ui/Nearby.tsx:590` 注释标明已迁移 | 关闭；R9-2b 只复核不回归 |
| 3 | 雷达南北镜像：`ny = dy/scale`、`atan2(dx,-dy)`，测试改「+y → 南」（O-2，P0） | **已修** | `src/pcap/nearbyRadar.ts:104-105` 使用 `atan2(dx, -dy)`；`:214` 为 `ny: dy / scale`；`nearbyRadar.test.ts:91-96` 断言 `[0,1000]='南'`、`[0,-1000]='北'` | 关闭；R9-3 只复核不回归 |
| 4 | 删除计划加二次确认（F-1） | **已作废** | `src/ui/plan/PlanDetailSheet.tsx` 已在 `779b08c..6aaf5e7` 删除（`git diff --diff-filter=D --name-only`） | 关闭；旧计划中心整块下线 |
| 5 | changelog 补 `2026-11-08d` 收集计划（E-1） | **已作废** | 收集计划整套已下线：`src/shared/collectionPlans.ts`、`functions/_lib/collectionPlans.ts`、`e2e/collection-plans.spec.ts` 均删除；`GroupPlanHub.tsx` 改为 `EggMatchingHub` 包装；`src/data/changelog.json` 无「收集计划」条目（换蛋功能已有条目） | 关闭；不再补该功能说明 |
| 6 | 发需求受「进行中最多 8 条」约束、降级只碰干净计划（B-1） | **已作废** | `git grep "ensureDemandPlan\|capActivePlans\|MAX_ACTIVE_PLANS" HEAD -- src functions tools e2e` 无匹配；`functions/_lib/collectionGroupsStore.ts` 现为 `+29 −764` | 关闭 |
| 7 | 归档只在 `done` 返回 5、撤回后补自动完成（B-2） | **已作废** | `src/shared/collectionPlans.ts` 已删除 | 关闭 |
| 8 | `MyCollectionView` 去掉 `slice(0,8)`（F-2） | **已作废** | `src/ui/plan/MyCollectionView.tsx` 已删除（−233） | 关闭 |
| 9 | 详情页 `onStart` 透传 `overflow`（F-3） | **已作废** | `src/ui/plan/PlanDetailSheet.tsx` 已删除（−323） | 关闭 |
| 10 | 「已上窝」取消勾选同步服务端、失败回滚（F-4） | **仍有效（部分修复）** | `src/ui/HomeDemandPlacements.tsx:331-336`：`if (!next) return;` 仍表示**取消勾选不调服务端**；失败回滚已补在 workflow 分支 `:342`（`setMarks(..., false)`），404 仍只提示本机记录 `:357-359` | 进 R7b，承接 F-4 |
| 11 | payload 传 `mapSelf`、增加 `demand` 字段并拆开稀有提醒（O-3/O-4） | **已修** | `src/nearby/overlayPayload.ts:67-68` 命中原因 `demand`/`alert` 分离；`:194-215` 接收 `demandHits` 与 `self`（含 `selfEstimated`）；`:237/:255` 输出 `alert`；`:207` 有 `Number.isFinite` 校验（O-8 一并修复） | 关闭；R9-2a 只复核 |
| 12 | 到 128MiB 主动停止并给明确状态（O-5） | **仍有效** | `desktop/capture/manager.cjs:15` `MAX_FILE_BYTES=128MiB`，`:183` 超限仍 `return ''`；`src/collector/nativeCollector.ts:107,122` 仍把 `savedBytes > MAX_CAPTURE_BYTES` 判为无效状态；`src/pcap/collectorUrl.ts:12` 上限 128MiB | 进 R10（desktop）+ R9-1，承接 O-5 |
| 13 | 只把尾部窗口送 worker、缓存只留 `windowBytes`（O-6） | **仍有效** | `src/collector/useCaptureProgress.ts:225-230`：`readCaptureSnapshotBytes` 返回累计全量后仍 `bytes.slice()` 再 `transfer`；`nativeCollector.ts:145-168` 的缓存是 `merged` 全量 | 进 R9-1，承接 O-6 |
| 14 | 裁剪加代次并整份重读（A-1） | **仍有效** | 全仓 `git grep "trimVersion\|X-Capture-Generation"` 无匹配；`PcapWriter.java` 仍有 `trimIfNeeded`；`CaptureController.java:254-272` 只有 `from`/size 增量参数 | 进 R8a3，承接 A-1 |
| 15 | `orb` 被回收后重建、失败返回明确状态（A-2） | **仍有效（部分修复）** | `BattleOverlayController.java:217,237` 已能返回 `need-permission`；但重建仍只判断 `orb == null`（`:247,256`），无 `isAttachedToWindow()` 检查，字段非空但 View 已 detach 时仍不会重建 | 进 R8a3，承接 A-2 |
| 16 | 通知 id 唯一 + 配对取消 + 权限检查（A-3） | **仍有效** | `CaptureController.java:199-200`：`notify(9528)` 后固定 `postDelayed(...cancel(9528), 10000)`；`:88-90` 权限检查只在 `startCapture`，发通知处未再校验 | 进 R8a3，承接 A-3 |
| 17 | 失败分支统一埋点（M-2） | **已作废** | `src/api/collectionGroups.ts` 已无 `track(`/`analytics` 调用；`src/api/analytics.ts` `+3 −75`，需求事件随收集计划一并移除 | 关闭 |
| 18 | `bulk` 真实传值或删字段；`placement_mark` count 统一（M-3） | **已作废** | `git grep "bulk\|placement_mark" HEAD -- src/api/analytics.ts` 无匹配 | 关闭 |
| 19 | e2e mock 按「我有这颗蛋」生成 `matchableEggIds`（D-1） | **已作废** | `e2e/collection-plans.spec.ts` 删除（−290）；`e2e/helpers/motherGroupsMock.ts` `+5 −334`；全仓无 `matchableEggIds` | 关闭 |
| 20a | 细化方案里的 `plans/batch` 改成 `/plans`（D-2） | **已作废** | `docs/收集计划-细化方案-2026-11-08.md:68` 仍写 `plans/batch`，但该接口/功能已不存在（收集计划下线）；文档已成为历史方案 | 关闭；由 R11 文档批次登记为历史 |
| 20b | 数据字段说明改 662 只 / `s5-2026-10-31`（D-3） | **仍有效** | `docs/domain/数据字段说明.md:8` 仍写「625 只精灵，版本 `s4-2026-09-24`」；`src/data/catalog.gen.json` 的 `dataVersion` 实测为 `s5-2026-10-31` | 进 R11a1，承接 D-3 |

**20 条小计**：仍有效 **7 条**（#1、#10、#12、#13、#15、#16、#20b）；已修 **3 条**（#2、#3、#11）；已作废 **10 条**（#4–#9、#17–#19、#20a）。合计 20 条。

---

## 2. 其余发现的三态（P0/P1/P2 全量）

| 编号 | 一句话问题 | 判定 | 证据 |
| --- | --- | --- | --- |
| O-1（P0） | 非「附近」页开始采集时悬浮面板不工作 | 已修 | `App.tsx:70` 应用级 `useNearbyOverlayPush()` |
| O-2（P0） | 雷达南北镜像 | 已修 | `nearbyRadar.ts:104-105,214`；测试断言 +y → 南 |
| O-3（P1） | 手机面板中心与 PC 不一致 | 已修 | `overlayPayload.ts:194-215` 使用传入 `self` 并标 `selfEstimated` |
| O-4（P1） | 面板看不出需求精灵、alert 与需求混用 | 已修 | `overlayPayload.ts:67-68,237,255` 语义分离 |
| O-5（P1） | 128MiB 后状态被判无效、停不下来 | 仍有效 | `desktop/manager.cjs:183`、`nativeCollector.ts:107,122` |
| O-6（P1） | 每轮复制整份抓包 | 仍有效 | `useCaptureProgress.ts:225-230` |
| O-7（P2） | payload 无 `theme`/`map`，壳硬编码 | 仍有效 | `git grep "theme\|map:" -- src/nearby/overlayPayload.ts src/nearby/overlayBridge.ts` 无匹配 |
| O-8（P2） | 坏的自身坐标推出 NaN 中心 | 已修 | `overlayPayload.ts:207` `Number.isFinite`；`:110-117` `selfEstimated` |
| O-9（P2） | 换局后附近页仍显示上一局 | 已修 | `src/collector/nearbyStore.ts:43-56` 增加「新鲜度门限」，`snapshot.session !== session` 返回 null |
| A-1（P1） | 裁剪后增量拼接可能错帧 | 仍有效 | 无 `trimVersion`/`X-Capture-Generation`；`PcapWriter.trimIfNeeded` 仍在 |
| A-2（P1） | 悬浮球被回收不重建、失败仍报成功 | 仍有效（部分修复） | `BattleOverlayController.java:217,237` 已报 `need-permission`；`:247` 仍只看 `orb == null` |
| A-3（P1） | 连续两只稀有只提醒一次 | 仍有效 | `CaptureController.java:199-200` 固定 id 9528 |
| A-4（P2） | 悬浮球 52dp、卡片不可点、长期遮挡 | 已作废 | `docs/手机悬浮窗-面板规格.md` 已重写，不再规定 48dp；`BattleOverlayController.java:80-83` 对 52dp 热区有明确设计说明 |
| A-5（P2） | 桥接回调在 UI 线程做文件 IO | 未复核 | 需读 `MainActivity.java:397` 起回调实现；本轮不据此定级 |
| M-1（P0） | 文案闸门在 HEAD 变红 | 已修 | 11-08 报告记录由 `e1f2f3c` 定点豁免，现 `node tools/lint-copy.mjs` 新增 0 |
| M-2（P1） | 失败/拦截路径无埋点 | 已作废 | 需求埋点随收集计划移除，`analytics.ts −75` |
| M-3（P1） | `plan_import` 不触发、count 两种含义 | 已作废 | `analytics.ts` 无 `bulk`/`placement_mark` |
| M-4（P2） | `tab_view` 重复上报 | 仍有效 | `src/App.tsx:158-164` effect 依赖仍是 `[navigation, activeTab, tour]` |
| M-5（P2） | lint 规则误判/漏判 | 仍有效 | `tools/lint-copy.mjs:31` 关键词仍含「口径」 |
| M-6（P2） | 删掉了「怎么做」的动作指引 | 已修 | `src/ui/ImportPanel.tsx:485` 已恢复「采集器里点『分享』选『小布助手』会自动导入」 |
| E-1（P1） | 收集计划没写进更新说明 | 已作废 | 收集计划下线；changelog 无需补该功能 |
| E-2（P2） | 版本号三套并存、无说明 | 仍有效（部分） | 版本已统一为 `1.5.6`（`package.json:4`、`build.gradle:36-37`）；但 `package.json:7` `"main": "desktop/main.cjs"` 仍在，README 无协议版本说明 |
| E-3（P2） | `.gitignore` 忽略的原型已入库、规则空转 | 已修 | `.gitignore` 已无「预览/原型」规则；`手机悬浮窗原型.html` 已入库 |
| D-1（P1） | e2e mock 判定写反 | 已作废 | spec 删除、mock 瘦身、无 `matchableEggIds` |
| D-2（P2） | 文档写批量接口不存在 | 已作废 | 收集计划下线；文档成为历史方案 |
| D-3（P2） | 数据字段说明图鉴版本过期 | 仍有效 | `docs/domain/数据字段说明.md:8` 仍 625 / `s4-2026-09-24`；`catalog.gen.json` 为 `s5-2026-10-31` |
| B-1–B-4 | 收集计划后端/前端状态与成本问题 | 已作废 | 相关函数/文件已删除（见 §1 #6–#9） |
| F-1–F-3、F-5–F-7 | 旧计划中心交互问题 | 已作废 | `PlanDetailSheet`/`MyCollectionView`/`GroupSquareView`/`PlanCard` 等删除 |
| F-4 | 「已上窝」取消不同步 | 仍有效 | `HomeDemandPlacements.tsx:336` |
| F-8 | 发需求草稿被父组件刷新重置 | 仍有效 | `DemandPublishSheet.tsx:100` |

---

## 3. 已作废的根因归纳

1. **收集计划整体下线**（`plans` 路由、`collectionPlans` 纯函数、广场/我的收集/计划卡/详情页、e2e spec 与 mock）。这解释了 B-1–B-4、F-1–F-3、F-5–F-7、E-1、D-1、D-2、M-2、M-3、以及 20 条清单里的 #4–#9、#17–#19、#20a。
2. **规格文档重写**：`docs/手机悬浮窗-面板规格.md` 不再固定 48dp，A-4 的前提消失。
3. **文案/引导回补**：M-6 已在 `ImportPanel.tsx:485` 恢复。

## 4. 仍然有效、本轮必须跟进的 7 条（建议优先）

| 优先级 | 编号 | 主题 | 对应批次 |
| --- | --- | --- | --- |
| P1 | O-5 / #12 | 128MiB 后采集状态无效 | R10 + R9-1 |
| P1 | O-6 / #13 | 每轮全量复制抓包 | R9-1 |
| P1 | A-1 / #14 | 裁剪代次缺失 | R8a3 |
| P1 | A-2 / #15 | 悬浮球回收不重建 | R8a3 |
| P1 | A-3 / #16 | 稀有通知 id 固定 | R8a3 |
| P1 | F-4 / #10 | 上窝取消不同步 | R7b |
| P1 | F-8 / #1 | 发需求草稿被重置 | R9-5a |

> 另有 3 条 P2 仍有效：O-7（payload 无 theme/map，进 R9-2a）、M-4（tab_view，进 R9-5a）、M-5（lint 规则，进 R9-6）、E-2（版本说明，进 R10）、D-3（文档版本，进 R11a1）。

---

## 5. 核对命令（可复跑）

```powershell
# 删除文件清单
git -c core.quotepath=false diff --diff-filter=D --name-only 779b08c..6aaf5e7

# 收集计划是否还有函数/引用
git grep -n "ensureDemandPlan\|capActivePlans\|MAX_ACTIVE_PLANS" HEAD -- src functions tools e2e
git grep -n "collectionPlans" HEAD -- src functions tools e2e

# 关键现状
git grep -n "useNearbyOverlayPush" HEAD -- src
git grep -n "trimVersion\|X-Capture-Generation" HEAD -- android-shell src
git grep -n "matchableEggIds" HEAD -- e2e src
Select-String -Path src\ui\DemandPublishSheet.tsx -Pattern "useEffect"
Select-String -Path src\ui\HomeDemandPlacements.tsx -Pattern "if \(!next\) return"
Select-String -Path docs\domain\数据字段说明.md -Pattern "625|662|s5-|s4-"
```

> 本文件只登记现状与证据，不改任何代码；具体修法与验收在批次报告中给出。
