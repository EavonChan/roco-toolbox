# 任务看板工作台（W2）

把 `docs/任务看板.md` + `docs/会话台账.md` 变成能一眼看进度的面板：**任务视图**看每件事到哪一步，**会话视图**看每个会话到哪个阶段、卡在哪，卡片点开看完整内容，卡片上能直接「确认已完成 / 打回」。

仍然**不建第二份状态**：没有数据库、没有 JSON 状态文件，两个视图都是每次请求重读 md 的投影。

## 跑起来

```powershell
node tools/workbench/server.mjs
# → http://127.0.0.1:4320
```

- 端口被占用时自动 +1，并在终端打印**实际地址**（`[ready] http://…`）。
- 只监听 `127.0.0.1`，纯本地，无登录、无外网依赖。
- 页面每 5 秒只重拉当前视图的接口，不整页刷新；两个视图用 `#board` / `#sessions` 记在地址栏。

## 三个视图元素

| 元素 | 说明 |
| --- | --- |
| 任务视图 | 深色四列（进行中 / 等你 / 已完成 / 待派）；卡片显示代号、状态、标题、派给、更新时间来源、阻塞、最近进展、下一步 |
| 卡片展开 | 点卡片（或聚焦后按 Enter/空格）展开：任务 / 派给 / 开始 / 最近进展 / 下一步 / 所在列 / 更新时间 / **详情** + 打回原因 + 看板原始字段表 |
| 会话视图 | 一个会话一行：代号、说人话的名字、阶段（待派·执行中·已交付·已验收·已收口）、最后活动时间（带来源）、台账原话、看板里对得上的任务行、阻塞原因、产出链接 |

## 文件

| 文件 | 作用 |
| --- | --- |
| `server.mjs` | 原生 Node HTTP：解析两份 md + `GET /api/board` + `GET /api/sessions` + `POST /api/approve` + 托管单文件页面。零 npm 依赖 |
| `index.html` | 单文件前端：双视图、卡片展开、审批按钮、5 秒轮询、375 纵向堆叠 |
| `check.mjs` | W1 接口级验收（行数 / sha / 端口 +1 / 改副本 5 秒内变 / 真文件未动） |
| `check-ui.mjs` | W1 面板级验收（改副本符号，卡片 ≤5 秒内变，且没整页刷新） |
| `check-approve.mjs` | **W2 验收**：审批 / 打回 / 写失败回滚 / 会话行数 / 详情列 / 375+1440 截图 |
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
node tools/workbench/shot.mjs --prefix W2 --tabs board,sessions
```

`check-approve.mjs` 的八步：① 会话行数 == 台账现役行数；② 接口审批写 🟢 + 日志 + 快照 + 5 秒内同步；③ 面板点「确认已完成」5 秒内变 🟢 且不整页刷新；④ 面板点「打回」变 🔴 + 红色阻塞条 + 备注进日志；⑤ 只读副本上审批 → 报错、md 不变、日志不增行；⑥ 有/没有「详情」列都对；⑦ 真实 `docs/任务看板.md`、`docs/会话台账.md`、`docs/进度/` 未被测试写入；⑧ 375 / 1440 × 任务 / 会话 + 展开详情 截图落 `docs/preview/W2-*.png`。

除第 ⑧ 步落截图外，全部在 `%TEMP%` 的副本上跑（`WORKBENCH_BOARD` / `WORKBENCH_LEDGER` / `WORKBENCH_PROGRESS`），不会碰真实看板。
只想复核功能、不想动 `docs/preview/` 时：`$env:SKIP_SHOTS=1` 再跑，第 ⑧ 步会跳过截图。

## 环境变量（全部只影响读写哪个文件，不产生第二份状态）

| 变量 | 默认 | 用途 |
| --- | --- | --- |
| `WORKBENCH_BOARD` | `docs/任务看板.md` | 换一份看板（验收脚本用副本） |
| `WORKBENCH_LEDGER` | `docs/会话台账.md` | 换一份台账 |
| `WORKBENCH_PROGRESS` | `docs/进度/` | 换审批日志与快照目录 |
| `PORT` / `HOST` | `4320` / `127.0.0.1` | 起始端口 / 绑定地址 |

## 取舍

- **写操作只有审批一处**：面板里能改的只有"该行状态符号"。改文字、加行、删行仍然只能编辑 md。
- **写前必留快照、写后必回读校验**：宁可报错回滚，也不留"md 改了但日志没写"的半截；代价是每次审批多一次整份备份（本项目看板 ~4 KB，可忽略）。
- **列不设内滚动**：页面整体滚动，四列顶部对齐；已完成多时页面会变长，换来所有卡都能被截图/打印。
- **行内没有时间就用文件 mtime**：看板只在表头写一个"最后更新"，逐行时间只有「进行中」有 `开始`；其余行只能退到文件时间，并在卡片上标注来源。
- **本地路径不做跳转**：`file://` 被浏览器拦、面板也不该替你启动外部程序，所以「详情」对本地路径做成"点击复制"。
- **面板不托管仓库文件**：静态资源只放行 `/` 和 `/index.html`，不把 `tools/workbench` 下的脚本源码当静态文件暴露。
- **不改看板结构**：解析侧兼容"表头后多一个空行"这类手滑写法，但不替看板做决定；格式问题只报告、不自动修。
