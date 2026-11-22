# 2026-11-19 发版前代码审查 · 只读简报（R1–R9）

> 依据 `docs/code-review/REVIEW-PLAYBOOK.md` 与 `docs/code-review/2026-11-19/plan.md`。
> 每个会话只读自己那一节（自包含，不依赖其它会话语境）。

## 通用规则（所有批次共用）

**项目**：洛克王国工具箱。`src/` 是 React + TypeScript 前端（Vite），`functions/` 是 Cloudflare Pages Functions（D1 + KV），`android-shell/` 是 WebView 壳（Java），`tools/`、`scripts/` 是构建与数据管线脚本，`e2e/` 是 Playwright。
**领域规则**：`docs/domain/**`（蛋组、大亲密度、目标性格、覆盖度、配种排序）、`docs/产品交互规范.md`。

**范围与基准**：审查范围 `779b08c..894de06`（`test` 分支），**行号一律以 `894de06` 为基准**，报告里注明这一点。
工作区当前有未提交内容（`docs/设计资产/registry.json`、`../../../%E5%8E%9F%E5%9E%8B/%E5%8E%86%E5%8F%B2/preview/`、`2026-11-xx/` 原型目录），**不属于本次审查范围**，不要把它们当成变更来审。

**规范依据白名单**（只能引这些判「中风险」，指不出依据的一律降为「建议」，不计入中风险）：
1. `tsconfig.json` / `tsconfig.node.json` / `functions/tsconfig.json` 的 `strict`、`noUnusedLocals`、`noUnusedParameters`、`noFallthroughCasesInSwitch`、`isolatedModules`
2. `AGENTS.md` 工作约定（先问再做、四类动作硬门槛、正式站只读、发版通道单一来源）
3. `docs/产品交互规范.md`（交互与文案口径）
4. `docs/domain/**`（领域规则）
5. `src/data/changelog.json` 对应条目（需求口径，用于判「实现与需求不符」）
6. 同模块既有写法（必须写「依据：参照 `xxx` 第 N 行既有写法」）
仓库无 eslint / editorconfig，不要凭空引用代码风格规则。

**分级**：
- 高：逻辑错误、与需求不符、并发/边界/异常处理缺陷、明显性能问题（N+1、循环内 IO、复杂度失控）、数据正确性（精度、时区、编码、事务、幂等）、安全（注入、越权、敏感信息）
- 中：违反上述白名单中明确规范、明显过度复杂、职责耦合、重复逻辑、错误处理不一致、可测试性差
- 低：死代码、无用导入、命名/注释瑕疵、格式
- 不确定：证据不足或需业务语义，标置信度 + 需要谁确认，禁止自行假设

**输出格式（每条严格三段式，面向上线影响，不面向代码）**：
- 第一行标题：`R{n}-H01 · 高风险 · 一句话说清用户能看到的现象`（禁止写成「XxxStore 缺少校验」这类代码名词）
- ① 问题描述：**现状** / **用户影响** / **触发条件** 各一句，技术证据压成一行括号附录（例：（`src/ui/xxx.ts:41` 未持久化 filter））
- ② 优化方案：把 X 改成 Y，2~3 句，不贴代码；改动 >30 行、涉及表结构或影响其它功能时写清代价与风险，多方案给 A/B 一句话对比 + 推荐
- ③ 优化后表现：**解决**（用户能感受到什么，一句）+ **验收**（可点操作路径或可执行命令）
- 术语首次出现写「通俗说法（术语）」；禁止「优化了代码结构」「提升健壮性」这类空话
- 报告末尾必备：统计表（高/中/低/不确定）、最该先修的 1~3 条（同样三段式，各一句话）、范围外备注（只记录不展开）

**纪律**：
- 审查阶段**禁止改任何代码**，**禁止任何 git 写操作**（不得 `add` / `commit` / `checkout` / `restore` / `stash` / `reset` / 建分支）。只允许 `git diff`、`git show`、`git log` 这类读取命令。
- 唯一允许写的文件是**本批报告文件**，不要顺手改别的文档。
- 可以跑只读性质的验证（`npx tsc -b`、`npx vitest run <本批测试文件>`、`node --test <本批测试>`），不要跑全量 `npx vitest run`，不要跑 Playwright / 打包 / 部署。
- 不要用「当前代码可能已经修了」当理由跳过复核：每条结论前必须重读 `894de06` 的当前文件内容。
- 已知线索只是线索，**未复核前不得直接定级**，核实后按实际证据写。

**遇到以下情况立即停下，在报告里写「待确认」并说明需要谁拍板**：需要业务口径二选一、涉及线上数据/已执行迁移、影响面无法静态确认、需要改表结构、发现测试断言被改松（只报告，不改）。

---

## §R1 换蛋域模型（shared）

**文件**（`779b08c..894de06`，+增 −删）：
- ★ `src/shared/eggPatrol.ts` +261、`src/shared/eggPatrol.test.ts` +127
- ★ `src/shared/eggWorkflow.ts` +389、`src/shared/eggWorkflow.test.ts` +274
- ★ `src/shared/eggMatching.ts` +226、`src/shared/eggMatching.test.ts` +133
- `src/shared/eggMigration.ts` +84、`eggMigration.test.ts` +50、`eggTaskActions.ts` +19

**审查重点**
1. 巡查状态机：上窝（laid/placed）与产出（produced/hatched）分步提醒的先后与去重，`placed` 新状态是否在所有分支被覆盖（迁移 `2026-11-18-egg-patrol-placement.sql`）。
2. 换蛋匹配：需求（`give` 给出 / `return` 期望回报）是否对称，空值、多选、重复需求、大小写/别名归一化。
3. `eggWorkflow` 的状态流转是否可能产生不可达状态或跳过必要步骤；机器人任务重建（`rebuildTask`）与已完成任务的关系。
4. 时间处理：到期/提醒窗口的时区与边界（24:00、跨天、传入非法日期），是否用本地时间与 UTC 混算。
5. 纯函数可测试性：分支是否有对应测试；测试断言是否被改松（与 `779b08c` 版本对比）。
6. 家园地上的蛋接入蛋仓按父母推算属性（提交 `2095137`）时，父母缺失/属性越界是否有兜底。

**已知线索（未复核）**
- `2c1ac40`：巡查请求不再传 `redirect: "error"`，Workers 运行时会直接抛错 —— 确认 shared 侧不再依赖该语义。
- `43f1639`：巡查改为「按上窝与产出分步提醒」—— 疑似旧单状态字段残留、双提醒可能重复触发。
- 迁移把 `egg_patrol_one_egg` 唯一约束恢复，shared 侧是否假设「一只蛋可多次巡查」。

**验证**：`npx vitest run src/shared/eggPatrol.test.ts src/shared/eggWorkflow.test.ts src/shared/eggMatching.test.ts src/shared/eggMigration.test.ts`

**输出**：`docs/code-review/2026-11-19/R1.md`，编号 `R1-H01 / R1-M01 / R1-L01 / R1-U01`。

---

## §R2a 换蛋后端（Functions 逻辑）

**文件**：
- ★ `functions/_lib/eggPatrol.ts` +158、`functions/_lib/eggPatrolStore.ts` +79
- ★ `functions/_lib/eggMatching.ts` +155
- `functions/_lib/eggReminders.ts` +70、`functions/_lib/eggBotBridge.ts` +139

**审查重点**
1. 唯一索引让位：巡查记录写入时 `egg_patrol_one_egg` 冲突的处理（覆盖 vs 报错），并发两次提交是否会 500 或写重。
2. 限频：巡查/匹配接口的频率限制是否按账号维度、是否可用重放绕过；失败分支是否仍然计数。
3. 上窝/产出先后：状态推进是否用条件更新（`WHERE status = ?`）保证幂等，重复提交是否会二次扣减或二次提醒。
4. D1 事务边界：多条写是否包在同一 batch；`await` 顺序错导致的部分写入。
5. 机器人桥（`eggBotBridge`）：外部推送失败是否影响主流程、是否记录可重试状态；消息内容是否泄露内部信息。
6. 错误处理一致性：与 `functions/_lib` 既有写法对比（统一 `json()`/错误码），不要吞异常返回 200。

**已知线索（未复核）**
- `60153f9` 需求中心按小组/账号缓存「上一份数据」——确认服务端是否有同类缓存导致的脏读。
- `ca6f028` 巡查强刷仅测试环境可用 —— 检查环境判断是否可被伪造（`env.ENVIRONMENT` 是否来自请求）。
- `2c1ac40`：去除 `redirect: "error"` 后，`fetch` 失败是否被正确捕获并转成可读错误。

**验证**：`npx tsc -p functions/tsconfig.json`（只读校验即可，测试由 R2b 会话跑）

**输出**：`docs/code-review/2026-11-19/R2a.md`，编号 `R2a-H01 …`。

---

## §R2b 数据库迁移 / schema / 换蛋接口测试

**文件**：
- ★ `functions/migrations/2026-11-16-egg-matching.sql` +226、`2026-11-16-egg-patrol.sql` +38、`2026-11-18-egg-patrol-placement.sql` +18、`2026-11-18-egg-patrol-repeat-reminders.sql` +29
- ★ `functions/schema.sql` +285 −6
- ★ `tools/test/egg-patrol-api.test.mjs` +353、`tools/test/egg-matching-api.test.mjs` +275
- `tools/test/verify-mother-groups-schema.mjs` +8

**审查重点**
1. 迁移可重入性：是否 `IF NOT EXISTS`、CHECK 约束变更时旧数据是否会被拒（`observations` 加 `placed` 后既有行是否合法）。
2. 迁移顺序依赖：`2026-11-16` → `2026-11-18` 之间是否有隐式依赖；`schema.sql` 与迁移是否一致（新库直接跑 schema 能否得到同样结构）。
3. 唯一索引与并发：`egg_patrol_one_egg` 重建过程中是否可能留下重复行；是否需要先清理再建唯一索引。
4. 索引与查询匹配：新增索引是否覆盖实际 WHERE/ORDER BY，是否有全表扫描的列表接口。
5. 测试质量：断言是否改松（与 `779b08c` 版本对比）、是否用 `sleep` 掩盖竞态、是否覆盖限频与重复提交。
6. 时间字段：`DATETIME` 默认值与 `CURRENT_TIMESTAMP` 时区（D1 为 UTC）和前端本地时间的换算。

**已知线索（未复核）**
- 迁移已在本机/线上执行过（见 plan §1），只审 SQL 文本正确性与一致性，**不要连库、不要重跑迁移**。
- `b9e0628` 同步了巡查新状态与账号表结构 —— 检查 `schema.sql` 与迁移是否同步到位。

**验证**：`node --test tools/test/egg-patrol-api.test.mjs`（如本地 wrangler 不可用，改为静态审测试代码并注明未执行）

**输出**：`docs/code-review/2026-11-19/R2b.md`，编号 `R2b-H01 …`。

---

## §R3a 换蛋前端主流程（plan 新组件）

**文件**：
- ★ `src/ui/plan/EggMatchingHub.tsx` +295、`.test.tsx` +121
- ★ `src/ui/plan/EggTasksPanel.tsx` +99、`.test.tsx` +126
- ★ `src/ui/plan/EggDemandCard.tsx` +44、`.test.tsx` +28、`EggDemandEditor.tsx` +49、`.test.tsx` +27
- `src/ui/plan/EggStockPanel.tsx` +74、`.test.tsx` +71、`EggLineSummary.tsx` +24、`.test.tsx` +15
- `src/ui/plan/EggBotConnection.tsx` +50、`.test.tsx` +33
- ★ `src/ui/plan/useEggMatching.ts` +74、`.test.tsx` +58

**审查重点**
1. 广场状态条与「只看我能接」筛选：筛选条件切换后列表计数是否同步、空结果是否给正确空态。
2. 需求两块（我发出 / 我能接）：分组与去重是否正确，一条需求能否同时出现在两块。
3. 统一入口：Hub → 任务面板/需求卡/蛋仓的跳转与返回是否保持筛选与滚动位置，返回是否复用缓存。
4. 双行确认（提交前二次确认）：确认后是否防重复提交（连点两次会不会发两次请求）。
5. React 性能与正确性：`memo`/`useMemo` 依赖是否漏项或过度，列表 key 是否稳定，effect 清理是否完整（避免卸载后 setState）。
6. 文案与口径：与 `docs/产品交互规范.md`、`src/data/changelog.json` 对应条目一致；空态/错误态是否有可操作出口。
7. 移动端：375/390 宽下双行确认与状态条是否被遮挡（能静态判断的布局问题）。

**已知线索（未复核）**
- `894de06` 刚把「需求详情按原型压成单行并补分区计数」——检查单行布局在长文本/大数字下是否溢出，计数口径是否与列表一致。
- `60153f9`「按小组和账号缓存上一份数据」——缓存命中时是否会显示别人的/过期的数据，切换账号或小组后是否失效。
- `673a618` 按原型补齐换蛋广场与任务卡确认 —— 确认交互是否与原型一致、是否有未接线的死按钮。

**验证**：`npx vitest run src/ui/plan`

**输出**：`docs/code-review/2026-11-19/R3a.md`，编号 `R3a-H01 …`。

---

## §R3b 需求中心模型与旧计划中心下线

**文件**：
- ★ `src/ui/plan/eggStockModel.ts` +125、`.test.ts` +115；`eggTime.ts` +27、`.test.ts` +21
- ★ `src/ui/plan/homeEggAdapter.ts` +193、`.test.ts` +117
- ★ `src/ui/plan/usePlanBadge.ts` +23 −9、`.test.tsx` +68
- 删除：`GroupPlanHub.tsx` −506、`GroupSquareView.tsx` −232、`MyCollectionView.tsx` −233、`PlanCard.tsx` −342、`PlanDetailSheet.tsx` −323、`planCardModel.ts/test` −296/−278、`planAlertsStore.ts/test` −67/−108、`useCollectionPlans.ts` −148、`planCard.css` −53

**审查重点**
1. 删除是否彻底：全局检索被删模块的引用（含路由、动态 import、测试、e2e、i18n、样式类名），残留引用会在构建期或运行期炸。
2. `homeEggAdapter`：家园地上的蛋按父母推算属性（`2095137`），父母缺失、属性缺字段、蛋已孵化/已取走的边界。
3. `eggStockModel`：蛋仓库存汇总口径（多小组、多账号）与 UI 展示是否一致，数值精度与排序稳定性。
4. `eggTime`：倒计时/到期文案的时间基准与刷新频率，后台标签页恢复时是否出现负值。
5. `usePlanBadge`：徽标计数来源与刷新时机，登出/切账号后是否清零。
6. 旧路径下线后，用户从收藏/通知/深链进来的旧地址是否有兜底（看 `src/ui/navigation.ts`、`src/App.tsx` 的引用）。

**已知线索（未复核）**
- 提交 `de0b394`「更改ui，新增巨量bug」与 `3dacef9`「完善看板、收集与家园体验」被视为已知不稳定源，重点看这轮是否留下半成品分支。

**验证**：`npx vitest run src/ui/plan` + `npx tsc -b`

**输出**：`docs/code-review/2026-11-19/R3b.md`，编号 `R3b-H01 …`。

---

## §R4 账号体系（用户名 + 密码）与接口

**文件**：
- ★ `functions/_lib/auth.ts` +152 −7、`functions/_lib/util.ts` +61、`functions/_lib/router.ts` +25 −4
- ★ `src/api/session.ts` +39 −18
- ★ `src/ui/AccountPanel.tsx` +271 −88
- `functions/migrations/2026-11-18-accounts-username-password.sql` +14
- `scripts/reset-password.mjs` +90、`scripts/reset-recovery-code.mjs` +83

**审查重点**
1. 口令存储：PBKDF2 参数（算法/迭代次数/盐长度/输出长度）是否固定且可升级；比对是否用常量时间；盐是否随机且每用户独立。
2. 用户名规范：大小写、全角/半角、空白、长度与字符集归一化；唯一索引冲突时的错误码是否可读。
3. 老账号迁移：没有用户名/密码的历史账号首次 `setup` 的鉴权路径是否可被劫持（拿旧 token 直接设密码？），恢复码校验是否与旧逻辑等价。
4. 会话与令牌：`src/api/session.ts` 登录态刷新、过期与登出是否清理本地凭据；失败重试是否会重复注册。
5. 接口兼容：旧接口保留的语义是否与前端一致（返回字段、错误结构），签名/校验失败是否返回 401 而不是 500。
6. 敏感信息：错误信息、日志、脚本输出是否泄露哈希/盐/令牌；`reset-password.mjs` 是否要求显式参数且不落盘明文。
7. 限频与暴力破解：登录失败是否计数、是否可无限尝试；用户名枚举（「用户不存在」vs「密码错误」）是否统一。

**已知线索（未复核）**
- `87a3b71` 账号改用用户名与密码登录；`b9e0628` 同步了 accounts 三列 + 唯一索引 —— 检查代码假设的列名/索引名与迁移一致。
- 迁移已在线上执行（见 plan §1），**不要连库、不要重跑**。

**验证**：`npx tsc -p functions/tsconfig.json` + `npx vitest run src/api`

**输出**：`docs/code-review/2026-11-19/R4.md`，编号 `R4-H01 …`。

---

## §R5 领域规则（体型/奖牌/档位）

**文件**：
- ★ `src/shared/bodySize.js` +19 −8、`src/shared/bodySize.d.ts` +7 −1、`src/pcap/bodySize.test.ts` +18 −5
- ★ `src/domain/petFilters.ts` +85 −8、`petFilters.test.ts` +74 −13
- ★ `src/domain/motherCriteria.ts` +23 −10、`motherCriteria.test.ts` +40 −10
- `src/domain/demandCriteria.ts` +12 −2、`demandCriteria.test.ts` +18 −5
- `src/domain/catalog.ts` +70 −20、`catalog.test.ts` +3 −1
- `src/domain/petIcons.ts` +15 −7、`petIcons.test.ts` +8 −3
- `src/domain/types.ts` +13 −1、`eggInventory.ts` +56、`eggInventory.test.ts` +38、`parseBackup.ts` +40、`parseBackup.test.ts` +22、`backup.ts` +4 −3
- `motherResource.test.ts`、`motherSharing.test.ts`、`productionLines.test.ts` 小改

**审查重点**
1. 「奖牌判定」与「孵蛋判定」是否真正分离：目标档位改单选（`dd23006`）后，旧的多选字段是否还有调用方；档位边界（恰好等于阈值）归上还是归下。
2. 身高/体重双维度：`bodySize` 的入口参数与返回值（区间、单位、小数）是否与 UI 展示一致；边界值（0、负数、超大）与 `NaN`。
3. 领域口径来源：与 `docs/domain/**`（蛋组、目标性格、覆盖度）逐条对齐，特别是「大块头」与身高的关系。
4. 目标性格/蛋组判定：大小写、别名、空值、未知性格是否安全退化。
5. `eggInventory` / `parseBackup`：解析外部备份的容错（缺字段、类型错、超大数据），失败是否给出可读原因而不是静默丢数据。
6. 排序稳定性：配种排序在评分相同时是否稳定（避免 UI 抖动）。

**已知线索（未复核）**
- `dd23006`「奖牌与孵蛋判定分离，目标档位改单选」是本次最高风险改动，先审这里。
- `081b604`「精灵背包身高和体重共用一个显示开关」会改到 `bodySize` 的展示口径，注意与判定口径别混用。

**验证**：`npx vitest run src/domain src/pcap/bodySize.test.ts`

**输出**：`docs/code-review/2026-11-19/R5.md`，编号 `R5-H01 …`。

---

## §R6a 我的精灵背包（大组件）

**文件**：
- ★ `src/ui/MyPets.tsx` +785 −73、`src/ui/MyPets.test.tsx` +422
- ★ `src/ui/myPetsFilterStore.ts` +155 −13、`myPetsFilterStore.test.ts` +122 −7

**审查重点**
1. 筛选状态迁移：旧存档的筛选结构如何升级到新结构，未知字段是否会整份重置（用户失去已选条件）。
2. 档位单选改造后，筛选与列表计数是否一致；清空筛选是否真的回到默认。
3. 785 行单组件的渲染成本：列表是否虚拟化/分页，`useMemo` 依赖是否覆盖筛选对象，是否存在每次输入都全量重算。
4. 卡片展示开关（身高/体重共用一个开关）状态是否持久化，刷新后是否回到默认。
5. 空账号/无数据：空态文案是否误导（「共 N 只」的计算口径与筛选后的数量）。
6. 可访问性与移动端：375/390 下筛选面板展开是否遮挡操作区（能静态判断的）。

**已知线索（未复核）**
- `dd23006` 目标档位改单选；`081b604` 身高体重共用一个显示开关 —— 两处都在这个组件里，注意测试断言是否跟着改松。
- 与 `R6b` 的 `Dashboard` 共用筛选口径，若发现口径冲突写进报告，不要跨文件自行统一。

**验证**：`npx vitest run src/ui/MyPets.test.tsx src/ui/myPetsFilterStore.test.ts`

**输出**：`docs/code-review/2026-11-19/R6a.md`，编号 `R6a-H01 …`。

---

## §R6b 看板 / 收集 / 覆盖度

**文件**：
- ★ `src/ui/Dashboard.tsx` +195 −96、`Dashboard.test.tsx` +214 −22
- ★ `src/ui/Collection.tsx` +32 −47、`Collection.test.tsx` +40 −9
- ★ `src/ui/Coverage.tsx` +1 −19、`Coverage.test.tsx` +28 −26
- `src/ui/CoverageFilterBar.tsx` +57 −33、`CoverageIntroCard.tsx` +7 −3、`src/ui/coverageFilterStore.ts` +9 −6

**审查重点**
1. 看板空账号：新用户没有任何数据时是否显示 0/空态而不是 NaN 或报错；`Dashboard.test.tsx` 是否覆盖。
2. 「共 N 只」的口径：是否统计去重后的精灵种类、是否包含未收集的占位；筛选后是否同步变化。
3. 档位单选后覆盖度计算的边界：0 覆盖、100% 覆盖、分母为 0。
4. `Coverage.tsx` 删减 19 行：被删的是否还有调用方（含 e2e 选择器），删除后是否留下死链接。
5. 筛选持久化迁移（`coverageFilterStore`）：旧键升级、默认值与重置。
6. 性能：覆盖度计算是否在渲染函数里做全量遍历，是否随账号规模放大。

**已知线索（未复核）**
- `3dacef9`「完善看板、收集与家园体验」与 `de0b394`「更改ui，新增巨量bug」都改过这几处，重点看边界与空态。
- 与 `R6a` 共用档位口径，冲突写进报告。

**验证**：`npx vitest run src/ui/Dashboard.test.tsx src/ui/Collection.test.tsx src/ui/Coverage.test.tsx`

**输出**：`docs/code-review/2026-11-19/R6b.md`，编号 `R6b-H01 …`。

---

## §R7a 朋友 PR · 列表与卡片

**范围**：朋友 PR `8b97e48..081b604` 中的卡片/列表/筛选组件（`Dashboard`、`MyPets`、`Collection`、`Coverage*` 由 R6 审，不在此批）。

**文件**：
- ★ `src/ui/PetCard.tsx` +96 −58、`PetCard.test.tsx` +72、`src/ui/PetCardLayout.tsx` +157
- ★ `src/ui/PetCompactCard.tsx` +51 −145、`.test.tsx` +28 −17、`src/ui/PetList.tsx` +34 −97、`.test.tsx` +18 −16
- ★ `src/ui/FilterAccordion.tsx` +118 −36
- ★ `src/ui/AccountFilterBar.tsx` +105 −49、`.test.tsx` +43
- `src/ui/primitives/FilterPanel.tsx` +7 −3、`src/ui/ProgressCard.tsx` −4

**审查重点**
1. 卡片布局重排后（`PetCardLayout` 新增）各断点下是否溢出/截断，密集信息（身高体重、档位、奖牌）是否还有可读性。
2. `PetCompactCard` / `PetList` 大幅瘦身（−145/−97）：被移除的字段是否还有使用方，删除后是否出现「空卡片」。
3. `FilterAccordion`：展开/收起状态是否在筛选变化后被重置；键盘与点击区域是否可用。
4. `AccountFilterBar`：多账号选择与「全部账号」的互斥逻辑；账号被删除后陈旧选中项是否会导致空列表。
5. 组件契约变化：props 重命名/删除是否影响其它调用方（全局检索确认）。

**已知线索（未复核）**
- `081b604`「精灵背包身高和体重共用一个显示开关」—— 检查开关在两个卡片组件里是否都生效、是否各自持久化导致状态不同步。
- `de0b394`「更改ui，新增巨量bug」是本批主要来源，优先看视觉与交互回归。

**验证**：`npx vitest run src/ui/PetCard.test.tsx src/ui/PetCompactCard.test.tsx src/ui/PetList.test.tsx src/ui/AccountFilterBar.test.tsx`

**输出**：`docs/code-review/2026-11-19/R7a.md`，编号 `R7a-H01 …`。

---

## §R7b 朋友 PR · 家园页与建议卡

**文件**：
- ★ `src/ui/Home.tsx` +153 −71、`Home.test.tsx` +49 −13
- ★ `src/ui/HomePairDiagram.tsx` +106 −30、`.test.tsx` +134
- `src/ui/HomeDemandPlacements.tsx` +30 −14、`.test.tsx` +13 −3
- ★ `src/ui/MotherView.tsx` +62 −134、`.test.tsx` +49
- ★ `src/ui/MotherCriteriaMedals.tsx` +103、`.test.tsx` +64
- ★ `src/ui/SuggestionCard.tsx` +96 −116、`.test.tsx` +57 −7、`src/ui/suggestionCardStore.ts` +18 −14
- `src/ui/NatureSelectionContent.tsx` +191、`src/ui/TargetGradeSelector.tsx` +76
- `src/ui/CollectionTargetEditor.tsx` +18 −127、`.test.tsx` +48 −13
- `src/ui/tour.ts` +26 −15、`src/ui/useCollectionSummary.ts` +2

**审查重点**
1. 家园页改版后的配对图（`HomePairDiagram`）与需求落位（`HomeDemandPlacements`）数据来源是否一致，空/缺数据时的占位。
2. `MotherView` 删减 134 行：被删的入口是否还有别处引用，母本详情是否丢信息。
3. 奖牌展示（`MotherCriteriaMedals`）是否与 R5 的「奖牌/孵蛋判定分离」口径一致；边界档位显示是否正确。
4. `SuggestionCard` 瘦身 116 行后，建议的排序/去重/空态是否还完整，store 迁移是否丢状态。
5. `TargetGradeSelector` 改单选后，旧多选值（存储里是数组）如何兼容。
6. `tour.ts` 引导分段是否随新界面更新，指向已删除元素的分步会卡住。

**已知线索（未复核）**
- `dd23006` 档位改单选、`dd23006` 奖牌口径分离都会影响本批；`2095137` 家园蛋接蛋仓会影响 `Home` 的展示来源。

**验证**：`npx vitest run src/ui/Home.test.tsx src/ui/HomePairDiagram.test.tsx src/ui/MotherView.test.tsx src/ui/SuggestionCard.test.tsx`

**输出**：`docs/code-review/2026-11-19/R7b.md`，编号 `R7b-H01 …`。

---

## §R8a Android 壳 · 采集与附近悬浮（Java）

**文件**：
- ★ `android-shell/.../capture/NearbyPanelController.java` +1354
- ★ `.../capture/NearbyOverlayModel.java` +434、`.../test/.../NearbyOverlayModelTest.java` +348
- ★ `.../capture/BattleOverlayController.java` +387 −121
- `.../capture/OverlayGeometry.java` +96、`OverlayGeometryTest.java` +71
- `.../capture/CaptureController.java` +16 −34、`CaptureState.java` +15 −1、`CaptureStateTest.java` +13、`CaptureBridgePolicy.java` +13 −3、`CaptureBridgePolicyTest.java` +10、`CaptureVpnService.java` +4 −4
- `.../assets/capture-bridge.js` +5 −1、`.../assets/overlay-map.html` +389、`.../assets/maps/maps.json` +20、`maps/10003.webp`（二进制，跳过）
- 删除：`CaptureUploadManager.java` −127、`CaptureUploadStore.java` −133、`CaptureUploader.java` −350、对应测试 −59/−282

**审查重点**
1. 上传链路删除是否彻底：`capture-bridge.js`、`MainActivity`、Manifest 权限、`strings.xml` 是否还有引用（残留会编译失败或运行时崩溃）。
2. `NearbyPanelController` 1354 行：主线程阻塞（IO/JSON 在 UI 线程）、`WebView` 生命周期（重复 `loadUrl`、未 `destroy`）、频繁刷新导致的内存抖动。
3. 坐标换算（`OverlayGeometry`）：屏幕方向/缩放/状态栏偏移；无标定场景的兜底（雷达）是否会产生 `NaN`/越界。
4. 悬浮窗权限与回收重建：`WindowManager` 异常（`BadTokenException`）是否捕获并如实上报；进程被杀后重建逻辑。
5. 战斗悬浮卡状态：新战斗不是奇遇形态时清掉上一场守卫卡（`736e181`）后，是否还有残留字段导致错显示。
6. 线程与资源：`Handler`/`Runnable` 是否在 `onDestroy` 移除；`WebView`、`Bitmap` 是否释放。

**已知线索（未复核）**
- `9fbfec0` 正式版移除了蛋神助手上传链路，采集只在本地保存与解析 —— 确认删除后的空实现不会让桥方法变成静默失败。
- `2975b3a`/`d3d5bad`/`f9d98a8` 重建附近悬浮面板，`fa42dae` 修过非有限自身坐标 NaN —— 复核该修复是否覆盖所有分支。

**验证**：`cd android-shell; ./gradlew compileReleaseJavaWithJavac`（如环境不可用，仅静态审查并注明未执行）

**输出**：`docs/code-review/2026-11-19/R8a.md`，编号 `R8a-H01 …`。

---

## §R8b Android 壳 · 更新、切服与主 Activity

**文件**：
- ★ `.../update/UpdateController.java` +583、`UpdateManager.java` +171、`UpdateManagerTest.java` +238
- `.../update/UpdateManifest.java` +57、`UpdateManifestTest.java` +78
- ★ `.../ServerConfig.java` +261、`ServerConfigTest.java` +83
- ★ `.../MainActivity.java` +343 −49、`.../IdentityRescue.java` +232
- ★ `android-shell/app/build.gradle` +262 −11、`AndroidManifest.xml` +5 −3、`res/values/strings.xml` +1 −1、`res/xml/file_paths.xml` +2、`.gitignore` +5、`README.md`/`THIRD_PARTY.md` 小改

**审查重点**
1. 更新检查桥（`e7422f0` 改强引用）：强引用是否造成 Activity 泄漏；跨进程/跨线程回调是否回到主线程；失败原因是否暴露给用户可读。
2. 通道与版本号：`-PtestBuild` 与默认站一致性断言（AGENTS.md「发版通道与更新：单一来源」）；`6aaf5e7` 内测版本号 42 是否与 `build.gradle`/Manifest/清单一致。
3. 强更门槛：低于门槛是否阻断使用；下载 APK 的校验（大小/哈希/签名）与安装 intent 的 `FileProvider` 配置是否匹配 `file_paths.xml`。
4. 切服（`ServerConfig`）：探活通过才保存（`fdf5b7d`）是否可被绕过；切换服务器后本地身份（localStorage 按 origin）如何处理，是否给用户明确提示。
5. `IdentityRescue`：救援流程是否会覆盖用户现有身份、是否有不可逆操作缺少确认。
6. 保活/重建：前台服务、通知渠道、`START_STICKY` 与系统限制；`onDestroy` 是否正确清理。
7. 权限与合规：新增权限是否必要、`usesCleartextTraffic` 等配置是否只在测试通道生效。

**已知线索（未复核）**
- AGENTS.md「正式站只读 / 反事故」条款：任何让内测包或测试默认站进入正式线的路径都是高风险。
- `284120e` 补入 test 线壳改动（切服、保活自愈、悬浮面板、身份救援）—— 本批主要来源。

**验证**：`cd android-shell; ./gradlew compileReleaseJavaWithJavac`（不可用则静态审查并注明）

**输出**：`docs/code-review/2026-11-19/R8b.md`，编号 `R8b-H01 …`。

---

## §R9a 采集 / PCAP / 附近（网页侧）

**文件**：
- ★ `src/collector/useCaptureProgress.ts` +234 −17、`.test.tsx` +66 −3
- ★ `src/collector/appUpdate.ts` +111、`nativeCollector.ts` +41 −37、`battleTargetStore.ts` +44 −14、`captureProgress.ts` +5 −2、`desktopOverlay.ts` +13、`nearbySelfTrack.ts` +29、`nearbyStore.ts` +39、`.test.ts` +34、`perfProbe.ts` +89、`useNearbyFeed.ts` +24 −7、`inspectCapture.ts` +1 −1
- ★ `src/nearby/overlayPayload.ts` +223 −16、`.test.ts` +388 −28
- ★ `src/nearby/useNearbyOverlayPush.ts` +209、`.test.tsx` +185
- `src/nearby/nearbyTargetStore.ts` +90、`.test.ts` +66、`nearbyFilterStore.ts` +100、`overlayBridge.test.ts` +11 −1、`overlayMapAsset.test.ts` +118
- ★ `src/pcap/wildNearby.ts` +13 −1、`.test.ts` +207 −2、`nearbyRadar.ts` +23 −7、`selfOdometry.ts` +29 −5、`nearbyRetain.ts` +5 −3、`rareRules.ts` +15 −8、`demandMatch.ts` +6 −4、`liveWindow.test.ts` +36、其余小改
- `src/pcap-decoder/tools/pcap-json-app/src/core.js` +393 −40、`core.d.ts` +29 −3

**审查重点**
1. 高频推送（`useNearbyOverlayPush`）的节流/合并：是否每次坐标变化都 `postMessage`，是否在页面隐藏/锁屏后继续跑。
2. payload 体积与结构（`overlayPayload`）：列表 + 地图全量精灵（`d3d5bad`）是否造成大对象序列化卡顿；字段缺省与旧壳兼容（旧客户端收到新字段是否崩）。
3. `useCaptureProgress` 234 行：定时器/订阅是否在卸载时清理，进度状态是否会回退（重复事件乱序）。
4. PCAP 解析（`core.js` +393）：二进制边界检查（长度、偏移、越界读取）、异常包是否中断整个解析、Worker 内存。
5. 自身坐标与雷达兜底（`fa42dae`/`selfOdometry`/`nearbyRadar`）：非有限值是否彻底过滤，标定缺失时兜底是否给出误导位置。
6. 稀有规则与需求匹配（`rareRules`/`demandMatch`）口径与领域文档一致。

**已知线索（未复核）**
- `343a5f0`/`1a54d78`/`1a54d78` 等正式站修复提到「递归实体解析、自身坐标、低延迟、单解码源、体型双维度、地图与列表兜底」—— 复核这些修复是否被后续提交回退。
- `fa42dae` 用精灵中位数替代非有限自身坐标，注意中位数为空时的分支。

**验证**：`npx vitest run src/nearby src/pcap src/collector`

**输出**：`docs/code-review/2026-11-19/R9a.md`，编号 `R9a-H01 …`。

---

## §R9b 其它网页 UI / API / 共享模块

**文件**：
- ★ `src/ui/Nearby.tsx` +377 −103、`.test.tsx` +84 −34、`NearbyErrorBoundary.tsx` +88、`NearbyMap.tsx` +104 −48、`.test.ts` +63 −1、`NearbyRadar.tsx` +10 −4
- ★ `src/ui/ServerAddressPanel.tsx` +230、`.test.tsx` +165、`src/ui/serverEnv.ts` +11、`.test.ts` +23
- ★ `src/ui/Profile.tsx` +110 −5、`.test.tsx` +72 −3
- ★ `src/api/collectionGroups.ts` +4 −320、`src/api/analytics.ts` +3 −75、`src/api/eggMatching.ts` +56、`eggPatrol.ts` +26、`sharedPrefs.ts` +124、`.test.ts` +65
- `src/ui/DemandPublishSheet.tsx` +24 −179、`demandPlacementStore.ts` −3、`useClaimedDemands.ts` +25 −5、`useDemandCenter.ts` +9 −2、`useTabViewTracking.ts` +19、`swapViewStore.ts` +33、`NativeCollectorPanel.tsx` +14 −59、`MotherGroupResources.tsx` +29 −43、`CollectionGroups.tsx` +12 −7
- `src/shared/collectionPlans.ts` −285、`collectionPlans.test.ts` −400、`src/shared/uuid.ts` +15、`uuid.test.ts` +24、`src/App.tsx` +15 −25、`src/sw.ts` +1 −1、`src/api/motherGroups*` 小改

**审查重点**
1. 大幅删减的 API 模块（`collectionGroups` −320、`analytics` −75、`DemandPublishSheet` −179）：调用方是否全部清理，是否留下死导出或半截 UI。
2. `ServerAddressPanel` / `serverEnv`：允许用户改服务器地址会不会把正式用户导到测试站（AGENTS.md 铁律：换站等于换身份）；默认站与通道断言。
3. `Nearby.tsx` 大改：错误边界（`NearbyErrorBoundary`）是否能兜住渲染异常而不白屏；列表/地图切换是否保持状态。
4. 埋点（`analytics`/`useTabViewTracking`）：失败是否静默、是否会阻塞主流程。
5. `sharedPrefs`：跨设备同步的合并策略（后写覆盖/冲突），敏感字段。
6. Service Worker（`sw.ts`）与 `App.tsx` 路由改动后，旧路径深链与离线缓存是否还能回到正确页面。

**已知线索（未复核）**
- `facf31b`/`aecef36` 涉及生产部署与机器人链路；`63a0362`「收集计划断言改为两通道都禁止」意味着收集计划相关前端应已移除 —— 核对残留。
- `f40640a` 产品改名「小布助手」并做桌面 userData 迁移 —— 注意文案与存储键迁移是否遗漏分支。

**验证**：`npx vitest run src/ui/Nearby.test.tsx src/ui/ServerAddressPanel.test.tsx src/ui/Profile.test.tsx src/api`

**输出**：`docs/code-review/2026-11-19/R9b.md`，编号 `R9b-H01 …`。

---

## §R9c 端到端测试 / 脚本 / 数据管线

**文件**：
- ★ `scripts/deploy-web.mjs` +158、`tools/test/deploy-web.test.mjs` +26
- ★ `scripts/design-assets.mjs` +110、`scripts/design-assets.test.mjs` +25
- `e2e/collection-plans.spec.ts` −290、`e2e/helpers/motherGroupsMock.ts` +5 −334、`e2e/android-collector.spec.ts` +2 −27、`e2e/coverage.spec.ts`、`dashboard.spec.ts`、`pwa.spec.ts`、`tour.spec.ts`、`product-states.spec.ts`、`mother-sharing*.spec.ts`、`share-target.spec.ts` 小改
- `tools/data-pipeline/sync-decoder-catalog.mjs` +89、`trim-catalog.mjs` +17
- `src/share/shareTarget.ts` +1 −1、`src/share/androidShell.test.ts` +4 −3

**审查重点**
1. `deploy-web.mjs`：正式站保护（`--branch main --approve-production`）是否可被绕过；bundle 断言（禁止内测文案）是否仍生效；失败时是否中止而不是继续发布。
2. 脚本是否会把内测包/测试默认站写进正式清单（AGENTS.md「发版通道与更新：单一来源」「先问再做」）。
3. `e2e` 删除 `collection-plans.spec.ts` 与 mock 大幅瘦身后，是否还有测试引用被删 helper（`--list` 会失败）。
4. 数据管线脚本：写入 `src/data/*` 是否幂等、是否有未排序导致的 diff 噪声、是否覆盖手工维护字段。

**已知线索（未复核）**
- `63a0362` 把收集计划断言改为两通道都禁止，`9fbfec0` 移除上传链路 —— 核对脚本断言与 e2e 是否同步。

**验证**：`node --test tools/test/deploy-web.test.mjs scripts/design-assets.test.mjs` + `npx playwright test --list`

**输出**：`docs/code-review/2026-11-19/R9c.md`，编号 `R9c-H01 …`。
