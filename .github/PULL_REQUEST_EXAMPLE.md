# PR 模板填写示例（功能调整类）

> 这是一份**示例**，不是模板本身。用途：让 S1~S6 看到模板填满之后长什么样。
> 案例取自 2026-11-21/22 的「小组求蛋与收集中」这批在制品，内容按真实文档写，验证输出是占位符。
>
> 真正的模板在 `PULL_REQUEST_TEMPLATE.md`，开 PR 时 GitHub 会自动填进去。

---

## 改了什么

把「收集中」从混编页改成纯任务页，并给「小组求蛋」加双向匹配入口：

- `src/ui/plan/MotherCollectingView.tsx`：收集中隐藏母本搜索、蛋组筛选、达标奖牌组合、推荐性格编辑四条横条，只留三页签 + 当前小组 + 任务卡；未发布且无进行中交换的本地计划，卡片右下角可直接移出。
- `src/ui/plan/GroupEggRequestSheet.tsx`：存在双向匹配时显示「可立即交换」，主按钮改为「发布并邀请某人」，可切回「只发布」。
- `src/domain/directExchange.ts`（新增）：双向匹配判定的纯函数，含单测。
- `src/ui/useMotherCollectionData.ts`（新增）：收集中列表的数据装配。
- `src/ui/MotherView.tsx`：母本页「收集中」状态改为与「未收集 / 已收集」互斥。

## 为什么（对应 issue / 交接文档）

- 设计口径：`docs/superpowers/specs/2026-11-21-小组求蛋与收集中-design.md`
- 实施计划：`docs/superpowers/plans/2026-11-21-小组求蛋与收集中.md`
- 交互口径变更：`docs/产品交互规范.md`「收集中」三条新增
- 台账登记：`docs/设计资产/registry.json`（新增原型 sha256 与 4 张证据图）

## 涉及的产品口径

- 收集中**不再**提供筛选与奖牌组合编辑；用户要改条件得回「母本」页。这是口径变化，已在 `docs/产品交互规范.md` 写明。
- 「发布并邀请」不是独占锁：被邀请人之外仍可回应。机器人会为邀请生成真实群通知。
- 移出规则：仅在「尚未发布且没有进行中的交换」时可一键移出；已有小组需求时必须先撤回需求。
- 默认体型选项仍是「不选 = 沿用普通大块头 / 小不点」，未改。

## 验证

```text
$ npx tsc -b
（无输出，exit=0）

$ npx vitest run src/ui/plan/MotherCollectingView.test.tsx src/ui/plan/GroupEggRequestSheet.test.tsx src/domain/directExchange.test.ts
 Test Files  3 passed (3)
      Tests  XX passed (XX)
   Duration  X.XXs

$ node tools/lint-copy.mjs
lint-copy: OK
```

说明：这是功能调整，只跑了 3 个相关测试文件 + 类型检查 + 文案检查；全量 `npm run verify` 留到合并前由 S6 跑。

## 界面变更

375 / 390 都看过，截图在：

- `.preview/收集计划-375-我的收集.png`、`.preview/收集计划-390-我的收集.png`
- `.preview/收集计划-375-组内广场.png`、`.preview/收集计划-390-组内广场.png`
- `output/playwright/collecting-tab-clean-375.png`、`collecting-tab-clean-390.png`（移除旧计划横条后的收集中）
- `output/playwright/group-egg-auto-invite-375.png`、`group-egg-auto-invite-390.png`（双向匹配态的求蛋面板）
- 可交互 HTML：`docs/prototypes/group-egg-request/2026-11-21/index.html`

## 越界声明

- 碰了 `docs/设计资产/registry.json`（P 名下）：只追加本次原型的 sha256 与证据图，未改历史条目。
- 碰了 `docs/产品交互规范.md`（P 名下）：只加「收集中」三条口径，已同期给 P 看过。
- 其余文件均在本工作区清单内。

## 归属工作区

- 工作区：S3 收集计划与换蛋
- 分支：`wip/collection-center-20261122` → `test`
- 规模：8 个文件，`+353 / -284` 行（**超协议上限 400 行**；已与用户确认按「一次目的」合并，不再拆）

<!-- 最后一行是模板设计的一个提醒：超限要显式承认，不允许悄悄带过去。 -->
