# 2026-11-19 审查修复交接 · 待确认，未发布

起点：`test` @ `d00739c`。可独立验收的修复已拆成提交，剩余改动和产物原位保留。**本轮未发布、未推送。**

## 已核实与待确认

1. **R2b-H01：六步闸门已转绿。** 原失败是旧夹具残留对 `mother_groups` 的巡查外键引用；现按巡查区块起止边界剥离，仅修改旧库夹具。没有把巡查迁移扩检混入本提交。
2. **R4-H03/H04：恢复码策略。** 找回入口可直接复用 POST /api/auth/recover，不需新增列，先交 375/390 预览审核，恢复后引导无用户名的老账号设置用户名密码。改密建议 A：保留当前会话，吊销其它令牌并让该账号旧恢复码失效；也可选 B：只吊销其它令牌、保留旧恢复码，旧码仍能登录。两者都保留无密码老账号的找回路径；仓库不能证明旧客户端不再使用恢复码接口。推荐先通过找回入口验收再启用 A。
3. **正式分支与生产结构。** 发布分支为 `release`，Cloudflare 目标为 `main`。只读查询 `npx --no-install wrangler d1 execute roco-toolbox-db --remote --json --command <结构查询>` 退出 0，查到 `username`、`username_lower`、`password_hash`、换蛋组表及七张巡查表；两条查询均 `changed_db: false`、`rows_written: 0`。没有读用户记录。另发现直接合并会把 `package.json` 从 `1.3.2` 带到 `1.5.6`，安卓 `versionName`/`versionCode` 也不同；未经确认不推进合并。
4. **R6b-H01：跨号补缺。** de0b394 断开 Coverage 到 StudMatrix 的跨号参数，但交互规范仍有该功能，存量跨号任务仍可见。证据偏向回归，但不能替代产品确认。建议只恢复单账号跨号补缺，不恢复小组资源页或需求中心。
5. **R9-1-H02 / R8a3-H01：采集边界。** 任意尾部切片缺少有效 PCAP 头和记录边界；继续解码还依赖偏移与状态。安卓桥未提供裁剪重写代次，网页不能仅凭长度分辨追加与裁剪后长回原长度。只评估能独立验证且不改 Worker 契约的网页缓解；如需改契约另行确认，不能把缓解算作完整修复。

如生产缺账号结构，现有 2026-11-18-accounts-username-password.sql 含三句 ALTER TABLE accounts ADD COLUMN username TEXT;、ALTER TABLE accounts ADD COLUMN username_lower TEXT;、ALTER TABLE accounts ADD COLUMN password_hash TEXT; 及 CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_username_lower ON accounts (username_lower) WHERE username_lower IS NOT NULL;。旧账号三列初始为 NULL，保留 recovery_hash、令牌、账号 ID 与关联数据。整份脚本不可重复盲跑。以上均未执行。

## 逐条处置

| 编号 | 状态与下一步 | 本轮验证 |
| --- | --- | --- |
| R2b-H01 | 已修：仅从旧库夹具剥离巡查区块，不改 schema、迁移或既有断言。`0c20305`（前置 HEAD `d00739c`）。 | `npm run test:mother-groups:api` 退出 0，六步通过，见下。 |
| R3a-H01 | 已修，`dc2d95a`：家园蛋不算可提供现蛋，也不进入分配或回礼候选。 | `npx vitest run src/ui/plan/EggMatchingHub.test.tsx src/ui/plan/EggTasksPanel.test.tsx src/ui/plan/EggStockPanel.test.tsx`：3 文件 26 通过。 |
| R4-H01 | 已修，`5dcb21b`：10 万次，旧 1 万次正确登录后静默升级，条件写入防止覆盖并发改密。 | 本地 Miniflare 100000 `{"ok":true}`、45ms 往返（不是生产 CPU 测量）；正式 CPU 预算未核实。 |
| R4-H02 | 已修，`5080bf0`：原密码错误返回 400，不触发 401 清会话。 | `node --test tools/test/auth-password.test.mjs`：`pass 1 / fail 0`（验证提交 `0697791`）。 |
| R4-H03 | 仅预览：`docs/prototypes/account-recovery-review.html`，待批准，不连接服务器。 | Chromium 375/390px：弹窗完整，空码报错，模拟成功引导设置用户名密码，无横向溢出。审核截图 `account-recovery-review-375.png`、`account-recovery-review-390.png`。 |
| R4-H04 | 已修会话，`1bb0a4c`：原子改密并吊销其它令牌，保留当前令牌。旧恢复码不变，是否作废待确认。 | 同 `auth-password.test.mjs`，两机令牌、正确/错误密码及恢复哈希保留通过。 |
| R5-H01 | 已修，`ac833b8`：个人展示和判定只使用第一个合法档位，旧存储与小组多档不改写。 | `npx vitest run src/ui/storeMigrate.test.ts src/ui/MotherCriteriaMedals.test.tsx src/ui/Dashboard.test.tsx src/domain/motherCriteria.test.ts`：4 文件 34 通过。 |
| R6a-H01 / R6a-M01 | 已修，`b6e3f4b`：其它分面保留所选档位；双组模式按交集。 | `npx vitest run src/ui/MyPets.test.tsx src/domain/petFilters.test.ts`：2 文件 58 通过；补测试数据，不改原断言。 |
| R6b-H01 | 未修；待确认是否只恢复旧跨号入口。 | 核对提交及交互规范，未跑浏览器。 |
| R7b-H03 | 已修，`18bcd58`：读存储失败时默认显示家园窝。 | `npx vitest run src/ui/Home.test.tsx`：18 通过，含 `SecurityError`。安卓未验证。 |
| R8a1-H01 | 未修；根因在 Android 悬浮窗 WebView 生命周期，无等价网页修复。 | Android 未编译、未验证、未发布。 |
| R8a2-H01 | 未修；网页已有 matched，Android 脚注误读 total；不应破坏标题总数来修脚注。 | Android 未编译、未验证、未发布。 |
| R8a3-H01 | 未修；网页仅评估可检测的失配重读；完整修复待壳提供代次。 | Android 未编译、未验证、未发布。 |
| R9-1-H02 | 未修；保持 Worker 契约与完整导入路径，涉及契约变化先问。 | 未做长采集、恢复点或内存实测。 |
| R3b3-H01 | 产品确认下线。保留未挂载组件和已有测试；不恢复路由、不删文件，保持旧资源页 mother-sharing-live 的 skip。 | 静态核对挂载与 skip；本轮未跑 npx tsc -b / npx playwright test --list，最终候选须验。 |
| R10-M04 | 下一轮；下载站兜底升级会改 version.json，与本次仅网页禁令冲突。 | 1.5.2/36 为原报告结果，本轮未回读。 |
| R10-L02 | 不纳入提交；现有 package-lock.json 改动保持原样，不暂存、不撤销。 | git diff --numstat -- package-lock.json 显示 2 2，仅既存版本元数据。 |

后续优先验证用户可见的重复通知与计数：区分规则允许的重复提醒和同一事件重复投递，用本地用例验证，不发真实 QQ 消息。R1-M03 承接客户端家园/背包水印；R2b-M01 待核对线上索引；R2a-M01 性能方案涉及加列，不在本次直接执行。其余中风险按 SUMMARY.md §2、§6 和 R*.md 编号承接。R11 七批文档审查未执行。

## R2b-H01 闸门实测

`npm run test:mother-groups:api` 退出码 **0**，真实输出摘录：

```text
[1/6] 校验 schema 定义（内存 SQLite）
schema 校验通过：
  - 完整 schema 与增量迁移的表/索引定义一致（可重复的迁移会跑两次）
[2/6] npm run build
✓ built in 6.35s
[3/6] 初始化临时本地 D1：C:\Users\SASAKI~1\AppData\Local\Temp\roco-mother-groups-AU8OEI
🚣 71 commands executed successfully.
[4/6] 启动本地 Functions：http://127.0.0.1:8789
[wrangler:info] Ready on http://127.0.0.1:8789
[5/6] 运行 API测试
ℹ tests 34
ℹ pass 34
ℹ fail 0
[6/6] 通过
```

## 发布记录

- **未发布。** 无正式候选 bundle、SHA-256、发布时间、通道校验、发布后回读或可执行的目标回滚命令。本轮未合并、推送、部署、打包，未改默认站、版本或清单；生产 D1 只读查结构。
- `npx tsc -b` 和 `npx tsc -p functions/tsconfig.json` 通过；`node tools/lint-copy.mjs`：`文案 lint 通过：存量 13 条，新增 0 条。` `npx playwright test --list`：`Total: 82 tests in 15 files`。
- `npx playwright test e2e/my-pets.spec.ts e2e/dashboard.spec.ts e2e/mother-sharing.spec.ts --workers=2 --output=docs/code-review/2026-11-19/playwright-130209` 退出 1：`6 failed / 28 passed (1.8m)`。看板 4 项：种公推荐标题未找到、两个过期 `inventory-grade-toggle` 定位、账号摘要定位匹配两个控件；背包 2 项：旧性别/体型瓦片定位不存在。日志上下文原位保留。未放松断言；既存 e2e 改动先不提交。最终候选的全量 Vitest、API 闸门复验及回读未执行。
- 版本裁决：建议正式候选保留 `release` 版本元数据与安卓壳配置，仅合入网页、必要 API 与相关测试；绝不把整条 `test` 直接合入并带上壳版本变更。明确发布范围后再续。若后续回滚，只恢复上一笔 Cloudflare 网页部署及其 Functions，并比对两份清单与 APK 字节；不改清单或 APK。
- git diff --quiet origin/release test -- public/android/version.json public/android/version-18.json 退出 0，仅证明 Git 中清单一致。正式发布前记录现网部署 ID、bundle 与两份清单/APK 的字节校验；仅回滚网页及对应 API 行为，清单/APK 不重发，回读比对基线。
- 继续后按问题提交，保留未暂存的锁文件、设计台账原改动、e2e 改动和所有预览/截图；最终闸门用候选实跑，不用历史输出替代。

## 已有改动的拆分提交

| 编号 | 提交与行为 | 本轮实测 |
| --- | --- | --- |
| R7a-H01 | `8063e81` 背包分段渲染。 | `PetList.test.tsx` 2 通过、`MyPets.test.tsx` 7 通过。 |
| R7b-H02 | `6992be3` 已同步上窝不可撤回提示。 | `HomeDemandPlacements.test.tsx` 27 通过。 |
| R9-2b-M01 | `445d0c4` 采集期间刷新悬浮窗需求。 | `useNearbyOverlayPush.test.tsx` 7 通过。 |
| R9-4b-M01 | `17efaa9` 默认站文案和身份隔离提示；不改默认地址。 | `ServerAddressPanel.test.tsx` 13 通过。 |
| R9-1-H01 / R10-M02 | `23e252f` 桌面超限状态仍可读。 | `nativeCollector.test.ts` 13 通过；未打包。 |
| R9-1-M01 | `0698dfd` 并发采集共享进度。 | `useCaptureProgress.test.tsx` 10 通过；有 `act()` 警告。 |
| R1-M02 | `7c50926` 巡查对单条脏配窝容错。 | `eggPatrol.test.ts` 9 通过。 |
| R1-M03 | `63ad97d` 家园与背包拆分水印。 | `eggWorkflow.test.ts` 26 通过。 |
| R7b-H01 | `bd308b7` 母本与看板读同一口径，已选档可取消。 | `Dashboard.test.tsx` 16、`MotherCriteriaMedals.test.tsx` 3、`CollectionTargetEditor.test.tsx` 6 通过。 |
| R7c-L05 | `dc5d17e` 缺奖牌图片显示文字。 | `npx tsc -b` 退出 0。 |
| R9-5 / 引导与埋点 | `215583c` 首启判抑制、引导版本 4、同步已读及去重埋点。 | `App.test.tsx` 7、`useTabViewTracking.test.tsx` 2 通过（单独请求的 `tour.test.tsx` 不在实际收集结果，未算通过）。 |
| R2a-H01 / H02、R1-M02 接线 | `fbc45c7` 按组读巡查，已产出不回退，并报告坏配窝数量。 | `node --test tools/test/egg-patrol-api.test.mjs tools/test/deploy-web.test.mjs`：25 通过；未发真实 QQ 消息。 |
| R10-H01 / M01 / M03、R9-6-H01 / M02 | `82fae69` 发布护栏、文案闸门与桌面迁移原有改动。 | 同上护栏测试及文案 lint；桌面未打包、未验收安装覆盖。 |
| R10 文档 | `70ce1a1` 项目名称和入口说明。 | `npx tsc -b` 退出 0。 |
