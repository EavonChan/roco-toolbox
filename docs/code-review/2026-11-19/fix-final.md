# 2026-11-19 审查修复交接 · 待确认，未发布

本轮核对了原始证据、裁决和发布门槛。起点与当前分支均为 test，HEAD 均为 d00739ce38191c759d7f013434393ab4adc11278。仅新增本报告；原有 46 个已跟踪文件的改动和未跟踪产物保留，未暂存、提交、回滚或清理。下表没有新修复提交号，不能把三路未提交改动算作已落地。

## 已核实与待确认

1. **R2b-H01：闸门仍红，但可只改测试夹具。** npm run test:mother-groups:api 退出 1；第 1/6 步报 AssertionError [ERR_ASSERTION]: 旧 schema 不应包含新表 mother_groups（tools/test/verify-mother-groups-schema.mjs:159）。旧库夹具没有剥离新增巡查区块，剩下 4 处真实外键引用。拟在自检脚本按现有唯一注释定位巡查区块，校验边界后只从内存夹具剥离，登记七张巡查表和三份既有迁移，补检显式索引与旧记录保留；不改既有断言、schema 或迁移文件。一次性 node --input-type=module 内存探针退出 0：剥离后巡查对象数为 0；基础迁移 → placement → repeat-reminders 重放，7 表列定义和对象清单一致，显式索引只有 egg_patrol_notification_due；换序会额外出现 egg_patrol_one_egg。探针通过不代表 API 自检转绿，也不代表生产库结构已验证。
2. **R4-H03/H04：恢复码策略。** 找回入口可直接复用 POST /api/auth/recover，不需新增列，先交 375/390 预览审核，恢复后引导无用户名的老账号设置用户名密码。改密建议 A：保留当前会话，吊销其它令牌并让该账号旧恢复码失效；也可选 B：只吊销其它令牌、保留旧恢复码，旧码仍能登录。两者都保留无密码老账号的找回路径；仓库不能证明旧客户端不再使用恢复码接口。推荐先通过找回入口验收再启用 A。
3. **正式分支与生产结构。** git ls-remote --heads origin refs/heads/release refs/heads/release/prod-1.5.0 refs/heads/test 只列出 release（88bce8d）和 test。396f9c8 明确将旧分支改名为 release；D:/roco-build/release-prod-1.5.0 只是 release 工作树目录。拟使用现行规范的 release，Cloudflare 目标仍为 main。git diff --name-status origin/release test -- functions/schema.sql functions/migrations 显示三份既有迁移和 schema 差异，不能推定生产未迁移；建议获准后只读核对生产 D1 结构，不查账号记录。若缺结构，另报缺项，绝不自行执行迁移。
4. **R6b-H01：跨号补缺。** de0b394 断开 Coverage 到 StudMatrix 的跨号参数，但交互规范仍有该功能，存量跨号任务仍可见。证据偏向回归，但不能替代产品确认。建议只恢复单账号跨号补缺，不恢复小组资源页或需求中心。
5. **R9-1-H02 / R8a3-H01：采集边界。** 任意尾部切片缺少有效 PCAP 头和记录边界；继续解码还依赖偏移与状态。安卓桥未提供裁剪重写代次，网页不能仅凭长度分辨追加与裁剪后长回原长度。只评估能独立验证且不改 Worker 契约的网页缓解；如需改契约另行确认，不能把缓解算作完整修复。

如生产缺账号结构，现有 2026-11-18-accounts-username-password.sql 含三句 ALTER TABLE accounts ADD COLUMN username TEXT;、ALTER TABLE accounts ADD COLUMN username_lower TEXT;、ALTER TABLE accounts ADD COLUMN password_hash TEXT; 及 CREATE UNIQUE INDEX IF NOT EXISTS idx_accounts_username_lower ON accounts (username_lower) WHERE username_lower IS NOT NULL;。旧账号三列初始为 NULL，保留 recovery_hash、令牌、账号 ID 与关联数据。整份脚本不可重复盲跑。以上均未执行。

## 逐条处置

| 编号 | 状态与下一步 | 本轮验证 |
| --- | --- | --- |
| R2b-H01 | 已修：仅从旧库夹具剥离巡查区块，不改 schema、迁移或既有断言。`0c20305`（前置 HEAD `d00739c`）。 | `npm run test:mother-groups:api` 退出 0，六步通过，见下。 |
| R3a-H01 | 未修；按裁决排除窝内蛋，覆盖「我能提供」和代孵单分配现蛋。 | 未跑现货、代孵回归。 |
| R4-H01 | 未修；严格校验存储串，兼容旧迭代数，登录成功后条件更新防并发覆盖改密；新参数须验证运行预算。 | 未测兼容登录、并发、运行预算。 |
| R4-H02 | 未修；原密码输错走表单校验，真正会话失效才返回 401。 | 未测输错后保留会话。 |
| R4-H03 | 未修；复用接口，新增入口先交预览。 | 静态核实接口存在；未测老账号跨设备找回。 |
| R4-H04 | 未修；现行改密只写哈希，待确认恢复码口径再做原子吊销并防换发竞态。 | 未测双设备及旧恢复码。 |
| R5-H01 | 未修；展示和判定共用首个合法档位，区分旧多档、空数组和缺失。 | 核对三路现有改动；未跑旧数据回归。 |
| R6a-H01 / R6a-M01 | 未修；其它分面保留体型/声音，只忽略计数对象自身；双蛋组计数与列表统一。 | 未测点击前计数与点击后列表。 |
| R6b-H01 | 未修；待确认是否只恢复旧跨号入口。 | 核对提交及交互规范，未跑浏览器。 |
| R7b-H03 | 未修；存储读取失败时默认显示家园窝视图。 | 未测禁用存储；安卓未验证。 |
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

- **未发布。** 无正式构建、bundle、SHA-256、发布时间、通道校验、线上回读或已核实的目标回滚命令。本轮未合并、推送、部署，未打包，未改默认站、版本、清单，未连接生产 D1。
- git diff --quiet origin/release test -- public/android/version.json public/android/version-18.json 退出 0，仅证明 Git 中清单一致。正式发布前记录现网部署 ID、bundle 与两份清单/APK 的字节校验；仅回滚网页及对应 API 行为，清单/APK 不重发，回读比对基线。
- 继续后按问题记录前置 HEAD、拆分既存改动，跑相关测试和 npx tsc -b，不把 lockfile、原型、截图或非授权配置混入修复。所有指定门槛用最终候选实际执行，不用 SUMMARY.md 的历史输出替代。
