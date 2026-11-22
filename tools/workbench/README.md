# 任务看板工作台（W1）

把 `docs/任务看板.md` 变成能一眼看进度的只读面板。**不引入第二份状态**：没有数据库、没有 JSON 状态文件，面板里也改不了任何东西。

## 跑起来

```powershell
node tools/workbench/server.mjs
# → http://127.0.0.1:4320
```

- 端口被占用时自动 +1，并在终端打印**实际地址**（`[ready] http://…`）。
- 只监听 `127.0.0.1`，纯本地，无登录、无外网依赖。
- 页面每 5 秒只重拉 `GET /api/board`，不整页刷新。

## 文件

| 文件 | 作用 |
| --- | --- |
| `server.mjs` | 原生 Node HTTP：解析 md + `GET /api/board` + 托管单文件页面。零 npm 依赖 |
| `index.html` | 单文件前端：深色四列（进行中 / 等你 / 已完成 / 待派）、5 秒轮询、375 纵向堆叠 |
| `check.mjs` | 接口级验收（行数一致 / sha 一致 / 端口 +1 / 改副本 5 秒内变 / 真文件未动） |
| `check-ui.mjs` | 面板级验收（Playwright 打开页面，改副本符号，看卡片 ≤5 秒内变，且没整页刷新） |
| `shot.mjs` | 375 / 1440 截图，输出到 `docs/preview/` |

## 唯一数据源

每次请求都重新 `readFile('docs/任务看板.md')`，没有任何内存/磁盘缓存。`/api/board` 的 `source.sha256` 就是这次读到的字节哈希——文件一动，哈希就变。

- 列 = md 的章节：`## 一、进行中` / `二、等你` / `三、已完成` / `四、待派`。
- 任务 = 章节里的表格行；`## 状态图例` 的表只用来取符号含义，不当任务。
- 状态 = 行内出现的 🟡🔵⚪🟢🔴；一行没有符号时用该列的默认符号。
- 「多久前更新」= 行内 `开始` 时间 → 看板 `最后更新` → 文件 mtime，取第一个不晚于当前时间的；所以看板把时间写到未来时不会显示"未来"。
- 解析器容忍表头后多一个空行的写法（真实看板出现过），也容忍表格行之间的空行。
- 代号：有 `代号` 列就用；否则从标题前缀取（`P2 外壳验收` → `P2`、`PR #6` → `PR#6`），取不到就不显示代号。

## API 契约（`GET /api/board`，字段固定）

```jsonc
{
  "schema": 1,
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
        { "id": "doing-1", "code": "W1", "title": "...", "assignee": "...",
          "status": "🟡", "statusKey": "doing", "statusLabel": "进行中",
          "startedAt": "23:35|null", "updatedAt": "ISO", "updatedSource": "row|doc|file",
          "blocker": "…|null", "detail": "...", "next": "...", "section": "一、进行中",
          "cells": [{ "header": "代号", "value": "W1" }] }
      ] }
  ],
  "legend": [{ "symbol": "🟡", "label": "进行中", "meaning": "会话在跑，等它回信" }]
}
```

`statusKey ∈ doing|waiting|done|backlog|blocked`；`blocker` 来自行内的 🔴 文案，没有就是 `null`。换前端只认这些字段即可。

## 验收（可重复跑）

```powershell
node tools/workbench/check.mjs      # 接口/端口/无缓存/不动真文件
node tools/workbench/check-ui.mjs   # 浏览器里真的 5 秒内变，且不整页刷新
node tools/workbench/shot.mjs       # 375 / 1440 截图
```

两个 check 都用**看板副本**（`WORKBENCH_BOARD` 指到 `%TEMP%`）测"改符号"，不会碰 `docs/任务看板.md`。

## 取舍

- **列不设内滚动**：页面整体滚动，四列顶部对齐；已完成多时页面会变长，换来所有卡都能被截图/打印。
- **行内没有时间就用文件 mtime**：看板只在表头写一个"最后更新"，逐行时间只有「进行中」有 `开始`；其余行只能退到文件时间，并在卡片上标注来源（行内时间 / 看板更新 / 文件时间）。
- **静态资源只放行 `/` 和 `/index.html`**：不把 `tools/workbench` 下的脚本源码当静态文件暴露。
- **不改看板**：工作台是只读的；发现看板格式问题（空行、未来时间）只在解析侧兼容，不替看板做决定。
