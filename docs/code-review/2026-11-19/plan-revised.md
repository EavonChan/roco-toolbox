# 2026-11-19 发版前代码审查 · 修订版计划

> 性质：**只读审查计划**，不改任何业务代码、不提交、不打包、不部署。
> 本文件修正 `docs/code-review/2026-11-19/plan.md` 中已过期的事实与批次划分，作为本轮执行口径；`plan.md` 保留原样，不覆盖。
> 流程基准：`docs/code-review/REVIEW-PLAYBOOK.md`。
> 上一轮报告：`docs/code-review/2026-11-08/review-report.md`；2026-11-18 清单只做过计划、未执行。

---

## 0. 已核实事实（2026-11-19 08:35 前后实测）

| 项 | 值 | 核实命令 | 状态 |
| --- | --- | --- | --- |
| 审查基线 | `779b08c..6aaf5e7` | `git log --oneline 779b08c..6aaf5e7 \| Measure-Object -Line` → 51 | 已核实 |
| 总规模 | 523 文件，+37061 −10025 | `git diff --shortstat 779b08c..6aaf5e7` | 已核实 |
| 代码规模 | 约 +22,546 行（src+functions+android-shell+tools+scripts+desktop+e2e+public） | 按顶层目录 numstat 汇总 | 已核实 |
| 非代码规模 | docs 150 文件 +8492、根目录 17 文件 +5371、`2026-11-15/` 42 文件 +644；二进制 122 个 | 同上 | 已核实 |
| `test` 当前指向 | `d00739c`；`friend/20261119` 同为 `d00739c` | `git rev-parse test friend/20261119` | 已核实 |
| 基线之后的 3 个提交 | `e1ec401`（审查清单）、`894de06`（需求详情单行化，**唯一改代码**）、`d00739c`（文档） | `git log --oneline 6aaf5e7..test` | 已核实 |
| `release` / `bot` | `88bce8d` / `f40640a`；`test..release`、`test..bot` 均为 0 | `git rev-parse release bot`；`git rev-list --count test..release` / `test..bot` | 已核实 |
| `codex/friend-ui-assets-20261117` | 指向 `8b97e48`；该提交**已包含在基线范围内**（是 `test` 的祖先），不是"范围外历史" | `git merge-base --is-ancestor 8b97e48 test` → 0 | 已核实 |
| 工作区 | 仅 `docs/设计资产/registry.json` 已改；其余为未跟踪目录/截图/`public/ui/eggs/` 等 | `git status --short` | 已核实 |
| 曾有三个待审文件 | `src/ui/plan/EggMatchingHub.tsx`、`EggTasksPanel.tsx`、`EggMatchingHub.test.tsx` 已由 `894de06` 提交，工作区当前无改动 | `git show --stat 894de06` | 已核实 |
| 数据库迁移 | 2026-11-18 的 3 个迁移已执行（见旧 plan §1） | 沿用旧 plan 记录 | 沿用，不在本轮重跑 |

> 结论：本计划按 `779b08c..6aaf5e7` 切批。若执行时以当前 `test`（`d00739c`）为 head，只需把 `894de06` 的 3 个文件并入 R3a 重读一遍，其余两个提交是文档，不影响批次结构。

### 0.1 plan.md 的事实修正记录

| # | plan.md 原文 | 实测 | 本文件处理 |
| --- | --- | --- | --- |
| 1 | R3 写 `src/ui/plan/eggStock` | 该文件不存在；实际是 `eggStockModel.ts`、`EggStockPanel.tsx`；`src/ui/plan/` 共 35 文件 | 拆入 R3a / R3b1，逐文件点名 |
| 2 | B4 写 `functions/_lib` 18 文件 +692 −34 | 实际 **14 文件 +888 −1058**；functions 全层 20 文件 +1498 −1064 | R2a / R2b 按实测切 |
| 3 | B5 写 `schema.sql +660` | 实际 `functions/schema.sql` **+285 −6** | R2b 按实测写 |
| 4 | B12 写 `src/ui/` 其他 ≈ +700 −80 | `src/ui/` 根目录 **92 文件 +6130 −2136**；`src/ui/` 全层 128 文件 +7943 −4734 | 拆成 R3b1、R3b2、R3b3、R6a、R6b、R7a–c、R9-4a/b、R9-5a/b、R10 |
| 5 | R7（`8b97e48..081b604`）与 R5/R6 重叠 | 该段实测 84 文件 +4431 −1481，确实包含 `src/domain/petFilters*`、`src/ui/MyPets*`、`Dashboard*`、`Collection*` | **R5、R6 独立审完**；R7 只审剩余文件（R7a–R7c） |
| 6 | R9 沿用 2026-11-18 的 B1–B17 | 那 17 批按 **35 提交 / 405 文件**切的，且 B4/B5/B12 等估算已过期 | 按 51 提交重算为 R9-1…R9-6（共 **9 个子批**，见 §2） |
| 7 | `desktop/**`、`src/share/**`、`public/**`、`data/**`、`vite.config.ts`、`index.html`、`package.json` 无批次 | 实测 desktop 3 文件、src/share 2、public 3、data 1、根配置 8 | 归入 **R10** |
| 8 | §2 只写验证命令，没有通过标准 | — | 每批增加「通过标准」（见 §3） |
| 9 | §4 收尾命令缺 `npm run test:mother-groups:api` | playbook §8 有该条 | §5 补齐 |
| 10 | §5 把打包、清单、发布窗、回滚写进审查计划 | 发版口径属 `docs/发版与更新规范.md` | §6 改为一句指向该文档 |
| 11 | §0 说 `codex/friend-ui-assets-20261117`「仅作历史」，R7 又用它的提交段 | 该分支的 `8b97e48` 已在审查范围内 | §0 表格改正，R7 继续用它只是按提交段定位文件，不矛盾 |

---

## 1. 审查口径与边界

### 1.1 范围与排除

**纳入**：`src/**`、`functions/**`、`android-shell/**`、`tools/**`、`scripts/**`、`e2e/**`、`desktop/**`、`public/**`、`data/**`、`src/share/**`、根配置文件（`package.json`、`vite.config.ts`、`index.html`、`tsconfig.e2e.json`、`AGENTS.md`、`README.md`、`.gitignore`）、`docs/**`。

**排除（只登记，不逐行审）**：

- 二进制/图片（122 个，含 `docs/**/*.png|webp`、`android-shell/**/10003.webp`）；
- `dist/`、`node_modules/`、`.wrangler/`、`*.apk`、`*.tsbuildinfo`、`package-lock.json` 的格式差异；
- 根目录原型 HTML 与 `docs/prototypes/**`、`docs/设计资产/**` 的设计稿：只核对"是否与现行规范冲突 / 是否登记在台账"，不按代码审；
- 历史归档（`docs/code-review/2026-11-08/**`、`docs/复盘-*.md`）：只登记，不重审。

### 1.2 删除文件只看引用

本轮共 **19 个删除文件**（`git diff --diff-filter=D --name-only 779b08c..6aaf5e7`）：

```
android-shell/.../capture/CaptureUploadManager.java
android-shell/.../capture/CaptureUploadStore.java
android-shell/.../capture/CaptureUploader.java
android-shell/.../capture/test/CaptureUploadStoreTest.java
android-shell/.../capture/test/CaptureUploaderTest.java
e2e/collection-plans.spec.ts
functions/_lib/collectionPlans.ts
src/shared/collectionPlans.ts
src/shared/collectionPlans.test.ts
src/ui/DemandPublishSheet.test.tsx
src/ui/plan/GroupSquareView.tsx
src/ui/plan/MyCollectionView.tsx
src/ui/plan/PlanCard.tsx
src/ui/plan/PlanDetailSheet.tsx
src/ui/plan/planAlertsStore.test.ts
src/ui/plan/planCard.css
src/ui/plan/planCardModel.test.ts
src/ui/plan/planCardModel.ts
src/ui/plan/useCollectionPlans.ts
```

口径：**不审被删内容，只核对是否还有引用**。通过标准固定为三条同时满足：

1. `git grep -n "<模块名>" HEAD -- src functions tools e2e desktop public` 无生产引用（测试里引用被删测试文件也算残留）；
2. `npx tsc -b` 与 `npx tsc -p functions/tsconfig.json` 通过；
3. 相关测试命令通过（如 `npx vitest run src/ui/plan`、`npx playwright test --list`）。

### 1.3 收集计划豁免深审（已拍板）

以下文件**本轮不深审**，只核对编译与测试通过，并在对应报告里登记豁免：

- `functions/_lib/collectionGroups.ts`、`collectionGroupsHttp.ts`、`collectionGroupsStore.ts`（`+29 −764`，功能已被拆除）；
- `functions/_lib/collectionPlans.ts`（已删除）；
- `src/shared/collectionPlans.ts`（已删除）；
- 关联测试 `tools/test/collection-groups-api.test.mjs`（`+6 −430`）、`e2e/collection-plans.spec.ts`（已删除）。

**登记模板（写进 R2a / R2b / R9-5a / R9-6 报告末尾）**：

```markdown
## 豁免登记
| 文件 | 豁免理由 | 已做的核对 | 证据 |
| --- | --- | --- | --- |
| functions/_lib/collectionGroupsStore.ts | 用户拍板：收集计划本轮不深审 | tsc + collection-groups 测试 + 全仓引用检索 | 命令与输出 |
```

**豁免不等于免验证**：以下命令必须至少跑一次并记录结果：

```powershell
npx tsc -p functions/tsconfig.json
npx tsc -b
node --test tools/test/collection-groups-api.test.mjs
git grep -n "collectionPlans" HEAD -- src functions tools e2e
```

### 1.4 11-08 旧项三态

逐条核对结果见同目录 `legacy-triage.md`。本计划只在批次里引用它：已作废项不再派活；仍有效项按"仍有效"进入对应批次，并在报告里标 `（承接 11-08 <编号>）`。

### 1.5 批次纪律

- 批次之间**文件不重叠**（同一文件只出现在一个批次）；测试文件跟被测代码同批。
- 单批 **≤1300 行 diff**；唯一例外是单文件本身超过上限的 `NearbyPanelController.java`（1354 行），按 playbook §3.3「单文件单会话、两轮读、两轮汇报」处理。
- 已执行批次沿用原编号与报告路径（`R1.md`、`R2a.md`、`R2b.md`、`R3a.md`、`R3b.md`、`R4.md`），不重命名、不重跑。
- 并行 ≤3；只读阶段禁止任何 git 写操作。

### 1.6 报告末尾的「待裁决清单」

每份批次报告末尾必须附一段，**最多 3 条，每条只放一个争议点，只放真正拿不准的**（能靠跑测试或读代码直接定案的不算）：

```markdown
## 待裁决清单
### <文件:行区间> <一句话标题>
- 现状：<5 行以内的关键代码片段>
- 疑点：<可能错在哪>
- 我的倾向：<结论 + 置信度>
- 要裁决的：<一个能用「是/否/还有第三种」回答的具体问题>
```

---

## 2. 批次总表

> 规模 = 增 + 删行数（含测试）；「状态」以 **2026-11-19 08:40** 的实际报告文件为准，之后有新报告按实际追加，不要反过来改批次结构。

### 2.1 代码批次（31 批）

| 批次 | 主题 | 文件数 | +增 | −删 | 合计 | 报告 | 状态 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1a | 巡查域模型（shared） | 5 | 1070 | 0 | 1070 | `R1.md` | 已执行 |
| R1b | 换蛋撮合/迁移/蛋仓（shared+domain） | 14 | 716 | 14 | 730 | `R1.md` | 已执行 |
| R2a | 换蛋后端逻辑（functions/_lib） | 5 | 601 | 0 | 601 | `R2a.md` | 已执行 |
| R2b | 迁移/schema/换蛋接口测试 | 9 | 1246 | 6 | 1252 | `R2b.md` | 已执行 |
| R3a | 换蛋前端主流程（plan 新组件） | 16 | 1113 | 0 | 1113 | `R3a.md` | 已执行 |
| R3b1 | 需求中心模型/适配/角标 | 8 | 368 | 321 | 689 | `R3b.md` | 已执行 |
| R3b2 | 旧计划中心下线 A（删除+引用） | 6 | 4 | 1294 | 1298 | `R3b2.md` | 待执行 |
| R3b3 | 旧计划中心下线 B（删除+引用） | 5 | 0 | 1292 | 1292 | `R3b3.md` | 待执行 |
| R4 | 账号体系（用户名+密码） | 9 | 802 | 132 | 934 | `R4.md` | 已执行 |
| R5 | 领域规则（体型/奖牌/档位） | 17 | 394 | 92 | 486 | `R5.md` | 已执行 |
| R6a | 我的精灵背包（大组件） | 2 | 1207 | 73 | 1280 | `R6a.md` | 已执行 |
| R6b | 看板/收集/覆盖度+筛选 store | 13 | 871 | 292 | 1163 | `R6b.md` | 已执行 |
| R7a | 朋友 PR 剩余：列表与卡片 | 12 | 729 | 425 | 1154 | `R7a.md` | 待执行 |
| R7b | 朋友 PR 剩余：家园/母本 | 10 | 768 | 269 | 1037 | `R7b.md` | 待执行 |
| R7c | 朋友 PR 剩余：建议/编辑/引导 | 10 | 546 | 296 | 842 | `R7c.md` | 待执行 |
| R8a1 | Android 附近悬浮面板（单文件例外） | 1 | 1354 | 0 | 1354 | `R8a1.md` | 待执行 |
| R8a2 | 附近面板模型/几何 | 4 | 949 | 0 | 949 | `R8a2.md` | 待执行 |
| R8a3 | 采集控制/战斗悬浮/资源 | 10 | 872 | 164 | 1036 | `R8a3.md` | 待执行 |
| R8a4 | 上传链路删除（只查引用） | 6 | 0 | 951 | 951 | `R8a4.md` | 待执行 |
| R8b1 | 壳更新链路 | 5 | 1127 | 0 | 1127 | `R8b1.md` | 待执行 |
| R8b2 | 切服/身份/主 Activity/构建配置 | 11 | 1197 | 79 | 1276 | `R8b2.md` | 待执行 |
| R9-1 | 采集链路（collector） | 15 | 730 | 130 | 860 | `R9-1.md` | 待执行 |
| R9-2a | 附近 payload 契约 | 2 | 611 | 44 | 655 | `R9-2a.md` | 待执行 |
| R9-2b | 附近推送/目标/筛选 | 5 | 528 | 252 | 780 | `R9-2b.md` | 待执行 |
| R9-3 | PCAP 解析/雷达/稀有规则 | 18 | 886 | 106 | 992 | `R9-3.md` | 待执行 |
| R9-4a | 附近页/地图/错误边界 | 6 | 726 | 190 | 916 | `R9-4a.md` | 待执行 |
| R9-4b | 服务器地址/Profile/换页 store | 8 | 668 | 8 | 676 | `R9-4b.md` | 待执行 |
| R9-5a | 需求中心残余/埋点/发布弹层 | 10 | 142 | 905 | 1047 | `R9-5a.md` | 待执行 |
| R9-5b | 采集面板/小组资源/共享偏好 | 13 | 297 | 263 | 560 | `R9-5b.md` | 待执行 |
| R9-6 | e2e/脚本/数据管线 | 17 | 464 | 682 | 1146 | `R9-6.md` | 待执行 |
| R10 | 工程配置/桌面/分享/数据资产 | 约 30 | 约 880 | 约 70 | 约 950 | `R10.md` | 待执行 |

### 2.2 文档批次（7 批，只审"文档与代码是否一致"）

| 批次 | 主题 | 文件数 | 规模 | 报告 | 状态 |
| --- | --- | --- | --- | --- | --- |
| R11a1 | 规范类文档（发版/交互/面板/部署） | 9 | 约 760 | `R11a1.md` | 待执行 |
| R11a2 | 换蛋方案与交接文档 | 7 | 约 1276 | `R11a2.md` | 待执行 |
| R11a3 | superpowers 计划与设计记录 | 9 | 约 674 | `R11a3.md` | 待执行 |
| R11b | 原型/设计资产（登记+一致性抽检） | 约 30 | 约 3000 | `R11b.md` | 待执行 |
| R11c1 | 评审与复盘归档 | 4 | 约 845 | `R11c1.md` | 待执行 |
| R11c2 | 协作/手册/机器人文档 | 6 | 约 1042 | `R11c2.md` | 待执行 |
| R11d | 图片与二进制登记 | 122 | 0 | `R11d.md` | 待执行 |

### 2.3 51 个提交 → 批次映射

| 提交 | 批次 |
| --- | --- |
| `55f9df3` `d529f95` `b25ee6c` `82f3336` `9800109` `66d033e` `7c4cb46` `5b4ed60` `1a54d78` `343a5f0` `9fbfec0` `63a0362` | R10（release 清单/网页发布脚本） |
| `1140e96` | R8a3 |
| `fdf5b7d` `7b0a1e9` `e7422f0` `6aaf5e7` | R8b1 / R8b2 |
| `2975b3a` `6b722f5` `d3d5bad` `f9d98a8` | R8a1 / R8a2 / R8a3 |
| `47fb54d` `fa42dae` | R9-2a / R9-2b |
| `736e181` | R9-1 |
| `aecef36` `130b270` `f1e5b04` `88bce8d` `facf31b` `ca6f028` `2c1ac40` `43f1639` | R1a / R2a / R2b |
| `8b97e48` | R11b（设计资产） |
| `3dacef9` `de0b394` `f3a6c48` `081b604` | R6a / R6b / R7a–R7c |
| `2095137` | R3b1（homeEggAdapter） |
| `f40640a` | R10（桌面改名/迁移） |
| `85df1cd` `d3a7f99` `6cbf8df` `106e72f` `e6ff1e9` | R11a / R11c |
| `284120e` | R8a / R8b |
| `dd23006` | R5 |
| `87a3b71` `b9e0628` | R4 / R2b |
| `60153f9` `673a618` `894de06` | R3a |
| `81425be` | 跨批（merge，按文件归属） |

---

## 3. 每批详情

### R1a 巡查域模型（shared）

- **文件（5，+1070 −0）**：`src/shared/eggPatrol.ts` +261、`eggPatrol.test.ts` +127、`eggWorkflow.ts` +389、`eggWorkflow.test.ts` +274、`eggTaskActions.ts` +19。
- **重点**：上窝（`placed`）与产出（`produced/hatched`）分步提醒的先后、去重与不可达状态；`eggTaskActions` 与任务重建（`rebuildTask`）的关系；时间窗口跨天/时区；测试断言是否被改松（与 `779b08c` 对比）。
- **通过标准**：报告覆盖 5 个文件；每条结论有 `文件:行`；`npx vitest run src/shared/eggPatrol.test.ts src/shared/eggWorkflow.test.ts` 通过；待裁决清单 ≤3 条。
- **报告**：`docs/code-review/2026-11-19/R1.md`（已执行，覆盖 R1a+R1b）。

### R1b 换蛋撮合/迁移/蛋仓（shared+domain）

- **文件（14，+716 −14）**：`src/shared/eggMatching.ts` +226、`eggMatching.test.ts` +133、`eggMigration.ts` +84、`eggMigration.test.ts` +50、`uuid.ts` +15、`uuid.test.ts` +24、`motherGroups.ts` +7−7、`collectionGroups.ts` +4−4；`src/domain/eggInventory.ts` +56、`eggInventory.test.ts` +38、`parseBackup.ts` +40、`parseBackup.test.ts` +22、`backup.ts` +4−3、`types.ts` +13。
- **重点**：`give`/`return` 对称性；多选、空值、别名归一化；备份解析容错；`eggInventory` 汇总口径。
- **通过标准**：`npx vitest run src/shared src/domain/eggInventory.test.ts src/domain/parseBackup.test.ts` 通过；覆盖所有文件。
- **报告**：`R1.md`（已执行）。

### R2a 换蛋后端逻辑（functions/_lib）

- **文件（5，+601）**：`eggPatrol.ts` +158、`eggPatrolStore.ts` +79、`eggMatching.ts` +155、`eggReminders.ts` +70、`eggBotBridge.ts` +139。
- **重点**：唯一索引让位（`egg_patrol_one_egg` 冲突时覆盖还是报错）；限频维度与失败是否计数；条件更新（`WHERE status = ?`）幂等；D1 事务边界；机器人桥失败是否影响主流程、是否泄露内部信息；`ca6f028` 的"仅测试环境可用"判断能否被伪造。
- **通过标准**：`npx tsc -p functions/tsconfig.json` 通过；结论有行号；**报告必须含「豁免登记」**（收集计划 `collectionGroups*`）。
- **报告**：`R2a.md`（已执行）。

### R2b 迁移/schema/换蛋接口测试

- **文件（9，+1246 −6）**：`functions/migrations/2026-11-16-egg-matching.sql` +226、`2026-11-16-egg-patrol.sql` +38、`2026-11-18-egg-patrol-placement.sql` +18、`2026-11-18-egg-patrol-repeat-reminders.sql` +29、`2026-11-18-accounts-username-password.sql` +14；`functions/schema.sql` +285−6；`tools/test/egg-patrol-api.test.mjs` +353、`egg-matching-api.test.mjs` +275、`verify-mother-groups-schema.mjs` +8。
- **重点**：迁移幂等与 CHECK 变更对旧数据的兼容；迁移顺序依赖；`schema.sql` 与迁移一致；唯一索引重建是否可能留下重复行；测试是否用 sleep 掩盖竞态。**只审 SQL 文本，不连库、不重跑迁移**。
- **通过标准**：`node tools/test/verify-mother-groups-schema.mjs` 通过；`node --test tools/test/egg-patrol-api.test.mjs` 通过（跑不了则注明）；报告含豁免登记。
- **报告**：`R2b.md`（已执行）。

### R3a 换蛋前端主流程（plan 新组件）

- **文件（16，+1113）**：`EggMatchingHub.tsx` +238、`EggMatchingHub.test.tsx` +102、`EggTasksPanel.tsx` +100、`EggTasksPanel.test.tsx` +126、`EggDemandCard.tsx` +44、`EggDemandCard.test.tsx` +28、`EggDemandEditor.tsx` +49、`EggDemandEditor.test.tsx` +27、`EggStockPanel.tsx` +74、`EggStockPanel.test.tsx` +71、`EggLineSummary.tsx` +24、`EggLineSummary.test.tsx` +15、`EggBotConnection.tsx` +50、`EggBotConnection.test.tsx` +33、`useEggMatching.ts` +74、`useEggMatching.test.tsx` +58。
- **重点**：广场状态条与"只看我能接"；需求两块去重；统一入口的返回与缓存；双行确认防连点；`memo`/`useMemo` 依赖；375/390 布局；`894de06` 的单行化是否溢出、分区计数是否与列表一致。
- **通过标准**：`npx vitest run src/ui/plan` 通过；三个曾被列出的工作区文件按 HEAD 版本审并在报告注明。
- **报告**：`R3a.md`（已执行）。

### R3b1 需求中心模型/适配/角标

- **文件（8，+368 −321）**：`src/ui/plan/eggStockModel.ts` +125、`eggStockModel.test.ts` +115、`eggTime.ts` +27、`eggTime.test.ts` +21、`homeEggAdapter.ts` +193、`homeEggAdapter.test.ts` +117、`usePlanBadge.ts` +23−9、`usePlanBadge.test.tsx` +68。
- **重点**：家园蛋按父母推算属性的缺失/越界兜底；蛋仓汇总口径；倒计时在后台恢复时的负值；角标登出/切账号清零。
- **通过标准**：`npx vitest run src/ui/plan src/ui/plan/eggStockModel.test.ts` 通过；`npx tsc -b` 通过。
- **报告**：`R3b.md`（已执行）。

### R3b2 旧计划中心下线 A（删除+引用）

- **文件（6，+4 −1294）**：`src/ui/plan/GroupPlanHub.tsx` +4−506（改为 EggMatchingHub 包装）、`GroupSquareView.tsx` −232（删）、`MyCollectionView.tsx` −233（删）、`useCollectionPlans.ts` −148（删）、`planAlertsStore.ts` −67（删）、`planAlertsStore.test.ts` −108（删）。
- **重点**：按 §1.2 的删除口径做引用核对；`GroupPlanHub` 包装后的 props 透传是否完整；旧路由/深链是否还有入口。
- **通过标准**：`git grep` 无残留引用；`npx tsc -b`；`npx vitest run src/ui/plan` 通过；报告附"引用核对表"。
- **报告**：`R3b2.md`（待执行）。

### R3b3 旧计划中心下线 B（删除+引用）

- **文件（5，+0 −1292）**：`PlanCard.tsx` −342、`PlanDetailSheet.tsx` −323、`planCardModel.ts` −296、`planCardModel.test.ts` −278、`planCard.css` −53。
- **重点**：同 R3b2；额外核对样式类名是否仍在别处引用、e2e 选择器是否残留。
- **通过标准**：同 R3b2；`npx playwright test --list` 通过。
- **报告**：`R3b3.md`（待执行）。

### R4 账号体系（用户名+密码）

- **文件（9，+802 −132）**：`functions/_lib/auth.ts` +152−7、`util.ts` +61、`router.ts` +25−4、`src/api/session.ts` +39−18、`src/ui/AccountPanel.tsx` +271−88、`AccountPanel.test.tsx` +67−15、`migrations/2026-11-18-accounts-username-password.sql` +14、`scripts/reset-password.mjs` +90、`reset-recovery-code.mjs` +83。
- **重点**：PBKDF2 参数与常量时间比较；用户名归一化与唯一索引冲突；老账号 setup 能否被旧 token 劫持；登录失败限频/枚举；脚本不落盘明文。
- **通过标准**：`npx tsc -p functions/tsconfig.json` + `npx vitest run src/api` 通过；报告无敏感值。
- **报告**：`R4.md`（已执行）。

### R5 领域规则（体型/奖牌/档位）

- **文件（17，+394 −92）**：`src/domain/petFilters.ts` +85−8、`petFilters.test.ts` +74−13、`motherCriteria.ts` +23−10、`motherCriteria.test.ts` +40−10、`demandCriteria.ts` +12−2、`demandCriteria.test.ts` +18−5、`catalog.ts` +65−12、`catalog.test.ts` +3−1、`petIcons.ts` +15−7、`petIcons.test.ts` +8−3、`productionLines.test.ts` +3−3、`motherResource.test.ts` +2−2、`motherSharing.test.ts` +2−2、`types.ts` +13；`src/shared/bodySize.js` +19−8、`bodySize.d.ts` +7−1；`src/pcap/bodySize.test.ts` +18−5。
- **重点**：奖牌判定与孵蛋判定是否真正分离（`dd23006`）；目标档位单选后旧多选字段是否还有调用方；身高/体重边界（0、负数、NaN）；与 `docs/domain/**` 逐条对齐；排序稳定性。
- **通过标准**：`npx vitest run src/domain src/pcap/bodySize.test.ts` 通过；每条结论引 `docs/domain/**` 或既有写法。
- **报告**：`R5.md`（待执行）。

### R6a 我的精灵背包（大组件）

- **文件（2，+1207 −73）**：`src/ui/MyPets.tsx` +785−73、`MyPets.test.tsx` +422。
- **重点**：785 行组件的渲染成本与 `useMemo` 依赖；筛选计数一致性；空账号；卡片展示开关持久化；375/390 布局。
- **通过标准**：`npx vitest run src/ui/MyPets.test.tsx` 通过；`npx tsc -b` 通过。
- **报告**：`R6a.md`（待执行）。

### R6b 看板/收集/覆盖度+筛选 store

- **文件（13，+871 −292）**：`Dashboard.tsx` +195−96、`Dashboard.test.tsx` +214−22、`Collection.tsx` +32−47、`Collection.test.tsx` +40−9、`Coverage.tsx` +1−19、`Coverage.test.tsx` +28−26、`CoverageFilterBar.tsx` +57−33、`CoverageIntroCard.tsx` +7−3、`CoverageIntroCard.test.tsx` +5−3、`coverageFilterStore.ts` +9−6、`coverageFilterStore.test.ts` +6−8、`myPetsFilterStore.ts` +155−13、`myPetsFilterStore.test.ts` +122−7。
- **重点**：看板空账号是否 NaN；"共 N 只"口径；覆盖度边界（0/100%/分母 0）；筛选持久化迁移；与被删 `Coverage.tsx` 代码相关的死链接。
- **通过标准**：`npx vitest run src/ui/Dashboard.test.tsx src/ui/Collection.test.tsx src/ui/Coverage.test.tsx src/ui/myPetsFilterStore.test.ts` 通过。
- **报告**：`R6b.md`（待执行）。

### R7a 朋友 PR 剩余：列表与卡片

- **文件（12，+729 −425）**：`PetCard.tsx` +96−58、`PetCard.test.tsx` +72、`PetCardLayout.tsx` +157、`PetCompactCard.tsx` +51−145、`PetCompactCard.test.tsx` +28−17、`PetList.tsx` +34−97、`PetList.test.tsx` +18−16、`FilterAccordion.tsx` +118−36、`AccountFilterBar.tsx` +105−49、`AccountFilterBar.test.tsx` +43、`primitives/FilterPanel.tsx` +7−3、`ProgressCard.tsx` −4。
- **重点**：布局重排后的断点溢出；瘦身删掉的字段是否还有使用方；筛选展开状态被重置；账号删除后的陈旧选中项；props 契约变化。
- **通过标准**：`npx vitest run src/ui/PetCard.test.tsx src/ui/PetCompactCard.test.tsx src/ui/PetList.test.tsx src/ui/AccountFilterBar.test.tsx` 通过；全局检索确认无残留调用。
- **报告**：`R7a.md`（待执行）。

### R7b 朋友 PR 剩余：家园/母本

- **文件（10，+768 −269）**：`Home.tsx` +158−75、`Home.test.tsx` +49−13、`HomePairDiagram.tsx` +106−30、`HomePairDiagram.test.tsx` +134、`HomeDemandPlacements.tsx` +30−14、`HomeDemandPlacements.test.tsx` +13−3、`MotherView.tsx` +62−134、`MotherView.test.tsx` +49、`MotherCriteriaMedals.tsx` +103、`MotherCriteriaMedals.test.tsx` +64。
- **重点**：配对图与需求落位数据源一致；`MotherView` 删除 134 行后的入口与信息完整性；奖牌展示与 R5 口径一致；`HomeDemandPlacements` 的"已上窝"取消同步（承接 11-08 F-4，见 `legacy-triage.md`）。
- **通过标准**：`npx vitest run src/ui/Home.test.tsx src/ui/HomePairDiagram.test.tsx src/ui/MotherView.test.tsx src/ui/HomeDemandPlacements.test.tsx` 通过。
- **报告**：`R7b.md`（待执行）。

### R7c 朋友 PR 剩余：建议/编辑/引导

- **文件（10，+546 −296）**：`SuggestionCard.tsx` +96−116、`SuggestionCard.test.tsx` +57−7、`suggestionCardStore.ts` +18−14、`NatureSelectionContent.tsx` +191、`TargetGradeSelector.tsx` +76、`CollectionTargetEditor.tsx` +18−127、`CollectionTargetEditor.test.tsx` +48−17、`tour.ts` +26−15、`tour.test.ts` +14、`useCollectionSummary.ts` +2。
- **重点**：建议排序/去重/空态；store 迁移丢状态；单选兼容旧数组；引导分段指向已删除元素。
- **通过标准**：`npx vitest run src/ui/SuggestionCard.test.tsx src/ui/tour.test.ts src/ui/CollectionTargetEditor.test.tsx` 通过。
- **报告**：`R7c.md`（待执行）。

### R8a1 Android 附近悬浮面板（单文件例外）

- **文件（1，+1354）**：`android-shell/.../capture/NearbyPanelController.java`。
- **重点**：UI 线程 IO/JSON；`WebView` 生命周期与重复 `loadUrl`；面板定位公式 `panel=f(orb)`；频繁刷新内存抖动；异常捕获。
- **通过标准**：单会话两轮读、两轮汇报；`./gradlew compileReleaseJavaWithJavac` 通过（不可用则注明并静态审）；报告 >1300 行例外说明。
- **报告**：`R8a1.md`（待执行）。

### R8a2 附近面板模型/几何

- **文件（4，+949）**：`NearbyOverlayModel.java` +434、`NearbyOverlayModelTest.java` +348、`OverlayGeometry.java` +96、`OverlayGeometryTest.java` +71。
- **重点**：坐标换算（屏幕方向/缩放/状态栏）；无标定兜底是否 NaN/越界；标签与箭头一致性。
- **通过标准**：`./gradlew test` 或对应测试通过（不可用则注明）；模型与测试断言一致。
- **报告**：`R8a2.md`（待执行）。

### R8a3 采集控制/战斗悬浮/资源

- **文件（10，+872 −164）**：`BattleOverlayController.java` +387−121、`CaptureController.java` +16−34、`CaptureState.java` +15−1、`CaptureStateTest.java` +13、`CaptureBridgePolicy.java` +13−3、`CaptureBridgePolicyTest.java` +10、`CaptureVpnService.java` +4−4、`assets/capture-bridge.js` +5−1、`assets/overlay-map.html` +389、`assets/maps/maps.json` +20。
- **重点**：`orb` 被系统回收后的重建（承接 11-08 A-2）；通知 id 与权限（承接 A-3）；裁剪代次（承接 A-1）；战斗守卫卡清理（`736e181`）。
- **通过标准**：`compileReleaseJavaWithJavac` 通过；三条承接项的现状写进报告。
- **报告**：`R8a3.md`（待执行）。

### R8a4 上传链路删除（只查引用）

- **文件（6，−951）**：`CaptureUploader.java` −350、`CaptureUploaderTest.java` −282、`CaptureUploadManager.java` −127、`CaptureUploadStore.java` −133、`CaptureUploadStoreTest.java` −59、`maps/10003.webp`（二进制，登记）。
- **重点**：按 §1.2 只查引用：`MainActivity`、`capture-bridge.js`、Manifest 权限、`strings.xml` 是否还有残留。
- **通过标准**：引用核对表 0 残留；编译通过。
- **报告**：`R8a4.md`（待执行）。

### R8b1 壳更新链路

- **文件（5，+1127）**：`update/UpdateController.java` +583、`UpdateManager.java` +171、`UpdateManagerTest.java` +238、`UpdateManifest.java` +57、`UpdateManifestTest.java` +78。
- **重点**：`e7422f0` 强引用是否造成泄漏、回调是否回主线程；失败原因可读性；强更门槛；下载校验与 `FileProvider`。
- **通过标准**：`compileReleaseJavaWithJavac` + 相关测试通过（不可用则注明）。
- **报告**：`R8b1.md`（待执行）。

### R8b2 切服/身份/主 Activity/构建配置

- **文件（11，+1197 −79）**：`ServerConfig.java` +261、`ServerConfigTest.java` +83、`MainActivity.java` +343−49、`IdentityRescue.java` +232、`app/build.gradle` +262−11、`AndroidManifest.xml` +5−3、`res/values/strings.xml` +1−1、`res/xml/file_paths.xml` +2、`.gitignore` +5、`README.md` +5−6、`THIRD_PARTY.md` +3−4。
- **重点**：通道/默认站一致性断言；切服后身份（localStorage 按 origin）处理；身份救援是否可逆；保活重建；`6aaf5e7` 版本号 42。
- **通过标准**：`compileReleaseJavaWithJavac` 通过；版本号三处一致（build.gradle / 清单 / 更新地址）。
- **报告**：`R8b2.md`（待执行）。

### R9-1 采集链路（collector）

- **文件（15，+730 −130）**：`useCaptureProgress.ts` +234−17、`useCaptureProgress.test.tsx` +66−3、`appUpdate.ts` +111、`nativeCollector.ts` +41−37、`nativeCollector.test.ts` −15、`battleTargetStore.ts` +44−14、`captureProgress.ts` +5−2、`desktopOverlay.ts` +13、`nearbySelfTrack.ts` +29、`nearbyStore.ts` +39、`nearbyStore.test.ts` +34、`perfProbe.ts` +89、`useNearbyFeed.ts` +24−7、`inspectCapture.ts` +1−1。
- **重点**：定时器/订阅清理；进度回退；增量读取仍全量复制（承接 11-08 O-6）；128MiB 上限（承接 O-5）；旧壳回退路径。
- **通过标准**：`npx vitest run src/collector` 通过；两条承接项写进报告。
- **报告**：`R9-1.md`（待执行）。

### R9-2a 附近 payload 契约

- **文件（2，+611 −44）**：`src/nearby/overlayPayload.ts` +223−16、`overlayPayload.test.ts` +388−28。
- **重点**：`demandHits`/`alert` 语义分离（承接 O-4）；`selfEstimated` 与 NaN（承接 O-8）；字段缺省对旧壳兼容；payload 体积。
- **通过标准**：`npx vitest run src/nearby/overlayPayload.test.ts` 通过。
- **报告**：`R9-2a.md`（待执行）。

### R9-2b 附近推送/目标/筛选

- **文件（5，+528 −252）**：`useNearbyOverlayPush.ts` +209、`useNearbyOverlayPush.test.tsx` +185、`nearbyTargetStore.ts` +90、`nearbyTargetStore.test.ts` +66、`nearbyFilterStore.ts` +100。
- **重点**：推送节流/合并、页面隐藏后是否继续；应用级挂载的生命周期；筛选与命中口径。
- **通过标准**：`npx vitest run src/nearby` 通过。
- **报告**：`R9-2b.md`（待执行）。

### R9-3 PCAP 解析/雷达/稀有规则

- **文件（18，+886 −106）**：`src/pcap/wildNearby.ts` +13−1、`wildNearby.test.ts` +207−2、`nearbyRadar.ts` +23−7、`nearbyRadar.test.ts` +37−4、`selfOdometry.ts` +29−5、`selfOdometry.test.ts` +37−4、`nearbyRetain.ts` +5−3、`nearbyRetain.test.ts` +6−4、`rareRules.ts` +15−8、`rareRules.test.ts` +29−16、`demandMatch.ts` +6−4、`demandMatch.test.ts` +18−5、`liveWindow.test.ts` +36、`readCaptureFile.ts` +1−1、`decodeCapture.worker.ts` +1−1；`src/pcap-decoder/.../core.js` +393−40、`core.d.ts` +29−3、`generated/catalog.json` +1−1。
- **重点**：二进制边界与越界读取；异常包是否中断全局；雷达方位与地图一致性（11-08 O-2 已修，复核不回归）；稀有/需求口径。
- **通过标准**：`npx vitest run src/pcap src/pcap-decoder` 通过。
- **报告**：`R9-3.md`（待执行）。

### R9-4a 附近页/地图/错误边界

- **文件（6，+726 −190）**：`Nearby.tsx` +377−103、`Nearby.test.tsx` +84−34、`NearbyErrorBoundary.tsx` +88、`NearbyMap.tsx` +104−48、`NearbyMap.test.ts` +63−1、`NearbyRadar.tsx` +10−4。
- **重点**：错误边界兜底不白屏；列表/地图切换状态；大列表性能；推送已迁应用级后的职责边界。
- **通过标准**：`npx vitest run src/ui/Nearby.test.tsx src/ui/NearbyMap.test.ts` 通过。
- **报告**：`R9-4a.md`（待执行）。

### R9-4b 服务器地址/Profile/换页 store

- **文件（8，+668 −8）**：`ServerAddressPanel.tsx` +230、`ServerAddressPanel.test.tsx` +165、`serverEnv.ts` +11、`serverEnv.test.ts` +23、`Profile.tsx` +110−5、`Profile.test.tsx` +72−3、`swapViewStore.ts` +33、`swapViewStore.test.ts` +24。
- **重点**：改服务器地址是否把正式用户导到测试站（AGENTS.md 铁律）；默认站与通道断言；资料页迁移。
- **通过标准**：`npx vitest run src/ui/ServerAddressPanel.test.tsx src/ui/Profile.test.tsx src/ui/swapViewStore.test.ts` 通过。
- **报告**：`R9-4b.md`（待执行）。

### R9-5a 需求中心残余/埋点/发布弹层

- **文件（10，+142 −905）**：`src/api/collectionGroups.ts` +4−320、`collectionGroups.test.ts` +1−123、`src/api/analytics.ts` +3−75、`analytics.test.ts` −90、`src/ui/DemandPublishSheet.tsx` +24−179、`DemandPublishSheet.test.tsx` −68、`useClaimedDemands.ts` +25−5、`useClaimedDemands.test.tsx` +57−8、`useDemandCenter.ts` +9−2、`useTabViewTracking.ts` +19。
- **重点**：大幅删减后是否留死导出/半截 UI；发布弹层草稿重置（承接 11-08 F-8）；`tab_view` 重复上报（承接 M-4）；失败埋点是否已随功能移除。
- **通过标准**：`npx vitest run src/api src/ui/DemandPublishSheet.test.tsx`（测试已删则跑剩余相关）通过；`npx tsc -b` 通过。
- **报告**：`R9-5a.md`（待执行）。

### R9-5b 采集面板/小组资源/共享偏好

- **文件（13，+297 −263）**：`NativeCollectorPanel.tsx` +14−59、`NativeCollectorPanel.test.tsx` +3−38、`NativeCollectorPanel.completion.test.tsx` +1−6、`MotherGroupResources.tsx` +29−43、`CollectionGroups.tsx` +12−7、`collectionGroupStore.ts` +13、`motherCriteriaStore.ts` +8−2、`ImportPanel.tsx` +11−10、`src/api/sharedPrefs.ts` +124、`sharedPrefs.test.ts` +65、`src/api/eggMatching.ts` +56、`eggMatching.test.ts` +33、`src/api/eggPatrol.ts` +26。
- **重点**：上传链路移除后的空实现是否静默失败；`sharedPrefs` 合并策略与敏感字段；面板空态。
- **通过标准**：`npx vitest run src/api src/ui/ImportPanel.test.tsx` 通过。
- **报告**：`R9-5b.md`（待执行）。

### R9-6 e2e/脚本/数据管线

- **文件（17，+464 −682）**：`scripts/deploy-web.mjs` +158、`tools/test/deploy-web.test.mjs` +26、`scripts/design-assets.mjs` +110、`design-assets.test.mjs` +25、`e2e/collection-plans.spec.ts` −290、`e2e/helpers/motherGroupsMock.ts` +5−334、`android-collector.spec.ts` +2−27、`coverage.spec.ts`、`dashboard.spec.ts`、`pwa.spec.ts`、`tour.spec.ts`、`product-states.spec.ts`、`mother-sharing*.spec.ts`（2 个）、`share-target.spec.ts`、`tools/data-pipeline/sync-decoder-catalog.mjs` +89、`trim-catalog.mjs` +17。
- **重点**：正式站保护与 bundle 断言能否绕过；脚本是否会把内测包写进正式清单；删除 e2e 后有无残留引用；数据管线幂等。
- **通过标准**：`node --test tools/test/deploy-web.test.mjs scripts/design-assets.test.mjs` + `npx playwright test --list` 通过。
- **报告**：`R9-6.md`（待执行）。

### R10 工程配置/桌面/分享/数据资产

- **文件（约 30，约 +880 −70）**：
  - 根配置：`package.json` +7−6、`vite.config.ts` +5−5、`index.html` +1−1、`tsconfig.e2e.json` +1−1、`AGENTS.md` +60−3、`README.md` +1−1、`.gitignore` +0−5、`package-lock.json`（格式差异，登记）；
  - `desktop/`：`main.cjs` +17−3、`userdata.cjs` +82、`capture/manager.cjs` −1；
  - `public/`：`_headers` +5、`android/version.json` +7、`android/version-18.json` +7；
  - `data/`：`changes/2026-11-10-s5-2026-10-31.md` +8；
  - `src/share/`：`shareTarget.ts` +1−1、`androidShell.test.ts` +4−3；
  - 数据资产：`src/data/eggIconUrls.json` +626、`catalog.gen.json` +1−1；
  - `src/App.tsx` +15−25、`src/sw.ts` +1−1、`src/ui/formatPercent.ts` +5、`StudMatrix.tsx` +4−4、`BattleHudOrb.tsx` +4−3、`CaptureProgressView.tsx` +1−1、`CaptureProgressView.rareAlert.test.tsx` +1−1、`LiveCaptureBanner.tsx` +1−1、`LiveCaptureBanner.test.tsx` +1−1、`navigation.ts` +1−1、`listViewStore.test.ts` +1−1、`groupAutoPublish.test.ts` +1−1、`CollectionGroupSetup.test.tsx` +1−1、`TourOverlay.test.tsx` +1−1。
- **重点**：`deploy-web.mjs` 之外的发布清单/版本号一致性；桌面 `userdata.cjs` 迁移是否可逆；`manager.cjs` 的 128MiB 行为（承接 O-5）；`package.json` 的 `main` 字段（承接 E-2）；分享入口。
- **通过标准**：`npx tsc -b`；`npx vitest run src/ui` 中相关文件；`node tools/lint-copy.mjs` 结果与基线一致。
- **报告**：`R10.md`（待执行）。

### 文档批次（R11）

- **R11a1 规范类（9 文件，约 760 行）**：`docs/发版与更新规范.md`、`docs/产品交互规范.md`、`docs/手机悬浮窗-面板规格.md`、`docs/手机端悬浮窗-方案.md`、`docs/部署到公网.md`、`docs/手机使用说明.md`、`docs/PC版适配方案.md`、`docs/待确认决策.md`、`docs/domain/数据字段说明.md`。重点：文档描述的接口/默认站/尺寸/图鉴数量是否与代码一致；**只记差异，不改文档**。
- **R11a2 换蛋方案与交接（7 文件，约 1276 行）**：`docs/换蛋撮合-落地方案-2026-11-15.md`、`docs/换蛋-家蛋进蛋仓-方案-2026-11-17.md`、`docs/换蛋-家蛋进蛋仓-交接-2026-11-17.md`、`docs/换蛋撮合-工作交接-2026-11-15.md`、`docs/换蛋撮合-工作交接-2026-11-16.md`、`docs/换蛋发布前检查-2026-11-16.md`、`docs/收集计划-上正式-评审清单-2026-11-14.md`。
- **R11a3 superpowers 计划（9 文件，约 674 行）**：`docs/superpowers/plans/**` 7 篇 + `docs/superpowers/specs/**` 2 篇。
- **R11b 原型/设计资产（约 30 文件，约 3000 行 + 图片）**：根目录 9 个 `*.html` 原型、`docs/prototypes/**`、`docs/设计资产/**`。**只做登记与"与现行规范冲突"抽检**，不逐行审；核对 `registry.json` 与实际文件是否一致。
- **R11c1 评审与复盘（4 文件，约 845 行）**：`docs/code-review/2026-11-08/review-report.md`、`docs/code-review/2026-11-18/plan.md`、`docs/复盘-2026-11-08-踩坑与改进.md`、`docs/复盘-2026-11-11-更新事故.md`。
- **R11c2 协作/手册/机器人（6 文件，约 1042 行）**：`docs/协作/朋友协作与更新.md`、`docs/机器人能力全景-2026-11-17.md`、`docs/远行商人推送执行手册-2026-11-17.md`、`docs/催进度执行手册-2026-11-17.md`、`docs/spec/1.3.6-1.3.7-nearby/spec.md`、`tasks.md`。
- **R11d 图片与二进制登记（122 文件，0 行）**：只列清单与用途，确认没有生产引用；不审内容。

> 文档批次同样要求：报告路径、通过标准（文档中的接口/路径/默认站/数量与代码一致，或明确标注为历史方案）、待裁决清单。

---

## 4. 分发与执行

1. 用同目录 `briefs-revised.md` 里的自包含简报派活；每批一个会话，并行 ≤3。
2. 只读阶段禁止改代码、禁止 git 写操作；报告只写自己那一份。
3. 每批完成后在会话里给三行结论（审出 N 条、最该先修的一条、需要拍板的一条），再开下一批。
4. 中途来了新提交：按 playbook §11 只审差异面，并在 `legacy-triage.md` 追加三态判定。

## 5. 修复与收尾验收

- 修复顺序 高 → 中 → 低；每批 ≤3 问题 / 3 文件；独立提交 `fix(cr-<批次>-<序号>): …`，提交前记 `git rev-parse HEAD`。
- 禁止：删文件、改迁移/`schema.sql`、改发版脚本与清单、改 lockfile、`reset --hard`/force push、顺手重构、为过测试改断言。
- 收尾只跑一次（与 playbook §8 对齐）：

```powershell
npx vitest run
npx tsc -b
npx tsc -p functions/tsconfig.json
npm run test:data-pipeline
npm run test:mother-groups:api
npx playwright test --list
npx playwright test <与本次改动最相关的 2~3 个 spec>
```

- 合并报告：`docs/code-review/2026-11-19/report.md`（结论、统计、修复记录、剩余风险、一页速览）。

## 6. 发版提示

本计划只管审查；打包、清单、发布窗、回滚等口径一律以 `docs/发版与更新规范.md` 为准，本文件不复制、不替代。

## 7. 与 playbook 的偏离

| 偏离点 | playbook 原文 | 本计划做法 | 理由 |
| --- | --- | --- | --- |
| 域模型不排在最前 | §3.5「域模型先审」 | R5 排在 R4 之后、UI 之前 | R1/R2/R3 是换蛋主链路且 `R1`–`R4` 已并行执行；R5 的奖牌/档位口径只影响 R6/R7，仍能在 UI 之前给出结论 |
| 单批上限的例外 | §3.2「单批 ≤1300 行」 | `NearbyPanelController.java` 1354 行单独一批 | 单文件无法再拆；按 §3.3 单会话两轮读处理 |
| 文档/原型入范围 | §1 默认排除生成物与截图 | 文档单列 R11，原型只登记抽检 | 本轮 523 文件里文档占 150；不审会让"已覆盖全部范围"不成立，但按文档强度审 |
| 已执行批次不重切 | §3 要求按目录重切 | R1–R4 沿用原编号 | 报告已在 08:24–08:31 产出，重切会让编号与已写报告脱节 |
| 豁免深审 | playbook 无此机制 | §1.3 的豁免登记 | 用户已拍板收集计划本轮不深审，必须留痕 |

## 8. 范围外登记（只记录，不展开）

- 122 个二进制文件（图片/webp/apk 等）：不审内容。
- `package-lock.json` 的格式差异：只确认没有依赖升级意图。
- 根目录与 `docs/` 下的历史原型 HTML：只登记，不按代码审。
- 未跟踪目录（`.preview/`、`2026-11-12/`、`2026-11-15/工作区`、`2026-11-16/17/18/`、`output/`、`public/ui/eggs/`、`.playwright-cli/`、`tmp-inspect-pcap.mjs`）：**不纳入本轮**，不要提交、不要清理。
