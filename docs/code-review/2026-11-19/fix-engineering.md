# 工程配置 / 发版护栏 / 桌面壳 修复记录（2026-11-19）

范围：R10（工程配置 / 桌面 / 分享）与 R9-6 中 `scripts/`、`package.json` 相关条目。
只改代码；未打包、未发版、未提交、未跑全量 vitest / Playwright。

## 1. R10-H01 / R9-6-H01 · 发版命令绕过护栏

- **改了什么**
  - `package.json`
    - `deploy:test` → `npm run verify && npm run build && node scripts/deploy-web.mjs --branch test`
    - `deploy:prod` → `npm run verify && npm run build && node scripts/deploy-web.mjs --branch main`
    - 不再出现 `wrangler pages deploy`；正式放行参数不写死，只能手动 `npm run deploy:prod -- --approve-production`。
  - `tools/test/deploy-web.test.mjs`：新增两条回归断言（两个 deploy 脚本必须走 `scripts/deploy-web.mjs`、不得直连 wrangler；`deploy:prod` 不得内嵌 `--approve-production`）。
- **验证**
  - `node --test tools/test/deploy-web.test.mjs` → `ℹ tests 4 / pass 4 / fail 0`（含新增两条）。
  - `node scripts/deploy-web.mjs --branch main` → 退出码 1，输出：
    `[发版中止] 正式站只读：没有用户明确的「放量 / 发正式」指令时，不允许部署 main。`
  - 脚本原有的 bundle 文件名 / SHA-256 / 内容断言与正式清单断言未改动。
- **未修原因**：无。

## 2. R10-M01 / R9-6-M02 · 文案闸门失效 + 3 条新增违规

- **改了什么**
  - `package.json`：`verify` 恢复为 `tsc -b && vitest run && node tools/lint-copy.mjs`（`deploy:*` 以 `verify` 开头，因此重新成为发版前置）。
  - `src/ui/DemandPublishSheet.tsx:187`：两行长说明压成一句「一个性格算一条需求；性别 / 体型 / 声音对本次选中的蛋统一生效。」
  - `src/ui/ImportPanel.tsx:485`：压成「采集器分享到「小布助手」会自动导入；也可手选 .pcap / .json（可多选）」。
  - `src/ui/ImportPanel.tsx:609`：压成「导出自己的账号数据；换设备首选上面的「云同步」。」。
  - `tools/test/deploy-web.test.mjs`：新增断言 `verify` 必须包含 `node tools/lint-copy.mjs`。
- **验证**
  - `node tools/lint-copy.mjs` → 退出码 0：`文案 lint 通过：存量 13 条，新增 0 条。`
  - `node --test tools/test/deploy-web.test.mjs` → 4 条通过（含 verify 闸门断言）。
- **未修原因**：无。

## 3. R10-M03 · 桌面 userData 改名与迁移空转

- **改了什么**
  - `package.json`：新增顶层 `"productName": "小布助手"`（`build.productName` 原有保留）。打包进 `app.asar` 的 package.json 会带上该字段，`app.getName()` / userData 真正变为 `%APPDATA%\小布助手`。
  - `desktop/userdata.cjs`：
    - 旧目录不再硬编码中文名，改为按真实产物判定候选：`['roco-toolbox', '洛克工具箱']`；取第一个真实存在且不等于当前 userData 的目录。
    - 增加同目录保护（`dir === target` 跳过），避免旧版未改名时自我拷贝。
    - 标记文件改为 `.migrated-userdata`；迁移算法保持「先复制到临时目录、再逐项搬入、旧目录不动」，失败回滚已搬条目。
    - 注释按真实产物重写（此前前提写反）。
  - `desktop/main.cjs:540`：迁移注释同步为真实口径。
- **验证**（临时目录内联脚本，真实输出）：
  `{"first":"migrated","second":"skipped","legacyKept":true,"copied":true,"chinese":"migrated","chineseCopied":true,"targetHasData":"skipped","targetContent":"new","sameDir":"skipped"}`
  - 迁移后旧目录文件仍在（`legacyKept:true`），新目录拿到副本；二次启动 `skipped`；仅中文旧目录时也能迁；新目录已有数据时不覆盖；当前目录等于旧目录时不迁。
  - `node -e` 读取 `package.json` → `{"top":"小布助手","build":"小布助手","name":"roco-toolbox"}`。
- **未修原因 / 限制**：按纪律未打包，无法实际生成 `app.asar` 复核；依据 electron-builder 保留顶层 `productName`、剥离 `build` 字段的既有行为。R10-U01（更早版本是否真的用过中文目录）仍保留「洛克工具箱」候选兜底。

## 4. R10-M02 · 桌面采集超过 128MiB 报「状态无效」

- **改了什么**
  - `desktop/capture/manager.cjs`：新增 `CAP_MESSAGE`；`state()` 在 `savedBytes > MAX_FILE_BYTES` 时写 `capped: true` 并把 message 改为「已达 128MiB 上限，请停止后重新开始」；`inspect()` 超限仍不提供增量读取入口（worker 本身拒绝 >128MiB），但注释说明原因由状态字段承载。
  - `src/collector/nativeCollector.ts`：`CollectorState` 增加可选 `capped?: boolean`；状态校验在 `capped === true` 时允许 `savedBytes` 超过 128MiB，其余越界仍判无效；`capped` 非布尔值也判无效。
  - `src/collector/nativeCollector.test.ts`：新增用例「桌面采集到达 128MiB 上限时带 capped 标记，不把整份状态判无效」。
- **验证**
  - `npx vitest run src/collector/nativeCollector.test.ts` → `12 passed`。
  - 内联脚本构造 `bytes = 128MiB + 1` 的 capturing 状态 → `{"capped":true,"message":"已达 128MiB 上限，请停止后重新开始","savedBytes":134217729,"phase":"capturing"}`。
  - 面板既有渲染（`NativeCollectorPanel.tsx:270` 的 `state.message`）会直接显示该原因，不再弹「本机采集状态无效」。
- **未修原因**：无（按报告推荐方案 A；未改 PCAP 写入链路）。

## 5. 低风险顺手项

| 条目 | 改了什么 | 验证 |
| --- | --- | --- |
| R10-L02 版本不一致 | `package-lock.json` 顶层与 `packages[""]` 的 `version` 由 `1.3.2` 对齐为 `1.5.6`（仅两处，无依赖变化） | `node -e` → `{"lock":"1.5.6","root":"1.5.6","pkg":"1.5.6"}` |
| R10-L03 README | 标题改「小布助手（原洛克工具箱）」；覆盖度术语改为「蛋组 × 性格 × 奖牌组合 / 种公目标」；补 `main` 只给 Electron、网页入口是 `index.html`、蛋神助手协议 1.2.9 不是本应用版本 | grep 命中「小布助手 / 种公目标 / 协议」，README 内已无「目标档位」 |
| R10-L01 重复 testid | 删除 `src/App.tsx` 顶栏的 `data-testid="app-version"` 构建时间，只保留 `src/ui/Profile.tsx:209` 一处 | `grep -n app-version src` → 仅 `Profile.tsx:209` 与 `Profile.test.tsx`；`npx vitest run src/Profile.test.tsx` 6 passed、`src/App.test.tsx` 7 passed |

## 范围外 / 未修（按指令只登记）

- **R10-M04 下载站兜底清单（1.5.2 / 36）**：涉及线上数据，未改任何清单 / `version.json`，留待发布窗处理。
- **R9-6-M01 e2e 选择器失效**：属另一路，未改用例。附注：删掉顶栏 `app-version` 后，`e2e/pwa.spec.ts:56,78` 的「页面顶部显示版本标记」会失败，需 e2e 路改为在「我的」页断言。
- **R9-6-L02 test 通道清单断言**：不在本轮必修清单，未改 `scripts/deploy-web.mjs` 行为（避免影响内测发版口径）。
- **R10-L04 / R9-6-L01 数据管线**：不在本路范围（R9-6 只取 `scripts/`、`package.json` 相关条目）。

## 收尾验证命令汇总（本路相关）

- `npx tsc -b` → 退出码 0
- `node --test tools/test/deploy-web.test.mjs` → 4 passed
- `npx vitest run src/collector/nativeCollector.test.ts src/ui/Profile.test.tsx src/App.test.tsx` → 25 passed
- `node tools/lint-copy.mjs` → 退出码 0（新增 0）
