# PC 版适配方案（Npcap 实时采集）

> 2026-11-08 定稿。背景：桌面版最初只是把网页打包成 exe，不能实时采集；用户要求参考
> `ROCO附近精灵 0.19.2`，做真正的 PC 端采集与界面适配。项目里没有既有的 PC 调研文档，
> 本文即补上的那份方案 + 实施记录。

## 1. 结论

PC 端实时采集走 **Npcap 抓本机网卡** 路线：

- 游戏客户端（或安卓模拟器）与服务器的 TCP 流都经过本机网卡，Npcap 能在用户态抓整条流；
- 抓到的帧写经典 PCAP（与手机采集器同格式），直接复用现有解码链路（`src/pcap-decoder`、
  `src/pcap` 的窗口化实时解析），**字段口径与手机完全一致**；
- 不做任何注入、不改游戏、不读进程内存。

### 参考工具的做法（拆包结论）

`ROCO附近精灵_0.19.2.exe`：PyInstaller + Python 3.12 + tkinter。

| 模块 | 作用 |
|---|---|
| `sources.pyc` | 自述 "Streaming classic PCAP reader and Windows Npcap adapter"，直接调用 `wpcap.dll`（`pcap_findalldevs / pcap_create / pcap_setfilter / pcap_next_ex`） |
| `engine.pyc` | "One event/state pipeline shared by PCAP replay and live capture" |
| `protocol / radar / mapview / fullmap / battle / storage` | 协议解析、雷达、地图、战斗、SQLite 落盘 |

即：**Npcap 抓包 + 自研协议解析**，与我们的方案一致；它同样要求用户安装 Npcap、
必要时以管理员运行。

## 2. 真实抓包验证（2026-11-08）

用三份手机采集的 pcap 跑现有解码器（`src/pcap/probeRealCapture.test.ts`）：

| 文件 | 包数 | AES key | 330 / 1044 | 场景 | 附近精灵 |
|---|---|---|---|---|---|
| capture-1793900360948 | 1720 | 有 | 1 / 45 | 10003 | 18 |
| capture-1793902106531 | 2244 | 有 | 1 / 97 | 10003 | 26 |
| capture-1793905516970 | 1975 | 有 | 1 / 68 | 10003 | 12 |

三份包里服务端 TCP 端口都是 **8195**，因此 PC 抓包过滤器定为 `tcp port 8195`。
结论：字段、协议、端口都够用，PC 端只需要换“数据从哪来”。

## 3. 架构

```
游戏 / 模拟器
   │ TCP 8195
   ▼
本机网卡 ──Npcap(wpcap.dll)──► 采集 Worker（worker_threads，一次打开多块网卡）
                                   │ 写 capture-<ts>.pcap
                                   ▼
                        Electron 主进程 CaptureManager
                        ├─ 状态/文件列表（RocoCapture.getState）
                        ├─ /capture/<id> 本地读取（支持 ?from=N 增量）
                        └─ IPC ←→ preload ←→ 网页 window.RocoCapture
                                                 │
                                          现有采集面板 / 附近雷达 / 自动导入
```

关键点：

- **接口零分叉**：桌面版实现与安卓壳同名同语义的 `window.RocoCapture`，网页端
  `NativeCollectorPanel`、`autoImportFlow`、附近雷达、窗口化实时解析全部复用；
- **自动多网卡**：默认一次打开除回环外的所有网卡（含加速器 TAP、虚拟网卡），
  用户不用猜游戏流量走哪块；也可以手动指定单块。回环链路类型不是以太网，会被跳过；
- **固定端口 5178**：localStorage / IndexedDB / 教程已读标记都按源（含端口）隔离，
  端口必须固定，否则每次重开都是新源——教程反复弹、数据也像丢了一样；
- **抓包放 Worker**：`pcap_next_ex` 单次最多阻塞 100ms，放主进程会卡窗口；Worker 里跑
  抓包 + 落盘，主进程只收状态；
- **增量读取**：本地服务对 `/capture/<id>?from=N` 返回第 N 字节以后的内容并带
  `X-Capture-From` 头，与安卓壳的拦截器语义一致（网页端已按该头校验）；
- **失败可读**：未装 Npcap、无权限、网卡被占用等都转成中文提示，直接显示在采集面板；
  采集中 8 秒还没有包时，状态栏会提示「确认游戏已登录 / 加速器改选 TAP 网卡」。

### 与安卓壳的接口对照

| 方法 | 安卓壳 | 桌面版 |
|---|---|---|
| `getState()` | JSON 状态 | 同（字段 version/supported/phase/packets/bytes/files/… 一致） |
| `startCapture(mode)` | 开 VPN 抓包 | 开 Npcap（mode 暂忽略，不滚动裁剪） |
| `stopCapture()` | 停 VPN、保存 | 停抓包、落盘收尾 |
| `inspectCapture()` | 返回 `https://roco-share.invalid/collector/<uuid>` | 返回 `http://127.0.0.1:<port>/capture/capture-<ts>.pcap` |
| `importCapture(id)` | 塞待处理分享 + 派发 `roco-share` | 主进程执行脚本塞 `window.__rocoPendingShare` + 派发同名事件 |
| `shareCapture(id)` | 系统分享面板 | 另存为对话框 |
| `deleteCapture(id)` | 删除本机原包 | 同 |
| `notifyRareAlert()` | 系统通知 | Electron 系统通知 |
| `updateBattleOverlay()` | 系统悬浮窗 | 返回 `unsupported`，回落到应用内悬浮球 |
| `listDevices / selectDevice` | 无 | 桌面专属：网卡列表与选择；默认 `auto`（除回环外全部），回环会被拒绝 |

## 4. 依赖与权限

- **Npcap**：免费，需用户自行安装（<https://npcap.com/#download>，勾选 WinPcap API 兼容）。
  未安装时采集面板给出下载入口，其余功能不受影响。
- **管理员**：Npcap 若勾选“限制管理员访问”，需以管理员身份运行工具箱；提示语已内置。
- **抓包范围**：只抓 `tcp port 8195`，不碰其它流量；文件只保存在本机 `userData/captures`。
- **加速器**：若使用 UU/迅游等加速器，游戏流量可能走 TAP 虚拟网卡，此时在面板里改选
  对应网卡即可（`Netease UU TAP-Win32 Adapter` 等）。

## 5. 已实现 / 未实现

已实现（2026-11-08）：

- Npcap 抓包模块、采集 Worker、主进程状态与文件管理、本地读取路由（含增量）；
- 自动多网卡采集（排除回环）+ 手动指定网卡；
- 固定本地端口 5178：教程已读、导入数据、界面偏好等按源保存的内容不再每次丢失；
- preload 暴露 `window.RocoCapture` / `window.rocoDesktop`；
- 采集面板 PC 文案 + 网卡选择 + Npcap 缺失引导；隐藏安卓专属入口（打开游戏）；
- 删除网页端「从蛋神助手电脑版导入」（PC 已有原生采集，不再需要一层中转）。

### 5.1 地图与悬浮小窗（2026-11-08）

- **附近页用地图替换雷达**：内置 10003「卡洛西亚大陆」地图（4096²）与投影标定
  （`src/pcap/worldMap.ts`，`public/maps/maps.json`）；点位按世界坐标实测落图，支持拖动 / 滚轮缩放 /
  点精灵看详情；没有地图的场景（家园）自动回退雷达；
- **PC 悬浮小窗**（`desktop/overlay`）：460×300，左侧 240×240 小地图 + 右侧紧凑列表
  （名字/等级 + 距离/方向 + 一个牌子，最多 8 条）；始终置顶、可拖动、位置记忆；
- **交互按成熟桌面浮窗的习惯设计**：主交互是「收起 / 展开」——收起成 230×38 状态条，
  直接显示「附近 N 只 · 稀有 M」；「明 / 暗」主题一键切换并记住；
- **「小窗不挡点击」是高级选项**，放在「附近」页（不占小窗按钮）：开启后鼠标点击直接落到游戏，
  点不到小窗，按 `Ctrl+Alt+O` 恢复；
- **登录提示不设超时**：未拿到 AES key 时提示「退出到登录界面重新登录一次」，不同机型加载时间不同，
  不做 8 秒之类的硬性判断；
- **桌面版一律按「实时采集」处理**（2026-11-08）：不自动停止、不自动导入。原因是 PC 的 key 只能
  在登录握手时拿到，自动停止后再采就要重新登录；需要入库时由用户点「停止并保存」→ 文件列表
  「解析并导入」。手机端保持原有的「收齐自动停止 + 导入」不变；
- **地图视野收紧**：默认 150m（一个 120m 距离圈，不再画外圈），右上角可缩放，
  缩放倍率记在 `localStorage`（`roco.nearbyMapZoom`），下次打开沿用；小窗小地图同样 150m / 120m。
  修掉了应用内地图一片黑的问题——图片被 Tailwind 的 `max-width:100%` 压扁后仍按原尺寸平移，
  结果整张图被推到画布外，补 `max-w-none` 后正常。

未实现（后续可做）：

- 滚动裁剪（抓包超过 8MiB 只保留最近 4MiB）——PC 磁盘空间充足，暂不做；
- 系统级悬浮窗 / 强提醒置顶窗口——目前通知走系统通知，雷达需在应用内查看；
- 端口自动发现（当前固定 8195；若游戏换端口需要改常量或加配置）；
- 以管理员身份重启的自动提权（当前只提示）。

## 6. 验收

- `npx tsc -b` 通过；
- `npx vitest run src/pcap/collectorUrl.test.ts src/collector/nativeCollector.test.ts src/ui/NativeCollectorPanel.test.tsx`
  → 33 passed；
- Npcap 实测（回环网卡 + 本机 8195 回声服务）：33 包 / 14 364 字节，PCAP 魔数正确；
- Electron 内实测：`getState / listDevices / selectDevice / startCapture / stopCapture /
  inspectCapture / ?from=` 全部返回预期，采集面板 PC 分支渲染无 pageerror。

## 7. 相关文件

- `desktop/capture/npcap.cjs`：Npcap FFI 与 PCAP 写盘
- `desktop/capture/worker.cjs`：采集 Worker
- `desktop/capture/manager.cjs`：状态、文件、网卡设置
- `desktop/preload.cjs`：`window.RocoCapture` / `window.rocoDesktop`
- `desktop/main.cjs`：IPC、`/capture/` 路由、启动流程
- `src/pcap/collectorUrl.ts`：本机原包 URL（安卓 / 桌面两种）
- `src/collector/nativeCollector.ts`：桥的类型与桌面网卡接口
- `src/ui/NativeCollectorPanel.tsx`：采集面板 PC 分支
