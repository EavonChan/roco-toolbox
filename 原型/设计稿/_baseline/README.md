# _baseline · 基准截图

## 这一版基准是什么

| 项 | 值 |
| --- | --- |
| 来源 | `https://test.roco-toolbox.pages.dev` |
| 构建 | 页面底部版本戳 **2026-11-22 21:07**（`index-B8gCjc1-.js`） |
| 捕获时间 | 2026-11-22 21:58（本地时间） |
| 屏宽 | 375 / 390 |
| 数据 | 未登录：导入样例备份（哈基米 + 千度月）；登录态：账号 `石岚测试` |
| 张数 | 未登录 22 张（8 页 × 2 宽 + 6 个二级页）＋ 登录态 26 张 |

这一版**包含 2026-11-22 当天的全部改动**：卡片统一 104/48/10、看板撤掉种公推荐与母本缺口网格、
家园页横向溢出修复、异色炫彩筛选口径修正。发版在即，后续调整以这一版为对照基准。

## 目录

```
_baseline/
├─ *.png                    未登录基准（<page>-<width>.png）
├─ 基线信息.json            每页的 body/nav/card 计算样式快照
└─ 登录态/                  登录后基准 + 登录态信息-<width>.json

> 不入库（见同目录 .gitignore）：
> - `_work/` 排障临时图（dev 截图），2026-11-22 已删除，省 12.3 MB；
> - `_prev-*/` 旧版基准归档，已移到仓库外 `D:\desk\roco-shots\设计稿-旧基准-2026-11-22-1327\`（52 个文件 / 8.4 MB）。
```

## 重新捕获

```bash
# 未登录（会覆盖同名文件）
node 原型/设计稿/_tools/capture-baseline.mjs               # 默认 test
node 原型/设计稿/_tools/capture-baseline.mjs --base https://roco-toolbox.pages.dev

# 登录态（只读线上数据，不点同步/覆盖云端）
node 原型/设计稿/_tools/capture-logged-in.mjs --user <账号> --pass <密码> --width 375
node 原型/设计稿/_tools/capture-logged-in.mjs --user <账号> --pass <密码> --width 390
```

⚠️ 重跑会覆盖 `*.png` 与 `基线信息.json`；要保留旧版，请复制到**仓库外**（例如 `D:\desk\roco-shots\设计稿-旧基准-<日期>/`），不要放回 `_baseline/`——`_prev-*/` 已在 .gitignore 里。
