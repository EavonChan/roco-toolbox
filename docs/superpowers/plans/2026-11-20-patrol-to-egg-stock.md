# 家园巡检产物写入蛋仓 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让家园巡查唯一确认产出的蛋自动进入换蛋蛋仓，并能被后续任务分配。

**Architecture:** 巡查仍负责解析家园场景和判定任务；新增一个纯函数把唯一 `produced` 观察转换成家园蛋仓记录，再由服务端在巡查成功后按小组做乐观并发写入。蛋实例 ID 与抓包导入的家园蛋保持同一格式，保证两条入口幂等合并。

**Tech Stack:** TypeScript、Cloudflare Workers/D1、Node test runner、Vitest。

**Spec:** 用户 2026-11-20 指令：补上“巡检发现产出后自动进蛋仓”，随后将当前测试版发布正式。

## Global Constraints

- 只有唯一匹配的 `produced` 观察写蛋仓；`ambiguous` 不写。
- 写入记录为 `location: 'home'`、`status: 'available'`，不自动占用换蛋任务。
- 蛋 ID 必须与 `homeStockFromSnapshot` 的格式一致：`["uid:<uid>","home","<actorId>"]`。
- 重复巡查只能更新确认时间，不能重复创建蛋。
- 手工标注、任务占用状态和已挂出状态不能被巡查覆盖。
- 巡查不删除蛋仓里已经存在的蛋；蛋被收走不等同于可以安全删除。
- 本次不打包 APK、不改 `latest.apk`、不改任何 `version.json`。

## Review Focus

- 同一颗蛋被重复巡查：应保持一条记录。
- 同一颗蛋匹配多个任务：应保持 `ambiguous`，不得猜一个任务写入。
- 抓包已先导入同一颗家园蛋：巡查应合并，不得产生第二条。
- 用户已手工标注或已被任务占用：巡查不得覆盖。
- 巡查回写与用户同时修改小组状态：旧版本写入必须失败并重试，不能覆盖用户操作。

---

### Task 1: 纯函数合并巡查产物

**Files:**
- Create: `src/shared/eggPatrolStock.ts`
- Test: `src/shared/eggPatrolStock.test.ts`

**Interfaces:**
- Consumes: `EggWorkflowState`, `PatrolTask`, `PatrolObservation`, `PatrolEgg`
- Produces: `recordPatrolProducedEgg(state, task, observation, egg, now): EggWorkflowState`

- [ ] **Step 1: Write the failing test**

```ts
test('a produced patrol egg is added once as home stock', () => {
  const next = recordPatrolProducedEgg(emptyEggWorkflow(), task, observation, egg, 1000);
  expect(next.eggs).toHaveLength(1);
  expect(next.eggs[0]).toMatchObject({ location: 'home', status: 'available', accountId: 'b' });
  expect(recordPatrolProducedEgg(next, task, observation, egg, 2000).eggs).toHaveLength(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/shared/eggPatrolStock.test.ts`
Expected: FAIL because `eggPatrolStock.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create the pure merge function with stable IDs, parent info, idempotent update, and preservation of manual/occupied fields.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/shared/eggPatrolStock.test.ts`
Expected: PASS.

### Task 2: 巡查成功后写回小组蛋仓

**Files:**
- Create: `functions/_lib/eggPatrolStock.ts`
- Modify: `functions/_lib/eggPatrol.ts`
- Test: `tools/test/egg-patrol-api.test.mjs`

**Interfaces:**
- Consumes: `recordPatrolProducedEgg`
- Produces: `recordProducedPatrolEggs(db, groupId, inputs): Promise<number>`

- [ ] **Step 1: Write the failing integration test**

Assert that after a patrol finds one produced egg, `egg_matching_groups.state_json` contains the stable home egg ID; a second patrol does not duplicate it.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tools/test/egg-patrol-api.test.mjs`
Expected: FAIL because the egg is absent from `state.eggs`.

- [ ] **Step 3: Implement optimistic D1 write**

Read the group version/state, merge all produced eggs for that group, reject over-capacity state, update with `WHERE version = ?`, and retry on conflict.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tools/test/egg-patrol-api.test.mjs`
Expected: PASS.

### Task 3: 相关验收与发布

**Files:**
- Modify: release branch contents after tests pass
- Verify: `roco-toolbox.pages.dev`

- [ ] **Step 1: Run focused tests**

Run: `npx vitest run src/shared/eggPatrolStock.test.ts src/shared/eggPatrol.test.ts src/shared/eggWorkflow.test.ts`
Expected: PASS.

- [ ] **Step 2: Run API patrol tests**

Run: `node --test tools/test/egg-patrol-api.test.mjs`
Expected: PASS.

- [ ] **Step 3: Run type/build checks**

Run: `npx tsc -b`
Run: `npm run build`
Expected: exit 0.

- [ ] **Step 4: Prepare production release candidate**

Follow `docs/发版与更新规范.md`: commit reviewed changes, merge the approved web candidate into `release`, ensure a clean release worktree, build, run `node scripts/deploy-web.mjs --branch main --approve-production --dry-run`, then deploy with the same command without `--dry-run`.

