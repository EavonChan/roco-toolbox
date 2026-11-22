# 修复记录 · 后端与采集/附近（本路）

> 范围：`functions/_lib` 换蛋后端、`src/shared` 换蛋域模型、`src/collector` 采集进度。
> 只改代码与测试；未打包、未部署、未跑迁移、未连库、未做 git 写操作。
> 依据：`R1.md`、`R2a.md`、`R2b.md`、`R9-1.md`、`R9-2a.md`（契约侧）、`R9-3.md` 及三份裁决。

| # | 条目 | 结果 | 验证 |
| --- | --- | --- | --- |
| 1 | R2a-H01 巡查状态读取扫全站 | 已修 | 见下 |
| 2 | R2a-H02 收蛋后状态回退 | 已修 | 见下 |
| 3 | R9-1-H01 超 128MiB 判无效 | 已修（另一路 `capped` + 本路补快照文案） | 见下 |
| 4 | R9-1-H02 live 每轮全量 `slice()` | **本轮不改，登记为已知风险** | 见下 |
| 5 | R9-1-M01 共享进度与所有权 | 已修 | 见下 |
| 6 | R1-M02 `breeding_pairs` 逐条容错 | 已修 | 见下 |
| 7 | R1-M03 背包/家园水印互相拖累 | 服务端已修；客户端在 `src/ui`，未动 | 见下 |

---

## 1. R2a-H01 · 巡查状态读取按小组过滤

**改了什么**

- `functions/_lib/eggPatrolStore.ts`：`activePatrolTasks(db, groupIds?)` 增加可选小组过滤（`e.group_id IN (...)`），成员改成一条 `WHERE group_id IN (...)` 批量查询；`readPatrolStatus` 只读当前小组。
- `functions/_lib/eggBotBridge.ts`：`claim` 只读本批通知所属小组；`validate` / `ack` 只读该通知的 `group_id`（`validate` 无租约时仍不扫描）。
- `functions/_lib/eggPatrol.ts`：tick 内每个 uid 复用开头已读到的任务列表，不再每账号重读全站（顺带覆盖 R2a-M02 方案 A 的一半；`scene_json` 列未动，测试断言不变）。

**验证**

```
node --test tools/test/egg-patrol-api.test.mjs
ℹ tests 21
ℹ pass 21
ℹ fail 0
```

新增用例「reading one group only scans that group and its members once」断言：状态查询带 `e.group_id IN`、成员只发 1 条批量查询、另一小组任务从 1 条加到 31 条后 SQL 条数不变。原有「同 UID 跨组只查一次」「跨组重绑后旧租约失效」两条回归保持通过。

---

## 2. R2a-H02 · 收蛋后不再退回「已上窝」

**改了什么**

- `functions/_lib/eggPatrol.ts`：写 `placed` 观察时增加 `AND NOT EXISTS (... task_key=? AND status='produced')`；已有产出记录的同一任务不再被上窝记录顶掉（裁决要求的严格条件：配窝仍在/已散都覆盖）。

**验证**

```
node --test tools/test/egg-patrol-api.test.mjs   → 21 passed
```

新增用例「collecting a produced egg never falls back to placed」：先「配对 + 蛋」得到 `produced`，再分别用「只有配对」和「配对也散」各跑一轮，状态都保持 `produced`。裁决提到的「多父本 → ambiguous」由既有 `ambiguous fathers/tasks never choose one` 用例覆盖，不在本修复中改动。

---

## 3. R9-1-H01 · 采集状态超 128MiB 被判无效（已修）

**改了什么**

- 桌面采集侧（工程路）已完成：`CollectorState.capped` 标记 + `readCollectorState` 允许 `capped=true` 时 `savedBytes` 略超上限，提示语沿用桌面 `message`；本路未改这两处。
- 本路补上剩余缺口（`src/collector/nativeCollector.ts`）：
  - `readCaptureSnapshot` 把「超过 128MiB」从「本机采集快照无效」里拆出来，改为明确文案「本次采集已达 128MiB 上限，请先解析导出已有的原包」；
  - 上限内（含正好 128MiB）的快照仍正常通过。

**验证**

```
npx vitest run src/collector/nativeCollector.test.ts
Test Files  1 passed (1)
Tests       13 passed (13)
```

新增用例「采满 128MiB 时快照给出上限提示而不是「快照无效」」；原「capped 标记不把整份状态判无效」用例保持通过。

---

## 4. R9-1-H02 · live 每轮 `bytes.slice()` 全量（本轮不改，已知风险）

**结论：按本轮范围不改，登记为已知风险。**

- 正确修法需要给 worker 协议增加「窗口起始绝对偏移 + 文件总长」，并改 `src/pcap-decoder/tools/pcap-json-app/src/core.js`、`decodeCapture.worker.ts`、`decodeInWorker.ts` 与主线程缓存契约：
  - 尾窗解析依赖整份文件的绝对偏移（`core.js:438-459`、`:2483-2492`）；
  - 冷启动要补扫头部 2MiB（`core.js:2285-2293`），`pcapFormat` 需要文件头 24 字节；
  - 只送尾部窗口会破坏 `applied` 去重键（`src/pcap/liveWindow.test.ts:122-140` 钉的点）并让裁剪恢复失效。
- 跨解码协议的影响面无法静态确认；当前 128MiB 上限已兜住极端内存情况，本轮不动 worker 协议。
- 风险记录：live 长采集时主线程峰值仍约为缓存的 2~3 倍（缓存、归并、`slice()` 副本），接近 128MiB 时顿挫会更明显；后续单独立项处理。

---

## 5. R9-1-M01 · 共享进度与所有权

**改了什么**

- `src/collector/useCaptureProgress.ts`：
  - 新增模块级 `progressStore`（复用 `createModuleStore`，不新建文件）；真正解码的实例把每次结果（含 `checking` / 错误 / 空结果）发布进去，没抢到所有权的实例直接读共享结果，不再返回自己从未刷新的 `result`。
  - `resetLiveLoopForTest()` 同时清空共享进度。
  - `selfAt` 改为只在真实 307 时推进：`rawSelf ? Date.now() : previousSnapshot?.selfAt`。
- 同分（1MiB / 2MiB）不改变「先占着的继续跑，避免来回顶」的交接规则；共享进度让非持有者在 250ms 内就有结果。

**验证**

```
npx vitest run src/collector/useCaptureProgress.test.tsx
✓ 10 tests passed
```

新增用例「两个同优先级 live 实例共享进度：后挂的实例也能拿到结果」：先挂 1MiB，再挂 2MiB（同分），12 秒后第二个实例的 `progress.stage` 为 `ready`、`sourceBytes` 为 100（修复前该实例进度始终为空）。既有「单一解码源」「走满即停」「缓存恢复」「后台心跳」用例全部保持通过。

---

## 6. R1-M02 · `breeding_pairs` 逐条容错

**改了什么**

- `src/shared/eggPatrol.ts`：`parsePatrolScene` 的配窝列表改为逐条 `try/catch`，单条缺 `pet_gid` / 父本格式异常 / 非对象只跳过自己；`breeding_pairs` 缺失或非数组按「本次没有上窝证据」处理；蛋列表仍严格失败（判定必需数据）。
- `PatrolScene.skippedPairs` 记录跳过条数；`functions/_lib/eggPatrol.ts` 在强刷（`force`）时把它带回 tick 响应，便于内测排查。

**验证**

```
npx vitest run src/shared/eggPatrol.test.ts src/shared/eggWorkflow.test.ts
Test Files  2 passed (2)
Tests       35 passed (35)
```

新增用例「脏配窝只跳过它自己，蛋与合法配窝照常解析」：3 条脏配窝 + 1 条合法配窝，`skippedPairs === 3`，蛋照常解析、合法配窝照常命中。

---

## 7. R1-M03 · 背包 / 家园水印拆分

**改了什么**

- `src/shared/eggWorkflow.ts` 的 `stock-sync`：
  - 水印拆成 `[账号, 游戏账号, 'bag'|'home']` 两条；每侧只和自己的上一次比；
  - 每侧的采集时间取该侧蛋的 `lastConfirmedAt`（客户端已按部位写入），该侧为空且 `complete*` 为真时退回请求 `capturedAt`；
  - 合并 / 删除 / `missingFromCapture` 都按「这一侧是否被接收」分别处理，未接收的一侧原样保留；
  - 每侧被接收时把该侧水印推进到请求 `capturedAt`；旧键 `[账号, 游戏账号]` 作为两侧兜底读一次，避免升级后重放旧快照。
- `visibleState` 的水印过滤按 `JSON.parse(key)[0] === accountId`，三元素键天然兼容，无需改。

**验证**

```
npx vitest run src/shared/eggPatrol.test.ts src/shared/eggWorkflow.test.ts   → 35 passed
```

新增用例「背包与家园各自记水印」：先同步 12:00 背包，再导入 11:50 家园，家园蛋仍入库；回放同一份旧家园快照返回原状态。既有「homeComplete 只删家园蛋」「bag complete 不删家园蛋」等 25 条用例保持通过。

**未修的一小半（裁决收窄项）**

- 客户端 `src/ui/plan/eggStockModel.ts:60` 仍用单个 `capturedAt` 水印；在「先同步 12:00 背包、再导入 11:50 家园」的路径上，客户端会在上传前就把家园蛋挡掉。该文件属 `src/ui/**`（另一路），本路未改；需要客户端同批把水印按部位拆开，否则只修服务端仍可能看不到蛋。

---

## 8. 只登记、不修改的项

- R9-3-U02（9 秒 TTL）与 R9-3-U01（野生大块头身高 98% vs 100%）：按任务约定证据不足，不改代码，仅登记。
- R2a-M01（通知表 `task_key` 列 + 索引）涉及加列迁移，不在本轮必修项，未动。
- R2a-M03 / L01~L04、R2b 系列不在本轮必修项，未动。

## 9. 收尾验证（真实输出）

```
node --test tools/test/egg-patrol-api.test.mjs       → tests 21 / pass 21 / fail 0
node --test tools/test/egg-matching-api.test.mjs     → tests 14 / pass 14 / fail 0
npx vitest run src/shared/eggPatrol.test.ts src/shared/eggWorkflow.test.ts → 35 passed
npx vitest run src/collector/useCaptureProgress.test.tsx → 10 passed
npx vitest run src/collector/nativeCollector.test.ts → 13 passed
npx vitest run src/collector/nativeCollector.test.ts src/collector/useCaptureProgress.test.tsx → 23 passed
npx tsc -p functions/tsconfig.json                   → exit 0
npx tsc -b                                           → exit 0
```

未跑全量 `vitest run`，未打包、未发版、未提交。
