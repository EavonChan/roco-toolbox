# 2026-11-23 四个切片的界面证据

> 这些图只用于 PR 正文引用，不参与功能分支的 diff。
> 采集方式：本地 `vite` + Playwright（Chromium headless），按真实导入的备份与小组 mock 跑；
> 尺寸为 375×812 / 390×844 / 844×390 / 1120×500 / 1280×720。

## A 配窝卡三维

- `A-3d-home-p375.png`：375 竖屏，11 张配窝卡全部出现三维行，卡高 86，`scrollWidth=375` 无横向溢出。
- `A-3d-home-l844.png`：844×390，三维行「生命+9 / 物攻+8 / 速度+10」无截断，卡高 86。
- `A-3d-home-l1280.png`：1280×720，卡宽 160 时三格仍不换行。

量测（浏览器 console）：

```text
p375  cards=11 stats=11 cardH=86 cardW=156 statOverflow=0 docScrollW=375
l844  cards=11 stats=11 cardH=86 cardW=150 statOverflow=0 docScrollW=844
l1280 cards=11 stats=11 cardH=86 cardW=160 statOverflow=0 docScrollW=1280
```

## B 换蛋横屏

- `B-swap-p390.png`：390 竖屏保持原「页签 + 搜索 + 蛋卡」上下顺序，不出现标题栏。
- `B-swap-l844.png`：844×390 三栏 —— 主区 477、筛选列 195、标题栏 39；无横向溢出。
- `B-swap-l844-collapsed.png`：收起筛选后主区 477 → 679，标题栏原位。
- `B-swap-l844-stock.png`：蛋仓子页沿用标题栏，返回文案「返回换蛋」。
- `B-swap-l1120.png`：1120 宽屏同样三栏。

量测（浏览器 console）：

```text
SWAP p390  rail=null filters=null scrollW=390
SWAP l844  rail=39 filters=195 main=477 scrollW=844
SWAP l844 collapsed main=679 data-collapsed=true scrollW=844
STOCK l844 rail=39 main=477 back=返回换蛋 scrollW=844
SWAP l1120 rail=39 filters=212 main=733 scrollW=1120
```

## C 蛋仓明细

- `C-detail-p390.png`：390 竖屏蛋详情，单列窄屏仍可滚动，面板 358×485。
- `C-detail-l844.png`：844×390 高密度两栏：左侧蛋信息，右侧实际父母 3 张配窝卡；学院卡显示「学院小窝 · 100%性格」。
- `C-detail-l844-edit.png`：同一面板进入标注态，面板 630×332，内容可滚。
- `C-detail-l1120.png`：1120 宽屏，父母卡不被拉宽，保持 6.5rem 卡宽。

量测（浏览器 console）：

```text
DETAIL p390  panel=358x485 scrollH=346 clientH=346
DETAIL l844  panel=630x327 scrollH=191 clientH=191
DETAIL l1120 panel=637x328 scrollH=192 clientH=192
```

## D rail CSS 归位

- `D-swap-l844.png`、`D-swap-l1120.png`：与 B 同尺寸、同量测；样式搬进 `rail.css` 后视觉无变化。

```text
SWAP l844  rail=39 filters=195 main=477 scrollW=844
SWAP l1120 rail=39 filters=212 main=733 scrollW=1120
```

## review-pr 预检

```text
A  upstream/test(e0daa5f) ← friend/individual-bonuses-20261123(46bf7f9)
   8 个文件，+343 / -11；无文本冲突；禁区无；重复补丁无；PASS
B  upstream/test(e0daa5f) ← friend/swap-landscape-20261123-v2(f662372)
   5 个文件，+377 / -20；无文本冲突；禁区无；重复补丁无；PASS
C  upstream/test(e0daa5f) ← friend/egg-detail-20261123-v2(364c60a)
   3 个文件，+109 / -35；无文本冲突；禁区无；重复补丁无；PASS
D  friend/swap-landscape-20261123-v2(f662372) ← friend/rail-css-20261123-v2(839807a)
   3 个文件，+81 / -79；无文本冲突；禁区无；重复补丁无；PASS
```
