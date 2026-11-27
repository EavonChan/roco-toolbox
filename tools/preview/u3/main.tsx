/**
 * U3 预览器：把**真实的蛋仓组件**（`EggStockPanel` / `EggCharacterSelect` / `eggCharactersOf`）
 * 用一份假数据渲染出来，用来对比「家园蛋仓」与「换蛋 → 我的蛋仓」两边的现状，以及对齐后的样子。
 *
 * 为什么不用真机 App 截图：两边蛋仓都要「已登录 + 已入组 + 服务端有蛋」才能出画面，
 * 本机没有组网环境；组件本身没有分叉，直接渲染同一份 `EggStockPanel` 就是两侧的真实像素与文案。
 * 外壳（顶部标题 / 五个页签 / PAGE 内边距）按 `src/App.tsx` 复制，只做上下文，不改动任何样式来源。
 *
 * 产出（`node tools/preview/u3/build.mjs`）：`docs/preview/U3-蛋仓角色对齐-2026-11-25.html`
 * 截图：`node tools/preview/u3/shot.mjs`
 */
import { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { species } from '../../../src/data/catalog';
import { CARD, PAGE, TITLE } from '../../../src/ui/primitives/styles';
import { SearchField } from '../../../src/ui/primitives/SearchField';
import { TabNav } from '../../../src/ui/TabNav';
import { EggCharacterSelect } from '../../../src/ui/plan/EggCharacterSelect';
import { EggGroupCard } from '../../../src/ui/plan/EggGroupCard';
import { EggStockPanel } from '../../../src/ui/plan/EggStockPanel';
import { eggCharactersOf } from '../../../src/ui/plan/eggCharacter';
import { groupEggStock, type EggGroupFacts } from '../../../src/ui/plan/eggStockGroups';
import { PetAvatar } from '../../../src/ui/PetAvatar';
import { PetCardLayout } from '../../../src/ui/PetCardLayout';
import type { AccountSnapshot } from '../../../src/domain/parseBackup';
import type { WorkflowEgg } from '../../../src/shared/eggWorkflow';

/** 工具箱账号 id（`accountId`）；角色是它下面的游戏号（`gameAccountKey`）。 */
const ME = 'acct-demo';

const HOUR = 3_600_000;
const ago = (hours: number) => Date.now() - hours * HOUR;

/** 本机导入的账号列表：**顺序就是角色下拉的顺序，第一个是主号**（与家园一致）。 */
const SNAPSHOTS = [
  { accountKey: 'uid:1001', accountName: '阿甲' },
  { accountKey: 'uid:1002', accountName: '阿乙' },
  // 主号列表里有、但一颗蛋都没有的角色：用来看「这个角色还没有蛋」提示
  { accountKey: 'uid:1003', accountName: '阿丙' },
] as unknown as readonly AccountSnapshot[];

const base = (patch: Partial<WorkflowEgg> & Pick<WorkflowEgg, 'id' | 'gameAccountKey' | 'eggGameId'>): WorkflowEgg => ({
  accountId: ME, nature: '固执', body: '大块头', voice: '婉转声', provenance: 'self-bred',
  confidence: 'system', kind: 'ordinary', status: 'available', listed: true, location: 'bag', ...patch,
});

/** 蛋仓里的蛋：阿甲 5 颗、阿乙 3 颗、阿丙 0 颗（与服务器 `state.eggs` 同形状）。 */
const EGGS: WorkflowEgg[] = [
  base({ id: 'e1', gameAccountKey: 'uid:1001', eggGameId: 3001, nature: '固执', body: '大块头', voice: '婉转声',
    listed: true, obtainedAt: ago(3), heightCm: 23.4, weightGrams: 12_345 }),
  base({ id: 'e2', gameAccountKey: 'uid:1001', eggGameId: 3002, nature: '冷静', body: '小不点', voice: '粗嗓门',
    listed: true, obtainedAt: ago(6), heightCm: 21.1, weightGrams: 10_500 }),
  base({ id: 'e3', gameAccountKey: 'uid:1001', eggGameId: 3003, nature: '平和', body: '满体重', voice: '+100',
    location: 'home', listed: false, obtainedAt: ago(20), lastConfirmedAt: ago(1) }),
  base({ id: 'e4', gameAccountKey: 'uid:1001', eggGameId: 3001, nature: '', body: 'unknown', voice: 'unknown',
    listed: false, obtainedAt: ago(9) }),
  base({ id: 'e5', gameAccountKey: 'uid:1001', eggGameId: 3005, nature: '开朗', body: '大块头', voice: '婉转声',
    listed: true, greenNest: true, obtainedAt: ago(28), heightCm: 24.8, weightGrams: 13_200 }),
  base({ id: 'e6', gameAccountKey: 'uid:1002', eggGameId: 3007, nature: '固执', body: '大块头', voice: '婉转声',
    listed: true, obtainedAt: ago(11), heightCm: 22.6, weightGrams: 11_900 }),
  base({ id: 'e7', gameAccountKey: 'uid:1002', eggGameId: 3001, nature: '天真', body: '小不点', voice: '婉转声',
    listed: true, obtainedAt: ago(15), heightCm: 20.4, weightGrams: 9_800 }),
  base({ id: 'e8', gameAccountKey: 'uid:1002', eggGameId: 3013, nature: '勇敢', body: '大块头', voice: '粗嗓门',
    location: 'home', listed: false, obtainedAt: ago(40), lastConfirmedAt: ago(2) }),
];

/** 两侧入口传进面板的都是这一份：`accountId === me && status !== 'transferred'`。 */
const MY_EGGS = EGGS.filter((egg) => egg.accountId === ME && egg.status !== 'transferred');

const noop = async () => undefined;

/** 顶部外壳：照 `src/App.tsx` 的 header + TabNav 复刻。 */
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
      {/* 家园蛋仓靠 `[data-testid="home-page"][data-view="stock"]` 调蛋仓那一屏的上下留白 */}
      <div
        className={PAGE}
        data-testid={pageView ? 'home-page' : undefined}
        data-view={pageView}
      >{children}</div>
    </div>
  );
}

/**
 * 家园蛋仓：`Home.tsx` 的标题行 + `EggStockView` 的 `StockBody`。
 * 竖屏时角色下拉由蛋仓屏 portal 到标题行插槽里；横屏在右侧筛选栏（这里只做竖屏）。
 *
 * `back` 三种形态，用来和广场那边对比「返回」该长什么样（2026-11-25 用户口径）：
 * - `header-right`：**现状**——标题+下拉在左、`返回家园` 边框按钮在最右，整行在家园页头里（常显）。
 * - `header-left`：方向 A——`‹ 返回` 文字按钮在左、再接标题+下拉，仍留在家园页头。
 * - `content-row`：方向 C——蛋仓屏自己出一条内容行（家园页头在蛋仓屏隐藏），标题会随内容滚走。
 */
function HomeStock({ initialChar, back = 'header-right' }: {
  initialChar?: string;
  back?: 'header-right' | 'header-left' | 'content-row';
}) {
  const [character, setCharacter] = useState(initialChar ?? '');
  const characters = useMemo(() => eggCharactersOf(MY_EGGS, SNAPSHOTS), []);
  const active = character || characters[0]?.key || '';
  const select = characters.length > 1
    ? <EggCharacterSelect value={active} characters={characters} onChange={setCharacter} />
    : null;
  const backText = <button type="button" className="min-h-[28px] shrink-0 px-1 text-xs text-slate-500">‹ 返回</button>;
  const title = (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <h2 className={`${TITLE} min-w-0 shrink-0`}>我的蛋仓</h2>
      <span className="flex min-w-0 items-center" data-testid="home-stock-character-slot">{select}</span>
    </div>
  );
  const header = back === 'content-row' ? null : back === 'header-left' ? (
    <div className="flex items-center gap-2">{backText}{title}</div>
  ) : (
    <div className="flex items-center gap-2">
      {title}
      <button type="button" className="min-h-[28px] shrink-0 rounded-lg border border-slate-200 px-2 text-xs font-medium text-slate-600">返回家园</button>
    </div>
  );
  const contentRow = back === 'content-row' ? <div className="flex items-center gap-2">{backText}{title}</div> : null;
  return (
    <Shell tab="home" pageView="stock">
      {header}
      {contentRow}
      <section className={CARD} data-testid="home-egg-stock-view">
        <div className="flex flex-col gap-2" data-testid="egg-stock-body">
          <EggStockPanel
            eggs={MY_EGGS}
            species={species}
            busy={false}
            mutate={noop}
            collapsibleFilterRail
            railBack={{ label: '返回家园', onClick: () => undefined }}
            character={active}
            characters={characters}
            onCharacterChange={setCharacter}
          />
        </div>
      </section>
    </Shell>
  );
}

/**
 * 换蛋 → 我的蛋仓：`EggMatchingHub.tsx` 的 `page === 'stock'` 分支（返回行 + 同一个面板）。
 * `withCharacter` = 对齐后的样子（角色下拉 + 面板三个 props）。
 * `back`：`left` = **现状**（`‹ 返回` 文字按钮在标题左边）；`right` = 方向 B（`返回换蛋` 边框按钮在最右，和家园现状同形）。
 */
function PlazaStock({ withCharacter = false, initialChar, back = 'left', card = false }: {
  withCharacter?: boolean;
  initialChar?: string;
  back?: 'left' | 'right';
  /** 套白卡（2026-11-26 用户口径：广场蛋仓复刻家园那层 CARD） */
  card?: boolean;
}) {
  const [character, setCharacter] = useState(initialChar ?? '');
  const characters = useMemo(() => eggCharactersOf(MY_EGGS, SNAPSHOTS), []);
  const active = character || characters[0]?.key || '';
  const select = withCharacter && characters.length > 1
    ? <EggCharacterSelect value={active} characters={characters} onChange={setCharacter} testId="egg-stock-character-plaza" />
    : null;
  return (
    <Shell tab="groups">
      <div className="flex min-w-0 flex-col gap-2" data-testid="egg-matching-hub">
        <div className="flex items-center gap-2">
          {back === 'left'
            ? <button type="button" className="min-h-[28px] shrink-0 px-1 text-xs text-slate-500">‹ 返回</button>
            : null}
          <h3 className="min-w-0 shrink-0 text-sm font-semibold">我的蛋仓</h3>
          {select}
          {back === 'right'
            ? <button type="button" className="ml-auto min-h-[28px] shrink-0 rounded-lg border border-slate-200 px-2 text-xs font-medium text-slate-600">返回换蛋</button>
            : null}
        </div>
        {(() => {
          const panel = (
            <EggStockPanel
              eggs={MY_EGGS}
              species={species}
              busy={false}
              mutate={noop}
              collapsibleFilterRail
              railBack={{ label: '返回换蛋', onClick: () => undefined }}
              {...(withCharacter
                ? { character: active, characters, onCharacterChange: setCharacter }
                : {})}
            />
          );
          return card
            ? <section className={CARD} data-testid="egg-stock-card">{panel}</section>
            : panel;
        })()}
      </div>
    </Shell>
  );
}

const SCREENS = {
  home: '家园 · 蛋仓（现状：有角色下拉）',
  plaza: '换蛋 → 我的蛋仓（现状：没有角色下拉）',
  'plaza-after': '换蛋 → 我的蛋仓（+角色下拉）',
  'return-a-home': '返回 · 方向 A：家园改成左侧 ‹ 返回',
  'return-b-plaza': '返回 · 方向 B：广场改成右侧 返回换蛋',
  'return-c-home': '返回 · 方向 C：家园出内容行（页头隐藏）',
  'plaza-card': '白卡 · 广场蛋仓套白卡（方案 1 的样子）',
  'group-2': '分组 · 方案 2：一个角色一段（段头带蛋数）',
  'group-2b': '分组 · 方案 2 + 同类蛋聚合（段内 ×N 聚合卡）',
  'group-3': '分组 · 方案 3：默认分组 + 顶部角色芯片',
  'fit-name': '字号对比：A 现状 10px / B 恢复 12→9',
} as const;
type ScreenKey = keyof typeof SCREENS;

/** 聚合卡要用的事实（与 `EggStockPanel` 里那几条私有判定同一口径）。 */
const EGG_FACTS: EggGroupFacts = {
  natureText: (egg) => egg.nature || '未标注',
  isGreenNest: (egg) => egg.greenNest === true,
  isSelfProduced: (egg) => egg.provenance === 'self-bred' || egg.location === 'home',
  isAnnotated: () => false,
  isSpecial: (egg) => egg.kind === 'special' || egg.kind === 'shiny',
};
const speciesName = (id: number) => species.find((entry) => entry.gameId === id)?.name ?? '未收录精灵';

/**
 * 蛋仓「按角色分组」的两个方向（2026-11-26 用户口径：不只是筛选，要分组）：
 * - `plain`：一个角色一段，段内还是现在的蛋卡（方案 2）
 * - `aggregate`：同上，但段内换成 U5 的「物种聚合卡 ×N」（分组 × 聚合两层嵌套）
 * - `chips`：默认分组 + 顶部角色芯片，只留某个角色（方案 3）
 */
/**
 * 卡名字号对比（2026-11-26 用户口径）：同一批卡、同一排版，只改字号策略。
 * - A 现状：`fitName` 但 base = min = 10（`466351b` 之后），名字一律 10px，超宽靠 truncate。
 * - B 恢复：朋友的参数化口径 base 12 / min 9（`56f23cd`），超宽按实测宽度缩到 9px。
 * 名字取图鉴里最长的几个：睡铃雪影娃娃(6 字)、蒲公英娃娃/白金独角兽(5 字)，喵喵(2 字) 作对照。
 */
const FIT_CASES = [
  { gameId: 3746, name: '睡铃雪影娃娃' },
  { gameId: 3027, name: '蒲公英娃娃' },
  { gameId: 3063, name: '白金独角兽' },
  { gameId: 3001, name: '喵喵' },
];

function NameRow({ base, min, label }: { base: number; min: number; label: string }) {
  return (
    <div className="grid grid-cols-4 gap-1.5" data-testid={`fit-row-${label}`}>
      {FIT_CASES.map((item) => (
        <PetCardLayout
          key={`${label}-${item.gameId}`}
          name={item.name}
          number="001"
          avatar={<PetAvatar gameId={item.gameId} name={item.name} size={48} />}
          fitName
          fitNameBase={base}
          fitNameMin={min}
          size="tall"
          testId="fit-demo-card"
        />
      ))}
    </div>
  );
}

function FitNameCompare() {
  return (
    <Shell tab="collection">
      <div className="flex flex-col gap-3">
        <section className="flex flex-col gap-1.5">
          <h2 className="text-xs font-semibold text-slate-900">A · 现状：名字一律 10px（超宽就截断）</h2>
          <NameRow base={10} min={10} label="a" />
        </section>
        <section className="flex flex-col gap-1.5">
          <h2 className="text-xs font-semibold text-slate-900">B · 恢复：基准 12px，超宽按比例缩到 9px</h2>
          <NameRow base={12} min={9} label="b" />
        </section>
      </div>
    </Shell>
  );
}

function GroupedStock({ mode }: { mode: 'plain' | 'aggregate' | 'chips' }) {
  const [query, setQuery] = useState('');
  const [only, setOnly] = useState('');
  const visible = MY_EGGS.filter((egg) => !query || speciesName(egg.eggGameId).includes(query));
  const characters = eggCharactersOf(visible, SNAPSHOTS);
  const shown = mode === 'chips' && only ? characters.filter((item) => item.key === only) : characters;
  const chips = [{ key: '', name: '全部', count: visible.length }, ...characters];
  return (
    <Shell tab="groups">
      <div className="flex min-w-0 flex-col gap-2" data-testid="egg-matching-hub">
        <div className="flex items-center gap-2">
          <button type="button" className="min-h-[28px] shrink-0 px-1 text-xs text-slate-500">‹ 返回</button>
          <h3 className="min-w-0 shrink-0 text-sm font-semibold">我的蛋仓</h3>
          <span className="ml-auto shrink-0 text-[10px] text-slate-400">共 {visible.length} 颗</span>
        </div>
        <section className={CARD} data-testid="egg-stock-card">
          <div className="flex flex-col gap-3">
            <SearchField label="搜索蛋名" value={query} onValueChange={setQuery} placeholder="搜索蛋名" className="[&_input]:text-left" />
            {mode === 'chips' ? (
              <div className="flex flex-wrap gap-1" data-testid="stock-role-chips">
                {chips.map((chip) => (
                  <button
                    key={chip.key || 'all'}
                    type="button"
                    aria-pressed={only === chip.key}
                    onClick={() => setOnly(chip.key)}
                    className={`min-h-7 rounded-md px-2 text-[11px] ${only === chip.key ? 'bg-emerald-50 font-semibold text-emerald-700' : 'text-slate-500'}`}
                  >{chip.name}（{chip.count}）</button>
                ))}
              </div>
            ) : null}
            {shown.map((character) => {
              const roleEggs = MY_EGGS.filter((egg) => egg.gameAccountKey === character.key);
              const groups = groupEggStock(roleEggs, EGG_FACTS);
              return (
                <section key={character.key} className="flex flex-col gap-1.5" data-testid="stock-role-section">
                  <header className="flex items-center gap-1.5">
                    <h4 className="text-xs font-semibold text-slate-900">{character.name}</h4>
                    <span className="text-[10px] text-slate-400">{character.count} 颗</span>
                    {character.key === characters[0]?.key
                      ? <span className="rounded bg-emerald-50 px-1 text-[9px] leading-4 text-emerald-700">主号</span>
                      : null}
                  </header>
                  {character.count === 0 ? (
                    <p className="text-[10px] text-slate-400">这个角色还没有蛋</p>
                  ) : mode === 'aggregate' ? (
                    <div className="egg-stock-grid grid grid-cols-4 gap-1.5">
                      {groups.map((group) => (
                        <EggGroupCard
                          key={group.key}
                          group={group}
                          total={group.count}
                          name={speciesName}
                          expanded={false}
                          onToggle={() => undefined}
                        />
                      ))}
                    </div>
                  ) : (
                    // 段内直接复用真实面板的蛋卡：只保留网格，把搜索与筛选条件藏掉
                    <div className="u3-section">
                      <EggStockPanel eggs={roleEggs} species={species} busy={false} mutate={noop} character={character.key} />
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </section>
      </div>
    </Shell>
  );
}

function renderScreen(screen: ScreenKey, initialChar?: string) {
  if (screen === 'home') return <HomeStock initialChar={initialChar} />;
  if (screen === 'return-a-home') return <HomeStock initialChar={initialChar} back="header-left" />;
  if (screen === 'return-c-home') return <HomeStock initialChar={initialChar} back="content-row" />;
  if (screen === 'group-2') return <GroupedStock mode="plain" />;
  if (screen === 'group-2b') return <GroupedStock mode="aggregate" />;
  if (screen === 'group-3') return <GroupedStock mode="chips" />;
  if (screen === 'fit-name') return <FitNameCompare />;
  if (screen === 'plaza-card') {
    return <PlazaStock withCharacter key="plaza-card" card initialChar={initialChar} />;
  }
  return (
    <PlazaStock
      withCharacter={screen !== 'plaza'}
      back={screen === 'return-b-plaza' ? 'right' : 'left'}
      initialChar={initialChar}
    />
  );
}

function App() {
  const params = new URLSearchParams(window.location.search);
  const bare = params.get('bare') === '1';
  const [screen, setScreen] = useState<ScreenKey>((params.get('screen') as ScreenKey) ?? 'home');
  const initialChar = params.get('char') ?? undefined;
  if (bare) return renderScreen(screen, initialChar);
  return (
    <div>
      <div data-toolbar className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-white px-3 py-2 text-xs">
        {Object.entries(SCREENS).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setScreen(key as ScreenKey)}
            aria-pressed={screen === key}
            className={`min-h-7 rounded-md px-2 ${screen === key ? 'bg-emerald-50 font-semibold text-emerald-700' : 'text-slate-500'}`}
          >{label}</button>
        ))}
        <span className="ml-1 text-slate-400">假数据：阿甲 5 颗 / 阿乙 3 颗 / 阿丙 0 颗；组件是仓库里的真实组件</span>
      </div>
      <div className="mx-auto max-w-[420px] border-x border-slate-200">
        {renderScreen(screen, initialChar)}
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
