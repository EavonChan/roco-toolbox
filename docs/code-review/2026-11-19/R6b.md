# R6b 看板 / 收集 / 覆盖度 · 只读审查

- 审查范围：`779b08c..894de06`（test 分支），**行号一律以 `894de06` 为基准**。
- 本批文件：`src/ui/Dashboard.tsx` / `Dashboard.test.tsx`、`src/ui/Collection.tsx` / `Collection.test.tsx`、`src/ui/Coverage.tsx` / `Coverage.test.tsx`、`src/ui/CoverageFilterBar.tsx`、`src/ui/CoverageIntroCard.tsx`、`src/ui/coverageFilterStore.ts`。
- 纪律：只读，未改任何代码，未做任何 git 写操作。
- 已跑验证：`npx vitest run src/ui/Dashboard.test.tsx src/ui/Collection.test.tsx src/ui/Coverage.test.tsx` → 3 文件 / 25 用例全过；`npx tsc -b` → 通过。

---

## 高风险

### R6b-H01 · 高风险 · 种公阵列里「别的号能补这颗蛋」和「加入配窝建议」整块消失，只剩存量任务能删不能加

① **问题描述**
**现状**：覆盖度页不再把自己的蛋名单交给种公阵列，阵列里嵌口格右下角的淡蓝「补」标记、点格弹出「其他号能出的所有蛋」、每条蛋右侧「加入配窝建议」这三件事一起消失，看板「配窝建议」里的跨号分组从此没有新增入口。
**用户影响**：小号养大号的玩家再也看不到「这个缺口小号A能配出火花 60%」，也做不了跨号补种公的待办，只能自己回两个号里翻。
**触发条件**：进「收集 · 种公」覆盖度，或从看板看配窝建议的「跨号补种公」分组——只要不是看代码，就再也进不来。
（`src/ui/Coverage.tsx:44-52` 已删掉 `transferTarget`/`transferPets` 计算，`:191-206` 调 `StudMatrix` 不再传这两个 prop；`src/ui/StudMatrix.tsx:49-51,126-127,159-167,483-489` 逻辑与按钮仍在，但 `transferTarget` 为空时整段不渲染；`src/ui/useOwnedPets.ts:23,35` 仍保留「给种公阵列跨号补缺用」的 `all`；需求依据 `docs/产品交互规范.md:191-193`、`src/data/changelog.json:102-103`（2026-11-03 已上线）；删除来自 `de0b394`，该提交未改规范也未写 changelog 说明下线。）

② **优化方案**
方案 A（推荐）：在 `Coverage.tsx` 恢复「当前只勾了一个账号时，取该号以外的全部精灵」这段十来行计算，把 `transferTarget`/`transferPets` 传回 `StudMatrix`，其余组件不用动，风险低、回滚容易。
方案 B：若产品确认要下线跨号补缺，则把 `StudMatrix` 里相关分支、`useOwnedPets.all`、`studTransferTaskStore` 一并删除，并同步删掉交互规范两条与 changelog，别留「规范说有、界面上没有」的半套。
两种都要先跟产品确认是「回归」还是「有意下线」，不能凭现状默认。

③ **优化后表现**
**解决**：只勾一个号看覆盖度时，缺口格里又能看到哪个小号能补、点开能选蛋、能一键记进看板配窝建议。
**验收**：导入两个账号 → 收集 · 种公 → 账号只勾一个 → 打开一个缺口格，应能看到「其他号可出的蛋」列表且每条带「加入配窝建议」；操作后回看板「配窝建议」应出现「目标号 ← 源号」分组。

---

### R6b-H02 · 高风险 · 看板「母本全收集」和点进去的母本页给出两个不同数字（默认设置下就不一致）

① **问题描述**
**现状**：看板卡现在用覆盖度的单一奖牌档位自己算一遍母本缺口，母本页仍按「个人母本达标条件（可四档多选）」算，两处不再共用同一份计数。
**用户影响**：默认设置下（看板默认只追「大婉」、个人母本条件默认不限档位）卡上显示「大婉 3/142」，点进去却看到「已收集 12/142」，用户会以为工具算错——这正是 2026-10-06 修过的同一个问题。
**触发条件**：任何账号里有「非大婉档」的达标母本，或用户在母本页把达标条件改成了别的组合，看板卡都不会跟着变。
（`src/ui/Dashboard.tsx:53-61` 用 `selectedGrade` 覆盖 `motherCriteria.grades`，`:70-74` 自算 `missingMothers`，`:239-248` 用它当分子；`src/ui/MotherView.tsx:254-264` 仍用 `criteria.grades`；共享口径在 `src/ui/useCollectionSummary.ts:66-83`（`mother.collected`）已不再被看板使用；需求依据 `docs/产品交互规范.md:17`「个人母本条件只影响个人清单和看板母本进度」、`src/data/changelog.json:709`「看板卡与母本页同一口径」、`src/domain/motherCriteria.ts:16-18` 注释；既有 e2e `e2e/dashboard.spec.ts:70-85` 仍在断言两者数字一致。）

② **优化方案**
方案 A（推荐，与「目标奖牌组合（公母共用）」文案一致）：把档位统一到一处——母本页也读同一个单选档位（或在看板选档时同步写回个人母本条件），看板继续用 `useCollectionSummary().mother.collected`，两页天然同源，改动约 10 行 + 一处 store 写入。
方案 B：看板卡改回 `mother.collected` / `mother.total`，母本缺口列表也改回个人条件，代价是「公母共用」这句文案要改，且看板不能再靠选档位筛母本。
口径二选一需要产品拍板（规范 21 行说「公母共用」，17 行说「个人母本条件决定看板母本进度」，两条互相矛盾）；确认前不要自行统一。

③ **优化后表现**
**解决**：同一份母本数据，看板卡与母本页显示同一个「已收集 N / M」，用户点进去数字不跳变。
**验收**：导入含非大婉母本的账号 → 记下看板「母本全收集」分子 → 点卡进母本页 → 顶部的「已收集 N」应与之相同（即 `e2e/dashboard.spec.ts:70-85` 恢复通过）。

---

## 中风险

### R6b-M01 · 中风险 · 新用户（还没有账号）时，看板的「目标模式」开关和收集页三张入口卡会错位、右侧空出一列

① **问题描述**
**现状**：账号数为 0 时账号控件返回空，但父级网格仍按「账号列 + 3 列」预留位置，剩下三个元素挤在前三列，右边留一块空白；收集页三张入口卡宽度也会和平时不一样。
**用户影响**：第一次打开、还没导入数据的人（也是教程第一屏）看到的是排歪的顶栏，第一印象就是「这页坏了」。
**触发条件**：本机没有任何账号快照时进入看板或收集页。
（`src/ui/Collection.tsx:92-96` 固定 `grid-cols-[minmax(76px,0.8fr)_repeat(3,minmax(0,1fr))]`，账号槽在 `src/ui/AccountFilterBar.tsx:19` 无账号时 `return null`；看板 `src/ui/Dashboard.tsx:110-158` 同样固定三列，账号按钮在 `:115` 才有条件渲染。）

② **优化方案**
把「有没有账号」提到网格层：无账号时不渲染账号槽，收集页退回 `grid-cols-3`，看板退回两列（`auto + 1fr` 右对齐目标模式）；或给账号槽一个占位元素并保持列宽。各改两三行，不涉及数据。

③ **优化后表现**
**解决**：还没导入数据时，看板目标卡与收集页三张卡都是正常对齐的，不会出现空白列。
**验收**：清空浏览器数据后打开站点 → 看板目标卡里的「追满分 / 追双牌」贴右、收集页三张卡等宽三等分；375 与 390 宽各看一次。

---

### R6b-M02 · 中风险 · 发版前的端到端回归会挂：几条旧用例还在点已经被删掉/改名的元素

① **问题描述**
**现状**：本轮删了「按代表档位查看母本」入口、覆盖度档位改成可点选控件、看板不再渲染通用账号筛选条、账号芯片与「全选」按钮改了标识，但 e2e 仍在找旧标识。
**用户影响**：这不是用户直接看到的问题，而是「发版前最后一关」跑不绿——`dashboard.spec` 的档位库存、账号联动两条和 `coverage.spec` 的档位只读断言都会失败，真正的回归信号被噪声淹没。
**触发条件**：跑 `npx playwright test e2e/dashboard.spec.ts e2e/coverage.spec.ts`。
（`e2e/dashboard.spec.ts:303,351` 找 `inventory-grade-toggle`（`Collection.tsx` 已删）；`:393-408` 找看板 `account-filter` / `account-chip-测试乙` / `account-filter-toggle-all`（看板已不渲染 `AccountFilterBar`，且 `AccountFilterBar.tsx` 改名为 `account-filter-*` / `account-filter-select-all`）；`e2e/coverage.spec.ts:112` 找 `coverage-grade-readonly`（已换成 `coverage-target-grade-*` 可点选控件）。`e2e/dashboard.spec.ts:70-85` 的口径断言见 H02。）

② **优化方案**
按新界面重写这几步：档位库存那条整条删除或改到母本页的达标条件控件上；账号联动改点 `dashboard-account-summary` → `dashboard-account-*` / `dashboard-account-select-all`，并把「账号（N/M）」文本断言改成摘要卡上的「(N/M)」；覆盖度只读断言改为断言 `coverage-target-grade-*` 的 `aria-pressed`。只动测试，不动实现。

③ **优化后表现**
**解决**：发版前的 e2e 能一次跑绿，不再有「功能没问题但用例红」的干扰。
**验收**：`npx playwright test e2e/dashboard.spec.ts e2e/coverage.spec.ts` 全部通过（本轮只做了静态核对，未执行 Playwright）。

---

## 低风险

### R6b-L01 · 低风险 · 两个已经没人用的界面组件/分支还留在仓库里

「按代表档位查看母本」的库存组件与「调整目标」弹层的母本分区都已无生产入口，留着会让下次改文案/改口径时误以为它们还生效。
（`src/ui/MotherGradeInventory.tsx:31` 全仓只有自身文件与测试引用；`src/ui/CollectionTargetEditor.tsx` 仅被 `Coverage.tsx:328-332` 以 `section="studs"` 使用，母本分支无调用方。）

建议：删除 `MotherGradeInventory` 及其测试；`CollectionTargetEditor` 的 `mothers` 分支（母本已由 `MotherView` 内的 `MotherCriteriaMedals` 承担）一并收敛。

### R6b-L02 · 低风险 · 一处「给跨号补缺用」的数据已经没人取，注释还写着它在用

`useOwnedPets().all` 现在没有任何调用方，注释仍写「给种公阵列的跨号补缺用」，与 H01 同源，会误导后续维护者。
（`src/ui/useOwnedPets.ts:23,35`；全仓 `const { accounts } = useOwnedPets()` 均为单字段解构。）
建议：H01 按方案 A 恢复后保留；若走方案 B，连 `all` 一起删。

### R6b-L03 · 低风险 · 覆盖度说明卡里的话和页面实际不一致，改过的文案也没让老用户看到

说明卡写死「已通 N / 14 组」，但蛋组被筛掉时页面显示的是「/ 13 组」；还说「奖牌组合在看板目标卡选择」，而下方筛选面板里本身就有同一个选择器；本轮把 1 条说明改成 3 条却没升级版本号，已经点过「知道了」的人永远看不到新增的两条。
（`src/ui/CoverageIntroCard.tsx:32-36`、`:12` `COVERAGE_INTRO_VERSION = '3'` 未变；对照 `src/ui/Coverage.tsx:166-169` 用的是 `stud.groupCount`、`src/ui/CoverageFilterBar.tsx:60-66` 自带档位选择器。）
建议：文案改成「已通 N / 当前蛋组数」，删掉「去看板选」这句或改成「看板与筛选面板都可选」，并把版本号 +1。

### R6b-L04 · 低风险 · 账号选择现在有两套实现，且「一个都没选」时的处理相反

看板自己重写了一套账号摘要+卡片选择，收集/覆盖度仍用通用账号条；通用条在「一个都没选」时会静默恢复成全选，看板则保留并提示去选。同一个共享筛选，两页行为不同。
（`src/ui/Dashboard.tsx:110-203` 自建实现；`src/ui/AccountFilterBar.tsx:16-18` 的自动 `clearAccountFilter()` 与 `dd23006` 明确删掉的看板同款 effect 相反。）
建议：把「无选中时怎么办」定成一条规则（保留并提示即可，与 `docs/产品交互规范.md:32`「必须提供恢复控件」对齐），通用条去掉自动全选；两套实现可暂不合并，但行为要一致。

### R6b-L05 · 低风险 · 几个边界没有测试兜底

「完全没有账号」的看板/收集布局与文案没有任何用例（旧的「账号全被筛掉」用例被换掉后再无覆盖）；覆盖度页「恢复默认」的页面级用例被整条删除，而重置入口仍在；档位迁移 `slice(-1)` 没有用例。
（`src/ui/Dashboard.test.tsx` 无 `accounts: []` 场景；`src/ui/Coverage.test.tsx` 删除了「恢复默认：蛋组回到 14/14」；`src/ui/coverageFilterStore.ts:77-80` 的 `slice(-1)` 无对应断言。）
建议：补三条最小用例即可，不扩大范围。

### R6b-L06 · 低风险 · 看板每次重渲染都会重算一遍母本缺口（性能，非新引入）

`effectiveCriteria` 每次渲染新建对象，导致 `useMemo` 依赖恒变、每次都全量重算母本判定；账号多、蛋多时表现为看板卡顿。本轮改动继续沿用这个写法。
（`src/ui/Dashboard.tsx:55-61` 的对象字面量作为 `:70-73` 的依赖。）
建议：把 `effectiveCriteria` 也用 `useMemo` 包一层（依赖 `motherCriteria` / `mode` / `selectedGrade`）。

---

## 不确定

### R6b-U01 · 不确定（置信度中）· 老的「多档位目标」在升级后被静默收敛成最后一个，用户的分母会突然变小，且没有任何提示

**现象**：上一版允许同时追多个奖牌组合，本轮迁移只保留数组最后一个（顺序＝用户点击顺序），覆盖度分母、种子公槽位、看板数字同步缩水；`src/data/changelog.json` 最新条目停在 2026-11-17，没有一句说明。
**需要谁确认**：产品/用户运营——这是「规格变更，接受静默收敛」，还是「要在更新说明里讲一句，或保留旧档位多选」？
（`src/ui/coverageFilterStore.ts:77-80` `filter(isGrade).slice(-1)`；`src/ui/Dashboard.tsx:53` 同样取最后一个；`CoverageFilterBar.tsx:60-63` 取第一个——内存里已是单选所以当前不会分叉，但两处取端不同的写法容易在后续改动里变成真 bug。）
建议：若接受收敛，补一条 changelog 并统一成「取第一个」的写法；若不接受，迁移时给出提示让用户重选。

---

## 统计

| 级别 | 条数 | 编号 |
| --- | --- | --- |
| 高 | 2 | H01、H02 |
| 中 | 2 | M01、M02 |
| 低 | 6 | L01–L06 |
| 不确定 | 1 | U01 |
| 合计 | 11 | — |

## 最该先修的 3 条

1. **R6b-H01**：跨号补缺整块消失——小号帮大号补种公的整条链路（补标记、可出的蛋、加入配窝建议）从界面消失，且规范与 changelog 仍写着它在线；先确认是回归还是下线，回归就补回传参，下线就同步文档。
2. **R6b-H02**：看板母本进度与母本页不同口径——默认设置下卡上和页内就是两个数字，点进去数字跳变，正是 2026-10-06 修过的那个 bug；需产品先定「以看板目标为准」还是「以个人母本条件为准」，再统一到一处。
3. **R6b-M02**：e2e 旧选择器失效——档位库存、账号联动、覆盖度只读三处用例必挂，发版前的回归会被噪声掩盖，按新界面重写这几步即可，不动实现。

## 范围外备注（只记录，不展开）

- 与本批相邻、未在此展开的：`AccountFilterBar` 重写与 `MyPets` 卡片（R7a / R6a）、`MotherView` 的母本条件控件（R7b）、`e2e/*.spec.ts` 的整体改造（R9c）。`e2e/my-pets.spec.ts:192` 找的 `page-indicator` 在 `779b08c` 基线就已不存在，属既有失效，不是本轮引入。
- 本轮看板/收集明显改版，`src/data/changelog.json` 没有对应条目（最新为 2026-11-17）；是否必须在发版说明里补一条，按 `docs/发版与更新规范.md` 由发版流程判断。
- 工作区未提交的 `docs/设计资产/registry.json`、`.preview/`、原型目录未纳入审查，也未改动。
- 未执行 Playwright、未打包、未部署；本报告只做了静态核对与上述单测/类型检查。
