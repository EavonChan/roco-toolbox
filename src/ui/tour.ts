/**
 * 新手引导（2026-11-01）：首启自动弹出，一步一步高亮真实控件。
 *
 * 与 `guide.ts` 的「使用教程」并存：
 * - 本文件 = 带聚光方框的分步引导（教怎么点）；
 * - `guide.ts` = 纯文字说明（讲功能是什么，随时可回看）。
 *
 * 已读记**版本号**而不是 true：以后步骤大改 +1 就能再弹一次。
 */
const TOUR_SEEN_KEY = 'roco.tourSeen';

/** 引导版本：改步骤时 +1（首版 1） */
export const TOUR_VERSION = '1';

/** 目标元素上挂的锚点属性；找不到时退化成居中说明卡。 */
export const TOUR_ANCHOR_ATTR = 'data-tour';

/**
 * 这里刻意不 import `navigation.ts`：本文件要被 e2e 工程直接引用（读版本号/步骤数），
 * 而 e2e 的 TS 工程只收自包含模块。下列字面量类型与导航合同结构兼容，由 App 转成意图。
 */
export type TourPage = 'dashboard' | 'home' | 'collection' | 'groups' | 'profile';
export type TourCollection =
  | { kind: 'mothers'; status: 'missing' | 'collected' | 'plan' }
  | { kind: 'studs'; view: 'coverage' }
  | { kind: 'inventory' };
export type TourProfileSection = 'identity' | 'data' | 'sync';

export interface TourStep {
  id: string;
  title: string;
  body: string;
  /** 进入该步骤前要切到的页签（不填 = 停在当前页） */
  page?: TourPage;
  /** 切到收集页的某个视图（隐含 page = collection） */
  collection?: TourCollection;
  /** 切到「我的」的某个分区（隐含 page = profile） */
  profileSection?: TourProfileSection;
  /** 家园的两个分页由本机偏好记住，不属于导航合同 */
  homeView?: 'nests' | 'demands';
  /** 要高亮的元素的 data-tour 值 */
  anchor?: string;
}

/**
 * 15 步主线：先讲入口，再按「看板 → 收集 → 小组 → 家园 → 我的」走一遍。
 * 文案只讲「这个控件怎么用」，不解释游戏机制。
 */
export const TOUR_STEPS: TourStep[] = [
  {
    id: 'nav',
    title: '五个入口',
    body: '看板看今天该补什么，家园看窝和蛋，收集看图鉴进度，小组和朋友共享，我的管数据与同步。',
    anchor: 'tab-nav',
  },
  {
    id: 'dashboard-target',
    title: '先定目标档位',
    body: '全站都按这里的「当前模式 + 档位」算。想追满分或双牌，在这里切换，覆盖度和配窝会一起变。',
    page: 'dashboard',
    anchor: 'dashboard-target',
  },
  {
    id: 'dashboard-actions',
    title: '今天该补什么',
    body: '这里按推荐性格列出还缺的母本与种公，点进去能看到具体缺哪几个蛋组。',
    anchor: 'dashboard-actions',
  },
  {
    id: 'dashboard-nest',
    title: '配窝建议',
    body: '按账号给出 11 个窝怎么摆、谁和谁配、每条线在补什么。摆位按游戏的窝尺寸与配对距离画。',
    anchor: 'dashboard-nest',
  },
  {
    id: 'collection-kinds',
    title: '收集页三个视图',
    body: '母本全收集看还缺哪些蛋，种公全收集看覆盖度，精灵背包看自己现有的精灵。',
    collection: { kind: 'mothers', status: 'missing' },
    anchor: 'collection-kinds',
  },
  {
    id: 'collection-studs',
    title: '覆盖度矩阵',
    body: '每个蛋组 × 每个要收的性格，绿色代表已有种公能覆盖。点一行展开看具体缺哪只。',
    collection: { kind: 'studs', view: 'coverage' },
    anchor: 'collection-studs',
  },
  {
    id: 'collection-mothers',
    title: '母本全收集',
    body: '按蛋统计还缺哪颗、缺什么性格。点开一颗蛋能看到组里谁有、怎么补最快。',
    collection: { kind: 'mothers', status: 'missing' },
    anchor: 'collection-mothers',
  },
  {
    id: 'group-setup',
    title: '和朋友一起收集',
    body: '登录后新建小组，或填邀请码加入。组内共享母本与种公清单，不用各自重复收集。',
    page: 'groups',
    anchor: 'group-setup',
  },
  {
    id: 'group-card',
    title: '资源自动同步',
    body: '导入数据后会自动同步到小组，不用手动发布；只想共享部分账号，可以在这里调选号。',
    anchor: 'group-card',
  },
  {
    id: 'group-demands',
    title: '我缺的 / 需求中心 / 共同寻找',
    body: '「我缺的」发需求，「需求中心」接别人的单，「共同寻找」一起认领全组都没有的缺口。',
    anchor: 'group-demands',
  },
  {
    id: 'home-tabs',
    title: '家园分两页',
    body: '「家园现状」看窝、配对和地上的蛋；「接单上窝」看你在需求中心接的单该怎么上窝。',
    page: 'home',
    homeView: 'nests',
    anchor: 'home-tabs',
  },
  {
    id: 'home-placement',
    title: '接单上窝',
    body: '每个账号给出母本 / 种公和窝位，并标出大概能孵出多少符合要求的蛋；已在家园的会标绿。',
    homeView: 'demands',
    anchor: 'home-placement',
  },
  {
    id: 'profile-import',
    title: '先导入一次数据',
    body: '点这里采集或选文件导入。导入结果留在本页，不会自动跳走；数据旧了随时可以再导一次。',
    profileSection: 'data',
    anchor: 'profile-import',
  },
  {
    id: 'profile-account',
    title: '云同步（可选）',
    body: '开启后换手机不丢数据，也能在小组里认出是同一人。恢复码只显示一次，记得截图保存。',
    profileSection: 'identity',
    anchor: 'profile-account',
  },
  {
    id: 'finish',
    title: '可以开始了',
    body: '导入数据 → 看板看缺口 → 去收集或小组补 → 回家园上窝。随时点顶部「教程」可以重看分步引导。',
  },
];

export function tourPending(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(TOUR_SEEN_KEY) !== TOUR_VERSION;
  } catch {
    return false;
  }
}

export function markTourSeen(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(TOUR_SEEN_KEY, TOUR_VERSION);
  } catch {
    // 隐私模式写不了：这次看过就算了，下次再弹
  }
}
