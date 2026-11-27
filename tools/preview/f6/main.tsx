/**
 * F6 预览器：F5「待认领」UI 的真实组件截图。
 *   node tools/preview/f6/build.mjs && node tools/preview/f6/shot.mjs
 *   → docs/preview/F6-<宽>-*.png
 *
 * 八屏（每屏 375 / 390 各一张）：
 * - `stock`   蛋仓顶部琥珀横幅 + 网格里的虚线「待认领」卡；
 * - `claim`   手动认领 · 未选（左家蛋 / 右本次进背包）；
 * - `pick`    左一张 + 右一张同种 → 「合并这两颗」可点；
 * - `same-species` 选中左卡后右列只留同物种（不同物种不显示）；
 * - `detail`  认领合并后的详情：「已与家园蛋 … 认领合并 · 拆开认领」；
 * - `split`   拆开确认；
 * - `after`   认领完：横幅消失，两张卡合成一张；
 * - `empty`   右列按物种过滤为空：「这次没有同物种的新蛋」。
 *
 * 只出现在 tools/ 下，不进 `src/`、不参与应用构建。
 */
import { createRoot } from 'react-dom/client';
import { species } from '../../../src/data/catalog';
import { CARD, PAGE, TITLE } from '../../../src/ui/primitives/styles';
import { TabNav } from '../../../src/ui/TabNav';
import { EggStockPanel } from '../../../src/ui/plan/EggStockPanel';
import type { WorkflowEgg } from '../../../src/shared/eggWorkflow';

const ME = 'acct-demo';
const AG = 'uid:1001';
const at = (value: string) => Date.parse(value);

const base = (patch: Partial<WorkflowEgg> & Pick<WorkflowEgg, 'id' | 'eggGameId'>): WorkflowEgg => ({
  accountId: ME, gameAccountKey: AG, nature: '固执', body: '大块头', voice: '婉转声', provenance: 'self-bred',
  confidence: 'system', kind: 'ordinary', status: 'available', listed: false, location: 'bag',
  lastConfirmedAt: at('2026-11-25T08:30:00'), ...patch,
});

const parentsOf = (greenNest: boolean) => ({
  mother: { id: 'm-1', gameId: 3049, name: '白发懒人', nature: '保守', body: '大块头' as const, voice: '+100' as const,
    nestName: greenNest ? '学院小窝' : '普通小窝', ...(greenNest ? { academy: true } : {}) },
  fathers: [{ id: 'f-1', gameId: 3001, name: '咕噜', nature: '胆小', body: '大块头' as const, voice: '婉转声' as const, nestName: '普通小窝' }],
  confirmed: false,
});

/** 两颗待认领的家蛋（同种）：一颗普通窝、一颗绿窝。 */
const PENDING: WorkflowEgg[] = [
  base({ id: 'home-1002', eggGameId: 3049, location: 'home', nature: '', body: 'unknown', voice: 'unknown',
    provenance: 'self-bred', claimPending: true, lastConfirmedAt: at('2026-11-25T08:30:00'), parents: parentsOf(false) }),
  base({ id: 'home-1003', eggGameId: 3049, location: 'home', nature: '', body: 'unknown', voice: 'unknown',
    provenance: 'self-bred', claimPending: true, greenNest: true, lastConfirmedAt: at('2026-11-25T08:32:00'), parents: parentsOf(true) }),
];

/** 本次新进背包的三颗：前两颗同种，第三颗用来演示「物种不同直接禁用」。 */
const FRESH: WorkflowEgg[] = [
  base({ id: 'bag-4559', eggGameId: 3049, provenance: 'unknown', nature: '平和', body: '大块头', voice: '婉转声',
    obtainedAt: '2026-11-25T08:41:00', heightCm: 23.4, weightGrams: 12886, claimArrivedAt: at('2026-11-25T08:45:00') }),
  base({ id: 'bag-4560', eggGameId: 3049, provenance: 'unknown', nature: '固执', body: '小不点', voice: '婉转声',
    obtainedAt: '2026-11-25T08:47:00', heightCm: 22.1, weightGrams: 11104, claimArrivedAt: at('2026-11-25T08:50:00') }),
  base({ id: 'bag-4561', eggGameId: 3001, provenance: 'unknown', nature: '胆小', body: '大块头', voice: '粗嗓门',
    obtainedAt: '2026-11-25T08:52:00', heightCm: 21.0, weightGrams: 9520, claimArrivedAt: at('2026-11-25T08:55:00') }),
];

/** 认领合并后的那颗（网格里和详情里都要看到「拆开认领」）。 */
const MERGED: WorkflowEgg = base({ id: 'home-1002', eggGameId: 3049, provenance: 'self-bred',
  nature: '平和', body: '大块头', voice: '婉转声', greenNest: true,
  obtainedAt: '2026-11-25T08:41:00', heightCm: 23.4, weightGrams: 12886,
  capturedEggId: 'bag-4559', claimPending: undefined,
  claimBackup: { nature: '', body: 'unknown', voice: 'unknown' }, parents: parentsOf(true) });

const NORMAL: WorkflowEgg[] = [
  base({ id: 'n-1', eggGameId: 3002, provenance: 'external', nature: '开朗', listed: true,
    obtainedAt: '2026-11-22T18:00:00', heightCm: 21.6, weightGrams: 7450 }),
  base({ id: 'n-2', eggGameId: 3003, provenance: 'external', nature: '胆小', body: '满体重', voice: '+100',
    obtainedAt: '2026-11-23T08:30:00', heightCm: 25.0, weightGrams: 9980 }),
];

const noop = async () => undefined;

function Shell({ children }: { children: React.ReactNode }) {
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
        <TabNav active="home" onChange={() => undefined} />
      </div>
      <div className={PAGE} data-testid="home-page" data-view="stock">{children}</div>
    </div>
  );
}

function StockScreen({ children }: { children: React.ReactNode }) {
  return (
    <Shell>
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <h2 className={`${TITLE} min-w-0 shrink-0`}>我的蛋仓</h2>
          <span className="flex min-w-0 items-center">
            <select aria-label="按游戏角色筛选" className="min-h-[26px] max-w-[7.5rem] rounded-md border border-slate-200 bg-white px-1 text-[11px] text-slate-600">
              <option>阿甲（7）</option>
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

function App() {
  const params = new URLSearchParams(window.location.search);
  const screen = params.get('screen') ?? 'stock';
  // 截图工具按 URL 直接选数据；认领页的点击由 shot.mjs 驱动，保证拍的是真实交互状态。
  const eggs = screen === 'after'
    ? [MERGED, ...FRESH.filter((egg) => egg.id !== 'bag-4559'), ...NORMAL]
    : screen === 'detail' || screen === 'split'
      ? [MERGED, ...FRESH, ...NORMAL]
      : screen === 'empty'
        // 待认领的家园蛋只有 3049；本次新进背包的只有 3001 → 右列按物种过滤后为空。
        ? [PENDING[0], FRESH[2], ...NORMAL]
        : [...PENDING, ...FRESH, ...NORMAL];
  return (
    <StockScreen>
      <EggStockPanel eggs={eggs} species={species} busy={false} mutate={noop} />
    </StockScreen>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
