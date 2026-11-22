# R9b · 其它网页 UI / API / 共享模块

> 审查范围 `779b08c..894de06`（`test` 分支），**行号一律以 `894de06` 为基准**。
> 工作区中未提交的原型 / 截图 / 报告不属于本次审查内容。
> 验证：`npx vitest run src/ui/Nearby.test.tsx src/ui/ServerAddressPanel.test.tsx src/ui/Profile.test.tsx` → 3 文件 43 条全过；
> `npx tsc --noEmit -p tsconfig.app.json` → 无输出（无类型 / 未使用变量错误，说明删除未留悬空引用）。

---

## R9b-H01 · 高风险 · 正式包里「服务器地址」面板会把正式站写成「测试服（默认）」，兜底默认站还写死了测试站

**① 问题描述**
- 现状：面板的当前/默认两行不读壳返回的通道，而是拿 `defaultUrl` 当「测试服」并硬编码文案；网页侧缺字段时的兜底常量也直接写死测试站。
- 用户影响：正式包用户在「我的」连点版本号 5 次打开面板，看到的是「当前：测试服（默认）https://roco-toolbox.pages.dev / 默认：测试服 https://roco-toolbox.pages.dev / 正式：正式服 https://roco-toolbox.pages.dev」——三行地址同一个、通道标错，用户会以为自己正在内测站上操作。
- 触发条件：正式通道 APK（`build.gradle` 里 `DEFAULT_SERVER_URL` = 正式站、`TEST_SERVER_URL` 为空）→ 我的 → 连点版本号 5 次（快切失败也会自动打开本面板）。
- 证据：`src/ui/ServerAddressPanel.tsx:138-140` 用 `current === defaultUrl` 直接判成「测试服（默认）」、`:165` 把 `defaultUrl` 固定标成「测试服」、`:27-29` 的 `DEFAULT_HINT` 写死 `https://test.roco-toolbox.pages.dev`；壳侧 `android-shell/.../ServerConfig.java:94-101` 的 `defaultUrl()` 返回的是**本通道**默认站、`build.gradle:44-45` 正式通道 `TEST_SERVER_URL` 为空。

**② 优化方案**
把「测试服 / 正式服」的判定改成比较壳返回的 `defaultUrl` 与 `productionUrl`：两者相等即正式通道，当前=默认时显示「正式服（当前）」，不等时才用「测试服（默认）」；兜底常量不作为「默认站」文案来源，壳没给值时显示「未知」而不是测试站。若希望更彻底，可让壳在 `read()` 里多返回一个 `channel` 字段，网页只按它渲染（改动约 20 行，只碰本面板，不涉表结构）。A：只按 URL 比较（零壳改动）；B：加 `channel` 字段（需壳配合发版）。推荐 A，能立刻消掉误标。

**③ 优化后表现**
- 解决：正式包打开面板，三行都按真实通道显示「正式服」，不会再出现「测试服」字样。
- 验收：正式包 → 我的 → 连点版本号 5 次，面板「当前 / 默认」两行都显示「正式服」；`npx vitest run src/ui/ServerAddressPanel.test.tsx` 里补一条 `defaultUrl === productionUrl` 的用例断言不出现「测试服」。

---

## R9b-M01 · 中风险 · 切服面板没有告诉用户「换站就是换一套身份」

**① 问题描述**
- 现状：面板唯一的风险提示是「仅限自用：填错等于把采集数据交给该站点」，只讲了隐私，没讲切站后登录态与本机数据不会跟过去。
- 用户影响：用户按提示切到测试站后，发现「我的身份」空了、教程重弹、看板回到空态，会以为数据丢了。
- 触发条件：连点版本号进入面板 → 输入地址保存（或填入测试站/自建站）。
- 证据：`src/ui/ServerAddressPanel.tsx:148-150` 只有一句隐私提示；`sharedPrefs.ts` 的头注释也承认「测试站与正式站是两个 origin，localStorage 天然隔离」，而它实际只用于教程进度（`src/ui/tour.ts`），登录与导入数据仍按 origin 各存一份。
- 依据：`AGENTS.md`「发版通道与更新：单一来源」——「身份按 origin 存在浏览器本地存储，换站等于换一套身份」。

**② 优化方案**
在同一处提示补一句事实说明：「切换后是另一套登录与本机数据；切回原地址还能看到原来的」。不要新增说明段落，保持一句提示内说完（符合 `AGENTS.md` 交付前自检①）。

**③ 优化后表现**
- 解决：用户在点「保存并重载」前就知道数据不会跟过去，不会误判丢数据。
- 验收：面板风险提示能在同一屏内看到这句；实际操作「正式 → 测试 → 正式」，回到正式站登录态与数据仍在。

---

## R9b-M02 · 中风险 · 机器人连接面板遇到网关错误页时，把 `Unexpected token '<'` 的原始报错甩给用户

**① 问题描述**
- 现状：机器人连接接口的请求函数先 `await response.json()` 再判状态码，没有兜住非 JSON 响应。
- 用户影响：接口被网关/代理拦下返回 HTML 或空 body 时，面板显示浏览器的 JSON 解析原文，用户看不懂也不知道点哪。
- 触发条件：`/api/collection-groups/{id}/egg-bot` 返回 HTML 错误页（5xx / 维护页）或 204 空体。
- 证据：`src/api/eggPatrol.ts:5-12` 的 `request()` 没有 `.catch`；同模块既有写法 `src/api/collectionGroups.ts:111` 是 `await response.text().catch(() => '')` 后再 `try JSON.parse`，失败给可读文案。

**② 优化方案**
照 `collectionGroups.request` 的写法：先取 text，再 try parse，拿不到对象时按状态码给「机器人连接暂不可用，请稍后重试」。改动仅限本文件十余行，不影响接口协议。

**③ 优化后表现**
- 解决：任何异常响应都显示一句可读中文，不再出现 JS/JSON 报错原文。
- 验收：`npx vitest run src/api` 中补一条「返回 HTML 502」用例，断言提示为本文件的中文文案。

---

## R9b-L01 · 低风险 · 新加的页签埋点 hook 没接进 App，旧的重复上报逻辑还在

**① 问题描述**
- 现状：仓库里新写了一个「同页重渲染不重复上报」的 hook，但 App 里仍是旧 effect 直接 `track('tab_view')`，且依赖整个 `navigation` 对象。
- 用户影响：无直接感知；内部统计数据偏高（点「看缺口」这类只改定位、不换页签的操作也会多记一次页签曝光）。
- 触发条件：在收集页点「看缺口 / 看推荐种公」、或任何触发 `consume-focus` 的操作。
- 证据：`src/App.tsx:154-164` 依赖 `[navigation, activeTab, tour]`；`src/ui/useTabViewTracking.ts:11-18` 除自身测试外无引用（全仓检索仅 `useTabViewTracking.test.tsx`）。

**② 优化方案**
二选一：把 App 那段换成 `useTabViewTracking(activeTab, activeTab, tour)`（保留旧页签名兼容），或删掉这个未使用的 hook 并在 App 里把依赖收窄到 `activeTab`。推荐前者，行为与注释一致。

**③ 优化后表现**
- 解决：一次进页只记一条页签曝光。
- 验收：`npx vitest run src/ui/useTabViewTracking.test.tsx`；手动在收集页点「看缺口」，不再新增 `tab_view`。

---

## R9b-L02 · 低风险 · 「我的」页同时出现两个版本号，且两处用同一个页面标识

**① 问题描述**
- 现状：顶栏新加了一个常显版本号，`我的` 页底部原有的版本号（连点切服入口）仍保留，同一页出现两份。
- 用户影响：页面上重复显示同一个版本；用页面标识查元素的自动化测试在「我的」页会一次命中两个。
- 触发条件：任何用户打开「我的」页。
- 证据：`src/App.tsx:227-229` 与 `src/ui/Profile.tsx:207-213` 都是 `data-testid="app-version"` 且文案都是「版本 {__APP_BUILD__}」。

**② 优化方案**
只留一处：把连点切服入口挪到顶栏那个版本号上、删掉页底那份；或保留页底那份但换掉其中一个 `data-testid`。前者更符合「页面常驻文案只留一句事实」（`AGENTS.md` 交付前自检①）。

**③ 优化后表现**
- 解决：「我的」页只看到一处版本号，连点行为不变。
- 验收：打开「我的」页可见版本号数量为 1；`npx vitest run src/ui/Profile.test.tsx` 仍通过（改为定位顶栏那份则同步改测试）。

---

## R9b-L03 · 低风险 · 附近地图超过 40 只时，命中需求的普通精灵可能被截掉、地图上看不到

**① 问题描述**
- 现状：地图点位过多时只保留 40 个，排序注释写「需求/稀有优先」，但打分只用「可提醒 / 稀有」，没有把需求命中算进去。
- 用户影响：野外精灵密集时，地图上可能恰好没有那只「需求中心命中」的普通精灵（列表里还能看到）。
- 触发条件：当前筛选范围内有坐标的精灵超过 40 只，且其中有命中需求但不可提醒、非稀有的精灵。
- 证据：`src/ui/Nearby.tsx:507-513` 的 `score` 只读 `pet.alertReason` / `pet.rare`，需求命中信息在 `hitByKey` 里未参与。

**② 优化方案**
把 `hitByKey` 纳入该 `useMemo` 依赖，`score` 里给「有需求命中」最高权重（可提醒其次、稀有再次），与注释一致；改动约 5 行。

**③ 优化后表现**
- 解决：精灵再多，命中需求的也会被画在地图上。
- 验收：造一份 41 只、其中 1 只需求命中的快照，`nearby-map` 里能点到该只（加一条 `Nearby.test.tsx` 用例）。

---

## R9b-L04 · 低风险 · 地图缩放的「不触发多余重绘」测试名与断言不符

**① 问题描述**
- 现状：测试名声称「返回同一对象」，实际只断言了 `scale`/`tx` 的数值，而 `zoomView` 每次都会返回新对象。
- 用户影响：无用户可见影响；后续维护者按测试名理解，会误以为「无变化时不重绘」已被保证。
- 触发条件：阅读或修改 `zoomView` 时。
- 证据：`src/ui/NearbyMap.test.ts:79-85`（注释自己写了「引用可不同」），`src/ui/NearbyMap.tsx:88-99` 始终 `return { scale, tx, ty }`。

**② 优化方案**
把测试名改成「到达上限后数值不再变化」，或让 `zoomView` 在 `next` 与入参完全相等时返回原对象（后者会让 `zoomAt` 里的 `next !== current` 判断真正生效）。

**③ 优化后表现**
- 解决：测试名与实际保证一致，改动前先能看懂它保护的是什么。
- 验收：`npx vitest run src/ui/NearbyMap.test.ts`。

---

## R9b-L05 · 低风险 · 连点快切时壳抛异常会让切服入口卡死到下次重载

**① 问题描述**
- 现状：连点触发的切换没有 try/finally，异常时「切换中」标志不会被复位。
- 用户影响：这一页后续连点版本号都没反应（既不再切换，也不打开手动面板），只能刷新页面。
- 触发条件：老壳缺方法、JS 桥调用抛错（WebView 侧异常）时。
- 证据：`src/ui/Profile.tsx:74-84` 的 `setTimeout` 回调里没有捕获；`src/ui/ServerAddressPanel.tsx:105-123` 同一动作有 `try/catch/finally`，两处写法不一致。

**② 优化方案**
照面板里的写法补 `try/catch/finally`：失败时复位标志、把原因写进 `serverNotice` 并打开面板（注释里已经承诺「探活失败时打开手动面板兜底」）。

**③ 优化后表现**
- 解决：任何一次异常后仍能继续连点或直接用手动面板。
- 验收：在 `Profile.test.tsx` 里让 `bridge.toggle` 抛错，断言提示出现且面板打开、再点 5 次仍能触发。

---

## R9b-U01 · 不确定 · 「已上窝」还需不需要让发布方看到，代码里两处注释互相矛盾

**① 问题描述**
- 现状：需求接口不再解析 `placedAt`，但共享类型注释仍写着「发布人据此看到已上窝→待我确认」，家园接单页也仍按这句话把勾选同步到服务端；同时服务端入参注释又说「只落库，别人的视图不展示」。
- 用户影响：无确定行为——勾「已上窝」仍然本机生效并写服务端，但网页上已没有任何界面读这个字段。
- 触发条件：家园「接单上窝」勾选「已上窝」。
- 证据：`src/api/collectionGroups.ts:550-566`（不再解析 `placedAt`）、`src/shared/collectionGroups.ts:360-364`（仍声明并被注释引用）、`src/ui/HomeDemandPlacements.tsx:326-329`（仍声称发布方据此到第 4 步）、`src/api/collectionGroups.ts:772`（「只落库，别人的视图不展示」）。新流程的上窝进度已由换蛋任务的 `trade.placed` 在任务面板展示。
- 置信度：中。**需要用户/产品确认**：旧需求中心的「已上窝 → 待我确认」是否仍需展示。

**② 优化方案**
若确认不需要：删掉 `CollectionDemand.placedAt`、`markCollectionDemandPlaced` 与家园页那一次服务端同步，注释一起改；若仍需要：把 `placedAt` 解析加回来并在发布方界面展示。A：下线旧字段（更干净，改动约 30 行，需确认没有外部客户端依赖 `/placement` 接口）；B：恢复解析并补界面（需 UI 改动，走「新增 UI 先审核」流程）。建议先确认再做。

**③ 优化后表现**
- 解决：不再有「写了没人读」的字段与互相矛盾的注释。
- 验收：确认后按选定方案落地，`npx vitest run src/ui/HomeDemandPlacements.test.tsx src/ui/useClaimedDemands.test.tsx` 通过。

---

## 统计

| 等级 | 数量 | 编号 |
| --- | --- | --- |
| 高 | 1 | H01 |
| 中 | 2 | M01、M02 |
| 低 | 5 | L01、L02、L03、L04、L05 |
| 不确定 | 1 | U01 |
| 合计 | 9 | |

## 最该先修的 1~3 条

1. **R9b-H01**（高）：正式包用户打开切服面板会看到「当前：测试服（默认）」而地址是正式站——通道标错 + 兜底默认站写死测试站，按 `AGENTS.md` 的「换站等于换身份」口径必须先改，否则正式用户会误判自己在内测环境。
2. **R9b-M01**（中）：同一次改动里，面板根本没告诉用户换站要重新登录、数据不跟过去；和 H01 一起改文案成本最低。
3. **R9b-M02**（中）：机器人连接面板在网关错误页会把 JSON 解析原文甩给用户，改法是照同模块既有 `request` 写法，几行即可。

## 范围外备注（只记录不展开）

- **桌面小窗「隐藏小窗」会被下一帧推送自动重开**：`src/ui/Nearby.tsx:539-543` 与 `:611-630`。`overlayShown` 在本区间未被改动（`git log 779b08c..894de06 -S overlayShown -- src/ui/Nearby.tsx` 为空），属既有问题。
- **`NearbyMap` 自身坐标兜底取「第一只有坐标的精灵」而非注释说的「离地图中心最近」**：`src/ui/NearbyMap.tsx:110-119`，本区间只是把这段移动位置，逻辑未变。
- **Functions 侧仍保留 `'plans'` 分支与收集计划表/触发器**：`functions/_lib/collectionGroups.ts:132`（有意让旧客户端 POST /plans 得到 409 升级提示）、`functions/schema.sql:252-300 / 446-505`。归 R2b 判断。
- **`GroupPlanHub.tsx` 变成 `EggMatchingHub` 的薄包装，但 props 仍 `extends MotherGroupResourcesProps`，绝大部分入参被静默忽略**：`src/ui/plan/GroupPlanHub.tsx:1-6`，归 R3b。
- **`DemandCriteriaDraft.requireGreenNest` 仍保留在类型里，但发需求面板从不返回它**：非本区间引入（`DemandPublishSheet` 删掉的是「添加想收」模式，与本字段无关）。
- **`Nearby.test.tsx` 运行时有多条 `act(...)` 警告**（`src/ui/Nearby.tsx:228` 附近）：测试卫生问题，不影响断言结果。
- **删除面核对结论**：`collectionPlans` 前端 API / `analytics` 事件常量 / `DemandPublishSheet` 的「添加想收」模式 / `shared/collectionPlans.ts` 的调用方均已清空（全仓检索无引用，`tsc --noEmit` 无未使用告警）；仅剩上面那条 `'plans'` 服务端分支是有意保留。
