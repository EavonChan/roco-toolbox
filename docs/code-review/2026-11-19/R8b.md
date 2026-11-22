# R8b · Android 壳 · 更新、切服与主 Activity

> 基线 `894de06`，范围 `779b08c..894de06`（test 分支）。**行号一律以 `894de06` 为基准。**
> 本批为只读审查：未修改任何代码，未做任何 git 写操作，未打包、未改清单 / version.json。
> 工作区里未提交的 `docs/设计资产/registry.json` 等原型产物不属于本次审查范围。

## 已实际执行的验证（真实输出）

| 命令 | 结果 |
|---|---|
| `cd android-shell; ./gradlew :app:verifyShellInvariants`（默认参数=正式通道） | **FAILED**：`壳不变量校验失败：- versionCode 与清单不一致：build.gradle=42，清单=40` |
| `cd android-shell; ./gradlew :app:compileReleaseJavaWithJavac -PtestOnlyBuild=true` | BUILD SUCCESSFUL，并打印 `[通道校验] channel=production appId=com.localdatatool.toolbox version=1.5.6(42) default=https://roco-toolbox.pages.dev` |
| `cd android-shell; ./gradlew :app:testDebugUnitTest -PtestOnlyBuild=true` | 9 个测试类**全部** `initializationError / ClassNotFoundException`（本机测试 classpath 异常，未拿到任何断言结果，见「范围外备注」） |

对照数据：`public/android/version.json` 与 `public/android/version-18.json` 均为 `versionName=1.5.6 / versionCode=40`；`android-shell/app/build.gradle` 为 `versionName=1.5.6 / versionCode=42`。

---

## R8b-H01 · 高风险 · 现在按正式参数打不出正式包，控制台第一屏就报「versionCode 与清单不一致」

① **问题描述**：**现状** 壳把版本号抬到 42（`build.gradle:36-37`），但主站两份更新清单仍是 40；构建前置的壳不变量校验只放行「versionCode 与清单完全相等」的构建（`build.gradle:123-128`），正式通道一启动就被拦。**用户影响** 本轮无法产出正式 APK，发版流程卡死；更危险的是按报错「把清单改成 42」这条最省事的路走——固定名包 `roco-toolbox-latest.apk` 仍是 40，所有正式用户会被提示更新到一个并不存在的 42 版，形成「提示更新 → 装完还是旧版 → 再提示」的循环。**触发条件** 不传任何 `-P` 参数执行 `./gradlew :app:compileReleaseJavaWithJavac`（实测输出见上表；依据：`docs/发版与更新规范.md` §2「正式通道」第 4 条、§4「转正流程」第 3~4 步）。

② **优化方案**：把「内测迭代号」和「正式版本号」拆开——正式通道的 `versionCode` 保持在对外清单的号（或下一次真正要发布的号），内测迭代用内测通道自己的版本号；等正式包真正上传、两份清单一起改时，再让 `build.gradle` 与清单对齐。**不要**用「改清单去对齐 42」的方式消警，那会把内测号泄漏到正式线。代价：一处 Gradle 配置 + 一次版本号口径确认（不涉及表结构，改动小于 30 行）。

③ **优化后表现**：**解决** 正式包重新能一条命令打出来，且不会再出现全员空更新循环。**验收** `cd android-shell; ./gradlew :app:compileReleaseJavaWithJavac` 通过并打印 `[通道校验] channel=production version=…`；同时 `git diff public/android/version*.json` 为空。

---

## R8b-H02 · 高风险 · 唯一能过闸的 `-PtestOnlyBuild=true` 会造出一个「正式包名 + 更高版本号」的包，发出去就收不回来

① **问题描述**：**现状** 为绕过 H01 只能加 `-PtestOnlyBuild=true`；该分支只要求 versionCode **大于**对外清单（`build.gradle:117-121`），于是产出 `channel=production`、`applicationId=com.localdatatool.toolbox`、versionCode 42 的正式通道包（实测日志已确认）。**用户影响** 这份包一旦被当成「测试包」发给用户，用户装的是与正式包同包名、更高版本号的包：之后官方 40 版无法覆盖安装（系统拒绝降级），而正式清单仍是 40，客户端认为「已是最新」，用户被永久留在无人维护的包上，必须把正式版本号抬到 43 才能救。**触发条件** `./gradlew assembleRelease -PtestOnlyBuild=true`（依据：`docs/发版与更新规范.md` §1「一个包只属于一个通道，不允许一个包装两个身份」、§2「内测通道」第 4 条——原文写的是 `testOnlyBuild` **只跳过 versionName 一项**，代码把它放宽成了 versionCode 也豁免；以及 AGENTS.md「先问再做：四类动作的硬门槛」）。

② **优化方案**：A) 把豁免收回到规范原文——`testOnlyBuild` 只跳过 versionName，versionCode 仍必须与对外清单相等；B) 若确实需要更高 versionCode 的单人验证包，强制要求同时传 `-PtestBuild=true`（内测 applicationId），并在 Gradle 里直接断言「testOnlyBuild 且非 testBuild → fail」。推荐 A+B 一起做，改动集中在一个闭包（约 10 行），不影响现有内测流程。

③ **优化后表现**：**解决** 任何「测试包」都不可能再与正式包同包名、同时带更高版本号。**验收** `./gradlew assembleRelease -PtestOnlyBuild=true` 直接失败并给出中文原因；`./gradlew assembleRelease -PtestBuild=true -PtestOnlyBuild=true` 打印 `channel=internal`。

---

## R8b-H03 · 高风险 · 正式包用户连点版本号 5 次就能打开「服务器地址」并切到别的站点，界面随即变成另一套账号

① **问题描述**：**现状** 主 Activity 对两个通道都注入了切服桥 `RocoServer`（`MainActivity.java:144/253`，无任何 `BuildConfig.CHANNEL` 判断），网页侧因此只按「有没有桥」进入切服流程（`src/ui/Profile.tsx:63-65`）；正式包里这次切换必然失败，然后**顺手弹出「服务器地址」面板**，面板还把正式站标成「测试服（默认）」（`src/ui/ServerAddressPanel.tsx:138-140` 把 `current == defaultUrl` 一律显示为测试服）。**用户影响** 正式用户被自己（或被口头指导）切到一个不同的 origin，而登录态、小组、教程进度都按 origin 存在浏览器本地存储——切换后账号、小组全变成空的（服务端数据还在，只是这个 origin 看不到）；若在输入框填一个自定义 https 站点，WebView 会把采集/分享/偏好全部 JS 桥交给该站点。**触发条件** 正式包打开「我的」→ 连点底部版本 5 次 → 在面板里点「恢复默认 / 保存并重载」或填入别的地址（依据：`docs/发版与更新规范.md` §0 四条硬约束第 2 条「**正式包不可改站点**：不提供切服入口、不提供改地址面板，默认站只认正式站」，以及 §0 铁律「换站等于换一套身份」）。

② **优化方案**：切服桥按通道收口——正式通道不注入 `RocoServer`，或注入一个只读实现（`read()` 只返回正式站，`apply/reset/toggle` 恒返回失败），这样网页侧入口天然不出现，与 `Profile.tsx:57` 现有注释的假设一致。同时 `destroyPageWebView` / 渲染进程回收重建时的注入列表要同步改。代价：约 20 行，属「改版界面」范畴的部分需先给用户看效果再落代码。

③ **优化后表现**：**解决** 正式用户再也点不出服务器地址面板，账号只可能停在正式站。**验收** 正式包打开「我的」连点版本 5 次无任何反应；用 chrome://inspect 确认 `window.RocoServer === undefined`，且网页侧 `serverBridge()` 返回 undefined。

---

## R8b-M01 · 中风险 · 单测把「默认站=测试站」写死，正式通道跑单测必红，而最省事的修法正是文档禁止的方向

① **问题描述**：**现状** `ServerConfigTest.java:18-22` 断言 `ServerConfig.DEFAULT_BASE_URL` 等于测试站，而该常量来自 `BuildConfig.DEFAULT_SERVER_URL`，在正式通道下是正式站（`build.gradle:44`）。**用户影响** 本身不改用户行为，但它把「默认站应该是测试站」固化成验收标准：正式通道一跑单测就红，后来者要么长期忽略这条红，要么为了让测试变绿把默认站改回测试站——那正是会让全体正式用户身份丢失的操作。**触发条件** 不传 `-PtestBuild` 执行 `./gradlew :app:testDebugUnitTest`（本机测试环境不可用，结论为静态对照 `build.gradle:44` 与 `ServerConfigTest.java:20`；依据：`docs/发版与更新规范.md` §1 表格「正式通道 包默认站 = 正式站」）。

② **优化方案**：把断言改成「等于 `BuildConfig.DEFAULT_SERVER_URL`，且该值随通道在正式站/测试站之间取值」，或直接断言 `ServerConfig.PRODUCTION_BASE_URL` 固定为正式站；「默认站等于测试站」只保留在内测通道分支。网页侧 `DEFAULT_HINT = 'https://test.roco-toolbox.pages.dev'` 的兜底文案同理（属 R9b）。

③ **优化后表现**：**解决** 正式通道跑单测不再红，也不会有人为修绿去改默认站。**验收** `./gradlew :app:testDebugUnitTest` 在 `-PtestBuild=true` 与不传参数两种配置下 `ServerConfigTest` 均通过。

---

## R8b-M02 · 中风险 · 更新清单没校验「最低可用版本不能高于清单版本」，一份手误的清单能把所有旧客户端永久锁在更新页

① **问题描述**：**现状** `UpdateManager.check`（`UpdateManager.java:110-128`）只比较「清单是否更新」和「当前版本是否低于 minSupportedVersionCode」，没有断言 `minSupportedVersionCode ≤ versionCode`；一旦清单写成 `minSupportedVersionCode=50 / versionCode=42`，所有 42 以下的客户端都会进入不可取消的全屏强更页（`UpdateController.java:223-291` 没有任何跳过入口），而「要求版本」一栏写的是它们永远达不到的号。**用户影响** 整批用户打开就是更新页，点「下载安装」装完仍被要求更新，应用不可用，只能卸载（等于丢本地身份）。**触发条件** 有人手工编辑 `public/android/version.json` / `version-18.json` 时把门槛写高（当前两份都是 0，属潜在风险；依据：`docs/发版与更新规范.md` §3 只写了「当前 versionCode < 门槛才强制」，未定义清单自身版本与门槛的关系，属口径缺口）。

② **优化方案**：在 `UpdateManifest.parse` 或 `UpdateManager.check` 加一条防御——`minSupportedVersionCode > versionCode` 时视为清单不可信（走 `onCheckFailed` 或把门槛降为 0），并在部署脚本里加同名校验（`deploy-web.mjs` 属 R9c）。代价：一个判断 + 一条单测，不影响现有清单。改动属防御性口径，最终取值建议由发版负责人确认。

③ **优化后表现**：**解决** 清单写错只表现为「这次不提示更新」，不会再把整批用户锁死。**验收** 单测里给 `manifest(42, 50)` 断言不进入 required 分支。

---

## R8b-L01 · 低风险 · 下载完的安装包只核对包名，签名或内容对不上时用户只看到系统一句「应用未安装」

① **问题描述**：**现状** `UpdateController.isValidApk`（`UpdateController.java:425-434`）只比对 `packageName`，真正拦住错签名的是系统安装器，用户在失败后拿不到中文原因。**用户影响** 下载域名被中间层替换、或固定名 APK 传错版本时，安装被系统拒绝，用户只能反复重试。**触发条件** 下载到的包与本地已装同名不同签名，或文件不完整。

② **优化方案**：下完先按清单里新增的可选 `sha256`（或「包名 + 文件大小 + 签名摘要」）做一次本地校验，失败时直接提示「安装包校验失败，请重试」，不要先调起安装器。此条引不出白名单规范，计为建议。

③ **优化后表现**：**解决** 坏包在调起安装器前就被识别并给出可读原因。**验收** 手工改坏缓存目录里的 APK 字节后再点安装，弹「安装包校验失败」而不是系统级「应用未安装」。

---

## R8b-L02 · 低风险 · 每切一次服务器就多叠加一份采集桥脚本

① **问题描述**：**现状** `reloadWithServer`（`MainActivity.java:838-849`）只移除 WebMessageListener，没有移除 document-start 脚本；切服时 `installCaptureWebMessageBridge` 又注入一份（`:438`），来回切多次后每个页面会执行多份 `capture-bridge.js`。**用户影响** 目前脚本是覆盖赋值，没有功能错误，只是每次切服多一点重复执行与内存占用。**触发条件** 反复连点切服。

② **优化方案**：保存 `addDocumentStartJavaScript` 返回的 ScriptHandler，切服与销毁时 `remove`；或只在 origin 变化时重建桥。

③ **优化后表现**：**解决** 切服不再累积脚本。**验收** 连切 5 次后用 chrome://inspect 检查注入脚本与 listener 数量不变。

---

## R8b-L03 · 低风险 · 后台心跳即使没有采集也每 1.2 秒唤醒一次主线程

① **问题描述**：**现状** `liveTickTask`（`MainActivity.java:155-167`）无条件 `postDelayed` 自己；不采集时每 1200ms 醒来一次什么都不做，前台也一样。**用户影响** 常驻小幅耗电，长时间挂后台的用户能感觉到。**触发条件** 应用常驻。

② **优化方案**：`busy=false` 且页面可见时停掉心跳（前台由网页自己的定时器负责），`onPause` 或采集开始时再恢复；或把空闲间隔放宽到 3~5 秒。

③ **优化后表现**：**解决** 不采集时不再有周期性唤醒。**验收** `adb shell dumpsys batterystats <包名>` 对比改动前后 wakeup 次数下降。

---

## R8b-U01 · 不确定 · 身份救援把测试站的令牌原样写进正式站，前提是两站共用同一个库

① **问题描述**：**现状** `IdentityRescue.writeIdentity`（`IdentityRescue.java:142-163`）把测试站 origin 的 `roco.deviceToken / roco.accountId / roco.syncVersion` 直接写进正式站 origin，写之前不在服务端确认一次令牌有效性。**用户影响（前提不成立时）** 用户打开就是「已登录」，但所有同步 / 小组接口 401，比空的未登录状态更难自查，且 `KEY_DONE` 已置位，不会再救第二次。**触发条件** 测试站与正式站改用不同 D1（当前 `wrangler.toml` 只有一份 `roco-toolbox-db` 绑定，test 分支部署默认复用同一库，所以现状大概率成立）。**置信度** 中。**需要确认** 后端 / 运维：两站是否长期共用同一 D1。

② **优化方案**：救援前用该令牌打一次正式站只读接口确认有效，不通就不写、也不置 `KEY_DONE`；或在 `docs/发版与更新规范.md` 把「两站共用 D1」写成硬前提，改库即触发救援逻辑复核。

③ **优化后表现**：**解决** 不会再把无效身份写进正式站。**验收** 造一份已失效的测试站令牌后首启，正式站保持未登录，且下次启动还会再试。

---

## R8b-U02 · 不确定 · 身份救援拿一个 `.json` 当探针页，WebView 可能把它当下载而不触发页面完成回调

① **问题描述**：**现状** `IdentityRescue` 用 `/android/version.json`（Content-Type: application/json）作为同源探针（`IdentityRescue.java:40/89/118/132`），整条流程靠 `onPageFinished` 驱动。Android WebView 对顶层 `application/json` 导航的默认处理（渲染成文本 / 触发下载 / 都不触发）随内核版本不同，而壳没有设置 `DownloadListener`。**用户影响（若不触发回调）** 救援永远走 2.5 秒超时：旧身份搬不过来，且每次首启都多等 2.5 秒（`KEY_DONE` 不置位，所以每次都重试）。**触发条件** 从 1.3.8~1.5.2 的公开包升级上来、正式站还没有身份的老用户。**置信度** 中。**需要确认** Android 壳负责人做一次真机验证：1.5.3（测试站有身份）升级到 1.5.6 后首启是否自动带出原账号。

② **优化方案**：换成一定会渲染的 HTML 探针（站点 404 页，或专门放一个 1 字节的 `rescue.html`），或改用 `onPageCommitVisible` / 在 `shouldInterceptRequest` 判定页面可执行后再 `evaluateJavascript`。

③ **优化后表现**：**解决** 救援不再依赖内核默认行为。**验收** 真机按上述升级路径复现：首启自动带出原账号，日志里没有 2.5 秒超时。

---

## 统计

| 等级 | 数量 | 编号 |
|---|---|---|
| 高 | 3 | H01、H02、H03 |
| 中 | 2 | M01、M02 |
| 低 | 3 | L01、L02、L03 |
| 不确定 | 2 | U01、U02 |
| **合计** | **10** | |

## 最该先修的 1~3 条

1. **R8b-H01**：正式通道现在根本打不出包，而按报错改清单会让全体正式用户陷入「提示更新 → 装完还是旧版」的空更新循环。
2. **R8b-H02**：唯一能过闸的 `-PtestOnlyBuild=true` 造出「正式包名 + 更高版本号」的包，一旦发出去用户无法回退、也收不到后续更新。
3. **R8b-H03**：正式包连点版本号就能打开服务器地址面板并切站，切换后账号与小组全部「消失」，直接违背「正式包不可改站点」的硬约束。

## 范围外备注（只记录，不展开）

- `src/ui/ServerAddressPanel.tsx` 把正式站显示成「测试服（默认）」、`DEFAULT_HINT` 兜底写死测试站——归 R9b；本批只记录「壳在正式通道也注入了 `RocoServer`」这一根因。
- 网页侧更新入口（`src/collector/appUpdate.ts`、`Profile.tsx` 更新按钮）归 R9a / R9b。
- `deploy-web.mjs` 对两份清单的一致性校验归 R9c（本批 M02 建议在那里补门槛校验）。
- `res/values/strings.xml` 的 `app_name` 与 `manifestPlaceholders.appLabel` 双来源：内测包的确认对话框仍显示「小布助手」而非「小布助手·内测」，仅记录。
- 本机 `:app:testDebugUnitTest` 时 9 个测试类全部 `initializationError / ClassNotFoundException`（与本批代码无关，疑似本机 Gradle 测试 classpath / 构建缓存问题），因此没有任何 JUnit 断言被执行；`compileReleaseJavaWithJavac`、`verifyShellInvariants` 已按上表真实执行。
- 未执行：打包 APK、改动 / 部署任何清单、`latest.apk`、`version.json`、Playwright。
