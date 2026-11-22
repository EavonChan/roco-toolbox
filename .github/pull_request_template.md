## 这个 PR 做什么

<!-- 一句话写目的，不要写文件名。 -->

## 规则自查（2026-11-22 起，见 docs/协作与合并规则.md）

- [ ] 分支是 `friend/<功能>-<日期>`，从 `origin/test` 开，存活 ≤ 7 天
- [ ] 一个 PR 一个目的；`git diff --numstat origin/test...HEAD` ≤ 8 文件 / ≤ 400 行
- [ ] 没有改「仅主线改」的文件（MotherView.tsx、Dashboard.tsx、src/ui/plan/\*、release/\*、scripts/deploy\*、.github/\*\*）；若改了，已附 issue 链接：____
- [ ] 没有 rebase 已推送的历史（已推送分支只用 merge 前进）
- [ ] 已跑 `npm run verify`，并把真实输出贴在下节
- [ ] UI 变更：附 375 / 390 两张截图并标出改动点；无视觉变化则在此说明：____

## npm run verify 输出

```
（贴命令与尾部输出，通过/失败都贴，不要写"本地已通过"）
```

## UI 截图（仅 UI 变更）

| 375 | 390 |
| --- | --- |
|  |  |

## 怎么验证 / 回滚风险

<!-- 用户能看到什么、怎么复现；出问题时怎么回退。 -->
