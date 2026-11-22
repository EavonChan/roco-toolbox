# R2b · 数据库迁移 / schema / 换蛋接口测试

> 审查范围：`779b08c..894de06`（`test` 分支），**所有行号以 `894de06` 为准**。
> 工作区未提交的原型 / 截图 / `../../../%E5%8E%9F%E5%9E%8B/%E5%8E%86%E5%8F%B2/preview/` 不属于本次审查范围。
> 本批只读：未改任何代码，未执行任何 git 写操作，未连接真实 D1，未重跑迁移。
> 复核方式：每条结论前都重读过文件；本批所有路径在工作区与 `894de06` 完全一致（`git diff 894de06..HEAD -- functions tools/test` 为空，HEAD 仅多一条 docs 提交），因此行号即以 `894de06` 为准。

## 已执行的验证（真实输出）

| 命令 | 结果 |
| --- | --- |
| `node --test tools/test/egg-patrol-api.test.mjs` | ✅ 19 通过 / 0 失败（15.9s） |
| `node --test tools/test/egg-matching-api.test.mjs` | ✅ 14 通过 / 0 失败（13.8s） |
| `node tools/test/verify-mother-groups-schema.mjs` | ❌ 失败：`AssertionError: 旧 schema 不应包含新表 mother_groups`（`tools/test/verify-mother-groups-schema.mjs:159`） |
| 内存 SQLite 复现①：schema.sql 建库后列索引 | `egg_patrol_one_egg` **不存在**，只有 `egg_patrol_notification_due` |
| 内存 SQLite 复现②：按文件名顺序跑迁移（placement → repeat-reminders） | 结果同样**没有** `egg_patrol_one_egg` |
| 内存 SQLite 复现③：按 `plan.md §1` 记录顺序（repeat-reminders → placement） | 结果**有** `egg_patrol_one_egg` |
| 内存 SQLite 复现④：写入「跨组占位锁」那一行 | ❌ `NOT NULL constraint failed: egg_matching_locks.account_id` |
| 内存 SQLite 复现⑤：`egg-matching` 迁移跑第二遍、`placement` 迁移跑第二遍 | ✅ 均不报错，观测行数保持 1 |

---

## R2b-H01 · 高风险 · 发版前那道「表结构自检」现在是红的，等于本次换蛋建表没有任何自动校验拦着

**① 问题描述**
**现状**：`779b08c` 之后新加的巡查建表区块被塞进了建库脚本，但没有登记进自检脚本的迁移清单，也没有加 `>>> / <<<` 剥离标记；自检脚本剥完「新区块」后仍剩 4 处 `REFERENCES mother_groups`，最后一条断言直接失败。
**用户影响**：本次新增的 11 张换蛋/巡查表和 4 条换蛋迁移完全没有被自动比对过（列定义、索引、可重复执行），表结构漂移只能靠人眼，发版前的机械闸门变成摆设。
**触发条件**：任何一次 `node tools/test/verify-mother-groups-schema.mjs`，以及 `npm run test:mother-groups:api`（该脚本是它的第 1/6 步，失败即中止，后面的构建与接口测试都不会跑）。
（证据：`functions/schema.sql:527-568` 新增巡查区块无 `>>> egg-patrol` 标记；`tools/test/verify-mother-groups-schema.mjs:18-101` 清单无对应条目、`:151-160` 剥离逻辑、`:159` 断言；对照 `779b08c` 同段剥离后残留为 0 行、`894de06` 为 4 行；`tools/test/run-mother-groups-local.mjs:110-111` 为第 1/6 步。）

**② 优化方案**
把 `2026-11-16-egg-patrol.sql`、`2026-11-18-egg-patrol-placement.sql`、`2026-11-18-egg-patrol-repeat-reminders.sql` 登记进自检清单（前两条带 `>>> / <<<` 区块标记，重建表的按既有做法标 `repeat: 1`），并把索引比对从「只看 `idx_` 前缀」改成「比对全部非自动索引」——现在 `egg_patrol_one_egg`、`egg_patrol_notification_due` 这类不以 `idx_` 开头的索引即使登记了表也会被跳过（`verify-mother-groups-schema.mjs:134-139、:189`）。改动只动测试脚本，不碰线上库；代价是要给 schema.sql 补 2 组区块注释标记。

**③ 优化后表现**
**解决**：这道自检恢复绿色，新迁移一旦和新库定义不一致会立刻红。**验收**：`node tools/test/verify-mother-groups-schema.mjs` 输出「schema 校验通过」，且把巡查表某个索引临时改名后该命令应报错。

---

## R2b-M01 · 中风险 · 同一套建库脚本在不同环境会建出不同的库：「一颗蛋只能有一条产出」的约束会悄悄消失

**① 问题描述**
**现状**：`repeat-reminders` 先删掉了唯一索引（数据库里「同一份数据不许出现两次」的规则）`egg_patrol_one_egg`，`placement` 又在末尾把它建回来；两条迁移同一天、按文件名 placement 在前，所以「按文件名顺序跑」最终没有这个索引，而 `plan.md §1` 记录的线上实际执行顺序是 repeat-reminders 在前、placement 在后，最终索引被建回来。
**用户影响**：新部署的库和线上库结构不同（新库少一条唯一约束），而写入代码的注释写着「避免唯一索引冲突」、靠一条手工删除来维持「一颗蛋一条产出」；换库部署的人会以为数据库在兜底，实际没有。
**触发条件**：任何「新建库只跑 `schema.sql`」的部署（脚本注释明确写了新库只跑这个文件），或未来有人按文件名顺序重放迁移。
（证据：`functions/migrations/2026-11-18-egg-patrol-repeat-reminders.sql:7` 删索引，`functions/migrations/2026-11-18-egg-patrol-placement.sql:18` 重建索引，`functions/schema.sql:547-553` 无该索引；`docs/code-review/2026-11-19/plan.md:44-50` 记录线上为「repeat → placement，索引已恢复」。三次内存建库实测见上表复现① ② ③。）

**② 优化方案**
先定口径再改文件（两种都只动 SQL 文本，不涉及线上数据）：A）确认不再需要该约束 —— 删掉 placement 末尾的建索引语句，让三种建库路径都收敛到「无索引」，并把代码注释改成「靠写前的删除维持」；B）确认需要该约束 —— 在 `schema.sql` 的巡查区块补一条同样的 `CREATE UNIQUE INDEX IF NOT EXISTS`，并在 repeat-reminders 里改为「先删后不重建」的显式说明顺序。推荐 A（与 `repeat-reminders` 的设计意图和当前代码的删除逻辑一致），但**线上库到底是哪种结构需要用户/运维回读 `sqlite_master` 确认后再定**——本批不连库，故不给最终结论。

**③ 优化后表现**
**解决**：新库、线上库、测试库三者的巡查表结构完全一致。**验收**：内存 SQLite 分别按「只跑 schema.sql」「schema + 按文件名顺序跑全部迁移」两条路径建库，`SELECT name FROM sqlite_master WHERE type='index' AND tbl_name LIKE 'egg_patrol%'` 结果应完全相同；`node --test tools/test/egg-patrol-api.test.mjs` 仍 19 通过。

---

## R2b-M02 · 中风险 · 跨小组抢同一颗蛋，实际是靠数据库报错拦下来的，那行「占位锁」永远写不进去

**① 问题描述**
**现状**：为了让别的组也看到「这颗蛋被占了」，代码会往蛋锁表插一行「没有归属账号」的占位记录；但蛋锁表的账号列是 `NOT NULL`，这一行必然被约束拒绝，整笔操作回滚。
**用户影响**：当前用户看到的仍是「蛋或亲本已被其他任务占用，请刷新」，表面上没问题；但锁表里从来没有别的组的占位记录，任何依赖「读锁表判断被谁占」的后续功能（冲突提示、对账）都拿不到数据，而且这条互斥是靠约束报错实现的，一旦列约束放宽就会静默写入脏行、把资源长期占住。
**触发条件**：同一颗蛋已被另一个小组（或同组另一笔任务）锁定之后，再有小组去接单。
（证据：`functions/_lib/eggMatching.ts:136-139` 有意 `SELECT NULL` 作为账号列；`functions/schema.sql:308` 与 `functions/migrations/2026-11-16-egg-matching.sql:10` 均为 `account_id TEXT NOT NULL`；内存 SQLite 实测该语句报 `NOT NULL constraint failed: egg_matching_locks.account_id`、锁表行数不变。）

**② 优化方案**
两选一：A）把互斥写成显式检查 —— 接单前先查一次「该资源是否已被其他组锁」，命中就直接返回可读的 409，不再依赖占位行；B）保留占位行但给账号列一个明确的占位值（例如空串或 `blocked`）并加注释说明它不是真实账号。推荐 A（语义清晰、不引入伪账号，且能顺带把「被哪个组占了」展示给用户）。

**③ 优化后表现**
**解决**：跨组占用变成一次明确的检查，锁表里不再出现写不进去的设计分支，将来能把「已被 XX 组锁定」提示给用户。**验收**：`node --test tools/test/egg-matching-api.test.mjs`（含「同一颗蛋不能在两个组各接一次」用例）通过，并补一条断言：被拒时返回的错误码是「蛋被占用」而不是笼统的约束失败。

---

## R2b-L01 · 低风险 · 换蛋接口测试没有「限频」和真正并发的断言，跨组 409 也只看状态码

**① 问题描述**
**现状**：匹配接口确实有按账号维度的限频（GET 1800 次/小时、写 240 次/小时），但两套接口测试从没触发过 429；「并发」用例是用 `Promise.all` 去调一个同步的内存 SQLite，实际仍然是串行执行，证明不了并发安全；跨组接单的用例只断言 `status === 409`，而「正确拒绝」和「约束报错」返回的也是 409，测试分辨不出两者。
**用户影响**：限频与并发这两条最容易出线上事故的路径没有测试保护；跨组互斥机制失效（见 R2b-M02）测试也发现不了。
**触发条件**：后续任何人改限频参数、改锁表结构或改错误码映射时。
（证据：`functions/_lib/eggMatching.ts:84` 有限频但两套测试无 429 断言；`tools/test/egg-patrol-api.test.mjs:137` 的 `Promise.all` 跑在 `node:sqlite` 同步库上；`tools/test/egg-matching-api.test.mjs:90` 只比状态码。）

**② 优化方案**
补三条用例：①把某个账号的写操作打到阈值，断言第 241 次返回 429；②跨组接单断言返回体里的错误码（而非只看状态码）；③把「并发」说明改成「租约互斥」单测，或明确标注内存库无法验证真并发、由 D1 批次原子性兜底。改动只动测试文件。

**③ 优化后表现**
**解决**：限频与跨组互斥都有断言，改坏会立刻红。**验收**：`node --test tools/test/egg-matching-api.test.mjs`、`node --test tools/test/egg-patrol-api.test.mjs` 全绿且新增用例在故意改坏对应逻辑时失败。

---

## R2b-L02 · 低风险 · 两条同日迁移互相依赖执行顺序，文件头没写

**① 问题描述**
**现状**：`placement` 的搬数据语句直接读 `egg_patrol_observations`，必须先有 `2026-11-16-egg-patrol.sql`；`placement` 又必须排在 `repeat-reminders` 之后，唯一索引的删除才不会被覆盖（见 R2b-M01）。
**用户影响**：运维按文件头说明单独补跑其中一条时，要么报「no such table」，要么把刚删掉过的约束又建回来，两种都不会有明显报错提示。
**触发条件**：手工按 `--file` 逐条补跑迁移（本项目既有做法），且顺序与文件名顺序不一致。
（证据：`functions/migrations/2026-11-18-egg-patrol-placement.sql:13-14` 读旧表但无前置说明；`functions/migrations/2026-11-18-egg-patrol-repeat-reminders.sql:7` 删索引；本仓库其它迁移文件头有先例，如 `2026-11-08-collection-demand-placed-at.sql` 写明「必须排在需求建表迁移之后」。）

**② 优化方案**
在两条文件的头部各补一句前置说明（已有哪些表 / 必须排在谁之后、必须排在谁之前），并在 `schema.sql` 巡查区块顶部注明「本区块与这两条迁移的最终结构一致，改一处要同步另一处」。

**③ 优化后表现**
**解决**：补跑迁移的人不会再踩顺序坑。**验收**：走查两份文件头即可；与 R2b-M01 的验收命令共用一次建库比对。

---

## R2b-U01 · 不确定（置信度：低-中） · 「亲本总容量 11 只」和「6 个窝 × 2 只 = 12 只」对不上

**① 问题描述**
**现状**：培育室容量约束按「去重后的亲本总数 > 11 就拒绝」实现，而项目内既有口径写的是「最多 6 个窝可以两两相连」，6 个窝各放两只不同精灵就是 12 只。
**用户影响**：如果确实允许 6 个窝摆 12 只互不相同的精灵，第 12 只合法摆位会被判成「已被占用」；如果 11 是刻意留一位给学院小窝，则当前实现正确，只是没有注释说明。
**触发条件**：同一游戏账号累计接了足够多任务、亲本去重后达到 11 只以上。
（证据：`functions/migrations/2026-11-16-egg-matching.sql:55-61` 的 `>11`；`docs/交接-下一会话.md:205`「最多 6 个窝可以两两相连」；`src/data/changelog.json` 同款表述。数字 11 在任何文档里都找不到出处。）
**需要谁确认**：产品（用户）—— 培育室是否允许 12 只不同亲本同时在场，11 是否为「留一个空窝位」的刻意设定。确认前不建议改动该约束（属于表结构变更，需单独走迁移）。

**② 优化方案**
若确认 11 是笔误：另开一条迁移把常量改成 12 并补注释；若确认 11 有意为之：仅在 SQL 里补一行注释说明「6 窝 × 2 − 1（学院小窝占位）」，零风险。

**③ 优化后表现**
**解决**：容量口径与产品一致，且后来人不用再猜。**验收**：`node --test tools/test/egg-matching-api.test.mjs`（含「亲本容量」用例）通过，并补一条 12 只亲本边界的用例。

---

## 已核对、未发现问题的项

- 时间字段口径统一：所有新表都用 `INTEGER` 毫秒时间戳，仓内无 `DATETIME` / `CURRENT_TIMESTAMP`（`functions` 全目录检索为 0 命中），不存在 UTC 与本地时间混算；「北京日」是按 `now + 8h` 取日期（`functions/_lib/eggPatrol.ts:56`），测试里对应的「跨天重置」用例通过。
- 迁移可重复执行：`egg-matching`、`egg-patrol` 全部 `IF NOT EXISTS`；`placement`、`repeat-reminders` 的「建新表→搬数据→删旧表→改名」在内存 SQLite 上重复执行不报错、数据不丢（见上表复现⑤）。
- `egg_matching` 锁表/亲本表的索引能覆盖实际查询：写路径按 `(account_id, resource_id)` 主键与 `group_id` 索引，没有全表扫描的写语句。
- `egg_matching_parent_capacity` 的「一个账号只能一个学院小窝（绿窝）」与领域口径一致（`docs/superpowers/specs/2026-10-25-小组收集二期-…-design.md:34`「每账号 1 个绿窝」）。
- 巡查配额：`CHECK(used BETWEEN 0 AND 100)` 与「`ON CONFLICT … WHERE used<100` 才自增」配合，上限不会被越界写入（测试断言 100 封顶通过）。
- 两套接口测试均为本批新增文件（`git diff --name-status` 为 `A`），没有「把旧断言改松」的情况。

## 统计

| 等级 | 数量 | 编号 |
| --- | --- | --- |
| 高 | 1 | H01 |
| 中 | 2 | M01、M02 |
| 低 | 2 | L01、L02 |
| 不确定 | 1 | U01 |
| **合计** | **6** | |

## 最该先修的 3 条

### 1）R2b-H01 · 高风险 · 表结构自检是红的，闸门失效

**① 问题描述**：`node tools/test/verify-mother-groups-schema.mjs` 现在直接断言失败，`npm run test:mother-groups:api` 也在第 1/6 步中止；本次新增的换蛋/巡查表全靠人眼核对。
**② 优化方案**：把两条巡查迁移与一条重建迁移登记进自检清单并补区块标记，同时让索引比对覆盖不以 `idx_` 开头的索引。
**③ 优化后表现**：**解决** 闸门恢复绿色并通过一次建库比对覆盖巡查表；**验收** `node tools/test/verify-mother-groups-schema.mjs` 输出「schema 校验通过」。

### 2）R2b-M01 · 中风险 · 新库与线上库的「一颗蛋一条产出」约束不一致

**① 问题描述**：`repeat-reminders` 删、`placement` 建，谁后跑决定结构；`schema.sql` 走的是「没有」这条路，`plan.md §1` 记录的线上是「有」，三种建库路径两种结果。
**② 优化方案**：先回读线上 `sqlite_master` 确认口径，再要么删掉 `placement` 的建索引语句、要么在 `schema.sql` 补同款索引，并把两处注释对齐。
**③ 优化后表现**：**解决** 三种建库路径结构一致；**验收** 两条建库路径的 `egg_patrol%` 索引列表完全相同。

### 3）R2b-M02 · 中风险 · 跨组互斥靠报错兜底

**① 问题描述**：占位锁行因账号列 `NOT NULL` 永远写不进去，跨组占用实际由约束报错回滚实现。
**② 优化方案**：改成接单前显式查询锁表并返回明确错误码，或给占位行一个明确的占位账号值。
**③ 优化后表现**：**解决** 互斥有真实数据可依、可展示「被谁占了」；**验收** 跨组接单用例断言错误码为「蛋被占用」。

## 范围外备注（只记录，不展开）

- `tools/test/egg-patrol-api.test.mjs` 用「repeat-reminders → placement」的顺序建测试库（`:21-22`），与文件名顺序相反；这是 R2b-M01 能躲过测试的直接原因，修 M01 时一并核对。
- 巡查状态接口每个任务 3 条 SQL、其中一条全表扫描的问题已由 R2a-M01 覆盖，本批不重复计数；`egg_patrol_observations` 无 `task_key` 索引属同一根因。
- R2a-L02 的口径是「唯一索引已被删除」，与本批 M01 的实测（线上按 `plan.md` 记录是被 `placement` 建回来）冲突，两条需要统一口径后再改注释。
- `tools/test/collection-groups-api.test.mjs` 在本范围内净删 431 行（收集计划段与 `criteriaId` 断言），`mother-groups-api.test.mjs` 只把判定集版本 v3 → v4；这两处属 R3b / R5 / R9b 的范围，本批未审。
- `2026-11-18-accounts-username-password.sql` 与 `schema.sql` 的账号三列一致性属 R4 范围，本批未比对。
- `egg_patrol_*` 表没有任何定期清理（通知表、观测表会随交易单调增长），影响量级未知，留给 R2a / 运维评估。
- 本批未连真实数据库，「线上到底有没有 `egg_patrol_one_egg`」只能依据 `plan.md §1` 的记录，实测需有权限的人回读一次 `sqlite_master`。
