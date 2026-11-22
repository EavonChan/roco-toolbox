# 2026-11-19 发版前代码审查 · 收尾验收与汇总

> 性质：**收尾验收 + 汇总**。本轮只执行验收命令与新增本文件；未改业务代码、未做 git 写操作、未打包、未部署、未连线上库、未改版本号或清单。
> 口径来源：`plan-revised.md`（修订版计划）、`coverage.md`（覆盖看板）、各 `R*.md` 批次报告、`verdicts/*.md`（6 份、21 条裁决）、`fix-engineering.md` / `fix-frontend.md` / `fix-backend.md`、`legacy-triage.md`。
> 执行时间：2026-11-19（本地时区 Asia/Shanghai）。
> 标注约定：**[已核实]** = 本次命令输出或文件原文可查；**[未验证]** = 本轮无法执行或证据不足。

---

## 1. 范围与基线

### 1.1 提交与文件规模 [已核实]

| 项 | 值 | 命令 |
| --- | --- | --- |
| 审查范围 | `779b08c..894de06` | `git diff --shortstat 779b08c..894de06` |
| 提交数 | **53** | `git rev-list --count 779b08c..894de06` |
| 文件数 | **524** | `git diff --name-only 779b08c..894de06 \| Measure-Object -Line` |
| 行数变化 | **+37204 −10025** | 同上 |
| `test` 当前 head | `d00739c` | `git log --oneline -1` |

### 1.2 审查基线 `894de06` 与 `d00739c` 的关系 [已核实]

- `d00739c` = `894de06` + **1 个纯文档提交**（`docs/code-review/2026-11-19/plan.md`，`+3 −3`）。
- `git diff --shortstat 894de06..d00739c` → `1 file changed, 3 insertions(+), 3 deletions(-)`；**两者业务代码完全相同**，各批次报告「行号以 894de06 为准」对 `d00739c` 同样成立。
- `779b08c..d00739c` 合计 54 个提交（53 + 1 文档）。
- `plan-revised.md` §0 记录的 51 个提交是切到 `6aaf5e7` 的数字；多出的 2 个是 `e1ec401`（审查清单，文档）与 `894de06`（需求详情单行化，唯一改代码），与「范围扩到 `894de06`」一致。

### 1.3 本轮工作区状态 [已核实]

- 三路修复混合未提交：**46 个已跟踪文件标记为修改**，`git diff --shortstat` 覆盖 45 个文件、**+700 −279**；另有 77 项未跟踪（`docs/code-review/2026-11-19/**` 报告、`../../../%E5%8E%9F%E5%9E%8B/%E5%8E%86%E5%8F%B2/preview/` 截图、`2026-11-1x/` 原型等）。
- 按任务要求：**未提交、未还原、未清理**。

### 1.4 覆盖缺口（必须如实登记）

| 项 | 状态 | 依据 |
| --- | --- | --- |
| 代码批次 31 个 | 全部有报告（R1 覆盖 R1a+R1b，`R3b.md` 对应 R3b1） | 目录内报告文件 |
| 文档批次 R11a1 / R11a2 / R11a3 / R11b / R11c1 / R11c2 / R11d（7 批） | **0 批执行，无报告** | `coverage.md` §4 与目录文件 |
| 中间/合并稿 | `R2.md`、`R3.md`、`R6.md`、`R7.md`、`R8.md`、`R9.md`、`R9a.md`、`R9b.md`、`R9c.md` 是分批发包阶段的合并稿，统计与最终子批不同（见 §2 备注） | 各文件首行说明 |

---

## 2. 各批统计（取自各报告末尾「统计」段）

| 批次 | 高 | 中 | 低 | 不确定 | 合计 | 报告 |
| --- | --- | --- | --- | --- | --- | --- |
| R1（R1a+R1b） | 0 | 3 | 5 | 2 | 10 | `R1.md` |
| R2a | 2 | 3 | 4 | 1 | 10 | `R2a.md` |
| R2b | 1 | 2 | 2 | 1 | 6 | `R2b.md` |
| R3a | 1 | 6 | 5 | 1 | 13 | `R3a.md` |
| R3b1 | 0 | 3 | 5 | 2 | 10 | `R3b.md` |
| R3b2 | 0 | 0 | 2 | 1 | 3 | `R3b2.md` |
| R3b3 | 1 | 1 | 1 | 0 | 3 | `R3b3.md` |
| R4 | 4 | 4 | 3 | 2 | 13 | `R4.md` |
| R5 | 1 | 1 | 2 | 2 | 6 | `R5.md` |
| R6a | 1 | 2 | 3 | 2 | 8 | `R6a.md` |
| R6b | 2 | 2 | 6 | 1 | 11 | `R6b.md` |
| R7a | 1 | 3 | 3 | 2 | 9 | `R7a.md` |
| R7b | 3 | 2 | 3 | 1 | 9 | `R7b.md` |
| R7c | 0 | 2 | 5 | 0 | 7 | `R7c.md` |
| R8a1 | 1 | 2 | 4 | 1 | 8 | `R8a1.md` |
| R8a2 | 1 | 0 | 5 | 0 | 6 | `R8a2.md` |
| R8a3 | 1 | 2 | 4 | 0 | 7 | `R8a3.md` |
| R8a4 | 0 | 0 | 0 | 0 | 0 | `R8a4.md`（只查引用，0 残留） |
| R8b1 | 0 | 0 | 5 | 1 | 6 | `R8b1.md` |
| R8b2 | 0 | 4 | 4 | 1 | 9 | `R8b2.md` |
| R9-1 | 2 | 1 | 3 | 0 | 6 | `R9-1.md` |
| R9-2a | 0 | 1 | 1 | 2 | 4 | `R9-2a.md` |
| R9-2b | 0 | 1 | 2 | 1 | 4 | `R9-2b.md` |
| R9-3 | 0 | 0 | 2 | 3 | 5 | `R9-3.md` |
| R9-4a | 0 | 2 | 3 | 0 | 5 | `R9-4a.md` |
| R9-4b | 0 | 2 | 2 | 0 | 4 | `R9-4b.md` |
| R9-5a | 0 | 1 | 2 | 1 | 4 | `R9-5a.md` |
| R9-5b | 0 | 2 | 3 | 0 | 5 | `R9-5b.md` |
| R9-6 | 1 | 2 | 2 | 0 | 5 | `R9-6.md` |
| R10 | 1 | 4 | 4 | 1 | 10 | `R10.md` |
| **合计** | **24** | **58** | **95** | **29** | **206** | — |

备注：

- `R7c.md` 的统计表只列到「低 5」，未单列合计行；合计 7 由分行相加得出。
- 早期合并稿 `report.md` 记的「152 条（高 22 / 中 41 / 低 66 / 不确定 23）」只覆盖当时的 R1–R9 合并口径，未含 R3b2/R3b3/R7c/R8a1–R8b2/R9-1–R9-6/R10 的子批重切，**以本表 206 条为准**。
- 低风险条数按各报告原文计入，未做去重；跨批同源问题（如 R3a-H01 与 R3b-U01、R9-2a-M01 与 R8a2-H01）在各报告内已互相引用。

---

## 3. 裁决结果（21 条：8 成立 / 13 推翻或收窄）

### 3.1 成立（8 条，按原结论执行）

| 编号 | 原结论 → 裁决 |
| --- | --- |
| R1-M03 | 背包与家园共用时间水印致旧家园快照整批丢弃 → **成立**（并补：客户端 `eggStockModel.ts:60` 同受此限） |
| R1-U01 | 接单前就在地上的蛋会被判「已产出」→ **成立**（补：只对单父本单任务成立，多父本判 ambiguous 不提醒） |
| R2a-H01 | 读巡查状态全站扫描 → **成立**（补：`validate` 无租约分支不计入开销） |
| R2b-M01 | 三种建库路径两种结构（`egg_patrol_one_egg`）→ **成立**（线上结构仍需回读确认） |
| R3b-M01 | 算不出母本的家园蛋被从蛋仓删除 → **成立**（`reserved/transferred` 不删但会丢挂出状态） |
| R4-H01 | PBKDF2 仅 1 万次迭代 → **基本成立**（并非唯一短板；另需校验存储串格式） |
| R4-U01 | 是否还有旧客户端在用 register/recover/rotate 无法判断 → **成立**（仓库不能排除旧版调用） |
| R4-U02 | 注销账号依赖级联删除、仓库无 `PRAGMA foreign_keys` → **级联成立**（`verify-mother-groups-schema.mjs:337-345` 已有断言，但脚本当前在 `:159` 就失败） |

### 3.2 推翻或收窄（13 条）

| 编号 | 原结论 → 裁决 |
| --- | --- |
| R1-M01 | 组状态只增不减、整组永久不可操作 → **部分成立**：存在取消/库存同步/产线清理等缩容路径，属「长期容量治理」而非阻断级 |
| R1-M02 | 一条脏 `breeding_pairs` 让整轮巡查抛错且「没有任何提示」 → **部分成立**：无旧观察时任务卡会显示「巡查失败」，有旧观察时失败被掩盖 |
| R2a-H02 | 收蛋后必然从「已产出」退回「已上窝」 → **有条件成立**：需场景仍有匹配配窝、任务仍有效且写入成功；配窝已散则保持 produced |
| R2a-M03 | 内部异常原文一律 400 回传、不打日志 → **收窄**：只对 `try` 内抛出的 `Error` 成立；非 `Error` 与 `try` 外异常走通用文案/500 |
| R2a-U01 | 手动催办过期后永久丢失且与设计文档冲突 → **收窄**：同一条不再领取成立；「指数退避」原文属产出通知队列，不约束手动催办；30 分钟后可重发 |
| R2b-M02 | 锁表里没有任何归属数据 → **部分成立**：现有锁行存了 `group_id`/`trade_id`，缺的只是无归属占位行 |
| R2b-U01 | 亲本容量 11 与「6 窝 × 2 只 = 12」对不上、需产品确认 → **不成立**：11 = 10 普通窝 + 1 学院小窝（`nestPlan.ts:39-40`），是总窝位预算 |
| R3a-H01 | 家园蛋被当成「我能提供」的现蛋、产品口径未定 → **事实成立、口径收窄**：方案文档已写明「窝内蛋不当现货」，可直接按 A 方案修；仍需处理代孵单分配现蛋入口 |
| R3a-M01 | 任何一次发起换蛋都看不到换回的蛋且系统代选 → **收窄**：仅接单方路径成立；从自己需求出发的两个入口已能看到将收到什么 |
| R3a-U01 | 双产线单双方永远看不到对方是否上窝 → **部分成立**：只显示一条巡查属实，但 `placed/returnPlaced` 已展示对方手动确认的上窝 |
| R3b-M03 | 同性格 60% 被当确定性格、约 40% 落空 → **行为成立、「40% 落空」未证实**：应改为「约 40% 概率不遗传该性格」 |
| R3b-U01 | 家园蛋固定 `ordinary` 可能把异色/特殊蛋当普通蛋换出 → **收窄**：抓包无地面蛋分类字段，异色风险证据不足；真正要修的是位置限制（同 R3a-H01） |
| R4-M03 | setup 只校验令牌、UPDATE 无条件、并发会静默覆盖 → **成立但覆盖有条件**：需两次都读到未绑定且写入均成功；另存在「更新 0 行仍返回成功」 |

---

## 4. 修复结果

### 4.1 工程配置 / 发版护栏 / 桌面壳（`fix-engineering.md`）

| 条目 | 内容 |
| --- | --- |
| #1 R10-H01 / R9-6-H01 | `deploy:test` / `deploy:prod` 收进 `scripts/deploy-web.mjs`，不再直连 wrangler；新增两条回归断言；正式放行参数只能手动传 |
| #2 R10-M01 / R9-6-M02 | `verify` 恢复 `node tools/lint-copy.mjs`；压掉 `DemandPublishSheet.tsx:187`、`ImportPanel.tsx:485,609` 三条新增违规 |
| #3 R10-M03 | `package.json` 补顶层 `productName`；`desktop/userdata.cjs` 候选目录按真实产物判定 + 同目录保护；临时目录脚本实测迁移/跳过/不覆盖 |
| #4 R10-M02 | 桌面 128MiB 超限改为 `capped: true` + 可读提示，`nativeCollector` 不再把整份状态判无效 |
| #5 低风险 | R10-L02 lockfile 版本对齐 1.5.6；R10-L03 README 改名与术语；R10-L01 删除 `App.tsx` 重复 `app-version` testid |

### 4.2 前端界面与 e2e（`fix-frontend.md`）

| 条目 | 内容 |
| --- | --- |
| R7b-H01 | 看板母本「已收集」改读 `motherCriteria.grades`；未设置组合改为「按体型/声音四档判定」 |
| R7a-H01 | `PetList` 分段渲染（首屏 60、滚动续 60），保持「不分页」；500 只用例 |
| R7b-H02 | 「已上窝」改成不可撤回 + 文案说明（B 方案，服务端撤回接口未补） |
| R9-6 e2e 残留 | `my-pets` / `dashboard` / `coverage` / `product-refactor` / `refactor-fixes` / `pwa` 六处选择器按新界面重写或改断言语义 |
| 引导相关 | `tourSuppressed()` 三处接线、`TOUR_VERSION` 3→4、`syncTourSeen()` 启动接线、`tab_view` 改用 `useTabViewTracking` 去重 |
| 交互一致性 | 母本档位「再点已选 = 取消」 |
| R9-2b-M01 | 采集期间每 60 秒 + 回前台调用 `reloadDemands()` |
| R9-4b-M01 | 正式站默认标签改为「正式服（默认）」，补「换站 = 换身份」说明 |
| R7c-L05 | 奖牌图标缺失不再 `throw` 白屏，改文字兜底 |

### 4.3 后端与采集/附近（`fix-backend.md`）

| 条目 | 内容 |
| --- | --- |
| #1 R2a-H01 | 巡查状态按小组过滤 + 成员批量查询；`claim/validate/ack` 只读所属小组 |
| #2 R2a-H02 | 写 `placed` 增加「同任务已有 `produced` 则不覆盖」条件 |
| #3 R9-1-H01 | `readCaptureSnapshot` 拆出 128MiB 上限文案（配合工程路 `capped`） |
| #5 R9-1-M01 | 采集进度改为模块级共享源；`selfAt` 只在真实 307 时推进 |
| #6 R1-M02 | `parsePatrolScene` 配窝逐条容错 + `skippedPairs` 计数回传 |
| #7 R1-M03 | `stock-sync` 水印按 `bag`/`home` 拆分，旧键兜底读一次（**仅服务端**） |

### 4.4 未修清单与原因

| 条目 | 状态 | 原因（原文或事实） |
| --- | --- | --- |
| R9-1-H02（O-6）worker 增量协议 | 未修 | 需改 worker 协议 + `core.js` + `decodeInWorker`，跨解码协议影响面无法静态确认；128MiB 上限已兜住极端内存 → 登记为已知风险 |
| R9-2a-M01 / R8a2-H01 悬浮球与「还有 N 只」 | 未修 | 数字由安卓壳读 payload `total` 渲染；本轮禁止改壳 Java 与 `overlayPayload`，需另开壳修复（payload 增 `nearbyTotal`） |
| R1-M03 客户端侧水印（`src/ui/plan/eggStockModel.ts:60`） | 未修 | 属另一路 `src/ui/**`；只修服务端仍可能丢蛋 → 需客户端同批拆水印 |
| R10-M04 下载站兜底清单 1.5.2/36 | 未修 | 涉及线上数据，任何清单/`version.json` 留待发布窗处理 |
| R9-6-L02 test 通道清单断言 | 未修 | 改动会影响内测发版口径，不在本轮必修清单 |
| R10-L04 / R9-6-L01 数据管线 | 未修 | 不在该路范围（R9-6 只取 `scripts/`、`package.json`） |
| R9-3-U01 / U02（大块头阈值 / 9 秒 TTL） | 未修 | 证据不足，按约定只登记 |
| R2a-M01（通知表 `task_key` 加列） | 未修 | 涉及加列迁移，不在本轮必修项 |
| R2a-M03、R2a-L01~L04、R2b 系列 | 未修 | 不在本轮必修项 |
| R3b3-H01 小组资源 / 需求中心界面 | 未修 | 待产品裁决；e2e 相应 3 条用例已删除、`mother-sharing-live` 标记 skip |
| R4-H01~H04、R4-M*、R5-H01、R6a-H01、R6b-H01、R7b-H03、R8a1–R8b2、R9-* 其余 | 未修 | 三路修复记录未覆盖，见 §2 统计与 §6 遗留清单 |

> 交叉说明：`R6b-H02`（看板母本进度与母本页不同口径）在 `fix-frontend.md` 未单独回填编号，但同一处改动（`Dashboard.tsx` 改读 `motherCriteria.grades`）实际覆盖了该问题；`R6b-H02` 仍按「未在修复记录中单列」处理。

---

## 5. 验收命令与真实输出

### 5.1 `npx tsc -b` → **通过** [已核实]

```
=== npx tsc -b ===
EXIT tsc-b=0
```

### 5.2 `npx tsc -p functions/tsconfig.json` → **通过** [已核实]

```
=== npx tsc -p functions/tsconfig.json ===
EXIT tsc-functions=0
```

### 5.3 `node tools/lint-copy.mjs` → **通过** [已核实]

```
文案 lint 通过：存量 13 条，新增 0 条。
EXIT lint-copy=0
```

存量 13 条与 `fix-engineering.md` 记录一致（`CollectionTargetEditor` 1、`MotherGroupResources` 3、`MotherResourceEditor` 1、`MotherSharing` 1、`NativeCollectorPanel` 5、`Nearby` 1、`RecommendedNatureEditor` 2）。

### 5.4 `npm run test:mother-groups:api` → **失败（脚本存在）** [已核实]

脚本确实存在：`package.json:20` → `node tools/test/run-mother-groups-local.mjs`。

```
> roco-toolbox@1.5.6 test:mother-groups:api
> node tools/test/run-mother-groups-local.mjs

[1/6] 校验 schema 定义（内存 SQLite）
AssertionError [ERR_ASSERTION]: 旧 schema 不应包含新表 mother_groups
    at .../tools/test/verify-mother-groups-schema.mjs:159:10
...
Error: schema 校验 失败（退出码 1）
    at .../tools/test/run-mother-groups-local.mjs:44:11
Command failed with exit code 1
```

- 这正是 `R2b-H01`（高风险）描述的既有失败：自检脚本在第 1/6 步就断言失败，后续换蛋接口测试全部跑不到。
- 按任务要求**未顺手改代码**，留入 §6 遗留清单。

### 5.5 `npx vitest run`（本轮唯一一次全量）→ **通过** [已核实]

```
 Test Files  181 passed | 1 skipped (182)
      Tests  1576 passed | 1 skipped (1577)
   Duration  76.80s
 EXIT 0
```

- 唯一 skip：`src/pcap/probeRealCapture.test.ts`（1 test，需要真实抓包样本，属既有 skip）。

### 5.6 `npx playwright test --list`（只列不跑）→ **通过** [已核实]

```
Total: 82 tests in 15 files
EXIT 0
```

- 删除计划中心用例、跳过 `mother-sharing-live` 后仍能完整列出，说明无语法/导入错误。
- **未实跑任何 spec**（按任务要求只列）。

### 5.7 安卓环境 → **不可用，未验证** [已核实 / 未验证]

```
JAVA_HOME=[ D:\software\jdk\Java\jdk1.8.0_321]
java -version → EXIT java=-1073741819
Test-Path D:\software\jdk\Java\jdk1.8.0_321 → False
Test-Path ...\bin\java.exe → False
```

- `JAVA_HOME` 带一个前导空格且指向**不存在的目录**，`java` 不在 PATH；`android-shell/gradlew.bat` 存在但无法执行编译。
- 因此 `compileReleaseJavaWithJavac`、JUnit、任何 APK 侧验证本轮**全部未验证**；`R8a3.md` 文首记录的也是同一原因。
- **[未验证]**：R8a1/R8a2/R8a3/R8b1/R8b2 的编译相关结论。

---

## 6. 遗留清单

### 6.1 安卓壳 7 条（高/中风险，全部未修、未编译验证）

> 按 R8a1 / R8a2 / R8a3 的高与中风险项归并；全部因 `JAVA_HOME` 不可用而**未编译、未真机验证**。

| # | 编号 | 问题 |
| --- | --- | --- |
| 1 | R8a1-H01 | 收起面板不销毁地图 WebView，反复开关累积内存、展开闪白 |
| 2 | R8a1-M01 | 面板展开时每秒数次全量重排 + 整份地图重灌，签名保护未覆盖面板/地图 |
| 3 | R8a1-M02 | 加窗失败/权限被收回时点球无反应、无提示，与 `need-permission` 语义不一致 |
| 4 | R8a2-H01 | 「还有 N 只未显示」把未命中筛选的精灵也算进去（与 R9-2a-M01 同源） |
| 5 | R8a3-H01 | 裁剪重写后无代次，缓存落后时两代抓包拼接错位（A-1） |
| 6 | R8a3-M01 | 悬浮球只判 `orb == null`，系统摘窗后不重建（A-2） |
| 7 | R8a3-M02 | 稀有提醒固定通知 id 9528，10 秒内第二只被第一只定时器撤掉（A-3） |

### 6.2 需要「payload + Java」两侧一起改

- **悬浮球与「还有 N 只」计数**（R9-2a-M01 / R8a2-H01）：网页侧需在 payload 增加 `nearbyTotal`（或让壳读 `matched`），壳侧 `NearbyOverlayModel` / `NearbyPanelController` 同步改；本轮两条路都被约束锁住，**未改动**。
- 相关待裁决：悬浮球数字应表达「附近总量」还是「当前筛选命中数」（`R9-2a.md` 待裁决清单）。

### 6.3 worker 增量协议（本轮不改，已知风险）

- **R9-1-H02（O-6）**：live 每轮仍 `bytes.slice()` 全量复制，主线程峰值约为缓存 2~3 倍，接近 128MiB 时顿挫明显。
- 修法需给 worker 协议增加「窗口起始绝对偏移 + 文件总长」并改 `core.js`、`decodeCapture.worker.ts`、`decodeInWorker.ts` 与主线程缓存契约；会破坏 `liveWindow.test.ts:122-140` 钉住的 `applied` 去重键。**登记为已知风险，后续单独立项**。

### 6.4 清单/版本一致性

- **R10-M04**：下载站兜底清单 `https://roco-toolbox-downloads.pages.dev/android/version.json` 仍是 **1.5.2 / 36**，主站两份清单是 **1.5.6 / 40**，按 `docs/发版与更新规范.md:39` 判为不一致。
- **R8b2-M01**：`android-shell/app/build.gradle` 版本号 **42** 与 `public/android/version*.json` 的 **40** 不一致；正式通道构建要求两者相等，直接从当前基线出正式包会被 gradle 拦住。
- **R8b2-M02**：构建只校验 `version.json`，客户端实际读 `version-18.json`，只改一份不会被拦。
- **R2b-H01**：`verify-mother-groups-schema.mjs:159` 断言失败，表结构自检闸门是红的（本次 `test:mother-groups:api` 已复现）。

### 6.5 证据不足、只登记不改

- **R9-3-U01**：野生精灵「大块头/小不点」身高阈值 98% vs 100% — 需真实抓包或产品口径裁决。
- **R9-3-U02**：9 秒 TTL — 需产品确认后再动。
- **R3b-M03**：「约 40% 落空」不成立，只能表述为「约 40% 概率不遗传该性格」。
- **R2b-U01**：亲本容量 11 已核实为 10 普通窝 + 1 学院小窝，无需改约束。

### 6.6 待产品裁决

- **R3b3-H01**：小组资源 / 需求中心界面随旧计划中心下线后无挂载点；`GroupPlanHub` 只挂换蛋流程，`MotherGroupResources.tsx` 仍在但无入口。恢复还是确认下线需产品决定；相关 e2e 已删除/跳过。
- **R9-2a-M01** 计数口径（见 6.2）。
- **R8b1-U01** 断网时强更是否放行。

### 6.7 过期拷贝 / 工作树

- `D:\roco-build\prod-130` 是独立 git worktree，HEAD **`f40640a`**（`bot` 分支），落后审查基线 `894de06`，`android-shell` 为过期拷贝；本轮**只读核对，未改动、未删除**。
- 同机另有 `D:\roco-build\release-prod-1.5.0`（`88bce8d`）、`D:\roco-build\friend-ui-assets-20261117`（`8b97e48`），均为工作树，不在本仓范围。

### 6.8 其他高/中风险未修项（按批次）

| 批次 | 未修的高风险 |
| --- | --- |
| R3a | R3a-H01 家园蛋可作现蛋发起换蛋（方案 A 明确可修，未做） |
| R4 | R4-H01 迭代次数、R4-H02 改密错误码 401、R4-H03 恢复码入口缺失、R4-H04 改密未吊销旧令牌 |
| R5 | R5-H01 旧档位数组导致母本「已收集」错位 |
| R6a | R6a-H01 分面计数把体型/声音整类剔出已选条件 |
| R6b | R6b-H01 跨号补缺整块消失（回归或下线待确认）；R6b-H02 见 §4.4 交叉说明 |
| R7b | R7b-H03 存储被禁用时家园页白屏（既有问题） |
| R9-1 | R9-1-H02 见 6.3 |

---

## 7. 发版前还需要什么

> 只列「还缺什么」，不写发版步骤。

1. **表结构自检转绿**：`npm run test:mother-groups:api` 目前在第 1/6 步失败（R2b-H01）。
2. **安卓编译至少成功一次**：当前 `JAVA_HOME` 指向不存在的 JDK，R8a1/R8a2/R8a3/R8b1/R8b2 全部结论未经编译验证。
3. **版本号与三份清单一致**：`build.gradle` 42 与主站/仓库清单 40（R8b2-M01），且构建要同时校验两份清单（R8b2-M02）。
4. **下载站兜底清单对齐**：1.5.2/36 → 1.5.6/40（R10-M04）。
5. **e2e 实跑一次**：本轮只 `--list`；`R9-6-M01` 改了 6 个 spec，且 `mother-sharing-live.spec.ts` 已被 skip，需确认其余 82 条真实通过。
6. **未修高风险项的明确处置**：§6.8 与 §6.1 的条目要么修、要么书面豁免，特别是 R4-H01~H04、R3a-H01、R5-H01、R6a-H01、R8a1-H01、R8a3-H01。
7. **文档批 R11（7 批）**：仍未执行，`docs/**` 与代码的一致性没有审过。
8. **工作区收口**：46 个已跟踪文件改动 + 全部报告仍处于未提交状态；发布前需要一次性提交或按批次拆分提交。
9. **产品裁决回填**：§6.6 三项（需求中心去留、悬浮球计数口径、断网强更）需要结论后才能定最终范围。

---

## 8. 一句话结论

代码侧静态质量已过闸（`tsc` × 2、文案 lint、181 个测试文件全绿），但**还不具备直接发版条件**：表结构自检是红的、安卓侧完全未编译验证、版本号与三份清单不一致、大量高风险项（尤其 R4 账号体系四条）未修，且文档批 7 批未执行。修复记录本身（三路 `fix-*.md`）与各批报告一致，未发现夸大：所有「已修」都能在对应文件或本次命令输出中对应上。
