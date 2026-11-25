import type { WorkflowEgg } from '../../shared/eggWorkflow';

/**
 * 蛋仓「同类蛋聚合」的纯函数（2026-11-25 U5）。
 *
 * 口径（用户拍板）：**同类 = 同物种**。主卡只回答「这是什么蛋、有几颗」+ 必要状态，
 * 性格 / 体型 / 声音的差异放到展开面板里按性格分组看。
 *
 * 这个模块只做展示前的归并与汇总，**不改 `StockEgg`、不落库、不同步**。
 * 面板把自己现有的私有判定（性格展示值、绿窝、自产、已标注、特殊蛋）作为 `facts` 传进来，
 * 这样两个模块零依赖：标注 / 角色那两轮改面板时，这里不用跟着动。
 */
export type EggGroupMode = 'species' | 'species-nature' | 'strict';

/** 展开面板每行右侧的状态（顺序即优先级）。 */
export type EggGroupRowStatus = '待认领' | '换蛋中' | '已挂出' | '在家园' | '未挂出';

export interface EggGroupFacts {
  /** 蛋的性格展示值：已落库值优先，没有就按父母推（面板的 `eggNatureText`）。 */
  natureText(e: WorkflowEgg): string;
  isGreenNest(e: WorkflowEgg): boolean;
  isSelfProduced(e: WorkflowEgg): boolean;
  isAnnotated(e: WorkflowEgg): boolean;
  isSpecial(e: WorkflowEgg): boolean;
}

export interface EggGroupItem {
  egg: WorkflowEgg;
  selfProduced: boolean;
  greenNest: boolean;
  status: EggGroupRowStatus;
}

/** 展开面板里的一组：同一性格。 */
export interface EggNatureSection {
  /** 性格展示值；空串表示「性格未标注」。 */
  text: string;
  items: EggGroupItem[];
}

export interface EggGroup {
  /** `species:<eggGameId>` 或 `special:<eggId>`（特殊蛋不聚合，各自一组）。 */
  key: string;
  eggGameId: number;
  items: EggGroupItem[];
  count: number;
  selfProduced: number;
  greenNest: number;
  listed: number;
  reserved: number;
  claimPending: number;
  bag: number;
  home: number;
  /** 在背包、可挂出、还没挂出的颗数（决定卡片要不要写「未挂出」）。 */
  availableBag: number;
  annotated: number;
  /** 性格分布（颗数降序），给卡片的 title / 测试用。 */
  natures: { text: string; count: number }[];
  /** 展开面板用：按性格分组，颗数降序、组内按获得时间倒序。 */
  natureSections: EggNatureSection[];
  latestObtainedAt?: string;
  latestConfirmedAt: number;
}

/** 一行的状态：待认领 > 换蛋中 > 已挂出 > 在家园 / 未挂出。 */
export function eggRowStatus(egg: WorkflowEgg): EggGroupRowStatus {
  if (egg.claimPending) return '待认领';
  if (egg.status === 'reserved') return '换蛋中';
  if (egg.listed) return '已挂出';
  return egg.location === 'home' ? '在家园' : '未挂出';
}

const timeOf = (egg: WorkflowEgg): number => {
  const value = egg.obtainedAt ? Date.parse(egg.obtainedAt) : Number.NaN;
  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
};

const tally = (values: string[]): { text: string; count: number }[] => {
  const counts = new Map<string, number>();
  const order = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
    if (!order.has(value)) order.set(value, order.size);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0))
    .map(([text, count]) => ({ text, count }));
};

/**
 * 分组 + 汇总。`mode` 默认 `species`（拍板口径）；另外两个值只保留给以后对比用。
 * 组间排序：组内任一自产 → 前；任一绿窝 → 再前；其余按组首次出现顺序（稳定）。
 */
export function groupEggStock(
  eggs: readonly WorkflowEgg[],
  facts: EggGroupFacts,
  mode: EggGroupMode = 'species',
): EggGroup[] {
  const members = new Map<string, WorkflowEgg[]>();
  for (const egg of eggs) {
    const key = facts.isSpecial(egg)
      ? `special:${egg.id}`
      : mode === 'strict'
        ? [egg.eggGameId, facts.natureText(egg), egg.body, egg.voice].join('|')
        : mode === 'species-nature'
          ? [egg.eggGameId, facts.natureText(egg)].join('|')
          : `species:${egg.eggGameId}`;
    members.set(key, [...(members.get(key) ?? []), egg]);
  }

  const groups = [...members.entries()].map(([key, list]) => {
    const items: EggGroupItem[] = list.map((egg) => ({
      egg,
      selfProduced: facts.isSelfProduced(egg),
      greenNest: facts.isGreenNest(egg),
      status: eggRowStatus(egg),
    }));
    const sections = new Map<string, EggGroupItem[]>();
    for (const item of items) {
      const text = facts.natureText(item.egg);
      sections.set(text, [...(sections.get(text) ?? []), item]);
    }
    const sectionOrder = new Map([...sections.keys()].map((text, index) => [text, index]));
    const natureSections = [...sections.entries()]
      .sort((a, b) => b[1].length - a[1].length || (sectionOrder.get(a[0]) ?? 0) - (sectionOrder.get(b[0]) ?? 0))
      .map(([text, sectionItems]) => ({
        text,
        items: [...sectionItems].sort((a, b) => timeOf(b.egg) - timeOf(a.egg)),
      }));
    const latestObtained = items
      .filter((item) => item.egg.obtainedAt)
      .sort((a, b) => timeOf(b.egg) - timeOf(a.egg))[0];
    return {
      key,
      eggGameId: list[0].eggGameId,
      items,
      count: items.length,
      selfProduced: items.filter((item) => item.selfProduced).length,
      greenNest: items.filter((item) => item.greenNest).length,
      listed: items.filter((item) => item.egg.listed).length,
      reserved: items.filter((item) => item.egg.status === 'reserved').length,
      claimPending: items.filter((item) => item.egg.claimPending).length,
      bag: items.filter((item) => item.egg.location === 'bag').length,
      home: items.filter((item) => item.egg.location === 'home').length,
      availableBag: items.filter((item) => item.egg.location === 'bag' && !item.egg.listed && item.egg.status === 'available').length,
      annotated: items.filter((item) => facts.isAnnotated(item.egg)).length,
      natures: tally(items.map((item) => facts.natureText(item.egg))),
      natureSections,
      latestObtainedAt: latestObtained?.egg.obtainedAt,
      latestConfirmedAt: items.reduce((max, item) => Math.max(max, item.egg.lastConfirmedAt || 0), 0),
    };
  });

  const firstIndex = new Map(groups.map((group, index) => [group.key, index]));
  return groups.sort((a, b) =>
    Number(b.selfProduced > 0) - Number(a.selfProduced > 0)
    || Number(b.greenNest > 0) - Number(a.greenNest > 0)
    || (firstIndex.get(a.key) ?? 0) - (firstIndex.get(b.key) ?? 0));
}
