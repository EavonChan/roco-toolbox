# R7a 朋友 PR 剩余：列表与卡片（只读审查）

- 批次：R7a（简报 `docs/code-review/2026-11-19/briefs-revised.md` §R7a）
- 基线：`894de06`（`test` 当前为 `d00739c`，本批 12 个文件与 `894de06` 完全一致，`git diff 894de06 -- <本批文件>` 为空）
- 范围：`git 8b97e48..081b604` 中下列文件的变更
- 验证：`npx tsc -b` 通过（无输出，exit 0）；`npx vitest run src/ui/PetCard.test.tsx src/ui/PetCompactCard.test.tsx src/ui/PetList.test.tsx src/ui/AccountFilterBar.test.tsx` 4 文件 17 用例全通过

## 一、已读文件与变更规模

| 文件 | 变更 |
| --- | --- |
| src/ui/PetCard.tsx | +96 −58 |
| src/ui/PetCard.test.tsx | +72 |
| src/ui/PetCardLayout.tsx | +157（新文件） |
| src/ui/PetCompactCard.tsx | +51 −145 |
| src/ui/PetCompactCard.test.tsx | +28 −17 |
| src/ui/PetList.tsx | +34 −97 |
| src/ui/PetList.test.tsx | +18 −16 |
| src/ui/FilterAccordion.tsx | +118 −36 |
| src/ui/AccountFilterBar.tsx | +105 −49 |
| src/ui/AccountFilterBar.test.tsx | +43 |
| src/ui/primitives/FilterPanel.tsx | +7 −3 |
| src/ui/ProgressCard.tsx | −4 |

关联调用方（只读确认）：src/ui/MyPets.tsx、src/ui/Collection.tsx、src/ui/Coverage.tsx、src/ui/Dashboard.tsx、src/ui/Home.tsx、src/ui/HomeDemandPlacements.tsx、src/ui/MotherGroupResources.tsx、src/ui/myPetsFilterStore.ts、e2e/my-pets.spec.ts。

## 二、审查重点逐条结论

1. **卡片布局重排后的断点与密集信息**：背包卡从自排版改为共享 `PetCardLayout`，并单独用 `size="tall"`（104px）。375px 下四列每卡宽约 79px，卡内同时放编号、蛋组、性格、性别、双奖牌、声音 dB、名字、高/重、位置，字号 6–8px，属于"能塞进去但没有余量"。三列模式的放大方式见 U01，需要截图才能定论。
2. **PetCompactCard / PetList 瘦身**：被删字段（每页条数、分页、`resetKey`、三列"声音/身高/体重"分栏）在 `src/` 内已无调用方（`tsc -b` 通过；全局检索 `PAGE_SIZES|resetKey|page-indicator|account-chip|pet-compact-medals` 仅命中 `e2e/`、`docs/` 和 `2026-11-17/` 历史打包目录）。空卡片风险：`PetCardLayout` 对"无编号 / 无蛋组"都有占位（PetCardLayout.tsx:81-97），不会出现破图；名字为空时标题为空串，与旧实现相同。
3. **FilterAccordion 展开态**：`activeId` 是字符串 state（FilterAccordion.tsx:50-51），维度数组每次重建也不会重置展开态；维度暂时消失时面板隐藏，再出现会恢复同一维度展开，符合预期。键盘：瓦片与选项都是原生 `button`，Enter/Space 可点，但面板容器没有 `role` / `aria-controls`，只能算建议。
4. **AccountFilterBar 互斥**：最后一项选中时按钮 `disabled`（AccountFilterBar.tsx:99），"全选"只在未全选时出现（:79-88），陈旧排除项不参与选择（:13 按 `accounts` 过滤），全部被排除时 effect 自动 `clearAccountFilter()`（:16-18）——与 `docs/产品交互规范.md:20`「至少保留一个已选账号，不能取消最后一项」一致；旧 e2e 里"全不选→0 只"的口径已失效，见 M03。
5. **props 契约变化**：`PetList` 由 `resetKey` 改为 `showCount/columns`；`AccountFilterBar` 新增 `compact`；`ProgressCard` 删除 `action`（Dashboard.tsx:229-248 两处调用未传 `action`，删除后无行为变化）。`tsc -b` 通过说明 `src/` 内无残留调用，唯一残留是 e2e 选择器（M03）。
6. **081b604 身高体重共用开关（简报已知线索）**：只有 `PetCard` 生效（PetCard.tsx:50-56），`PetCompactCard` 恒显示百分比（PetCompactCard.tsx:101）；开关只在精灵背包的筛选面板出现（MyPets.tsx:787-816），家园 / 需求中心没有该开关，因此**当前不构成"两个组件不同步"**。隐患在于卡片直接读全局 store，见 M02。

## 三、问题清单

### R7a-H01 · 高风险 · 500 只的账号一进精灵背包就一次性渲染全部卡片，滚动和搜索会卡

- ① 问题描述：分页被整体删除后 `PetList` 直接 `pets.map` 全量渲染（src/ui/PetList.tsx:45-53），`MyPets` 也不再切页、把完整结果一次传入（src/ui/MyPets.tsx:907-913）；用户影响是账号精灵多时首屏要建几百张卡、每次输入搜索词全量重渲染，安卓 WebView 上明显掉帧，触发条件是账号精灵数 ≥300 或在背包里输入搜索词（e2e/my-pets.spec.ts:181-213 的性能夹具就是 500 只）。（技术证据：PetList.tsx:45-53 无窗口化/无 `React.memo`；MyPets.tsx:907-913 传全量 `visiblePets`）
- ② 优化方案：A（推荐）保留「不分页」口径，在 `PetList` 内按可视区做窗口化：固定卡高（四列 104+6、三列按放大后高度）算出行数，只渲染当前屏 ±1 屏，`MyPets` 传参与现在一致；B 回退为 20/50/100 分页，需要用户重新确认口径。A 的代价约 60~80 行，要处理三列 `zoom` 下的行高换算与滚动锚点，且只影响背包页；风险是快速滚动时占位高度算错会出现白块。
- ③ 优化后表现：500 只账号滚动、搜索都不再卡顿；验收：导入 `e2e/my-pets.spec.ts:181-183` 同款 500 只夹具，打开「收集 → 精灵背包」，连续滚动 3 屏并在搜索框逐字输入，DevTools Performance 中无 >100ms 长任务（或对比改动前后的首帧耗时打点）。

### R7a-M01 · 中等 · 背包卡片改成 104px，与「所有独立精灵卡统一 98px」的规范不一致

- ① 问题描述：`PetCardLayout` 新增 `size="tall"`（104px）（src/ui/PetCardLayout.tsx:22-27、68），`PetCard` 固定用它（src/ui/PetCard.tsx:60），于是背包卡比家园 / 母本 / 需求中心卡高 6px、名字与详情行也各上移；用户影响是同一张"精灵卡"在不同页高度、字号不一致，视觉上像两套卡片，触发条件是把背包与家园 / 母本页并排看或来回切。（依据：docs/产品交互规范.md:73「所有独立精灵卡统一使用 PetCardLayout：卡片高 98px」、:88-89、:101，以及 :111「共享卡片的布局调整在 PetCardLayout 中完成，所有使用该布局的独立卡片需同步保持一致」）
- ② 优化方案：A 把 `tall` 档并回 `default` 98px，背包卡改用 6px 名字 + 8px 详情两行（改动约 6 行 CSS 类），代价是矮 6px 后"高/重"与位置行更挤；B 保留 104px，但需要把 `docs/产品交互规范.md` 与 `src/data/changelog.json` 一起登记"背包卡 104px、其余 98px"的新口径，否则文档与实现长期打架。推荐先确认 2026-11-18 的口径是否已把 104px 定稿，再决定 A/B。
- ③ 优化后表现：卡片高度口径只有一种，或文档/更新说明与实现一致；验收：`npx vitest run src/ui/PetCard.test.tsx`（:31 的 `h-[104px]` 断言随方案改）+ 375/390 下背包与家园并排截图对比。

### R7a-M02 · 中等 · 背包卡直接读全局筛选 store，卡片的显示不再由调用方决定

- ① 问题描述：`PetCard` 在渲染时直接调用 `getMyPetsSizeUnit()`（src/ui/PetCard.tsx:9、50），而不是像同目录紧凑卡那样把每个显示字段作为 props 传入（依据：参照 src/ui/PetCompactCard.tsx:34-53，全部数据走 props）；用户影响是：现在只有精灵背包能出现这个开关，切页/复用都靠"父组件恰好订阅了 store"（MyPets.tsx:229-264 的 `useMyPetsFilters`）才刷新，一旦给 `PetList`/`PetCard` 加 memo 或搬到母本页，开关切换后卡片不会更新；触发条件是后续复用这两个组件或做性能优化。
- ② 优化方案：给 `PetCard` 增加可选 `sizeUnit?: SizeUnit`，缺省仍取 store 值以兼容现有测试；`PetList` 透传，`MyPets` 用已订阅的 `sizeUnit` 传入。改动 2 个文件、约 10 行，无行为变化。
- ③ 优化后表现：卡片的显示只由入参决定，复用与 memo 都不再踩坑；验收：`npx vitest run src/ui/PetCard.test.tsx`，新增「传 prop 优先于 store」与「不传 prop 时仍跟 store」两个断言。

### R7a-M03 · 中等 · 「精灵背包」的旧 e2e 还在点已经不存在的分页与账号芯片，发版前验收会红

- ① 问题描述：`AccountFilterBar` 改成折叠摘要 + `account-filter-{账号}`（src/ui/AccountFilterBar.tsx:91-113），`PetList` 去掉了分页与 `page-indicator`（src/ui/PetList.tsx:33-53），但 e2e/my-pets.spec.ts:191-213 仍断言「第 1 / 25 页、每页 20 只」并点"上一页/下一页/50/100"，:261-271 仍点 `account-chip-测试乙` 与 `account-filter-toggle-all` 并期望"全不选 → 0 只"；用户影响是不直接可见，但这是发版前的自动化验收，现在必然失败，且旧用例覆盖的"0 只"口径已被 `docs/产品交互规范.md:20` 取代。（技术证据：e2e/my-pets.spec.ts:192、:206、:261、:269 选择器在 `src/` 已无对应实现）
- ② 优化方案：按新交互重写该 spec：分页用例改为"一次展示全部 500 张卡 + 无分页控件"；账号用例改为先点 `account-filter-summary` 展开、再点 `account-filter-测试乙` 排除并断言 4 只，删除"全不选"步骤、改断言最后一项 `disabled`。只改 e2e，不动业务代码；e2e 属 R9-6 批次，本批只报不改。
- ③ 优化后表现：`my-pets` 用例重新可用，发版前的 e2e 不再有已知红；验收：`npx playwright test e2e/my-pets.spec.ts` 通过，且全仓 `grep page-indicator e2e/` 为 0。

### R7a-U01 · 不确定（置信度中）· 三列模式的 `zoom: 1.35` 可能让卡片压到相邻列或产生横向滚动

- ① 问题描述：三列模式给每个 `<li>` 加 `style={{ zoom: 1.35 }}`（src/ui/PetList.tsx:19、28-29、46），网格仍是 `grid-cols-3`；用户影响是若 `zoom` 把布局盒一起放大，79px 级的三列格会溢出到隔壁，或右侧出现横向滚动；触发条件是切到"三列"且机型 360/375。静态读代码无法定论（Chromium 对 grid item 的 `zoom` 与 `transform` 处理不同）。
- ② 优化方案：以截图为准——A 若溢出，改成"卡宽 100%、内部字号/头像/奖牌整体 +35%"的显式三列样式；B 若正常，补一条 375/390 的视觉回归说明，保留 zoom。
- ③ 优化后表现：三列下卡片不叠、不横滚；验收：375 / 390 截图（需要真机或浏览器截图，审查阶段不跑 Playwright）。

### R7a-U02 · 不确定（置信度中）· 背包筛选面板的手风琴弹层以"行内右侧容器"为定位基准，可能右侧出屏

- ① 问题描述：`FilterAccordion` 的 popover 是 `absolute left-1/2 -translate-x-1/2 w-[calc(100vw-2rem)]`（src/ui/FilterAccordion.tsx:108），而它在背包页只占筛选行右半部分、最近的定位祖先是那一行（src/ui/MyPets.tsx:840-869）；用户影响是面板以偏右的中心点算 100vw 宽，右侧可能被切掉或整页横向滚动；触发条件是展开"性格 / 蛋组"等维度。
- ② 优化方案：把弹层定位改到 `FilterPanel` 级别的容器（`relative` 提到 `pet-filters` 卡片上）或用 `right-0` 对齐；先截图确认是否真的溢出再改。
- ③ 优化后表现：面板完整落在屏内、不横向滚动；验收：375 / 390 截图（同上）。

### R7a-L01 · 低 · AccountFilterBar 测试里留了一段无意义的 JSX 类型断言

`render(<AccountFilterBar accounts={[...]} compact/> as React.ReactElement<any, ...> | string | number | ...)`（src/ui/AccountFilterBar.test.tsx:30-31），每次渲染都要读一长串联合类型，没有任何类型收益，建议直接 `render(<AccountFilterBar accounts={['账号甲','账号乙']} compact />)`。

### R7a-L02 · 低 · 三个文件末行缺换行

src/ui/PetList.tsx、src/ui/FilterAccordion.tsx、src/ui/HomePairDiagram.tsx 结尾都是 `}\ No newline at end of file`，会让后续 diff 出现噪音，补一个换行即可。

### R7a-L03 · 低 · 体型奖牌的 alt 直接用了可能为空的奖牌名

`alt={pet.medalBody}`（src/ui/PetCard.tsx:77）在 `medalBody` 为 `undefined` 时会渲染成无 `alt` 的图片；虽然只在有奖牌图标时才渲染（`bodyIcon` 非空），但类型上仍是 `string | undefined`，建议 `alt={pet.medalBody ?? ''}`。

## 四、统计

| 风险 | 条数 | 编号 |
| --- | --- | --- |
| 高 | 1 | H01 |
| 中 | 3 | M01、M02、M03 |
| 低 | 3 | L01、L02、L03 |
| 不确定 | 2 | U01、U02 |
| 合计 | 9 | |

## 五、最该先修的三条

### 1. R7a-H01 · 高风险 · 500 只账号一次性渲染全部卡片

- ① 现状 / 影响 / 触发：见 H01；`PetList.tsx:45-53` 全量 `map`，`MyPets.tsx:907-913` 不分页；500 只夹具下首屏与搜索输入都会卡。
- ② 方案：保留"不分页"外观，在 `PetList` 内做窗口化（按固定卡高只渲可视区 ±1 屏）；代价 60~80 行、只影响背包页。
- ③ 表现与验收：500 只下滚动/搜索无明显长任务；验收见 H01 ③。

### 2. R7a-M03 · 中等 · 旧 e2e 与新交互脱节

- ① 现状 / 影响 / 触发：见 M03；`e2e/my-pets.spec.ts:191-213、261-271` 点的是已删除的分页与 `account-chip`，发版前 e2e 必红。
- ② 方案：按新 `account-filter-*` 与"全部展示"重写该 spec，不改业务代码。
- ③ 表现与验收：`npx playwright test e2e/my-pets.spec.ts` 通过；`e2e/` 内不再出现 `page-indicator`。

### 3. R7a-M01 · 中等 · 背包卡 104px 与共享卡片 98px 规范冲突

- ① 现状 / 影响 / 触发：见 M01；`PetCardLayout.tsx:68` 出现 98/104 两档，文档只写了 98（docs/产品交互规范.md:73）。
- ② 方案：并回 98px（A），或保留 104px 并同步文档 / changelog（B），先确认口径。
- ③ 表现与验收：口径唯一或文档一致；验收 `npx vitest run src/ui/PetCard.test.tsx` + 375/390 截图。

## 六、范围外备注

- `e2e/dashboard.spec.ts:399` 仍引用 `account-chip-*`（看板已不渲染 `AccountFilterBar`），属 R9-6 批次，本批只登记。
- `2026-11-17/pc-package/work/` 下有旧版 `PetList/PetCompactCard/AccountFilterBar` 的打包副本，是历史产物，不计入残留调用。
- `MyPets.tsx` 的筛选项计算、`speciesByGameId` 构建等在 R6a 范围，本批未重复审。
- `ProgressCard` 删除 `action` 后，可点卡片只剩点击行为、没有"去查看 ›"文字提示；当前 Dashboard 两处调用本来就没传 `action`，所以不是本批引入的观感变化，未计入风险。

## 七、待裁决清单

## src/ui/PetCard.tsx:59-60 + docs/产品交互规范.md:73 背包卡到底用 98px 还是 104px
- 现状：

```tsx
<PetCardLayout
  name={displayName}
  size="tall"
```
- 疑点：`PetCardLayout` 新增 `tall=104px`，而规范写"所有独立精灵卡统一 98px"，测试也把 104px 写死了（PetCard.test.tsx:31）。
- 我的倾向：2026-11-18 的口径大概率已经把背包卡定成 104px，规范漏同步；置信度中。
- 要裁决的：是"并回 98px"还是"保留 104px 并改文档"？

## src/ui/PetList.tsx:19-53 三列模式的 `zoom` 方案是否可接受
- 现状：

```tsx
const THREE_COLUMN_ZOOM = 1.35;
const zoomStyle = columns === 3 ? { zoom: THREE_COLUMN_ZOOM } : undefined;
```
- 疑点：`zoom` 作用在 grid item 上可能放大布局盒，导致三列卡片压到隔壁或横向滚动，静态代码无法确认。
- 我的倾向：先出 375/390 截图；若溢出就换成显式三列样式。置信度中。
- 要裁决的：是否允许为三列另写一套显式尺寸（不走 zoom）？

## src/ui/MyPets.tsx:907-913 「全部展示」是否允许内部窗口化
- 现状：

```tsx
<PetList pets={visiblePets} ... showCount={false} columns={columns} />
```
- 疑点：用户口径是"全部展示、不分页"，但一次渲染全量在 500 只时明显变慢；窗口化不改变"一次展示全部"的外观。
- 我的倾向：允许窗口化（只改渲染层，不改口径）。置信度中高。
- 要裁决的：是否可以引入虚拟滚动（外观仍是"一页到底"）？
