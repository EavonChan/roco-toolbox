# docs/进度 —— 审批日志与改前快照

工作台（`tools/workbench/`）的审批节点落盘在这里。**只有这一个目录会被工作台写入**，看板与会话台账始终由人维护。

## 文件

| 路径 | 内容 | 谁写 |
| --- | --- | --- |
| `审批.jsonl` | 每次审批一行 JSON，**append-only**，永不改写 | `POST /api/approve` |
| `snapshots/<时间戳>.md` | 写看板**之前**的完整副本（同一份字节） | `POST /api/approve` |

两个文件都是**按需创建**的：没审批过就没有 `审批.jsonl`，也不会有 `snapshots/`。

## 审批.jsonl 的一行

```json
{"id":"doing-1","action":"approve","note":null,"at":"2026-11-22T15:46:52.969Z"}
```

| 字段 | 含义 |
| --- | --- |
| `id` | 看板里的任务标识（`<列>-<序号>`，见 `/api/board` 的 `id`） |
| `action` | `approve` = 确认已完成（🟢）；`reject` = 打回（🔴） |
| `note` | 备注，没写就是 `null`（打回时建议写原因） |
| `at` | 写入时间，ISO 8601（UTC） |

## 快照文件名

`2026-11-22T15-46-52-969Z.md` —— UTC 时间戳，冒号换成短横（Windows 文件名不允许冒号），按名字排序即按时间排序。

## 回滚一次审批

```powershell
# 1) 看一眼改前是什么样
Get-Content docs\进度\snapshots\2026-11-22T15-46-52-969Z.md | Select-String 'W1'
# 2) 整份放回去（会覆盖审批时那一行的符号）
Copy-Item docs\进度\snapshots\2026-11-22T15-46-52-969Z.md docs\任务看板.md
```

注意：这样会把**快照之后**别人对着板做的其他修改一起冲掉。多人同时改时，优先只把那一行的符号手改回去，再用 `审批.jsonl` 的 `at` 时间点对账。

## 约束

1. 工作台的**唯一**写操作就是这次审批：`POST /api/approve`。其他一律只读（GET/HEAD）。
2. 写之前一定先落快照；md 写失败或校验不过，会把 md 回滚成改前内容并把错误如实返回，**不留半截**。
3. 这个目录里的东西只增不改；要清理就整份归档到 `docs/archive/`，不要就地删行。
4. 验收脚本：`node tools/workbench/check-approve.mjs`（全程在 `%TEMP%` 副本上跑，不碰真实看板）。
