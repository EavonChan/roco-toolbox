# R9c · 端到端测试 / 脚本 / 数据管线

> 审查范围 `779b08c..894de06`（test 分支），**行号一律以 `894de06` 为基准**。
> 本批只读审查：未改任何代码、未做任何 git 写操作、未执行部署/打包/发布。
> 已执行（只读）：`node --test tools/test/deploy-web.test.mjs scripts/design-assets.test.mjs`（3 通过 / 0 失败）、
> `npx playwright test --list`（85 个用例 / 15 个文件，全部可枚举，无残留 helper 引用）。
> 工作区未提交的原型 / 截图 / `docs/设计资产/registry.json` 改动不属于本次范围。

---

## R9c-M01 · 中风险 · 正式发版的「下线文案」拦截只看了首页那一个 JS 文件，文案换个分包就能混上正式站

① **问题描述**
- **现状**：发版脚本只从 `dist/index.html` 里抓一个 `assets/index-*.js` 并只读这一个文件做关键字检查（`scripts/deploy-web.mjs:56-71`），其余产物一律不看。
- **用户影响**：把「收集计划」这类已下线功能的界面放进懒加载分包（打包时被自动拆出的独立 JS）后，脚本仍会逐条打印 ✓ 并照常部署，正式站会重新出现内测功能——这正是 `docs/发版与更新规范.md:195` 所说的「最后一道机械拦截」被静默绕过。
- **触发条件**：新增/恢复任何被删功能且它通过 `import()` 懒加载，或文案被 rollup 提到公共分包，然后发 `main` 或 `test`。
- **证据**：实测当前 `dist/assets` 有 3 个 JS（`index-*`、`core-*`、`decodeCapture.worker-*`），入口 `index` 用 `import("./core-BMmuAoTd.js")` 动态加载 core，而 core 里本身就有大量中文文案（性格名、技能名），说明分包是常态化产物；`src/pcap/decodeCapture.ts:30` 就是这么拆出 core 的。

② **优化方案**
A) 把检查改成「遍历 `dist` 下全部 `.js`（`assets/**` 递归 + `dist/sw.js`）逐个做关键字判断，任一命中即中止」——约 5~10 行，代价是每次发版多读几百 KB（当前 3 个文件，毫秒级）；
B) 只额外扫 `dist/assets/*.js`，`sw.js` 单独补一条。
推荐 A：既覆盖分包也覆盖 Service Worker（离线壳，用户拿到的就是它）；行为与现有 `fail()` 一致，失败仍在调用 wrangler 之前退出（`:138-147` 早于 `:154`）。

③ **优化后表现**
- **解决**：发版前看到的是一份「整个产物都不含下线文案」的结论，而不是「首页那个文件不含」。
- **验收**：`node --test tools/test/deploy-web.test.mjs` 全绿；并把测试夹具改成把「收集计划」写进第二个 JS 文件（如 `assets/core-QA1.js`），断言脚本非 0 退出且提示「内容断言」。

---

## R9c-M02 · 中风险 · 发版脚本不认产物来自哪里，任意分支 / 任意目录构建出来的 dist 都能被打上正式站

① **问题描述**
- **现状**：`--dist` 可指向任意目录（`scripts/deploy-web.mjs:34`），部署命令固定带 `--commit-dirty=true`（`:155-157`），脚本全程不读 git 分支、不看工作区是否干净，唯一门槛是人工加 `--approve-production`（`:48-51`）与内容断言。
- **用户影响**：在功能分支上 `npm run build` 之后直接执行发版命令，脚本会一路绿灯把正式站顶到没被核对过的代码上——`docs/发版与更新规范.md` §4.2（「先提交、再构建」「工作区干净」）与 2026-11-10 事故就是这一类；一旦发出去，回滚与复盘都找不到对应提交。
- **触发条件**：非 release 分支构建 → `node scripts/deploy-web.mjs --branch main --approve-production`（不带/带 `--dist` 都行）。
- **证据**：`scripts/deploy-web.mjs:34,48-51,138-157` 与 `docs/发版与更新规范.md:188-198` 对照；脚本里没有任何 `git` 调用。

② **优化方案**
A) 部署前读 `git rev-parse --abbrev-ref HEAD` 与 `git status --porcelain`：分支不是 `release`（或指定的正式分支）或工作区有改动就中止，并打印本次 HEAD 提交；需要临时验证包时显式加 `--allow-dirty`。约 15 行，风险是 worktree / 直接拷仓库的用法要补参数；
B) 只做告知：打印 HEAD 提交并要求 `--expect-hash` 必填。
推荐 A（真正挡住越界），B 只降低误发概率。

③ **优化后表现**
- **解决**：发版人不会再在「绿灯」下把功能分支的产物推上正式站。
- **验收**：在非 release 分支上跑 `node scripts/deploy-web.mjs --branch main --approve-production --dry-run`，脚本非 0 退出并指出当前分支；在 release 且工作区干净时仍能正常打印 bundle 与 SHA-256。

---

## R9c-L01 · 低风险 · 项目放在含空格的路径里，发版命令会拼错，报错看不懂

① **问题描述**
- **现状**：部署调用用 `shell: true`（`scripts/deploy-web.mjs:155-157`），Windows 下由 cmd 拼字符串，`dist` 绝对路径没有加引号；项目目录或 `--dist` 含空格时命令被截断、参数错位（本机用户目录 `C:\Users\Sasaki ishiran\…` 本身就带空格）。
- **用户影响**：换一台机器 / 换个目录发版时直接报 wrangler 参数错误，看起来像发布失败，排查方向被带偏。
- **触发条件**：仓库路径、`--dist` 路径或用户名目录含空格，或含 `&` 等 cmd 特殊字符。

② **优化方案**：Windows 用 `npx.cmd` 走 `execFileSync` 并去掉 `shell: true`（参数按数组传，天然不需要转义）；或保留 shell 但给路径加双引号。约 3 行，不影响现有命令含义。

③ **优化后表现**
- **解决**：含空格路径下也能正常部署。
- **验收**：把仓库复制到含空格的路径跑一次 `--dry-run` 与一次真实部署（发版时顺带）。

---

## R9c-L02 · 低风险 · 设计资产台账的机械校验没有任何命令会执行，台账漂移不影响发版

① **问题描述**
- **现状**：`scripts/design-assets.mjs` 的校验（`:98-107`）只在手动执行时运行；`package.json:22` 的 `verify` 是 `tsc -b && vitest run`，不包含它；`scripts/design-assets.test.mjs` 也不在 `vite.config.ts:70` 的 include（只收 `src/**`）里，`npm test` 跑不到。
- **用户影响**：改了原型 HTML 却没更新台账（`docs/设计资产/registry.json`）时没有任何红灯，`AGENTS.md`「交付时同步登记」只能靠自觉；等到有人手动跑脚本才发现一串「内容指纹变化 / 未登记」。
- **触发条件**：新增或替换原型 HTML、没同步 registry 就交付。

② **优化方案**：把 `node scripts/design-assets.mjs`（只校验，不加 `--write`）与 `node --test scripts/design-assets.test.mjs` 串进 `verify`。代价：verify 多 0.6 秒；若台账在历史上已漂移需要先补登记（改动可能有几十行 registry 数据）。

③ **优化后表现**
- **解决**：台账不同步会在本地就失败，不再等人工核对。
- **验收**：故意改一个登记过的 HTML 不改指纹，`npm run verify` 非 0 并打印「内容指纹变化：…」。

---

## R9c-L03 · 低风险 · 新加的两个管线函数没有任何测试，阈值规则改坏了要等发版后才暴露

① **问题描述**
- **现状**：`tools/data-pipeline/trim-catalog.mjs:111-117` 的 `toEggSize`（四个阈值缺一就不输出，防止「蛋重 >= 0 恒成立、每枚蛋都判大块头」）没有单测且未导出；新脚本 `tools/data-pipeline/sync-decoder-catalog.mjs` 全流程也没有测试，`tools/data-pipeline/tests/` 里没有对应用例。
- **用户影响**：以后调整阈值来源或改判据时没有任何回归保护，最容易出现的是「整批蛋被误判成大块头/小不点」，而且只能等用户发现。
- **触发条件**：后续修改 `toEggSize`、`egg_size` 字段来源或 `sync-decoder-catalog` 的覆盖集合。

② **优化方案**：导出 `toEggSize`，补三条用例（四值齐全 → 对象；缺 `huge_min` → `undefined`；值为字符串 → `undefined`）；`sync-decoder-catalog` 的「已收录集合」与 `formId` 去重抽成纯函数各补一条。约 30 行，跑在现有 `npm run test:data-pipeline` 里。

③ **优化后表现**
- **解决**：判据改动会在本地单测就红。
- **验收**：`npm run test:data-pipeline` 出现 `toEggSize` 相关用例并全绿。

---

## R9c-L04 · 低风险 · 发版脚本的测试只覆盖正式通道，test 通道与哈希校验改坏了也全绿

① **问题描述**
- **现状**：`tools/test/deploy-web.test.mjs:20-25` 两个用例都写死 `--branch main`，没有覆盖：`--branch test` 成功路径、`--expect-hash` 不一致必须中止、缺少 `index.html` 必须中止、失败时不应走到 wrangler。
- **用户影响**：以后调整脚本时把 test 通道或哈希比对改坏，CI 仍然全绿，问题留到真实发版。
- **触发条件**：后续修改 `scripts/deploy-web.mjs` 的参数解析或断言顺序。

② **优化方案**：补 3 个用例（test 通道正常构建；`--expect-hash 0…0` 非 0 退出；删掉 `index.html` 非 0 退出），沿用现有临时目录夹具，约 10 行。

③ **优化后表现**
- **解决**：两条通道与哈希门槛都有机械回归。
- **验收**：`node --test tools/test/deploy-web.test.mjs` 用例数从 2 增到 5 且全绿。

---

## R9c-U01 · 不确定 · 蛋重阈值已写进管线，但产物图鉴里一条都没有，界面上可能永远「判不了」

① **问题描述**
- **现状**：`trim-catalog.mjs:165` 新输出 `eggSize`，但 `src/data/catalog.gen.json` 在本范围内没有重新生成——实测 662 个物种中带 `eggSize` 的为 **0**；同时全仓库目前没有任何消费方（只有 `src/domain/types.ts:43` 的类型声明）。
- **用户影响**：如果本版要让「按蛋重判大块头/小不点」对外生效，用户会一直看到「没有数据、判不了」；如果没有消费方，则暂时无感。
- **触发条件**：直接拿当前 `catalog.gen.json` 构建并发布。
- **置信度**：事实（0 条 `eggSize`）置信度高；「本版是否本该带这份数据」置信度低。
- **需要谁确认**：数据/产品负责人——是「只改脚本、数据下一版再发」，还是「本版就该执行 `npm run trim:catalog` 并一起发」。确认前不要动 `catalog.gen.json`。

② **优化方案**：二选一。A) 本版要发：重跑 `npm run trim:catalog`，核对 diff 只多出 `eggSize` 字段后提交；B) 本版不发：在交接卡里登记「eggSize 未启用」，不做其它改动。

③ **优化后表现**
- **解决**：发版口径与数据现状一致，不会出现「功能在但数据空」的半成品。
- **验收**：`node -e "…统计 catalog.gen.json 中 eggSize 数量…"` 的结果与确认结论一致；若选 A，数量应等于可孵蛋物种数。

---

## 统计

| 级别 | 数量 | 编号 |
| --- | --- | --- |
| 高 | 0 | — |
| 中 | 2 | R9c-M01、R9c-M02 |
| 低 | 4 | R9c-L01、R9c-L02、R9c-L03、R9c-L04 |
| 不确定 | 1 | R9c-U01 |

**已核实但未定级（无问题）**：`deploy-web.mjs` 缺少 `--approve-production` 或 `--branch` 取值非法都会在调用 wrangler 之前以非 0 退出，`--branch=main` 这种写法拿不到值同样被拒；两份正式清单的存在、可解析、`apkUrl` 指向正式包、两份版本一致四条断言齐全，且 `test.*` / `/internal/` 路径被单独拒绝；`node --test tools/test/deploy-web.test.mjs scripts/design-assets.test.mjs` 3 通过；`npx playwright test --list` 85 个用例可枚举，`collection-plans.spec.ts` 删除与 mock 瘦身后没有残留引用，被删的 `MockPlanSeed` / `MockOfferSeed` / `uploadCapture` 全仓库无引用；`sync-decoder-catalog.mjs` 的属性顺序 [体力, 攻击, 特攻, 防御, 特防, 速度] 与现有解码器图鉴 776 条样本中 617 条吻合、命名/`runtimePetId`/`formId` 写法与既有条目一致，重复执行不会重复追加。

## 最该先修的 3 条

1. **R9c-M01**：发版拦截只扫首页 JS，下线文案放到分包即可混上正式站——「最后一道机械拦截」实际只覆盖了三分之一的产物，改法是把检查扩到 `dist` 下所有 JS。
2. **R9c-M02**：脚本不认产物来源，功能分支构建的 dist 同样能拿到绿灯并顶掉正式站（2026-11-10 事故同型），建议发版前断言分支与工作区干净。
3. **R9c-U01**：先确认蛋重阈值这份数据本版发不发，否则可能出现「功能已上线、数据一条没有」的半成品（需数据/产品拍板）。

## 范围外备注（只记录，不展开）

- `package.json:23-24` 的 `deploy:test` / `deploy:prod` 仍直连 `wrangler pages deploy`，完全绕开本脚本的全部断言；已由 **R10-H01** 覆盖，本批不重复计数。
- `verify` 去掉 `tools/lint-copy.mjs`（基线 `779b08c` 有、当前没有）同样属 R10 范围。
- `deploy-web.mjs` 未校验清单里的 `minSupportedVersionCode` 合理性，属 **R8b-M02** 的建议，不在本批展开。
- `e2e` 改动只做了静态枚举与引用检查，按约束未跑真实用例（未起 `npm run preview`、未跑 Playwright 执行）。
- 工作区里 `docs/设计资产/registry.json` 的未提交修改、`../../../%E5%8E%9F%E5%9E%8B/%E5%8E%86%E5%8F%B2/preview/` 与 `2026-11-xx/` 原型目录不在本次范围。
