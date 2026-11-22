# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: my-pets.spec.ts >> 账号同类取并集；标签数量随选择动态更新且为 0 时置灰
- Location: e2e\my-pets.spec.ts:236:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByTestId('filter-tile-body')

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
      - generic [ref=e18]:
        - button "账号筛选 2/2" [expanded] [ref=e20] [cursor=pointer]:
          - generic [ref=e21]: 测试甲
          - generic [ref=e22]: 2/2
          - generic [aria-hidden] [ref=e23]: ⌃
        - generic [ref=e24]:
          - generic [ref=e25]: 至少选择一个账号
          - group "账号选择" [ref=e27]:
            - button "测试甲" [pressed] [ref=e28] [cursor=pointer]
            - button "测试乙" [pressed] [ref=e29] [cursor=pointer]
      - button "精灵背包 共 6 只" [pressed] [ref=e30] [cursor=pointer]:
        - generic [ref=e31]: 精灵背包
        - generic [ref=e32]: 共 6 只
      - button "母本" [ref=e33] [cursor=pointer]
      - button "种公" [ref=e35] [cursor=pointer]
  - main [ref=e37]:
    - generic [ref=e38]:
      - generic [ref=e39]: 搜索精灵名
      - searchbox "搜索精灵名" [ref=e41]
    - generic [ref=e42]:
      - generic [ref=e43]:
        - button "筛选" [expanded] [ref=e44] [cursor=pointer]: 筛选▲
        - generic [ref=e45]:
          - generic [ref=e46]: 身高体重
          - generic [ref=e47]:
            - button "百分比" [pressed] [ref=e48] [cursor=pointer]
            - button "数值" [ref=e49] [cursor=pointer]
        - generic [ref=e50]:
          - button "三列" [ref=e51] [cursor=pointer]
          - button "四列" [pressed] [ref=e52] [cursor=pointer]
        - button "重置" [ref=e53] [cursor=pointer]
      - generic [ref=e54]:
        - generic [ref=e55]:
          - generic [ref=e57]:
            - button "公" [ref=e58] [cursor=pointer]
            - button "母" [ref=e60] [cursor=pointer]
          - generic [ref=e64]:
            - button "异色" [ref=e65] [cursor=pointer]
            - button "异色炫彩" [disabled] [ref=e66]
            - button "炫彩" [disabled] [ref=e67]
          - generic [ref=e69]:
            - button "性格 不限 ▼" [ref=e70] [cursor=pointer]:
              - generic [ref=e71]: 性格
              - generic [ref=e72]:
                - generic [ref=e73]: 不限
                - generic [ref=e74]: ▼
            - button "蛋组 不限 ▼" [ref=e75] [cursor=pointer]:
              - generic [ref=e76]: 蛋组
              - generic [ref=e77]:
                - generic [ref=e78]: 不限
                - generic [ref=e79]: ▼
        - generic [ref=e82]:
          - generic [ref=e83]: "身高:"
          - generic [ref=e84]:
            - textbox "最低身高百分比" [ref=e85]: "0"
            - generic [ref=e86]: "%"
          - generic [ref=e87]: 至
          - generic [ref=e88]:
            - textbox "最高身高百分比" [ref=e89]: "100"
            - generic [ref=e90]: "%"
          - button "零身高" [ref=e91] [cursor=pointer]
          - button "满身高" [ref=e92] [cursor=pointer]
          - button "清除" [ref=e93] [cursor=pointer]
        - generic [ref=e94]:
          - generic [ref=e95]:
            - generic [ref=e96]: "体型:"
            - generic [ref=e97]:
              - button "不限" [pressed] [ref=e98] [cursor=pointer]
              - button "大块头" [ref=e99] [cursor=pointer]
              - button "小不点" [ref=e100] [cursor=pointer]
              - button "满体重" [disabled] [ref=e101]
              - button "零体重" [disabled] [ref=e102]
          - generic [ref=e103]:
            - generic [ref=e104]: "声音:"
            - generic [ref=e105]:
              - button "不限" [pressed] [ref=e106] [cursor=pointer]
              - button "婉转声" [ref=e107] [cursor=pointer]
              - button "粗嗓门" [disabled] [ref=e108]
              - button "+100" [ref=e109] [cursor=pointer]
              - button "-100" [disabled] [ref=e110]
    - list [ref=e112]:
      - listitem [ref=e113]:
        - article [ref=e114]:
          - generic [ref=e115]:
            - generic [ref=e116]:
              - generic [ref=e117]: No.263
              - generic [ref=e118]:
                - generic "机械组" [ref=e119]
                - generic "拟人组" [ref=e120]
              - img "异色" [ref=e122]
            - generic [ref=e123]:
              - generic [ref=e124]:
                - generic "母" [ref=e126]: ♀
                - generic "大胆" [ref=e128]
              - generic [ref=e129]:
                - generic [ref=e130]:
                  - img "大块头" [ref=e131]
                  - img "婉转声" [ref=e132]
                - generic "声音 100dB" [ref=e133]: 100dB
          - heading "机械方方" [level=3] [ref=e136]
          - generic [ref=e137]: 高— · 重98.4%
          - generic "测试甲·盒子01" [ref=e141]
      - listitem [ref=e142]:
        - article [ref=e143]:
          - generic [ref=e144]:
            - generic [ref=e145]:
              - generic [ref=e146]: No.011
              - generic "天空组" [ref=e148]
            - generic [ref=e149]:
              - generic [ref=e150]:
                - generic "公" [ref=e152]: ♂
                - generic "固执" [ref=e154]
              - generic [ref=e155]:
                - img "婉转声" [ref=e157]
                - generic "声音 96dB" [ref=e158]: 96dB
          - heading "鸭吉吉_等一等鸭" [level=3] [ref=e161]
          - generic [ref=e162]: 高— · 重55.2%
          - generic "测试甲·盒子01" [ref=e166]
      - listitem [ref=e167]:
        - article [ref=e168]:
          - generic [ref=e169]:
            - generic [ref=e170]:
              - generic [ref=e171]: No.002
              - generic [ref=e172]:
                - generic "动物组" [ref=e173]
                - generic "拟人组" [ref=e174]
            - generic [ref=e175]:
              - generic [ref=e176]:
                - generic "性别未知" [ref=e178]: "?"
                - generic "踏实" [ref=e180]
              - generic [ref=e181]:
                - img "小不点" [ref=e183]
                - generic "声音 40dB" [ref=e184]: 40dB
          - heading "喵喵" [level=3] [ref=e187]
          - generic [ref=e188]: 高— · 重0.8%
          - generic "测试甲·盒子02" [ref=e192]
      - listitem [ref=e193]:
        - article [ref=e194]:
          - generic [ref=e195]:
            - generic [ref=e196]:
              - generic [ref=e197]: No.005
              - generic [ref=e198]:
                - generic "魔力组" [ref=e199]
                - generic "巨灵组" [ref=e200]
            - generic [ref=e201]:
              - generic [ref=e202]:
                - generic "公" [ref=e204]: ♂
                - generic "固执" [ref=e206]
              - generic [ref=e207]:
                - generic [ref=e208]:
                  - img "大块头" [ref=e209]
                  - img "婉转声" [ref=e210]
                - generic "声音 100dB" [ref=e211]: 100dB
          - heading "火花" [level=3] [ref=e214]
          - generic [ref=e215]: 高— · 重99.1%
          - generic "测试甲·盒子01·3" [ref=e219]
      - listitem [ref=e220]:
        - article [ref=e221]:
          - generic [ref=e222]:
            - generic [ref=e223]:
              - generic [ref=e224]: No.008
              - generic "魔力组" [ref=e226]
            - generic [ref=e227]:
              - generic [ref=e228]:
                - generic "母" [ref=e230]: ♀
                - generic "开朗" [ref=e232]
              - generic [ref=e233]:
                - img "婉转声" [ref=e235]
                - generic "声音 98dB" [ref=e236]: 98dB
          - heading "水蓝蓝" [level=3] [ref=e239]
          - generic [ref=e240]: 高— · 重—
          - generic "测试乙·盒子01" [ref=e244]
      - listitem [ref=e245]:
        - article [ref=e246]:
          - generic [ref=e247]:
            - generic [ref=e248]:
              - generic [ref=e249]: No.002
              - generic [ref=e250]:
                - generic "动物组" [ref=e251]
                - generic "拟人组" [ref=e252]
              - img "异色" [ref=e254]
            - generic [ref=e255]:
              - generic [ref=e256]:
                - generic "公" [ref=e258]: ♂
                - generic "固执" [ref=e260]
              - generic [ref=e261]:
                - img "大块头" [ref=e263]
                - generic "声音 55dB" [ref=e264]: 55dB
          - heading "喵喵" [level=3] [ref=e267]
          - generic [ref=e268]: 高— · 重—
          - generic "测试乙·盒子02" [ref=e272]
```

# Test source

```ts
  164 |   const items = Array.from({ length: 500 }, (_, i) => ({
  165 |     name: `测试精灵${i}`,
  166 |     speciesPetId: 3001 + (i % 20),
  167 |     gender: i % 2 === 0 ? '母' : '公',
  168 |     nature: '固执',
  169 |     voiceDb: 100,
  170 |     medalBody: '大块头',
  171 |     isShiny: false,
  172 |     group: `盒子${String((i % 9) + 1).padStart(2, '0')}`,
  173 |     boxNumber: (i % 9) + 1,
  174 |     slotOrder: (i % 30) + 1,
  175 |   }));
  176 |   const fixture = {
  177 |     meta: { type: 'hatch-backup', playerName: '压测账号', gameId: 1, exportedAt: '2026-09-26T00:00:00.000Z' },
  178 |     collections: { petBackpack: { items }, eggInventory: { eggs: [] } },
  179 |   };
  180 |   mkdirSync('test-results', { recursive: true });
  181 |   const fixturePath = 'test-results/perf-fixture.json';
  182 |   writeFileSync(fixturePath, JSON.stringify(fixture), 'utf8');
  183 | 
  184 |   await page.goto('/');
  185 |   await page.getByTestId('import-input').setInputFiles(fixturePath);
  186 |   await expect(page.getByText('还没有数据')).toHaveCount(0);
  187 |   await page.getByRole('button', { name: '收集', exact: true }).click();
  188 |   await page.getByTestId('collection-kind-inventory').click();
  189 | 
  190 |   // 首屏只建 60 张卡（避免 500 只一次渲染卡住），但仍是一次展示、没有分页
  191 |   await expect(page.locator('article')).toHaveCount(60);
  192 |   await expect(page.getByTestId('pet-list-more')).toContainText('已显示 60 / 500 只');
  193 |   await expect(page.getByTestId('page-indicator')).toHaveCount(0);
  194 |   await expect(page.getByRole('button', { name: '下一页' })).toHaveCount(0);
  195 |   await expect(page.getByRole('button', { name: '上一页' })).toHaveCount(0);
  196 | 
  197 |   // 滚到底自动续一档
  198 |   await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  199 |   await expect(page.locator('article')).toHaveCount(120);
  200 |   await expect(page.getByTestId('pet-list-more')).toContainText('已显示 120 / 500 只');
  201 | });
  202 | 
  203 | test('精灵背包搜索：按进化链全员命中，搜不到给空态', async ({ page }) => {
  204 |   await page.goto('/');
  205 |   await page.getByTestId('import-input').setInputFiles('src/domain/__fixtures__/backup-sample.json');
  206 |   await expect(page.getByText('还没有数据')).toHaveCount(0);
  207 |   await page.getByRole('button', { name: '收集', exact: true }).click();
  208 |   await page.getByTestId('collection-kind-inventory').click();
  209 |   await expect(page.getByTestId('collection-kind-inventory')).toHaveAttribute('aria-pressed', 'true');
  210 | 
  211 |   // 种公名单连同它的搜索框一起下线；搜索能力仍在精灵背包（R2-6-L05：两条用例合并成一条）
  212 |   const search = page.getByTestId('pet-name-search');
  213 |   await expect(search).toBeVisible();
  214 |   // fixture 里只有 stage1 的火花（3003），搜它同链的进化形态名也要命中
  215 |   await search.fill('火神');
  216 |   await expect(page.getByText('火花')).toBeVisible();
  217 |   await expect(page.getByText('机械方方')).toHaveCount(0);
  218 | 
  219 |   await search.fill('焰火');
  220 |   await expect(page.getByText('火花')).toBeVisible();
  221 | 
  222 |   // 搜自己也在
  223 |   await search.fill('火花');
  224 |   await expect(page.getByText('火花')).toBeVisible();
  225 | 
  226 |   // 清空恢复全部
  227 |   await search.fill('');
  228 |   await expect(page.getByText('机械方方')).toBeVisible();
  229 | 
  230 |   // 搜不到：给空态文案，而不是留一片空白
  231 |   await search.fill('不存在的名字XYZ');
  232 |   await expect(page.getByText('没有符合条件的精灵，试试取消部分标签。')).toBeVisible();
  233 |   await expect(page.getByText('火花')).toHaveCount(0);
  234 | });
  235 | 
  236 | test('账号同类取并集；标签数量随选择动态更新且为 0 时置灰', async ({ page }) => {
  237 |   await page.goto('/');
  238 |   await page.getByTestId('import-input').setInputFiles([
  239 |     'src/domain/__fixtures__/backup-sample.json',
  240 |     'src/domain/__fixtures__/backup-sample-2.json',
  241 |   ]);
  242 |   await expect(page.getByText('还没有数据')).toHaveCount(0);
  243 |   await page.getByRole('button', { name: '收集', exact: true }).click();
  244 |   await page.getByTestId('collection-kind-inventory').click();
  245 | 
  246 |   // 账号筛选在页面顶部 AccountFilterBar（默认折叠；排除制：点 chip = 取消该账号）；
  247 |   // 下方筛选面板不再有账号标签。
  248 |   // 初始全选 6 只；排除「测试乙」→ 只剩测试甲 4 只
  249 |   await page.getByTestId('account-filter-summary').click();
  250 |   await page.getByTestId('account-filter-测试乙').click();
  251 |   await expect(page.locator('article')).toHaveCount(4);
  252 | 
  253 |   // 点回「测试乙」→ 并集 6 只（旧实现取交集会变成 0 只）
  254 |   await page.getByTestId('account-filter-测试乙').click();
  255 |   await expect(page.locator('article')).toHaveCount(6);
  256 | 
  257 |   // 「全不选」已被禁止：只剩一个账号时该 chip 不可点，点「全选」恢复
  258 |   await page.getByTestId('account-filter-测试甲').click();
  259 |   await expect(page.locator('article')).toHaveCount(2);
  260 |   await expect(page.getByTestId('account-filter-测试乙')).toBeDisabled();
  261 |   await page.getByTestId('account-filter-select-all').click();
  262 |   await expect(page.locator('article')).toHaveCount(6);
  263 | 
> 264 |   await page.getByTestId('filter-tile-body').click();
      |                                              ^ Error: locator.click: Test timeout of 30000ms exceeded.
  265 |   await page.getByTestId('filter-opt-body-body:大块头').click();
  266 |   await expect(page.locator('article')).toHaveCount(3);
  267 | 
  268 |   // 性别选项带动态计数：点「体型」同时展开一个维度（手风琴互斥），开「性别」看公/母计数
  269 |   await page.getByTestId('filter-tile-gender').click();
  270 |   await expect(page.getByTestId('filter-opt-gender-gender:公')).toContainText('公 (2)');
  271 |   await expect(page.getByTestId('filter-opt-gender-gender:母')).toContainText('母 (1)');
  272 | 
  273 |   // 粗嗓门 0 计数置灰（在这个 fixture 里没有负分贝 = 不是粗嗓门）
  274 |   await page.getByTestId('filter-tile-voice').click();
  275 |   await expect(page.getByTestId('filter-opt-voice-voice:粗嗓门')).toBeDisabled();
  276 | });
  277 | 
```