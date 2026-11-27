# 任务看板工作台（W2 + W4 + T1）

把 `docs/任务看板.md` + `docs/会话台账.md` 变成能一眼看进度的面板：**任务视图**看每件事到哪一步，**会话视图**看每个会话到哪个阶段、卡在哪，卡片点开看完整内容，卡片上能直接「确认已完成 / 打回」。
W4 又加了**汇报视图**：把 `docs/汇报/` 里的 Markdown 按标题层级 / 表格 / 列表 / 代码块渲染出来，零依赖。
T1 加了**工时视图**：一条状态条 + 今日时间线 + 按任务汇总，只回答"今天时间去哪了"，**不做考勤**、**不做空闲自动停**；数据只在本机、不进仓库。

仍然**不建第二份状态**：没有数据库、没有 JSON 状态文件，看板 / 会话 / 汇报三个视图都是每次请求重读 md（或目录）的投影。
工时是唯一的例外，但它也不在仓库里：只往 `%USERPROFILE%\.workbench\timer\` 追加日志（见下）。

## 跑起来

```powershell
node tools/workbench/server.mjs
# → http://127.0.0.1:4320
```

- 端口被占用时自动 +1，并在终端打印**实际地址**（`[ready] http://…`）。
- 只监听 `127.0.0.1`，纯本地，无登录、无外网依赖。
- 页面每 5 秒只重拉当前视图的接口，不整页刷新；四个视图用 `#board` / `#sessions` / `#reports` / `#timer` 记在地址栏。

## 四个视图元素

| 元素 | 说明 |
| --- | --- |
| 任务视图 | 四列（进行中 / 等你 / 已完成 / 待派），默认浅色；卡片显示代号、状态、标题、派给、更新时间来源、阻塞、最近进展、下一步 |
| 卡片展开 | 点卡片（或聚焦后按 Enter/空格）展开：任务 / 派给 / 开始 / 最近进展 / 下一步 / 所在列 / 更新时间 / **详情** + 打回原因 + 看板原始字段表 |
| 会话视图 | 一个会话一行：代号、说人话的名字、阶段（待派·执行中·已交付·已验收·已收口）、最后活动时间（带来源）、台账原话、看板里对得上的任务行、阻塞原因、产出链接 |
| 工时视图 | 一条状态条（圆点=面板连着没连着 · 当前任务 · 已计时长 · 切换/停止）+ 今日时间线 + 按任务汇总 + 最近 20 条记录（折叠） |

## 汇报视图（W4，只读 Markdown）

顶部第三个 tab「汇报」：**左列**是 `docs/汇报/` 下的 `.md`（按修改时间倒序，显示标题、文件名、多久前、大小），
**右侧**渲染选中那份的正文。默认选中最新一份；点左列换文件，不刷新整页。

- **零依赖**：Markdown 是自己写的，`index.html` 里一个渲染函数（`mdInline` + `mdToHtml`，约 90 行），
  不引 marked / markdown-it，也不从 CDN 拿任何东西——包离线也能跑。
- **支持**：`#` ~ `###` 标题、段落、`**加粗**`、`` `行内代码` ``、`[文字](链接)`、无序 / 有序列表
  （`- [ ]` / `- [x]` 渲染成 ☐ / ☑）、`>` 引用、``` 代码块（等宽 + 浅灰底）、`|` 表格（含表头分隔行）、分隔线。
- **只放行安全协议**：链接只给 `http(s)` / `mailto` / 站内相对路径开口子，`javascript:` 之类退化成纯文字。
- **不白屏**：空文件给空态文案；渲染抛错就把原文原样放进 `<pre>`；正文下面还常驻一个「看原文」折叠块。

### API 契约（`GET /api/reports`，schema 3）

```jsonc
{
  "schema": 3,
  "ok": true,
  "generatedAt": "ISO",
  "dir": "docs/汇报",
  "absoluteDir": "D:\\…\\docs\\汇报",
  "available": true,
  "count": 1,
  "sort": "mtime-desc",
  "files": [
    { "name": "2026-11-24.md", "path": "docs/汇报/2026-11-24.md",
      "title": "2026-11-24 工作汇报（示例）",   // 正文第一行 `# ` 之后的内容；没有就退回文件名
      "size": 2429, "bytes": 2429, "mtime": "ISO" }
  ],
  "readPolicy": "每次请求重读目录与文件，不缓存"
}
```

目录还没建时返回 `available:false` + `reason`，不报错。隐藏文件、非 `.md` 一律不进清单。

### `GET /api/reports/<文件名>` 回原文

响应体就是文件字节（`Content-Type: text/markdown; charset=utf-8`），另带 `X-Report-Name` / `X-Report-Mtime` / `X-Report-Bytes`。

**只允许读 `docs/汇报/` 这一个目录**，下面这些一律 `400 bad_report_path`，绝不吐别处的文件：

| 试法 | 结果 |
| --- | --- |
| `/api/reports/../package.json`（裸 `..`） | 400 |
| `/api/reports/..%2Fpackage.json`、`%2e%2e%2f…`（编码过的穿越） | 400 |
| `/api/reports/C:%5CWindows%5Cwin.ini`（盘符 / 反斜杠） | 400 |
| `/api/reports/`（空名字）、`/api/reports/package.json`（不是 `.md`） | 400 |
| `/api/package.json`（客户端把 `..` 折叠掉之后剩下的路径） | 400 |
| 目录里不存在的 `xxx.md` | 404 |

判穿越用的是**请求行里的原始路径**：`new URL()` 会把 `/api/reports/../x` 折叠成 `/api/x`，靠它判就等于放过；
名字校验通过后还会 `realpath` 再核一遍真实位置，防软链接指到目录外。
另外**不认识的 `/api/` 路径一律 400**（不是 404）：curl / fetch 这类客户端会先把 `..` 归一化掉，
服务端根本看不到那段 `..`，只剩 `/api/package.json`——当非法接口路径挡掉，穿越在任何客户端下都不会变成 200。

## 工时计时器（T1）：今天时间去哪了

> **只回答"时间去哪了"，不做考勤。** 不排名、不评分、不记"谁打断的"（没有打断来源这个字段），也不做 AI 时间统计。
> 数据只存本机：`%USERPROFILE%\.workbench\timer\`，**不在仓库里、不上传、不进 git**。删掉这个目录就等于全部清零。

### 一条状态条 + 两个动作

顶栏第四个 tab「工时」。进去只有一条状态条和今天的账：

```
● 写 PRD · 01:23:45   [切换] [停止]
```

- **切换**：弹出输入框，上面是今天出现过的任务（点一下就开始，**一次点击完成**），也可以直接输入新任务名回车。
  正在计时时日志写 `switch`，空闲时写 `start`。375 下这条仍是一行：任务名放不下就省略（悬停看全名），时钟不换行。
- **停止**：进入空闲，状态条变成 `○ 空闲 · 今日已记 2 小时 10 分`，按钮变成「开始」。
- **圆点**只说一件事：**面板还连着没连着**（最近 15 秒内有心跳；服务端留一拍余量，实际按 20 秒判）。亮=连着，灰=没连着。
  它**跟计时完全无关**：灰了计时照样跑，只有手动切换/停止才结束一段。
- 计时中时钟每秒走一格；空闲时显示"今日已记多久"。

下面就是今天的账：

- **今日时间线**：一条横向色带，按任务分段，**没记录的时间留缝**（灰底）——手动停之后没马上开始下一段就照实空着。
- **按任务汇总**：每个任务一行 —— 时长、占"已记录工时"的百分比、几段。
- **最近 20 条记录**（折叠）：开始 / 切换 / 停止，一行一条。

### 不做空闲自动停、不做补记（设计决定）

> 不做空闲自动停止、不做补记：用户可能同时在两台电脑上工作，自动停会把另一台机器上的时间误判为离开。只有手动切换/停止才结束一段。

- 一段计时开始后**一直跑**，直到你点「切换」或「停止」；
- 心跳只用来点亮状态条上的圆点（面板连着没连着），**不许用它停计时**；
- 没有"回来补记"：时间线上没记录的时间就是空隙，不弹提示、不追问、不要求你补；
- 所以服务端只认 `start` / `switch` / `stop` 三种事件，日志里没有系统替你写的事件。

### 心跳与圆点：它能说明什么、不能说明什么

- 前端每 15 秒打一次 `POST /api/timer/heartbeat`（页面隐藏时不打）；
- 服务端只看"最近 20 秒内有没有心跳"来决定 `state.online`（心跳 15 秒一拍，留一拍余量防抖）；
- **`online:false` 只表示这个页面的心跳断了**（切走标签页 / 最小化 / 锁屏 / 机器休眠 / 浏览器把定时器冻了），
  它不代表你走了，也不会让计时停下。在主电脑上开着、去另一台电脑干活，回来照样是同一段。

浏览器看不到页面外的鼠标，也不该去读系统级输入——所以这里索性不判断"人在不在"，
只提供"我这一页还连着"这个事实，剩下的交给你手动操作。

### 存储：只有一个文件，在仓库外

| 路径 | 内容 |
| --- | --- |
| `%USERPROFILE%\.workbench\timer\YYYY-MM-DD.jsonl` | 一天一个事件日志，**只追加、不改写**，一行一个事件 |

路径在用户目录下，仓库里没有任何计时文件，`git status` 永远看不见它（`check-timer.mjs` 第 4 步就是证明这一点）。

### 事件格式（JSONL，一行一个）

```jsonc
{"ts":"2026-11-24T09:12:00+08:00","type":"start","task":"需求评审"}
{"ts":"2026-11-24T09:40:00+08:00","type":"switch","from":"需求评审","to":"写 PRD"}
{"ts":"2026-11-24T09:55:00+08:00","type":"stop","task":"写 PRD"}
```

- `ts` 是**事件真正发生的时刻**（本机时区，带 `+08:00` 这种偏移）。
- 只有这三个类型：一段计时只会被 `start` / `switch` / `stop` 断开，没有系统替你补的事件。
- 时间线**不存**在文件里，每次请求从日志重放；服务重启、页面关掉，账都还在。
  重启后日志里最后一段如果还开着，就按"还在计时"接回来（因为只有手动才能停），并在终端打一行提示。

### API

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| `/api/timer/start` | POST | `{task}` 开始新任务（当前任务自动结束） |
| `/api/timer/switch` | POST | `{task}` 切到另一个任务 |
| `/api/timer/stop` | POST | 停止，进入空闲 |
| `/api/timer/heartbeat` | POST | 前端每 15 秒一次；**只更新 `online`，不碰计时** |
| `/api/timer/state` | GET | 当前任务、已计时长、今日汇总、最近 20 条、`online` |

所有 POST 都**返回当前状态**（和 `GET /api/timer/state` 同一个结构，另加 `ok` / `event` / `changed`），前端拿回来直接重画，不用二次请求。

```jsonc
// GET /api/timer/state（截断）
{
  "schema": 1, "ok": true, "date": "2026-11-24",
  "storage": { "dir": "~\\.workbench\\timer", "absoluteDir": "C:\\Users\\…\\.workbench\\timer",
               "logFile": "~\\.workbench\\timer\\2026-11-24.jsonl", "outsideRepo": true },
  "online": true, "lastHeartbeat": "…T10:19:50+08:00",
  "current": { "task": "写 PRD", "since": "…T10:12:00+08:00", "elapsedMs": 3725000 },
  "day": { "from": "…T09:07:00+08:00", "to": "…T10:20:00+08:00", "fromHhmm": "09:07", "toHhmm": "10:20",
           "segments": [{ "task": "需求评审", "fromHhmm": "09:12", "toHhmm": "09:40", "ms": 1680000 }],
           "holes": [{ "fromHhmm": "09:55", "toHhmm": "10:12", "ms": 1020000 }] },
  "summary": { "trackedMs": 3725000, "holeMs": 1020000,
               "tasks": [{ "task": "写 PRD", "ms": 1545000, "share": 41, "count": 2 }] },
  "recent": [{ "at": "09:55", "type": "stop", "text": "停止 · 写 PRD" }]
}
```

时间线窗口从"今天第一段记录前 5 分钟"画到"现在"，不把打开工作台之前的时间算成空隙。

## 主题：默认浅色，深色是选项

- **默认浅色**：背景 `#F7F8FA`，卡片白底 + 1px `#E5E7EB` 边，主色 `#0F9D58`，正文 `#1F2329`，次要文字 `#6B7280`；
  状态色 🟡`#D97706` 🔵`#2563EB` 🟢`#059669` 🔴`#DC2626` —— 只用来做**左侧 3px 竖条、小圆点、浅底深字的小标签**，不做整块高饱和底色。
- **深色保留**：顶栏右上角 `☾ / ☀` 切换，选择写 `localStorage['workbench.theme']`（`light` / `dark`）。
  没存过就是浅色；`<head>` 里有一段前置脚本，在首帧之前把 `data-theme` 定好，切主题不会闪一下。
- **成体系**：字号只用 12 / 13 / 14 / 20，圆角只用 8 / 12（状态胶囊用 999），间距一律 4 的倍数（4 / 8 / 12 / 16 / 20 / 24）。
- **可读性优先**：任务标题两行截断（`-webkit-line-clamp:2`，完整标题在展开的「任务」行），时间用弱化色，
  375 下所有可点区域 ≥ 40px（视图切换、审批按钮、阶段筛选、主题按钮）。
- 深浅两套颜色都只是 `:root` / `html[data-theme="dark"]` 上的 CSS 变量，组件里不写死颜色。

## 文件

| 文件 | 作用 |
| --- | --- |
| `server.mjs` | 原生 Node HTTP：解析两份 md + `GET /api/board` + `GET /api/sessions` + `GET /api/reports`（列目录 / 回原文，带穿越拦截）+ `POST /api/approve` + 托管单文件页面。零 npm 依赖 |
| `index.html` | 单文件前端：三视图、卡片展开、审批按钮、自写 Markdown 渲染、5 秒轮询、375 纵向堆叠、浅色默认 + 深色可选 |
| `check.mjs` | W1 接口级验收（行数 / sha / 端口 +1 / 改副本 5 秒内变 / 真文件未动） |
| `check-ui.mjs` | W1 面板级验收（改副本符号，卡片 ≤5 秒内变，且没整页刷新） |
| `check-approve.mjs` | **W2 验收**：审批 / 打回 / 写失败回滚 / 会话行数 / 详情列 / 375+1440 截图 |
| `check-reports.mjs` | **W4 验收**：汇报清单 / 原文一致性 / 穿越拦截（裸 socket 发原始路径）/ 渲染（表格边框、标题层级）/ 空文件空态 / 375 布局 / 375+1440 截图 |
| `check-timer.mjs` | **T1 验收**：已计时长 / 切换落盘 / 心跳只报在线不停表 / 数据只在仓库外 / 面板一次点击切换 / 375+1440 截图 |
| `shot.mjs` | 截图（`--tabs board,sessions`，375 / 1440），输出到 `docs/preview/` |

## 唯一写操作：`POST /api/approve`

```jsonc
// 请求
{ "id": "doing-1", "action": "approve", "note": "可选备注" }
// action: "approve" → 该行改成 🟢；"reject" → 该行改成 🔴
// 可选再带 "key": "k95b2cd0564"（稳定的行标识，见下），带了优先用 key 定位
```

服务端按这个顺序做，**任何一步失败都不留半截**：

1. 重新读 `docs/任务看板.md`，按 `id`/`key` 定位那一行（找不到 → 404，什么都不写）；
2. 已经是目标符号 → 直接返回 `changed:false`，不写文件、不备份、不记日志；
3. 把改前内容整份写到 `docs/进度/snapshots/<UTC时间戳>.md`（`wx` 独占创建，不覆盖旧快照）；
4. 只替换那一行里的状态符号（行内有符号就换第一个；没有就塞进「最近进展」那格），**其余字节不动**；
5. 写 md；
6. 重新解析校验：目标行必须是新符号、条数不变、字节与预期一致，否则**回滚成改前内容**并报 `verify_failed`；
7. 追加一行到 `docs/进度/审批.jsonl`（`{id, action, note, at}`）；这一步失败也回滚 md。

响应（成功）：

```jsonc
{ "ok": true, "changed": true,
  "record": { "id": "doing-1", "action": "approve", "note": null, "at": "ISO" },
  "snapshot": { "path": "docs/进度/snapshots/…Z.md", "name": "…", "bytes": 4123 },
  "task": { "id": "doing-1", "key": "k95b2cd0564", "code": "W1", "status": "🟢", "statusKey": "done" },
  "board": { "path": "docs/任务看板.md", "sha256": "…", "bytes": 4123, "mtime": "ISO" } }
```

失败（`ok:false` + `error`）：`bad_action` / `missing_id` / `row_not_found` / `snapshot_failed` / `write_failed` / `verify_failed` / `log_failed`。写失败与回滚相关的响应带 `snapshot`、`boardUnchanged`、`rolledBack`。

**除了这个 POST，服务只认 GET/HEAD**（其他方法 405，静态资源只放行 `/` 和 `/index.html`）。

## 行标识：`id` 与 `key`

- `id` = `<列>-<行内序号>`（`doing-1`、`waiting-2`…），人看着顺眼，但**加行会挪位**。
- `key` = `sha1(列|代号|标题)` 前 10 位，状态符号变了它不变，上面插一行也不会认错。页面两个都发，服务端优先用 `key`；只发 `id` 也能用（验收脚本就是这么测的）。

## API 契约（`GET /api/board`，schema 2）

```jsonc
{
  "schema": 2,
  "generatedAt": "ISO",
  "source": { "path": "docs/任务看板.md", "absolutePath": "...", "bytes": 0,
              "mtime": "ISO", "declaredUpdatedAt": "ISO|null",
              "sha256": "...", "commit": { "at": "ISO", "hash": "...", "subject": "..." },
              "readPolicy": "每次请求重读，不缓存" },
  "repo":   { "root": "...", "branch": "test", "version": "1.5.7",
              "dirtyFiles": 0, "lastCommitAt": "ISO", "lastCommitHash": "...",
              "lastCommitSubject": "...", "boardRelativePath": "docs/任务看板.md" },
  "counts": { "total": 0, "doing": 0, "waiting": 0, "done": 0, "backlog": 0 },
  "columns": [
    { "key": "doing", "title": "进行中", "status": "🟡", "count": 0,
      "tasks": [
        { "id": "doing-1", "key": "k95b2cd0564", "code": "W1", "title": "...",
          "assignee": "...", "status": "🟡", "statusKey": "doing", "statusLabel": "进行中",
          "startedAt": "23:35|null", "updatedAt": "ISO", "updatedSource": "row|doc|file",
          "blocker": "…|null", "detail": "...", "next": "...",
          "section": "一、进行中", "sectionKey": "doing",
          "detailLink": { "raw": "docs/x.md", "kind": "path|url|text", "href": null },
          "cells": [{ "header": "代号", "value": "W1" }] }
      ] }
  ],
  "legend": [{ "symbol": "🟡", "label": "进行中", "meaning": "会话在跑，等它回信" }],
  "approvals": { "available": true, "path": "docs/进度/审批.jsonl", "total": 3,
                 "items": [{ "id": "doing-1", "action": "approve", "note": null, "at": "ISO" }] }
}
```

## API 契约（`GET /api/sessions`，schema 2）

```jsonc
{
  "schema": 2,
  "generatedAt": "ISO",
  "repo": { "…": "同 /api/board，用来在会话视图也显示分支/脏文件" },
  "source": { "board": "docs/任务看板.md", "ledger": "docs/会话台账.md",
              "bytes": 0, "mtime": "ISO", "sha256": "...", "snapshotAt": "ISO|null",
              "readPolicy": "每次请求重读两份 md，不缓存、不落盘" },
  "counts": { "total": 8, "archived": 3, "byStage": { "backlog": 0, "doing": 5,
              "delivered": 2, "accepted": 0, "closed": 1 } },
  "boardCounts": { "total": 21, "doing": 1, "waiting": 3, "done": 12, "backlog": 5 },
  "stages": [{ "key": "backlog", "label": "待派" }, "…"],
  "sessions": [
    { "id": "C1", "code": "C1", "name": "改收集页", "sessionId": "f614095a",
      "stage": { "key": "doing", "label": "执行中", "sourceLabel": "台账" },
      "stageSource": "ledger|board",
      "ledgerStatus": "运行中，e2e 收尾 15/24",
      "updatedAt": "ISO", "updatedSource": "board-row|board-doc|board-file|ledger-snapshot|ledger-file",
      "outputs": [{ "raw": "docs/preview/C1-*.png", "label": "…", "kind": "path", "href": null }],
      "blocker": null, "conflict": null,
      "tasks": [{ "id": "waiting-2", "key": "k26…", "code": "C1", "title": "C1 收集页验收",
                  "status": "🔵", "statusKey": "waiting", "statusLabel": "等你" }] }
  ]
}
```

### 会话阶段怎么来的（不新增状态）

1. **先看台账「状态」列**：含 `已验收` → 已验收；`已收口/已收尾/已归档/已结束/已完成/关闭` → 已收口；`已交付/待验收` → 已交付；`运行中/执行中/在跑/进行中` → 执行中；`待派/未开始/空白/排队` → 待派。
2. 台账那句都不匹配 → **退到看板**：该代号对得上的看板行里，有 🟡 或 🔴 → 执行中；有 🔵 → 已交付；全 🟢 → 已收口；只有 ⚪ → 待派。此时行上会标「阶段按看板判」。
3. 两边明显打架时只**点出来**、不替任何一边改口径：台账写「执行中」但看板行全 🟢 → 黄条「对不上」；台账已收口但看板还有 🟡 → 同样提示。
4. **最后活动时间**取该会话看板行里最新的那个，退而求其次用台账 §四「最近一次快照」时间、台账文件 mtime；卡片上标来源（看板行内时间 / 看板更新时间 / 台账快照 / 台账文件时间）。
5. **阻塞原因**取该会话看板行里的 🔴 文案。

`现役会话数` 的口径：`## 一、现役会话` 那张表的**数据行数**（含代号写成 `—` 的行）。表外的手写行（比如表格结束后又补的一行）不算——`docs/会话台账.md` 现在就有一行，验收脚本按同一口径独立数，结果是 8 行。

### 状态符号写在哪格（审批只改这一处）

- **读**：先看「任务」列**以外**的单元格里有没有 🟡🔵⚪🟢🔴；只有它们都没有时，才退一步把标题里的算上（W1 兼容口径）。一行都没符号就用该列默认状态。
- **写**：先换掉「任务」列以外**第一个**带符号的单元格里的符号（看板惯例是写在「最近进展」开头）；都没有就把符号插到「最近进展」格首。
- **永远不写「任务」列**：看板里真的会用 `**🔴 1.5.8 线上有 bug**` 这种写法把 🔴 当"要紧"的标记，它不是状态；审批会绕过标题，并在写盘前额外校验标题一个字节都没变（变了就拒绝并回滚）。
- 已经是目标状态（包含"该列默认就是这个状态"）时不写文件、不备份、不记日志，直接返回 `changed:false`。

## 新列约定：`详情`

看板表格里加一列表头 `详情`，值可以是**仓库内路径**（`docs/交付说明.md`）或 **URL**。工作台的行为：

| 情况 | 表现 |
| --- | --- |
| 有该列、值是 URL | 展开卡片里有「打开详情 ↗」，新标签打开 |
| 有该列、值是 markdown 链接（`[方案 HTML](docs/preview/x.html)`） | 按钮用 md 里的标签「方案 HTML」，点击**复制目标路径** |
| 有该列、值是路径/通配符 | 「打开详情」按钮，点一下**复制路径**（面板不托管仓库文件，也不启动外部程序） |
| 有该列、值是普通文字 | 原样显示，不当链接 |
| 有该列、值是 `—` | 当作没有详情，不出现这一行 |
| **没有该列** | 展开卡片里不出现「详情」这一行，**不报错** |

「进行中」表已经加了这一列；另外三张表以后要加，解析器按每张表的表头判断，不用改代码。

## 验收（可重复跑）

```powershell
node tools/workbench/check.mjs          # W1 接口/端口/无缓存/不动真文件
node tools/workbench/check-ui.mjs       # W1 浏览器里真的 5 秒内变，且不整页刷新
node tools/workbench/check-approve.mjs  # W2 审批/打回/写失败/会话行数/详情列/截图
node tools/workbench/check-reports.mjs  # W4 汇报清单/原文/穿越拦截/渲染/空态/375 布局/截图
node tools/workbench/check-timer.mjs    # T1 计时/切换/心跳只报在线/仓库外存储/截图
node tools/workbench/shot.mjs --prefix W2 --tabs board,sessions
node tools/workbench/shot.mjs --prefix W3 --tabs board    # 浅色主题 375 / 1440
```

`check-approve.mjs` 的八步：① 会话行数 == 台账现役行数；② 接口审批写 🟢 + 日志 + 快照 + 5 秒内同步；③ 面板点「确认已完成」5 秒内变 🟢 且不整页刷新；④ 面板点「打回」变 🔴 + 红色阻塞条 + 备注进日志；⑤ 只读副本上审批 → 报错、md 不变、日志不增行；⑥ 有/没有「详情」列都对；⑦ 真实 `docs/任务看板.md`、`docs/会话台账.md`、`docs/进度/` 未被测试写入；⑧ 375 / 1440 × 任务 / 会话 + 展开详情 截图落 `docs/preview/W2-*.png`。

`check-timer.mjs` 的五步：① start 后 2 秒，state 里已计时 ≈ 2 秒；② switch 后前一段落盘（有开始有结束）、新段开始；③ 心跳打上 → `online:true`，**停心跳 90 秒** → 当前任务仍在、`since` 没变、已计时继续涨，只是 `online:false`，日志里没有 `idle-stop`；再打一次心跳 → `online:true`、计时不中断；④ 日志在计时目录里、默认路径（假 `USERPROFILE`）也验一遍、`git status` 看不见、目录里没有 `config.json`；⑤ 面板（状态条 / 圆点亮 / 回车切换）+ 375 / 1440 截图落 `docs/preview/T1-工时-*.png`。第 ③ 步要真等 90 秒。

除截图外全部在 `%TEMP%` 的副本上跑（`WORKBENCH_BOARD` / `WORKBENCH_LEDGER` / `WORKBENCH_PROGRESS` / `WORKBENCH_TIMER_DIR`），不碰真实看板，也不碰真实计时数据。
只想复核功能、不想动 `docs/preview/` 时：`$env:SKIP_SHOTS=1` 再跑，第 ⑧ 步会跳过截图。

## 环境变量（全部只影响读写哪个文件，不产生第二份状态）

| 变量 | 默认 | 用途 |
| --- | --- | --- |
| `WORKBENCH_BOARD` | `docs/任务看板.md` | 换一份看板（验收脚本用副本） |
| `WORKBENCH_LEDGER` | `docs/会话台账.md` | 换一份台账 |
| `WORKBENCH_PROGRESS` | `docs/进度/` | 换审批日志与快照目录 |
| `WORKBENCH_REPORTS` | `docs/汇报/` | 换汇报目录（只读；验收脚本用临时目录测空文件与排序） |
| `WORKBENCH_TIMER_DIR` | `%USERPROFILE%\.workbench\timer` | 换计时数据目录（验收脚本用临时目录，绝不写真实计时数据） |
| `PORT` / `HOST` | `4320` / `127.0.0.1` | 起始端口 / 绑定地址 |

## 取舍

- **写操作只有审批一处**：面板里能改的只有"该行状态符号"。改文字、加行、删行仍然只能编辑 md。
- **写前必留快照、写后必回读校验**：宁可报错回滚，也不留"md 改了但日志没写"的半截；代价是每次审批多一次整份备份（本项目看板 ~4 KB，可忽略）。
- **列不设内滚动**：页面整体滚动，四列顶部对齐；已完成多时页面会变长，换来所有卡都能被截图/打印。
- **行内没有时间就用文件 mtime**：看板只在表头写一个"最后更新"，逐行时间只有「进行中」有 `开始`；其余行只能退到文件时间，并在卡片上标注来源。
- **本地路径不做跳转**：`file://` 被浏览器拦、面板也不该替你启动外部程序，所以「详情」对本地路径做成"点击复制"。
- **面板不托管仓库文件**：静态资源只放行 `/` 和 `/index.html`，不把 `tools/workbench` 下的脚本源码当静态文件暴露。
- **不改看板结构**：解析侧兼容"表头后多一个空行"这类手滑写法，但不替看板做决定；格式问题只报告、不自动修。
- **汇报不由工作台托管成静态站**：`/api/reports/<文件名>` 只回 `docs/汇报/` 里的 `.md` 字节，
  既不列目录外的东西，也不解释 `.html`；要看别的文件自己开编辑器。
- **渲染器宁小勿全**：不支持语法高亮、脚注、内嵌 HTML（会被转义成文字）。需要新语法再在里面加十行，
  不引第三方包——"零依赖、可离线"是硬要求。
- **工时数据在仓库外**：`%USERPROFILE%\.workbench\timer\` 而不是 `docs/`。这一份是"我今天怎么过的"，
  不该跟着仓库走、不该进 PR、更不该上传；代价是要自己记得备份这个目录。
- **工时不做考勤，也不做 AI 统计**：没有排名、评分、"专注度"这类派生指标，也没有打断来源字段。
  只有任务名 + 时间，多一个字段都可能被拿去考核。
- **判定不用"鼠标没动"**：那要么得读系统级输入（不该做），要么误判（看视频、开会都算离开）。
  所以这里不判断"人在不在"，只报"这一页还连着"（圆点），计时完全交给手动。
- **计时只追加、不改写**：时间线每次从日志重放，日志写坏了只丢那一行（会报 `brokenLines`），不会整天消失。
- **不做空闲自动停、不做补记**：用户可能同时在两台电脑上工作，自动停会把另一台机器上的时间误判为离开。
  心跳只点亮/熄灭状态条上的圆点，不碰计时；空隙就是空隙，不弹提示也不要求补。
  代价是"人走了但没停"会多算——这靠你手动停，不靠系统猜。
- **服务重启把还开着的一段接回来**：日志最后一段没有 `stop` 就按"还在计时"恢复（`since` 用日志里的开始时间），
  因为只有手动才能结束一段。宁可多算，也不写一条假的"停止"。
