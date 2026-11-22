# R3b 裁决（Codex，一次性）

> 输入：`%TEMP%\review_brief_R3b.md`（3 条）；被审基线 `894de06`。
> 调用：`codex exec --sandbox read-only --ephemeral -C "d:\desk\洛克工具箱" -m gpt-6.2-sol -c model_reasoning_effort=medium -o %TEMP%\verdict_R3b.txt`
> 结果：成功（正常退出，未超时），耗时 **92 秒**，原始输出 1905 字节，已全文读取。

## 1. R3b-M01 · 算不出母本的家园蛋被从蛋仓删掉
- **原结论**：完整家抓包里一颗算不出母本/物种的蛋被跳过、`complete` 仍为 true，服务端把它标 `missingFromCapture` 并删除，挂出状态一并丢失。
- **裁决：成立，但不是所有状态都会删。**
  - 成立：同账号旧家园蛋未进入同步列表且全量同步通过时间水位时，`src/shared/eggWorkflow.ts:219` 先标缺失并下架，`:221` 的过滤会删除 `available` 记录。
  - 补充（未推翻）：`:222` 保留 `reserved` 与 `transferred`，但**不保留挂出状态**；若预留蛋后来恢复为 `available`，`:360` 或 `:386` 仍可能清掉它。
  - 第三种情况：找到了母本但查不到母本物种，也走同一条误删路径（`src/ui/plan/homeEggAdapter.ts:146`）。
- **对修复动作的影响**：修复方案（`complete` 与背包侧对齐）成立；验收用例要覆盖三类状态：`available` 必删、`reserved/transferred` 不删但挂出状态会丢、以及「有母本无物种」这条与「无母本」等价的路径。

## 2. R3b-M03 · 普通窝同性格的 60% 被当成确定性格
- **原结论**：普通窝双亲同性格直接落值并标 `system`，界面与匹配都按 100% 处理，约 40% 落空。
- **裁决：行为判断成立；「约 40% 落空」未被证实。**
  - 成立：`src/ui/plan/homeEggAdapter.ts:151` 写入性格，`:178` 标 `system`；`src/ui/plan/EggStockPanel.tsx:66` 只在性格为空时显示候选；`src/shared/eggMatching.ts:113` 只比对已填性格，没有候选兜底。
  - 推翻（报告原句「对方照此接单约有 40% 落空」）：仓库文档只确认「40% 走随机分支」，未证明最终恰有 40% 不命中（`docs/domain/数据字段说明.md:70`）。
  - 第三种情况：新快照算不出性格时，`src/shared/eggWorkflow.ts:206` 会沿用旧值，旧推断仍可能继续命中。
- **对修复动作的影响**：修复方向（留空或标 60%）不变；文案与验收里不要写「40% 落空」，改成「约 40% 概率不遗传该性格」。

## 3. R3b-U01 · 家园蛋一律按普通蛋 / 自产入库
- **原结论**：固定 `kind:'ordinary'` 可能把异色/特殊家蛋当普通蛋换出去。
- **裁决：分类判断对，挂出结论只对一半；异色风险证据不足。**
  - 成立：`src/ui/plan/homeEggAdapter.ts:177` 固定来源与分类；`src/ui/plan/EggStockPanel.tsx:57` 不给地面蛋挂出按钮，但服务端 `src/shared/eggWorkflow.ts:231` 的挂出校验不检查位置。
  - 推翻（报告隐含的「家蛋可能是异色/特殊」）：`src/pcap-decoder/tools/pcap-json-app/src/home.js:153` 的地面蛋解码不产出分类字段，真实样例没有地面蛋（`src/pcap/homeRealCapture.test.ts:26`），固定 `ordinary` 属已知数据限制，不是已证实的误分类。
  - 第三种情况：即使不挂出，地面蛋也能进入自己的现蛋候选（`src/ui/plan/EggMatchingHub.tsx:153`），并通过主动供蛋路径的校验（`src/shared/eggWorkflow.ts:292`）——这是独立于稀有分类的交易限制缺口（与 R3a-H01 同源）。
- **对修复动作的影响**：该条应从「待领域确认」降为「已核实：抓包无分类字段」；真正要修的是位置限制（同 R3a-H01），不是稀有度推断。
