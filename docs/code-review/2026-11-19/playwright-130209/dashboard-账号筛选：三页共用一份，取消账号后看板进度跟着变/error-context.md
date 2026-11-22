# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard.spec.ts >> 账号筛选：三页共用一份，取消账号后看板进度跟着变
- Location: e2e\dashboard.spec.ts:383:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByTestId('account-filter-summary')
Expected substring: "(2/2)"
Error: strict mode violation: getByTestId('account-filter-summary') resolved to 2 elements:
    1) <button type="button" aria-expanded="false" aria-label="账号筛选 2/2" title="测试甲、测试乙 (2/2)" data-testid="account-filter-summary" class="flex min-h-[32px] min-w-0 w-full items-center rounded-lg border text-slate-700 shadow-sm hover:border-emerald-300 min-h-[44px] justify-center gap-0.5 px-1 text-[10px] border-slate-200 bg-white">…</button> aka getByTestId('collection-kinds').getByTestId('account-filter-summary')
    2) <button type="button" aria-expanded="false" title="测试甲、测试乙 (2/2)" data-testid="account-filter-summary" class="flex min-h-[32px] min-w-0 w-full items-center rounded-lg border text-slate-700 shadow-sm hover:border-emerald-300 gap-1 px-2 text-xs border-slate-200 bg-white">…</button> aka getByRole('button', { name: '测试甲 、测试乙 (2/2)' })

Call log:
  - Expect "toContainText" getByTestId('account-filter-summary') with timeout 5000ms
  - waiting for getByTestId('account-filter-summary')

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - banner [ref=e4]:
      - heading "小布助手" [level=1] [ref=e5]
      - generic [ref=e6]:
        - button "刷新" [ref=e7] [cursor=pointer]
        - button "教程" [ref=e8] [cursor=pointer]
    - navigation [ref=e9]:
      - button "看板" [ref=e10] [cursor=pointer]
      - button "家园" [ref=e11] [cursor=pointer]
      - button "收集" [ref=e12] [cursor=pointer]
      - button "附近" [ref=e13] [cursor=pointer]
      - button "小组" [ref=e14] [cursor=pointer]
      - button "我的" [ref=e15] [cursor=pointer]
  - navigation "收集视图" [ref=e16]:
    - generic [ref=e17]:
      - button "账号筛选 2/2" [ref=e20] [cursor=pointer]:
        - generic [ref=e21]: 测试甲
        - generic [ref=e22]: 2/2
        - generic [aria-hidden] [ref=e23]: ⌄
      - button "精灵背包" [ref=e24] [cursor=pointer]
      - button "母本" [ref=e26] [cursor=pointer]
      - button "种公" [active] [pressed] [ref=e28] [cursor=pointer]
  - main [ref=e30]:
    - generic [ref=e32]:
      - generic [ref=e33]: 账号
      - button "测试甲 、测试乙 (2/2)" [ref=e34] [cursor=pointer]:
        - generic [ref=e35]:
          - generic [ref=e36]: 测试甲
          - generic "测试乙" [ref=e37]: 、测试乙
        - generic [ref=e38]: (2/2)
        - generic [aria-hidden] [ref=e39]: ⌄
    - generic [ref=e40]:
      - heading "覆盖度· 追满分" [level=2] [ref=e41]:
        - text: 覆盖度
        - generic [ref=e42]: · 追满分
      - paragraph [ref=e43]:
        - text: 已通 0
        - generic [ref=e44]: / 14
        - text: 组
      - list [ref=e45]:
        - listitem [ref=e46]: 已通
        - listitem [ref=e48]: 可迭代
        - listitem [ref=e50]: 未收集
    - generic [ref=e52]:
      - heading "怎么看这页" [level=2] [ref=e53]
      - list [ref=e54]:
        - listitem [ref=e55]:
          - generic [aria-hidden] [ref=e56]: ·
          - generic [ref=e57]: 已通 N / 14 组按当前体型 × 声音目标算；点带数字的格子可以换代表种公
        - listitem [ref=e58]:
          - generic [aria-hidden] [ref=e59]: ·
          - generic [ref=e60]: 右上角「筛选」选蛋组与性格；奖牌组合在看板目标卡选择
        - listitem [ref=e61]:
          - generic [aria-hidden] [ref=e62]: ·
          - generic [ref=e63]: 淡黄格 = 还没收集的推荐种公，点一下加到小组需求中心
      - button "知道了" [ref=e65] [cursor=pointer]
    - generic [ref=e66]:
      - generic [ref=e67]:
        - generic [ref=e68]:
          - heading "种公阵列" [level=2] [ref=e69]
          - paragraph [ref=e70]: 跟随「覆盖度」目标 · 点带数字的格子换代表
        - button "筛选" [ref=e71] [cursor=pointer]: 筛选▼
      - group "阵列档位" [ref=e72]:
        - button "大婉" [pressed] [ref=e73] [cursor=pointer]
        - generic [ref=e74]: 左右滑动看更多性格 · 点缺口格可求蛋
      - table [ref=e76]:
        - rowgroup [ref=e86]:
          - row [ref=e87]:
            - columnheader "蛋组" [ref=e88]
            - columnheader "固执" [ref=e89]
            - columnheader "开朗" [ref=e90]
            - columnheader "沉默" [ref=e91]
            - columnheader "胆小" [ref=e92]
            - columnheader "平和" [ref=e93]
            - columnheader "聪明" [ref=e94]
            - columnheader "踏实" [ref=e95]
        - rowgroup [ref=e96]:
          - row [ref=e97]:
            - rowheader "巨灵组" [ref=e98]
            - cell [ref=e99]:
              - button "固执 种公 火花，共 1 只，点击选择代表" [ref=e100] [cursor=pointer]:
                - generic "火花" [ref=e102]
            - cell [ref=e103]:
              - button "瑰眼仔 荐" [ref=e104] [cursor=pointer]:
                - generic [ref=e105]: 瑰眼仔
                - generic [ref=e106]: 荐
            - cell "—" [ref=e107]
            - cell "—" [ref=e109]
            - cell [ref=e111]:
              - button "白发懒人 荐" [ref=e112] [cursor=pointer]:
                - generic [ref=e113]: 白发懒人
                - generic [ref=e114]: 荐
            - cell "—" [ref=e115]
            - cell "—" [ref=e117]
          - row [ref=e119]:
            - rowheader "两栖组" [ref=e120]
            - cell [ref=e121]:
              - button "草头鸭 荐" [ref=e122] [cursor=pointer]:
                - generic [ref=e123]: 草头鸭
                - generic [ref=e124]: 荐
            - cell [ref=e125]:
              - button "草头鸭 荐" [ref=e126] [cursor=pointer]:
                - generic [ref=e127]: 草头鸭
                - generic [ref=e128]: 荐
            - cell [ref=e129]:
              - button "波波螺 荐" [ref=e130] [cursor=pointer]:
                - generic [ref=e131]: 波波螺
                - generic [ref=e132]: 荐
            - cell "—" [ref=e133]
            - cell "—" [ref=e135]
            - cell "—" [ref=e137]
            - cell "—" [ref=e139]
          - row [ref=e141]:
            - rowheader "昆虫组" [ref=e142]
            - cell "—" [ref=e143]
            - cell [ref=e145]:
              - button "瑰眼仔 荐" [ref=e146] [cursor=pointer]:
                - generic [ref=e147]: 瑰眼仔
                - generic [ref=e148]: 荐
            - cell "—" [ref=e149]
            - cell "—" [ref=e151]
            - cell [ref=e153]:
              - button "瑰眼仔 荐" [ref=e154] [cursor=pointer]:
                - generic [ref=e155]: 瑰眼仔
                - generic [ref=e156]: 荐
            - cell [ref=e157]:
              - button "毛毛 荐" [ref=e158] [cursor=pointer]:
                - generic [ref=e159]: 毛毛
                - generic [ref=e160]: 荐
            - cell "—" [ref=e161]
          - row [ref=e163]:
            - rowheader "天空组" [ref=e164]
            - cell [ref=e165]:
              - button "小狮鹫 荐" [ref=e166] [cursor=pointer]:
                - generic [ref=e167]: 小狮鹫
                - generic [ref=e168]: 荐
            - cell [ref=e169]:
              - button "小狮鹫 荐" [ref=e170] [cursor=pointer]:
                - generic [ref=e171]: 小狮鹫
                - generic [ref=e172]: 荐
            - cell "—" [ref=e173]
            - cell [ref=e175]:
              - button "风铃鲨 荐" [ref=e176] [cursor=pointer]:
                - generic [ref=e177]: 风铃鲨
                - generic [ref=e178]: 荐
            - cell "—" [ref=e179]
            - cell "—" [ref=e181]
            - cell "—" [ref=e183]
          - row [ref=e185]:
            - rowheader "动物组" [ref=e186]
            - cell [ref=e187]:
              - button "小狮鹫 荐" [ref=e188] [cursor=pointer]:
                - generic [ref=e189]: 小狮鹫
                - generic [ref=e190]: 荐
            - cell [ref=e191]:
              - button "小狮鹫 荐" [ref=e192] [cursor=pointer]:
                - generic [ref=e193]: 小狮鹫
                - generic [ref=e194]: 荐
            - cell [ref=e195]:
              - button "小鼠獭 荐" [ref=e196] [cursor=pointer]:
                - generic [ref=e197]: 小鼠獭
                - generic [ref=e198]: 荐
            - cell "—" [ref=e199]
            - cell "—" [ref=e201]
            - cell "—" [ref=e203]
            - cell "—" [ref=e205]
          - row [ref=e207]:
            - rowheader "妖精组" [ref=e208]
            - cell [ref=e209]:
              - button "水滴蛇 荐" [ref=e210] [cursor=pointer]:
                - generic [ref=e211]: 水滴蛇
                - generic [ref=e212]: 荐
            - cell [ref=e213]:
              - button "书魔虫 荐" [ref=e214] [cursor=pointer]:
                - generic [ref=e215]: 书魔虫
                - generic [ref=e216]: 荐
            - cell "—" [ref=e217]
            - cell [ref=e219]:
              - button "梦游 荐" [ref=e220] [cursor=pointer]:
                - generic [ref=e221]: 梦游
                - generic [ref=e222]: 荐
            - cell "—" [ref=e223]
            - cell "—" [ref=e225]
            - cell "—" [ref=e227]
          - row [ref=e229]:
            - rowheader "植物组" [ref=e230]
            - cell "—" [ref=e231]
            - cell "—" [ref=e233]
            - cell [ref=e235]:
              - button "兽花蕾 荐" [ref=e236] [cursor=pointer]:
                - generic [ref=e237]: 兽花蕾
                - generic [ref=e238]: 荐
            - cell [ref=e239]:
              - button "海枝枝 荐" [ref=e240] [cursor=pointer]:
                - generic [ref=e241]: 海枝枝
                - generic [ref=e242]: 荐
            - cell "—" [ref=e243]
            - cell "—" [ref=e245]
            - cell [ref=e247]:
              - button "小灵菇 荐" [ref=e248] [cursor=pointer]:
                - generic [ref=e249]: 小灵菇
                - generic [ref=e250]: 荐
          - row [ref=e251]:
            - rowheader "拟人组" [ref=e252]
            - cell [ref=e253]:
              - button "小怂猫 荐" [ref=e254] [cursor=pointer]:
                - generic [ref=e255]: 小怂猫
                - generic [ref=e256]: 荐
            - cell [ref=e257]:
              - button "霹雳宝宝 荐" [ref=e258] [cursor=pointer]:
                - generic [ref=e259]: 霹雳宝宝
                - generic [ref=e260]: 荐
            - cell "—" [ref=e261]
            - cell "—" [ref=e263]
            - cell [ref=e265]:
              - button "白发懒人 荐" [ref=e266] [cursor=pointer]:
                - generic [ref=e267]: 白发懒人
                - generic [ref=e268]: 荐
            - cell "—" [ref=e269]
            - cell "—" [ref=e271]
          - row [ref=e273]:
            - rowheader "软体组" [ref=e274]
            - cell [ref=e275]:
              - button "矿晶虫 荐" [ref=e276] [cursor=pointer]:
                - generic [ref=e277]: 矿晶虫
                - generic [ref=e278]: 荐
            - cell "—" [ref=e279]
            - cell "—" [ref=e281]
            - cell [ref=e283]:
              - button "脆筒甜甜 荐" [ref=e284] [cursor=pointer]:
                - generic [ref=e285]: 脆筒甜甜
                - generic [ref=e286]: 荐
            - cell "—" [ref=e287]
            - cell [ref=e289]:
              - button "翡翠水母 荐" [ref=e290] [cursor=pointer]:
                - generic [ref=e291]: 翡翠水母
                - generic [ref=e292]: 荐
            - cell "—" [ref=e293]
          - row [ref=e295]:
            - rowheader "大地组" [ref=e296]
            - cell [ref=e297]:
              - button "矿晶虫 荐" [ref=e298] [cursor=pointer]:
                - generic [ref=e299]: 矿晶虫
                - generic [ref=e300]: 荐
            - cell "—" [ref=e301]
            - cell [ref=e303]:
              - button "波波螺 荐" [ref=e304] [cursor=pointer]:
                - generic [ref=e305]: 波波螺
                - generic [ref=e306]: 荐
            - cell "—" [ref=e307]
            - cell [ref=e309]:
              - button "布是石 荐" [ref=e310] [cursor=pointer]:
                - generic [ref=e311]: 布是石
                - generic [ref=e312]: 荐
            - cell "—" [ref=e313]
            - cell "—" [ref=e315]
          - row [ref=e317]:
            - rowheader "魔力组" [ref=e318]
            - cell [ref=e319]:
              - button "固执 种公 火花，共 1 只，点击选择代表" [ref=e320] [cursor=pointer]:
                - generic "火花" [ref=e322]
            - cell "—" [ref=e323]
            - cell "—" [ref=e325]
            - cell [ref=e327]:
              - button "梦游 荐" [ref=e328] [cursor=pointer]:
                - generic [ref=e329]: 梦游
                - generic [ref=e330]: 荐
            - cell "—" [ref=e331]
            - cell [ref=e333]:
              - button "果冻 荐" [ref=e334] [cursor=pointer]:
                - generic [ref=e335]: 果冻
                - generic [ref=e336]: 荐
            - cell "—" [ref=e337]
          - row [ref=e339]:
            - rowheader "海洋组" [ref=e340]
            - cell "—" [ref=e341]
            - cell "—" [ref=e343]
            - cell [ref=e345]:
              - button "花怨鳗 荐" [ref=e346] [cursor=pointer]:
                - generic [ref=e347]: 花怨鳗
                - generic [ref=e348]: 荐
            - cell [ref=e349]:
              - button "海枝枝 荐" [ref=e350] [cursor=pointer]:
                - generic [ref=e351]: 海枝枝
                - generic [ref=e352]: 荐
            - cell "—" [ref=e353]
            - cell [ref=e355]:
              - button "翡翠水母 荐" [ref=e356] [cursor=pointer]:
                - generic [ref=e357]: 翡翠水母
                - generic [ref=e358]: 荐
            - cell "—" [ref=e359]
          - row [ref=e361]:
            - rowheader "龙组" [ref=e362]
            - cell [ref=e363]:
              - button "小翼龙 荐" [ref=e364] [cursor=pointer]:
                - generic [ref=e365]: 小翼龙
                - generic [ref=e366]: 荐
            - cell [ref=e367]:
              - button "豆丁鱼 荐" [ref=e368] [cursor=pointer]:
                - generic [ref=e369]: 豆丁鱼
                - generic [ref=e370]: 荐
            - cell "—" [ref=e371]
            - cell "—" [ref=e373]
            - cell "—" [ref=e375]
            - cell [ref=e377]:
              - button "伊雷龙 荐" [ref=e378] [cursor=pointer]:
                - generic [ref=e379]: 伊雷龙
                - generic [ref=e380]: 荐
            - cell "—" [ref=e381]
          - row [ref=e383]:
            - rowheader "机械组" [ref=e384]
            - cell [ref=e385]:
              - button "螺旋帕帕 荐" [ref=e386] [cursor=pointer]:
                - generic [ref=e387]: 螺旋帕帕
                - generic [ref=e388]: 荐
            - cell "—" [ref=e389]
            - cell [ref=e391]:
              - button "贝瑟 荐" [ref=e392] [cursor=pointer]:
                - generic [ref=e393]: 贝瑟
                - generic [ref=e394]: 荐
            - cell "—" [ref=e395]
            - cell [ref=e397]:
              - button "多西 荐" [ref=e398] [cursor=pointer]:
                - generic [ref=e399]: 多西
                - generic [ref=e400]: 荐
            - cell "—" [ref=e401]
            - cell "—" [ref=e403]
    - heading "缺口明细（按蛋组）" [level=2] [ref=e405]
    - list [ref=e406]:
      - listitem [ref=e407]:
        - button "两栖组 0 / 3" [ref=e408] [cursor=pointer]:
          - generic [ref=e409]: 两栖组
          - generic [ref=e412]:
            - generic [ref=e413]: 0 / 3
            - generic [aria-hidden] [ref=e414]: ▼
      - listitem [ref=e415]:
        - button "昆虫组 0 / 3" [ref=e416] [cursor=pointer]:
          - generic [ref=e417]: 昆虫组
          - generic [ref=e420]:
            - generic [ref=e421]: 0 / 3
            - generic [aria-hidden] [ref=e422]: ▼
      - listitem [ref=e423]:
        - button "天空组 0 / 3" [ref=e424] [cursor=pointer]:
          - generic [ref=e425]: 天空组
          - generic [ref=e428]:
            - generic [ref=e429]: 0 / 3
            - generic [aria-hidden] [ref=e430]: ▼
      - listitem [ref=e431]:
        - button "动物组 0 / 3" [ref=e432] [cursor=pointer]:
          - generic [ref=e433]: 动物组
          - generic [ref=e436]:
            - generic [ref=e437]: 0 / 3
            - generic [aria-hidden] [ref=e438]: ▼
      - listitem [ref=e439]:
        - button "妖精组 0 / 3" [ref=e440] [cursor=pointer]:
          - generic [ref=e441]: 妖精组
          - generic [ref=e444]:
            - generic [ref=e445]: 0 / 3
            - generic [aria-hidden] [ref=e446]: ▼
      - listitem [ref=e447]:
        - button "植物组 0 / 3" [ref=e448] [cursor=pointer]:
          - generic [ref=e449]: 植物组
          - generic [ref=e452]:
            - generic [ref=e453]: 0 / 3
            - generic [aria-hidden] [ref=e454]: ▼
      - listitem [ref=e455]:
        - button "拟人组 0 / 3" [ref=e456] [cursor=pointer]:
          - generic [ref=e457]: 拟人组
          - generic [ref=e460]:
            - generic [ref=e461]: 0 / 3
            - generic [aria-hidden] [ref=e462]: ▼
      - listitem [ref=e463]:
        - button "软体组 0 / 3" [ref=e464] [cursor=pointer]:
          - generic [ref=e465]: 软体组
          - generic [ref=e468]:
            - generic [ref=e469]: 0 / 3
            - generic [aria-hidden] [ref=e470]: ▼
      - listitem [ref=e471]:
        - button "大地组 0 / 3" [ref=e472] [cursor=pointer]:
          - generic [ref=e473]: 大地组
          - generic [ref=e476]:
            - generic [ref=e477]: 0 / 3
            - generic [aria-hidden] [ref=e478]: ▼
      - listitem [ref=e479]:
        - button "海洋组 0 / 3" [ref=e480] [cursor=pointer]:
          - generic [ref=e481]: 海洋组
          - generic [ref=e484]:
            - generic [ref=e485]: 0 / 3
            - generic [aria-hidden] [ref=e486]: ▼
      - listitem [ref=e487]:
        - button "龙组 0 / 3" [ref=e488] [cursor=pointer]:
          - generic [ref=e489]: 龙组
          - generic [ref=e492]:
            - generic [ref=e493]: 0 / 3
            - generic [aria-hidden] [ref=e494]: ▼
      - listitem [ref=e495]:
        - button "机械组 0 / 3" [ref=e496] [cursor=pointer]:
          - generic [ref=e497]: 机械组
          - generic [ref=e500]:
            - generic [ref=e501]: 0 / 3
            - generic [aria-hidden] [ref=e502]: ▼
      - listitem [ref=e503]:
        - button "巨灵组 1 / 3" [ref=e504] [cursor=pointer]:
          - generic [ref=e505]: 巨灵组
          - generic [ref=e508]:
            - generic [ref=e509]: 1 / 3
            - generic [aria-hidden] [ref=e510]: ▼
      - listitem [ref=e511]:
        - button "魔力组 1 / 3" [ref=e512] [cursor=pointer]:
          - generic [ref=e513]: 魔力组
          - generic [ref=e516]:
            - generic [ref=e517]: 1 / 3
            - generic [aria-hidden] [ref=e518]: ▼
    - generic [ref=e519]:
      - paragraph [ref=e520]:
        - text: 数据来源：
        - link "洛克王国：世界 Wiki" [ref=e521] [cursor=pointer]:
          - /url: https://wiki.biligame.com/nrc/
        - text: （洛克王国：世界 Wiki (wiki.biligame.com/nrc)，版本 s5-2026-10-31）
      - paragraph [ref=e522]:
        - text: 内容以
        - link "CC BY-SA 4.0" [ref=e523] [cursor=pointer]:
          - /url: https://creativecommons.org/licenses/by-sa/4.0/
        - text: 许可授权。
```

# Test source

```ts
  298 |   await waitImported(page);
  299 | 
  300 |   // 2026-10-24：完整档位库存从看板迁到「收集 · 精灵库」的固定次入口
  301 |   await openTab(page, '收集');
  302 |   await page.getByTestId('collection-kind-inventory').click();
  303 |   await page.getByTestId('inventory-grade-toggle').click();
  304 | 
  305 |   // 档位是页内下拉栏：默认显示满分大婉（带计数）
  306 |   const gradeSelect = page.getByTestId('mother-grade-select');
  307 |   await expect(gradeSelect).toContainText(/满分大婉 \(\d+\)/);
  308 | 
  309 |   await expect(page.getByTestId('mother-filter-title')).toContainText('按代表档位查看');
  310 |   // 点开下拉栏：4 个档位都在
  311 |   await gradeSelect.click();
  312 |   const gradeOptions = page.getByTestId('mother-grade-options');
  313 |   await expect(gradeOptions).toBeVisible();
  314 |   await expect(gradeOptions.getByRole('radio')).toHaveCount(4);
  315 | 
  316 |   // 母本列表默认收起，先展开再断言内容（2026-10-04 优化）
  317 |   await page.getByTestId('mother-list-toggle').click();
  318 | 
  319 |   // fixture 里「机械方方」是母本 · 大块头 · 100dB → 属于满分大婉，列表里能看到它的账号与盒子
  320 |   const rows = page.getByTestId('mother-filter-row');
  321 |   await expect(rows.first()).toContainText('机械方方');
  322 |   await expect(rows.first()).toContainText('（');
  323 |   await expect(rows.first()).toContainText('盒子');
  324 |   // 母本列表按账号聚拢：账号作为分组标题
  325 |   await expect(page.getByTestId('account-section').first()).toBeVisible();
  326 | 
  327 |   // 切到满分小婉（fixture 里没有）→ 列表为空、下拉选中项跟着换（选择档位会自动展开列表）。
  328 |   // 展开母本列表那一下算「点外部」，下拉已收起（2026-10-24 统一单选：外点关闭），这里重新打开再选
  329 |   await gradeSelect.click();
  330 |   await page.getByTestId('mother-grade-option-小婉').click();
  331 |   await expect(gradeSelect).toContainText(/满分小婉/);
  332 |   await expect(page.getByTestId('mother-filter-result')).toContainText('这个档位暂时没有合格的母本');
  333 |   await expect(page.getByTestId('mother-filter-result')).toBeVisible();
  334 | });
  335 | 
  336 | test('当前模式：看板开关切到追双牌，全程序跟着换', async ({ page }) => {
  337 |   await page.goto('/');
  338 |   await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  339 |   await expect(page.getByText('还没有数据')).toHaveCount(0);
  340 |   await waitImported(page);
  341 |   await openTab(page, '看板');
  342 | 
  343 |   // 默认追满分
  344 |   await expect(page.getByTestId('target-mode-perfect')).toHaveAttribute('aria-pressed', 'true');
  345 | 
  346 |   await page.getByTestId('target-mode-medal').click();
  347 |   await expect(page.getByTestId('target-mode-medal')).toHaveAttribute('aria-pressed', 'true');
  348 |   // 档位库存已迁到「收集 · 精灵库」的次入口；选项不再带「满分」前缀
  349 |   await openTab(page, '收集');
  350 |   await page.getByTestId('collection-kind-inventory').click();
  351 |   await page.getByTestId('inventory-grade-toggle').click();
  352 |   await page.getByTestId('mother-grade-select').click();
  353 |   await expect(page.getByTestId('mother-grade-option-大婉')).toHaveText(/^大婉 \(\d+\)$/);
  354 | 
  355 |   // 覆盖度页显示当前模式
  356 |   await openTab(page, '收集');
  357 |   await page.getByTestId('collection-kind-studs').click();
  358 |   await expect(page.getByTestId('coverage-mode')).toContainText('追双牌');
  359 | 
  360 |   // 刷新后模式还在（持久化在本机）；页签也留在原处（关后台回来不丢位置）
  361 |   await page.reload();
  362 |   await expect(page.getByTestId('coverage-mode')).toContainText('追双牌');
  363 |   await openTab(page, '看板');
  364 |   await expect(page.getByTestId('target-mode-medal')).toHaveAttribute('aria-pressed', 'true');
  365 | });
  366 | 
  367 | test('导入报告：性格不在目标池的合格公也会被列出', async ({ page }) => {
  368 |   await page.goto('/');
  369 |   await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-offtarget-stud.json');
  370 |   // 2026-10-25 起导入后停在导入页；「本次新增」卡片在看板（2026-10-05 移至看板）
  371 |   await waitImported(page);
  372 |   await openTab(page, '看板');
  373 | 
  374 |   const card = page.getByTestId('import-result');
  375 |   await expect(card).toBeVisible();
  376 |   // 「满分小婉 · 懒散」的公：懒散不在任何目标性格池里，但必须出现在「新增种公」
  377 |   const stud = card.getByTestId('import-result-stud').first();
  378 |   await expect(stud).toContainText('梦游');
  379 |   await expect(stud).toContainText('懒散');
  380 |   await expect(stud).toContainText('100dB');
  381 | });
  382 | 
  383 | test('账号筛选：三页共用一份，取消账号后看板进度跟着变', async ({ page }) => {
  384 |   await page.goto('/');
  385 |   await page.getByTestId('import-input').setInputFiles([
  386 |     'src/domain/__fixtures__/backup-sample.json',
  387 |     'src/domain/__fixtures__/backup-sample-2.json',
  388 |   ]);
  389 |   await expect(page.getByText('还没有数据')).toHaveCount(0);
  390 |   await waitImported(page);
  391 |   await openTab(page, '看板');
  392 | 
  393 |   await expect(page.getByTestId('dashboard-account-summary')).toContainText('(2/2)');
  394 | 
  395 |   // 覆盖度页是同一个 store：那边取消一个账号，看板这边也是 1/2
  396 |   await openTab(page, '收集');
  397 |   await page.getByTestId('collection-kind-studs').click();
> 398 |   await expect(page.getByTestId('account-filter-summary')).toContainText('(2/2)');
      |                                                            ^ Error: expect(locator).toContainText(expected) failed
  399 |   await page.getByTestId('account-filter-summary').click();
  400 |   await page.getByTestId('account-filter-测试乙').click();
  401 |   await expect(page.getByTestId('account-filter-summary')).toContainText('(1/2)');
  402 | 
  403 |   await openTab(page, '看板');
  404 |   await expect(page.getByTestId('dashboard-account-summary')).toContainText('(1/2)');
  405 | 
  406 |   // 「全不选」已被禁止：只剩一个账号时不可再取消，改点「全选」恢复
  407 |   await page.getByTestId('dashboard-account-summary').click();
  408 |   await expect(page.getByTestId('dashboard-account-测试甲')).toBeDisabled();
  409 |   await page.getByTestId('dashboard-account-select-all').click();
  410 |   await expect(page.getByTestId('dashboard-account-summary')).toContainText('(2/2)');
  411 | });
  412 | 
  413 | test('种公全收集卡可点：跳收集 · 种公阵列', async ({ page }) => {
  414 |   await page.goto('/');
  415 |   await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  416 |   await expect(page.getByText('还没有数据')).toHaveCount(0);
  417 |   await waitImported(page);
  418 |   await openTab(page, '看板');
  419 | 
  420 |   await page.getByTestId('progress-card-action-stud').click();
  421 |   // 只有「收集 · 种公阵列」这个落点才成立的强断言（旧「我的精灵 · 种公视角」已删除）
  422 |   await expect(page.getByTestId('collection-kind-studs')).toHaveAttribute('aria-pressed', 'true');
  423 |   await expect(page.getByTestId('stud-matrix')).toBeVisible();
  424 |   await expect(page.getByTestId('collection-kind-inventory')).not.toHaveAttribute(
  425 |     'aria-pressed',
  426 |     'true',
  427 |   );
  428 | });
  429 | 
  430 | test('跳转后落在目标页顶部：切页签会重置滚动位置', async ({ page }) => {
  431 |   await page.goto('/');
  432 |   await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  433 |   await waitImported(page);
  434 |   await openTab(page, '看板');
  435 |   await expect(page.getByRole('heading', { name: '种公全收集' })).toBeVisible();
  436 | 
  437 |   // 把看板滚到底：页面够长，滚动偏移一定 > 0
  438 |   await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  439 |   await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  440 | 
  441 |   // 切到覆盖度（目标页比视口高：不重置的话会沿用看板的旧偏移，跳转位置不准）
  442 |   await openTab(page, '收集');
  443 |   await page.getByTestId('collection-kind-studs').click();
  444 |   await expect(page.getByTestId('coverage-mode')).toBeVisible();
  445 |   await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  446 | });
  447 | 
  448 | test('一次导入两个文件后账号数显示为 2', async ({ page }) => {
  449 |   await page.goto('/');
  450 |   await page.getByTestId('import-input').setInputFiles([
  451 |     'src/domain/__fixtures__/backup-sample.json',
  452 |     'src/domain/__fixtures__/backup-sample-2.json',
  453 |   ]);
  454 |   // 导入后停在导入页（不再自动跳看板），「N 个账号」就在这里
  455 |   await waitImported(page);
  456 |   await expect(page.getByText('2 个账号')).toBeVisible();
  457 | });
  458 | 
  459 | test.describe('本次导入新增', () => {
  460 |   test('按账号分组，只列合要求的精灵并标明盒子位置（卡片在看板）', async ({ page }) => {
  461 |     await page.goto('/');
  462 |     await page.getByTestId('import-input').setInputFiles([
  463 |       'src/domain/__fixtures__/backup-sample.json',
  464 |       'src/domain/__fixtures__/backup-sample-2.json',
  465 |     ]);
  466 |     // 2026-10-25 起导入后停在导入页；卡片仍在看板（2026-10-05 移至看板）
  467 |     await waitImported(page);
  468 |     await openTab(page, '看板');
  469 | 
  470 |     const card = page.getByTestId('import-result');
  471 |     await expect(card).toBeVisible();
  472 | 
  473 |     // 按账号分组：测试甲有货、测试乙没有
  474 |     const accounts = card.getByTestId('import-result-account');
  475 |     await expect(accounts).toHaveCount(2);
  476 |     await expect(accounts.first()).toContainText('测试甲');
  477 |     await expect(accounts.nth(1)).toContainText('测试乙');
  478 |     await expect(accounts.nth(1)).toContainText('没有新增符合要求的精灵');
  479 | 
  480 |     // 火花：大块头 + 100dB + 公 + 固执 → 满分大婉种公；标出蛋组与盒子位置
  481 |     const stud = card.getByTestId('import-result-stud').first();
  482 |     await expect(stud).toContainText('火花');
  483 |     await expect(stud).toContainText('巨灵组');
  484 |     await expect(stud).toContainText('盒子01 第3位');
  485 | 
  486 |     // 机械方方：大块头 + 100dB 母本 → 分到「满分大婉」档，并标出盒子位置
  487 |     await expect(accounts.first()).toContainText('新增满分大婉种公 1');
  488 |     await expect(accounts.first()).toContainText('新增满分大婉母本 1');
  489 |     await expect(card.getByTestId('import-result-mother').first()).toContainText('机械方方');
  490 |     await expect(card.getByTestId('import-result-mother').first()).toContainText('盒子01');
  491 |   });
  492 | 
  493 |   test('同一份数据再导入一次 → 没有新增（不会把老精灵当成新抓的）', async ({ page }) => {
  494 |     await page.goto('/');
  495 |     await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  496 |     // 导入后停在导入页；「本次新增」卡片在看板
  497 |     await waitImported(page);
  498 |     await openTab(page, '看板');
```