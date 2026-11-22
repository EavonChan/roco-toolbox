# R8a · Android 壳 · 采集与附近悬浮（Java）

- **审查基线**：`894de06`（`779b08c..894de06`，`test` 分支）；**行号一律以 `894de06` 为准**。
- **工作区一致性**：`git diff 894de06..HEAD -- android-shell` 与 `git status -- android-shell` 均为空，磁盘内容即基线内容；`../../../%E5%8E%9F%E5%9E%8B/%E5%8E%86%E5%8F%B2/preview/`、`2026-11-xx/` 原型目录不在范围内。
- **编译校验**：未执行。`android-shell/gradlew.bat compileReleaseJavaWithJavac` 因 `JAVA_HOME` 指向不存在的 `D:\software\jdk\Java\jdk1.8.0_321` 直接失败（`java -version` 也不可用），本报告全部为静态审查结论。
- **本次覆盖**：`capture/{NearbyPanelController, NearbyOverlayModel, BattleOverlayController, OverlayGeometry, CaptureController, CaptureState, CaptureBridgePolicy, CaptureVpnService}`、`assets/{capture-bridge.js, overlay-map.html, maps/maps.json}`、`MainActivity` 的桥接与生命周期、壳单测。

---

## R8a-H01 · 高风险 · 反复开关附近面板后，手机内存一路涨、地图每次都先空白一下再出现

**① 问题描述**
现状：每次点球展开面板都会**新建一个地图网页视图（WebView）**，收起面板只把窗口摘掉、不销毁这个网页视图，代码注释声称「保留已加载的网页小地图，下次展开直接复用」，实际从未复用（`android-shell/app/src/main/java/com/localdatatool/toolbox/capture/NearbyPanelController.java:376-413` 不调用销毁，`:415-437/:539-549` 每次 `addPanel → buildMapBox → createMapView` 都 `new WebView`，整个类里唯一的销毁点是 `:381-386 release()`）。
用户影响：打一场开一次面板，几十次之后被丢掉的网页视图持续累积（每个都持有 Activity 引用与一份网页渲染资源），低端机表现为悬浮层变卡、偶发被系统杀进程；同时因为不是复用，展开瞬间地图要重新加载 `overlay-map.html`，会出现约百毫秒的空白/闪一下（早期 `mapReady` 还是旧的 `true`，首帧推送会被静默丢弃，`:102/:601/:628` 与 `:551-616`）。
触发条件：任何一次「点球展开 → 收起 → 再展开」，真机游戏进行中即可复现。

**② 优化方案**
把「收起」改成两件事分离：收起只摘窗口，但让地图网页视图留在字段里、下次展开直接挂回原实例；只有在 Activity 销毁、或这个网页视图的渲染进程被回收时，才走完整销毁并重建。若不想引入复用分支（成本更小、行为更简单），另一个方案是每次收起就老老实实销毁、展开时重新加载，并显式重置「就绪」标记，避免首帧推送打到还没加载完的页面。推荐 A（复用）：改动集中在控制器内约 40 行，风险是需额外处理窗口重新挂载时的尺寸变化；B 方案改动更小但保留闪白。

**③ 优化后表现**
解决：反复开关面板不再累积网页视图，内存曲线持平；展开时地图沿用上一帧，不再空白。
验收：真机采集状态下连续开关面板 20 次，`adb shell dumpsys meminfo <包名>` 的 Java Heap / Native Heap 不呈单调上涨，且每次展开地图立即可见。

---

## R8a-M01 · 中风险 · 玩家走动时附近面板每秒重排最多 4 次，整份地图数据反复重灌

**① 问题描述**
现状：网页侧按 250ms 节流推附近数据，控制器每来一帧就完整跑一遍渲染：重设面板背景与命中区背景、逐个重排标题/地图/列表/脚注的帧位置、`updateViewLayout`，再把整份地图点 JSON 通过 `evaluateJavascript` 注进地图页；只有列表做了「内容签名不变就跳过」的处理（`NearbyPanelController.java:664-764`，背景 `:686-687`、签名跳过只在列表 `:741-748`、地图注入 `:756`、`placePanel→safeUpdate :283-313/:1097-1104`）。
用户影响：面板展开时，游戏画面上多出一层每秒最多 4 次的全量重排与跨线程 JS 解析，低端机表现为面板文字/列表轻微掉帧、机器发烫；地图页还会对每个精灵点重写 `className/left/top/innerHTML`，与注释里「刷新只改 transform、不重建 DOM」的目标不一致（`android-shell/app/src/main/assets/overlay-map.html:263-293`，`:328-360`）。
触发条件：采集进行中、面板展开、附近精灵在移动（payload 每秒 1~4 次变化）。

**② 优化方案**
把列表已有的「内容签名」思路推广到整个渲染：为面板整体算一个签名（含行数、命中区文案、地图点集合、显隐与尺寸），签名不变就只做必要的 `updateViewLayout`，不再重设背景与帧位置；地图推送继续用「自身坐标变化 >1 或点位集合变化」才注入，注入内容也改成增量或只在场景/点位变化时全量。地图页侧把 `innerHTML` 写入改成只在跳档位时更新一次，其余帧只改几何样式。代价是约 60~80 行改动，需要确认面板高度缓存的正确性。

**③ 优化后表现**
解决：面板内容没变时零重排，地图注入次数从每秒 4 次降到「坐标真正变化时」，游戏上层不再持续重绘。
验收：真机 `adb logcat -s RocoPerf` 里面板展开静止时 `render` 计数与 `mapPush` 计数不再随 `payload` 同比例增长；走动时面板文字不再抖动。

---

## R8a-M02 · 中风险 · 悬浮窗权限被收回或加窗失败时，点球什么都没发生、也没有任何提示

**① 问题描述**
现状：`addPanel()` 的 `windowManager.addView` 失败时只是把字段回滚并 `expanded=false`，不记录原因也不回报网页，`toggle()` 因此静默结束（`NearbyPanelController.java:459-466`、`:229-240`）；而同一模块的战斗悬浮窗走的是明确语义——没有权限就回 `need-permission` 让页面给授权入口（`BattleOverlayController.java:212-227`，源自 `:203-205` 的 `canDraw()`）。
用户影响：权限被系统收回 / 加窗抛异常（BadToken、SecurityException、个别 OEM 的窗口限制）时，用户点球完全没反应，页面也不会出现「去授权」按钮，只会以为悬浮窗坏了。
触发条件：采集进行中，用户在系统设置里关掉「显示在其他应用上层」后返回游戏，再点球展开（或 OEM 拒绝往非 Activity 窗口加子窗口时）。

**② 优化方案**
让展开路径与战斗路径统一：`addPanel` 失败时把「需要授权 / 加窗失败」的原因带回 `toggle()`，由 `BattleOverlayController` 像 `update()` 一样返回 `need-permission`（或专门的失败码），网页侧沿用现有的去授权按钮；同时把失败原因写进 RocoPerf 日志便于真机排查。改动约 20 行，不改协议，旧网页收到未知结果时按现有「非 unsupported 即成功」处理，无兼容风险。

**③ 优化后表现**
解决：权限异常时用户能看到「开启显示在其他应用上层」的入口，而不是点了没反应。
验收：真机采集状态下关掉悬浮窗权限，回到游戏点球，页面出现授权提示（对应 `BattleHudOrb` 的 `battle-overlay-permission` 按钮）。

---

## R8a-L01 · 低风险 · 三个公开方法在生产代码里没有任何调用方

**① 问题描述**
现状：`orbCountText()`、`parseMapScenes()`、`metaTextLine1()` 只有单测在用，主代码零调用（`NearbyOverlayModel.java:231-233`、`:276-294`、`:385-390`）。用户影响：无直接现象，但会误导后续维护者以为「场景是否在 maps.json」仍影响地图显隐（实际已在 `NearbyPanelController.java:959-967` 改成只看自身坐标）。触发条件：无。

**② 优化方案**
保留 `metaTextLine1` 的兼容注释可以接受，但 `orbCountText`、`parseMapScenes` 建议连同对应断言一起删掉，或标注 `@Deprecated` 并注明「仅为旧口径兼容，生产不再使用」，避免下次改地图显隐时被这两处带偏。

**③ 优化后表现**
解决：不再有「看起来在用、其实没用」的口径入口。
验收：全局检索这三个名字，只出现在测试或带 `@Deprecated` 的声明处。

---

## R8a-L02 · 低风险 · 脚注位置写死 20dp，与规格常量重复

**① 问题描述**
现状：底注定位用 `panelHeight - 20`，而 20 正是 `NearbyOverlayModel.FOOT_ROW_GAP`（`NearbyPanelController.java:753-754` 对 `NearbyOverlayModel.java:51`）。用户影响：以后调底注留白时，面板总高会跟着常量变、底注却不动，出现文字压边或被裁。触发条件：改 `FOOT_ROW_GAP` / `FOOT_GAP` 时必然触发。

**② 优化方案**
把 20 换成 `NearbyOverlayModel.FOOT_ROW_GAP`，与同文件其他尺寸（`HIT_HEIGHT`、`MAP_SIZE`、`ROW_HEIGHT`）保持一致引用。

**③ 优化后表现**
解决：底注与面板高度永远同步。
验收：改常量后重新展开面板，底注仍在卡片底边留白内。

---

## R8a-L03 · 低风险 · 注释承诺「下次展开复用地图」，实现却是每次重建

**① 问题描述**
现状：`remove()`/`collapse()` 的注释写着「保留已加载的网页小地图，下次展开直接复用」（`NearbyPanelController.java:373-378`、`:388-413`），但 `addPanel()` 每次都重新 `buildMapBox()` 并新建 WebView（`:415-437`）。用户影响：与 H01 同源，注释会让人误以为资源已受控，从而不做释放。触发条件：读代码/改代码时。

**② 优化方案**
按 H01 选定的方案二选一后同步改注释：选复用的，把 `buildMapBox` 改成「已存在就挂回」；选销毁重建的，把注释改成「每次展开重新加载」。

**③ 优化后表现**
解决：注释与行为一致，不再掩盖资源问题。
验收：通读 `remove/collapse/addPanel` 三处注释，与实现逐一对应。

---

## R8a-L04 · 低风险 · Activity 启动时在主线程读 `maps.json`

**① 问题描述**
现状：控制器构造里同步读 assets 标定表（`NearbyPanelController.java:183-184`、`:1200-1210`），而构造发生在 `MainActivity.onCreate`（`BattleOverlayController.java:163`）。用户影响：文件很小，正常无感；但严格模式下属于主线程 IO，后续标定表变大会拖慢冷启动。触发条件：冷启动 / 每次进程重启。

**② 优化方案**
改为首次展开面板时在后台线程读取并缓存（或直接复用网页侧同一份 `maps.json` 注入），失败仍退回雷达。

**③ 优化后表现**
解决：冷启动不再在 UI 线程做文件读取。
验收：StrictMode 打开后冷启动无 `DiskReadViolation`，面板首次展开仍能显示底图。

---

## R8a-L05 · 低风险 · 新建地图网页视图时「就绪」标记仍是上一份的

**① 问题描述**
现状：`createMapView()` 新建实例后没有把 `mapReady` 置回 false，只有「渲染进程回收」和「完全销毁」两条路径会重置（`NearbyPanelController.java:551-616` 对比 `:628`、`:642`）。用户影响：展开瞬间会向还没加载完的页面注一次地图数据，静默丢失，靠 `onPageFinished` 再补一次，表现为首帧地图慢半拍。触发条件：收起后再次展开。

**② 优化方案**
把 `mapReady = false` 放进 `createMapView()` 新建实例处（与销毁处成对），让「就绪」只描述当前这个视图。

**③ 优化后表现**
解决：就绪状态与视图实例严格对应，不再有「假就绪」。
验收：展开面板时在 RocoPerf 里不再出现「推送成功但地图未更新」的计数。

---

## R8a-L06 · 低风险 · 切换服务器后采集桥脚本被重复注入

**① 问题描述**
现状：`reloadWithServer()` 每次切服都调 `installCaptureWebMessageBridge()`，后者无条件再 `addDocumentStartJavaScript` 一份脚本（`MainActivity.java:838-849`、`:394-440`），旧 origin 的注入不会撤销。用户影响：切几次服后同一页面里有几份 `capture-bridge.js`，功能上被后者覆盖，但脚本体积/执行次数随切换次数增加，旧站白名单也残留在页面里。触发条件：正式 ⇄ 测试来回切换。

**② 优化方案**
记录「为哪个 origin 注入过」，只在 origin 变化时重新注入（或用可替换的单例脚本，内部读当前 origin）。

**③ 优化后表现**
解决：切服不再叠加脚本，页面里只有一份桥。
验收：切服两次后在页面控制台执行 `Object.keys(window.RocoCapture)` 与脚本计数不变。

---

## R8a-L07 · 低风险 · 「收起附近面板」也回 need-permission

**① 问题描述**
现状：权限缺失时 `updateNearby` 不看 payload 是「显示」还是「收起」，一律返回 `need-permission`（`BattleOverlayController.java:233-238`）。用户影响：当前网页侧忽略该返回值，暂无可见影响；但协议上「收起」被当成失败，后续若网页拿它驱动授权提示，会在采集停止时误弹授权。触发条件：无权限 + 推来 `visible=false`。

**② 优化方案**
按 `nearbyPanel.nearbyVisible()` 或 `payload.visible` 区分：收起一律回 `ok`，只有需要显示时才回 `need-permission`，与 `update()` 的分支保持一致（`:212-227`）。

**③ 优化后表现**
解决：错误码只表达「需要授权」，不再表达「没成功」。
验收：无权限时停止采集，桥返回 `ok` 而非 `need-permission`。

---

## R8a-L08 · 低风险 · 标定表读不到时地图区是深色空块，没有雷达也没有提示

**① 问题描述**
现状：`hasMap()` 只看「网页视图存在 + 自身坐标存在」，不关心地图页是否初始化成功（`NearbyPanelController.java:959-967`）；而 `init(catalogJson)` 只在 `catalogJson != null` 时执行（`:600-609`），地图页在 `catalog` 为空时直接 `teardown()`（`overlay-map.html:328-336`）。用户影响：`assets/maps/maps.json` 缺失/损坏时，地图区显示为一块深色矩形，既没有雷达兜底也没有「无标定」提示，用户会以为是数据坏了。触发条件：打包漏文件或 asset 读取异常。

**② 优化方案**
把 `hasMap` 与「地图页是否就绪/是否已注入目录」关联；未就绪时让地图页画雷达并显示「未找到地图标定」，或干脆收起地图区让列表占满。

**③ 优化后表现**
解决：标定缺失时用户看到明确的雷达/提示，而不是空块。
验收：临时改名 `maps.json` 后展开面板，地图区出现雷达 + 提示而非纯深色。

---

## R8a-U01 · 不确定 · 用户拖动过的面板位置，下次展开是否应该保持？

**① 问题描述**
现状：拖动松手会把坐标写进 `nearby-panel` 偏好（`NearbyPanelController.java:352-362`），但下次展开时只要拿到了球坐标就优先「贴球另一侧」，存档位置只在「完全没有球坐标」时才读（`:283-313`，字段注释 `:76-79` 却写「下次展开沿用」）。用户影响：取决于产品口径——若要求「拖过就记住」，现在等于没记住；若按 2026-11-10 的「面板固定贴球」设计，则是注释过期。触发条件：拖动面板后收起再展开。
置信度：中。**需要产品/原作者确认**：面板位置是「跟着球」还是「跟随用户上次拖动」，确认后再决定改代码还是改注释。

**② 优化方案**
若「跟随用户拖动」：展开时优先用存档位置，仅当存档为空才贴球；若「跟着球」：删掉存档写入与读取，并把注释改成实际行为。

**③ 优化后表现**
解决：行为与文案统一，用户不会觉得「拖了白拖」。
验收：拖动面板到屏幕中部、收起、再展开，位置符合产品确认后的口径。

---

## 复核结论（本次检查后未发现问题的点）

- **上传链路删除彻底**：`android-shell/` 全量检索 `CaptureUpload*` / `uploadCapture` 无 Java 或 JS 残留；`CaptureController` 已无上传相关导入与字段，`capture-bridge.js` 已移除 `uploadCapture`，`src/` 侧也无 `uploadCapture` 调用；`build.gradle` 无 `CAPTURE_TOKEN` 引用。不会因删除导致编译或运行时失败。
- **坐标 NaN 防护到位**：壳侧 `numberOrNull` 拒绝 NaN/null，`OverlayGeometry` 全整数无除法，地图页对 `self` / 每个点位都做 `isFinite` 校验并在投影越界时退回雷达（`overlay-map.html:166-190`、`:263-293`、`:334-336`）。
- **线程与回调清理**：`BattleOverlayController.destroy()` 移除长按/半透明定时器并注销显示监听（`:272-279`），控制器销毁时清掉采集停止回调（`MainActivity.java:524-538`），面板性能采样也在 `release()` 里撤销。
- **桥的调用方校验**：`CaptureBridgePolicy.allows` 与 `MainActivity` 的 origin 白名单按当前站点校验，切服后同步更新（`:394-440`、`:838-849`），未见可绕过的旧站放行路径。
- **单测未改松**：`NearbyOverlayModelTest`（348 行）与 `OverlayGeometryTest`（71 行）覆盖了解析兜底、面板高度表、两行文案与几何夹紧，断言与现行常量一致。

---

## 统计表

| 等级 | 数量 | 编号 |
| --- | --- | --- |
| 高 | 1 | R8a-H01 |
| 中 | 2 | R8a-M01、R8a-M02 |
| 低 | 8 | R8a-L01 ~ R8a-L08 |
| 不确定 | 1 | R8a-U01 |

## 最该先修的 3 条

**R8a-H01 · 高风险** — 收起面板不销毁地图网页视图，反复开关后内存累积、展开必闪白；改成货真价实的复用或销毁重建二选一。
- 验收：真机连开关 20 次后内存不单调上涨，展开时地图立即可见。

**R8a-M01 · 中风险** — 面板展开时每秒最多 4 次全量重排 + 整份地图数据重灌，游戏上层持续重绘。
- 验收：`RocoPerf` 中静止时 `render`/`mapPush` 计数不再随 `payload` 同比例增长。

**R8a-M02 · 中风险** — 加窗失败/权限被收回时点球无反应、无提示，与同模块 `need-permission` 语义不一致。
- 验收：关掉悬浮窗权限后点球，页面出现「开启显示在其他应用上层」入口。

## 范围外备注（只记录，不展开）

- `MainActivity` 的 `IdentityRescue`、`UpdateController`、`ServerConfig`、`build.gradle` 通道断言属 R8b，本批只做了调用点确认。
- 网页侧推送节流、payload 体积与旧壳兼容属 R9a；本批仅从壳的接收视角引用，未作结论。
- 工作区中的 `../../../%E5%8E%9F%E5%9E%8B/%E5%8E%86%E5%8F%B2/preview/`、`2026-11-1x/` 原型与截图、`docs/设计资产/registry.json` 改动不属本次审查范围。
