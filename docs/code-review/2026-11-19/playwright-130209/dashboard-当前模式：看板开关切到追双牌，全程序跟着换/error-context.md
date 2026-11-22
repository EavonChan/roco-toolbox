# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: dashboard.spec.ts >> 当前模式：看板开关切到追双牌，全程序跟着换
- Location: e2e\dashboard.spec.ts:336:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByTestId('inventory-grade-toggle')

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
      - button "账号筛选 1/1" [ref=e20] [cursor=pointer]:
        - generic [ref=e21]: 测试甲
        - generic [ref=e22]: 1/1
        - generic [aria-hidden] [ref=e23]: ⌄
      - button "精灵背包 共 4 只" [active] [pressed] [ref=e24] [cursor=pointer]:
        - generic [ref=e25]: 精灵背包
        - generic [ref=e26]: 共 4 只
      - button "母本" [ref=e27] [cursor=pointer]
      - button "种公" [ref=e29] [cursor=pointer]
  - main [ref=e31]:
    - generic [ref=e32]:
      - generic [ref=e33]: 搜索精灵名
      - searchbox "搜索精灵名" [ref=e35]
    - generic [ref=e36]:
      - generic [ref=e37]:
        - button "筛选" [expanded] [ref=e38] [cursor=pointer]: 筛选▲
        - generic [ref=e39]:
          - generic [ref=e40]: 身高体重
          - generic [ref=e41]:
            - button "百分比" [pressed] [ref=e42] [cursor=pointer]
            - button "数值" [ref=e43] [cursor=pointer]
        - generic [ref=e44]:
          - button "三列" [ref=e45] [cursor=pointer]
          - button "四列" [pressed] [ref=e46] [cursor=pointer]
        - button "重置" [ref=e47] [cursor=pointer]
      - generic [ref=e48]:
        - generic [ref=e49]:
          - generic [ref=e51]:
            - button "公" [ref=e52] [cursor=pointer]
            - button "母" [ref=e54] [cursor=pointer]
          - generic [ref=e58]:
            - button "异色" [ref=e59] [cursor=pointer]
            - button "异色炫彩" [disabled] [ref=e60]
            - button "炫彩" [disabled] [ref=e61]
          - generic [ref=e63]:
            - button "性格 不限 ▼" [ref=e64] [cursor=pointer]:
              - generic [ref=e65]: 性格
              - generic [ref=e66]:
                - generic [ref=e67]: 不限
                - generic [ref=e68]: ▼
            - button "蛋组 不限 ▼" [ref=e69] [cursor=pointer]:
              - generic [ref=e70]: 蛋组
              - generic [ref=e71]:
                - generic [ref=e72]: 不限
                - generic [ref=e73]: ▼
        - generic [ref=e76]:
          - generic [ref=e77]: "身高:"
          - generic [ref=e78]:
            - textbox "最低身高百分比" [ref=e79]: "0"
            - generic [ref=e80]: "%"
          - generic [ref=e81]: 至
          - generic [ref=e82]:
            - textbox "最高身高百分比" [ref=e83]: "100"
            - generic [ref=e84]: "%"
          - button "零身高" [ref=e85] [cursor=pointer]
          - button "满身高" [ref=e86] [cursor=pointer]
          - button "清除" [ref=e87] [cursor=pointer]
        - generic [ref=e88]:
          - generic [ref=e89]:
            - generic [ref=e90]: "体型:"
            - generic [ref=e91]:
              - button "不限" [pressed] [ref=e92] [cursor=pointer]
              - button "大块头" [ref=e93] [cursor=pointer]
              - button "小不点" [ref=e94] [cursor=pointer]
              - button "满体重" [disabled] [ref=e95]
              - button "零体重" [disabled] [ref=e96]
          - generic [ref=e97]:
            - generic [ref=e98]: "声音:"
            - generic [ref=e99]:
              - button "不限" [pressed] [ref=e100] [cursor=pointer]
              - button "婉转声" [ref=e101] [cursor=pointer]
              - button "粗嗓门" [disabled] [ref=e102]
              - button "+100" [ref=e103] [cursor=pointer]
              - button "-100" [disabled] [ref=e104]
    - list [ref=e106]:
      - listitem [ref=e107]:
        - article [ref=e108]:
          - generic [ref=e109]:
            - generic [ref=e110]:
              - generic [ref=e111]: No.263
              - generic [ref=e112]:
                - generic "机械组" [ref=e113]
                - generic "拟人组" [ref=e114]
              - img "异色" [ref=e116]
            - generic [ref=e117]:
              - generic [ref=e118]:
                - generic "母" [ref=e120]: ♀
                - generic "大胆" [ref=e122]
              - generic [ref=e123]:
                - generic [ref=e124]:
                  - img "大块头" [ref=e125]
                  - img "婉转声" [ref=e126]
                - generic "声音 100dB" [ref=e127]: 100dB
          - heading "机械方方" [level=3] [ref=e130]
          - generic [ref=e131]: 高— · 重98.4%
          - generic "测试甲·盒子01" [ref=e135]
      - listitem [ref=e136]:
        - article [ref=e137]:
          - generic [ref=e138]:
            - generic [ref=e139]:
              - generic [ref=e140]: No.011
              - generic "天空组" [ref=e142]
            - generic [ref=e143]:
              - generic [ref=e144]:
                - generic "公" [ref=e146]: ♂
                - generic "固执" [ref=e148]
              - generic [ref=e149]:
                - img "婉转声" [ref=e151]
                - generic "声音 96dB" [ref=e152]: 96dB
          - heading "鸭吉吉_等一等鸭" [level=3] [ref=e155]
          - generic [ref=e156]: 高— · 重55.2%
          - generic "测试甲·盒子01" [ref=e160]
      - listitem [ref=e161]:
        - article [ref=e162]:
          - generic [ref=e163]:
            - generic [ref=e164]:
              - generic [ref=e165]: No.002
              - generic [ref=e166]:
                - generic "动物组" [ref=e167]
                - generic "拟人组" [ref=e168]
            - generic [ref=e169]:
              - generic [ref=e170]:
                - generic "性别未知" [ref=e172]: "?"
                - generic "踏实" [ref=e174]
              - generic [ref=e175]:
                - img "小不点" [ref=e177]
                - generic "声音 40dB" [ref=e178]: 40dB
          - heading "喵喵" [level=3] [ref=e181]
          - generic [ref=e182]: 高— · 重0.8%
          - generic "测试甲·盒子02" [ref=e186]
      - listitem [ref=e187]:
        - article [ref=e188]:
          - generic [ref=e189]:
            - generic [ref=e190]:
              - generic [ref=e191]: No.005
              - generic [ref=e192]:
                - generic "魔力组" [ref=e193]
                - generic "巨灵组" [ref=e194]
            - generic [ref=e195]:
              - generic [ref=e196]:
                - generic "公" [ref=e198]: ♂
                - generic "固执" [ref=e200]
              - generic [ref=e201]:
                - generic [ref=e202]:
                  - img "大块头" [ref=e203]
                  - img "婉转声" [ref=e204]
                - generic "声音 100dB" [ref=e205]: 100dB
          - heading "火花" [level=3] [ref=e208]
          - generic [ref=e209]: 高— · 重99.1%
          - generic "测试甲·盒子01·3" [ref=e213]
```

# Test source

```ts
  251 |   page.on('dialog', (dialog) => dialog.accept());
  252 |   await openMoreData(page);
  253 |   await page.getByTestId('backup-input').setInputFiles(olderPath);
  254 |   const message = page.getByTestId('data-message');
  255 |   await expect(message).toContainText('新增 0 个账号');
  256 |   await expect(message).toContainText('更新 0 个');
  257 |   await expect(message).toContainText('保留本地较新的 1 个');
  258 | 
  259 |   // 本地那份没被空数据顶掉：精灵还在（我的精灵里能看到 fixture 里的机械方方）
  260 |   await openTab(page, '收集');
  261 |   await page.getByTestId('collection-kind-inventory').click();
  262 |   await expect(page.getByText('机械方方')).toBeVisible();
  263 | });
  264 | 
  265 | test('把备份文件从「导入抓包数据」入口塞进去，也能按合并导入处理', async ({ page }) => {
  266 |   await page.goto('/');
  267 |   await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  268 |   // 导入后停在导入页（不再自动跳看板），导出/导入入口都在这里
  269 |   await waitImported(page);
  270 | 
  271 |   // 导出一份真备份，模拟「微信收到备份 → 分享给小布助手」：走的就是这条入口。
  272 |   // 以前这里会被当成抓包解析而报错，现在按合并导入处理。
  273 |   await openMoreData(page);
  274 |   const [download] = await Promise.all([
  275 |     page.waitForEvent('download'),
  276 |     page.getByTestId('export-button').click(),
  277 |   ]);
  278 |   const backupPath = await download.path();
  279 |   await page.getByTestId('import-input').setInputFiles(backupPath as string);
  280 | 
  281 |   await expect(page.getByTestId('data-message')).toContainText('已合并导入');
  282 |   // 同一份数据 → 本地时间不比它旧 → 保留本地，不报错、也不清数据
  283 |   await expect(page.getByTestId('data-message')).toContainText('保留本地较新的 1 个');
  284 |   await expect(page.getByText('1 个账号')).toBeVisible();
  285 | });
  286 | 
  287 | test('用「合并导入」选抓包文件时给出可读错误', async ({ page }) => {
  288 |   await page.goto('/');
  289 |   await openMoreData(page);
  290 |   await page.getByTestId('backup-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  291 |   await expect(page.getByText(/不是小布助手的备份文件/)).toBeVisible();
  292 | });
  293 | 
  294 | test('母本按代表档位查看：四档分开计数，切换档位换列表', async ({ page }) => {
  295 |   await page.goto('/');
  296 |   await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  297 |   await expect(page.getByText('还没有数据')).toHaveCount(0);
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
> 351 |   await page.getByTestId('inventory-grade-toggle').click();
      |                                                    ^ Error: locator.click: Test timeout of 30000ms exceeded.
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
  398 |   await expect(page.getByTestId('account-filter-summary')).toContainText('(2/2)');
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
```