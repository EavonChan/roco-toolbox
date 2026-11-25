/**
 * U5 预览器：蛋仓「同类蛋聚合」方案对比。
 *
 *   node tools/preview/u5/build.mjs && node tools/preview/u5/shot.mjs
 *   → docs/preview/U5-375-*.png / U5-390-*.png
 *
 * 五屏：
 * - `now`    现状（**仓库里的真实 EggStockPanel**）：5 颗白发懒人占 5 个格子；
 * - `group`  聚合后（原型）：白发懒人合成一张卡，右上 ×5；
 * - `open`   点开（原型）：卡下面就地展开 5 行；
 * - `filter` 筛选「已标注」（原型）：聚合卡显示 ×4（共 5 颗）；
 * - `sheet`  备选（原型）：底部抽屉（复用 ModalSurface placement="sheet"）。
 *
 * 原型代码在 `aggPanel.tsx`，只出现在 tools/ 下，不进 `src/`。
 */
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { species } from '../../../src/data/catalog';
import { CARD, PAGE, TITLE } from '../../../src/ui/primitives/styles';
import { TabNav } from '../../../src/ui/TabNav';
import { EggStockPanel } from '../../../src/ui/plan/EggStockPanel';
import type { WorkflowEgg } from '../../../src/shared/eggWorkflow';
import { AggPanel } from './aggPanel';

/** 工具箱账号 id；角色是它下面的游戏号。 */
const ME = 'acct-demo';
const AG = 'uid:1001';

const base = (patch: Partial<WorkflowEgg> & Pick<WorkflowEgg, 'id' | 'eggGameId'>): WorkflowEgg => ({
  accountId: ME, gameAccountKey: AG, nature: '固执', body: '大块头', voice: '婉转声', provenance: 'self-bred',
  confidence: 'system', kind: 'ordinary', status: 'available', listed: false, location: 'bag', lastConfirmedAt: Date.now(), ...patch,
});

/**
 * 假数据照用户那张图的口径：白发懒人 5 颗（同一对亲本、连续几天收的），另外 3 颗别的蛋。
 * 性格 / 体型 / 声音故意不完全一致，用来验证聚合卡上的「分布摘要」和状态汇总。
 */
const EGGS: WorkflowEgg[] = [
  base({ id: 'w1', eggGameId: 3049, nature: '平和', body: '大块头', voice: '婉转声', listed: true,
    obtainedAt: '2026-11-24T21:12:00+08:00', heightCm: 24.1, weightGrams: 8_920 }),
  base({ id: 'w2', eggGameId: 3049, nature: '平和', body: '大块头', voice: '婉转声', listed: false,
    obtainedAt: '2026-11-24T23:40:00+08:00', heightCm: 23.8, weightGrams: 8_740 }),
  base({ id: 'w3', eggGameId: 3049, nature: '平和', body: '小不点', voice: '婉转声', listed: false, status: 'reserved',
    obtainedAt: '2026-11-25T09:05:00+08:00', heightCm: 23.2, weightGrams: 6_910 }),
  base({ id: 'w4', eggGameId: 3049, nature: '冷静', body: 'unknown', voice: 'unknown',
    location: 'home', listed: false, lastConfirmedAt: new Date('2026-11-25T10:20:00+08:00').getTime() }),
  base({ id: 'w5', eggGameId: 3049, nature: '平和', body: '大块头', voice: '粗嗓门',
    location: 'home', listed: false, claimPending: true, lastConfirmedAt: new Date('2026-11-25T08:40:00+08:00').getTime() }),
  base({ id: 'm1', eggGameId: 3001, nature: '固执', body: '大块头', voice: '婉转声', listed: true, provenance: 'external',
    obtainedAt: '2026-11-22T18:00:00+08:00', heightCm: 21.6, weightGrams: 7_450 }),
  base({ id: 'm2', eggGameId: 3002, nature: '开朗', body: 'unknown', voice: 'unknown', listed: false,
    obtainedAt: '2026-11-23T08:30:00+08:00', heightCm: 20.9, weightGrams: 6_020 }),
  base({ id: 'm3', eggGameId: 3003, nature: '胆小', body: '满体重', voice: '+100', greenNest: true, listed: false,
    obtainedAt: '2026-11-25T07:10:00+08:00', heightCm: 25.0, weightGrams: 9_980 }),
];

/** 顶部外壳：照 `src/App.tsx` 的 header + TabNav 复刻，只做上下文。 */
function Shell({ tab, pageView, children }: { tab: 'home' | 'groups'; pageView?: 'stock'; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-50 bg-white">
        <header className="flex items-center justify-between gap-2 border-b border-slate-100 bg-white px-4 py-2">
          <h1 className="text-base font-semibold text-slate-900">小布助手</h1>
          <div className="flex shrink-0 items-center gap-1.5">
            <button type="button" className="min-h-[30px] rounded-lg border border-slate-200 px-2.5 text-xs text-slate-500">刷新</button>
            <button type="button" className="min-h-[30px] rounded-lg border border-slate-200 px-2.5 text-xs text-slate-500">教程</button>
          </div>
        </header>
        <TabNav active={tab} onChange={() => undefined} />
      </div>
      <div className={PAGE} data-testid={pageView ? 'home-page' : undefined} data-view={pageView}>{children}</div>
    </div>
  );
}

/** 家园 · 我的蛋仓：标题行 + 面板主体（与 Home.tsx / EggStockView.tsx 的竖屏结构一致）。 */
function StockScreen({ children }: { children: React.ReactNode }) {
  return (
    <Shell tab="home" pageView="stock">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <h2 className={`${TITLE} min-w-0 shrink-0`}>我的蛋仓</h2>
          <span className="flex min-w-0 items-center">
            <select aria-label="按游戏角色筛选" className="min-h-[26px] max-w-[7.5rem] rounded-md border border-slate-200 bg-white px-1 text-[11px] text-slate-600">
              <option>阿甲（8）</option>
            </select>
          </span>
        </div>
        <button type="button" className="min-h-[28px] shrink-0 rounded-lg border border-slate-200 px-2 text-xs font-medium text-slate-600">返回家园</button>
      </div>
      <section className={CARD} data-testid="home-egg-stock-view">
        <div className="flex flex-col gap-2" data-testid="egg-stock-body">{children}</div>
      </section>
    </Shell>
  );
}

const noop = async () => undefined;

const SCREENS = {
  now: '① 现状（真实组件）：5 颗占 5 格',
  group: '② 聚合后：一张卡 ×5',
  open: '③ 点开：就地展开（按性格分组）',
  filter: '④ 筛选「已标注」：×4/5',
} as const;
type ScreenKey = keyof typeof SCREENS;

function App() {
  const params = new URLSearchParams(window.location.search);
  const bare = params.get('bare') === '1';
  const [screen, setScreen] = useState<ScreenKey>((params.get('screen') as ScreenKey) ?? 'group');
  const natureHint = params.get('hint') === '1';
  const body = screen === 'now'
    ? <EggStockPanel eggs={EGGS} species={species} busy={false} mutate={noop} collapsibleFilterRail railBack={{ label: '返回家园', onClick: () => undefined }} />
    : screen === 'group'
      ? <AggPanel eggs={EGGS} species={species} natureHint={natureHint} />
      : screen === 'open'
        ? <AggPanel eggs={EGGS} species={species} initialInlineOpen={3049} />
        : <AggPanel eggs={EGGS} species={species} initialFilter="已标注" />;
  if (bare) return <StockScreen>{body}</StockScreen>;
  return (
    <div>
      <div data-toolbar className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-white px-3 py-2 text-xs">
        {Object.entries(SCREENS).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setScreen(key as ScreenKey)} aria-pressed={screen === key}
            className={`min-h-7 rounded-md px-2 ${screen === key ? 'bg-emerald-50 font-semibold text-emerald-700' : 'text-slate-500'}`}>{label}</button>
        ))}
        <span className="ml-1 text-slate-400">假数据 8 颗：白发懒人 5（1 已挂出 / 1 待认领 / 3 未挂出）+ 喵喵 / 水蓝蓝 / 火花；① 是仓库真实组件，②~⑤ 是本方案原型</span>
      </div>
      <div className="mx-auto max-w-[420px] border-x border-slate-200">{body}</div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
