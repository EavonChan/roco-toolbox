## 改了什么

- pcap：`protocolIndividualStats` → `protocolIndividualBonuses`，field 14 每项输出 `{name,value}`；单只精灵字段改为 `individualBonuses`，`individualText` 保留。
- 新增 `src/domain/individualBonuses.ts`：优先读采集器值，旧 JSON 回退 `rawFields.bytes["14"]`；按生命→物攻→魔攻→物防→魔防→速度排序，最多三项。
- `OwnedPet` 与导入 / 本地备份清洗保留 `individualBonuses`。
- 家园配窝卡底部固定三格显示三维，缺项留空；卡高 70→86。

## 为什么

用户 2026-11-22 口径：家园配窝卡显示真实个体三维。原 #7 把三维、三只组重排与 CSS 混在 12 文件 / 761 行里，按维护者要求拆开；本片只做三维与数据链路。原 PR：https://github.com/sasaki-ishiran/roco-toolbox/pull/7

## 涉及的产品口径

- 顺序固定：生命→物攻→魔攻→物防→魔防→速度；最多三项；缺项留空；没数据整行留空。
- 家园卡高 70→86；配窝建议卡不变。
- 数据口径：抓包单只精灵 `individualStats`（名称数组）→ `individualBonuses`（`{name,value}` 数组）；`individualText` 保留。

## 验证

```text
$ npm run verify
 Test Files  203 passed | 1 skipped (204)
      Tests  1844 passed | 1 skipped (1845)
 Test Files  1 passed (1)
      Tests  5 passed (5)
文案 lint 通过：存量 13 条，新增 0 条。
EXIT=0
```

## 界面变更

375 / 844×390 / 1280×720 都看过，图在证据分支：

- https://raw.githubusercontent.com/EavonChan/roco-toolbox/friend/pr-evidence-20261123/docs/screenshots/2026-11-23-slices/A-3d-home-p375.png
- https://raw.githubusercontent.com/EavonChan/roco-toolbox/friend/pr-evidence-20261123/docs/screenshots/2026-11-23-slices/A-3d-home-l844.png

量测：cards=11、stats=11、cardH=86、statOverflow=0，三档都无横向溢出。

## 越界声明

碰了 `src/pcap-decoder/tools/pcap-json-app/src/core.js`（S5 采集与端侧）：只改 field 14 的字段名与每项数值输出，不改解析逻辑；改名必须同步采集器输出。其余文件在 S2 范围内。

## 归属工作区

- 工作区：S2 母本与配窝（pcap 一处越界见上）
- 分支：`friend/individual-bonuses-20261123` → `test`
- 规模：8 个文件，`+343 / -11` 行
