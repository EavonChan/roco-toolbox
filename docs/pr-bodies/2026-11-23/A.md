## 改了什么

- `src/pcap-decoder/tools/pcap-json-app/src/core.js`：`protocolIndividualStats` → `protocolIndividualBonuses`，field 14 每项输出 `{ name, value }`；`buildItem` 输出 `individualBonuses`，`individualText` 由名称拼；汇总计数同步。
- `src/domain/individualBonuses.ts`（新增）：优先读采集器值，没有再回退旧 `rawFields.bytes["14"]` 解码；按生命 → 物攻 → 魔攻 → 物防 → 魔防 → 速度排序，最多三项。
- `src/domain/types.ts`、`parseBackup.ts`、`backup.ts`：`OwnedPet` 增加 `individualBonuses`，导入与本地备份清洗都保留。
- `src/ui/NestPlanCard.tsx`、`HomePairCards.tsx`：家园配窝卡底部固定三格显示三维，缺项留空；卡高 70 → 86。

## 为什么（对应 issue / 交接文档）

- 用户 2026-11-22 口径：家园配窝卡要显示真实个体三维。
- 原 #7 把三维、三只组重排、窄横屏竖排、CSS 混在一条 12 文件 / 761 行的累积分支里，维护者要求拆开；本片只做三维与数据链路。原 PR：https://github.com/sasaki-ishiran/roco-toolbox/pull/7
- 改名原因：原 `individualStats` 只存名称，新链路需要数值；统一叫 `individualBonuses` 并同步 pcap 输出，避免两个字段并存。

## 涉及的产品口径

- 三维显示顺序固定：生命 → 物攻 → 魔攻 → 物防 → 魔防 → 速度；最多三项；缺项留空；没有数据时整行留空。
- 家园卡高 70 → 86，与配窝建议卡一致；配窝建议卡本身不变。
- 数据口径变化：抓包单只精灵的 `individualStats`（名称数组）改为 `individualBonuses`（`{name,value}` 数组）；`individualText` 保留。
- 三只组重排、窄横屏竖排两只、卡头空行不在本片，留给后续切片。

## 验证

```text
$ npm run verify
> tsc -b && vitest run && vitest run --config vitest.functions.config.ts && node tools/lint-copy.mjs
 Test Files  203 passed | 1 skipped (204)
      Tests  1844 passed | 1 skipped (1845)
 Test Files  1 passed (1)
      Tests  5 passed (5)
文案 lint 通过：存量 13 条，新增 0 条。
EXIT=0
```


## 界面变更

375 / 844×390 / 1280×720 都看过，截图在证据分支（不进入本 PR 的 diff）：

- https://raw.githubusercontent.com/EavonChan/roco-toolbox/friend/pr-evidence-20261123/docs/screenshots/2026-11-23-slices/A-3d-home-p375.png
- https://raw.githubusercontent.com/EavonChan/roco-toolbox/friend/pr-evidence-20261123/docs/screenshots/2026-11-23-slices/A-3d-home-l844.png
- https://raw.githubusercontent.com/EavonChan/roco-toolbox/friend/pr-evidence-20261123/docs/screenshots/2026-11-23-slices/A-3d-home-l1280.png

量测：三档都是 `cards=11 / stats=11 / cardH=86 / statOverflow=0 / docScrollW=视口宽`，三格「生命+9 / 物攻+8 / 速度+10」没有被截断。

## 越界声明

- 碰了 `src/pcap-decoder/tools/pcap-json-app/src/core.js`（S5 采集与端侧）：只改 field 14 的字段名与每项数值输出，不改解析/协议逻辑；原因是 `individualStats → individualBonuses` 必须同步采集器输出，否则导入链路拿不到数值。
- 其余文件在 S2 配窝/导入范围内。

## 归属工作区

- 工作区：S2 母本与配窝（pcap 一处越界见上）
- 分支：`friend/individual-bonuses-20261123` → `test`
- 规模：8 个文件，`+343 / -11` 行（协议上限：≤ 8 文件 / ≤ 400 行）
