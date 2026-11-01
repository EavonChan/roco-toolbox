import { createModuleStore } from './createModuleStore';
import {
  DEFAULT_DEMAND_BODY,
  DEFAULT_DEMAND_GENDER,
  DEFAULT_DEMAND_VOICE,
  DEMAND_BODIES,
  DEMAND_GENDERS,
  DEMAND_VOICES,
  type DemandBody,
  type DemandGender,
  type DemandVoice,
} from '../shared/collectionGroups';

/**
 * 清单的临时查看状态（2026-10-24 重构任务 4）。
 *
 * - **个人清单**的搜索：同一次会话跨页保留，重新加载清空；不写 localStorage。
 * - **小组清单**的搜索 / 分段 / 成员筛选 / 只看已拥有：按「工具箱身份 + 小组」隔离，
 *   换身份立即清空；切组天然互不串。只存查询条件，不缓存别人的资源正文。
 *
 * 长期目标与达标条件不在这里（见 motherCriteriaStore / coverageFilterStore）。
 */

export type PersonalListId = 'inventory-all' | 'mothers';

export interface PersonalListState {
  query: string;
}

type PersonalLists = Record<PersonalListId, PersonalListState>;

const PERSONAL_INITIAL: PersonalLists = {
  'inventory-all': { query: '' },
  mothers: { query: '' },
};

const personalStore = createModuleStore<PersonalLists>(PERSONAL_INITIAL);

export function usePersonalList(id: PersonalListId): PersonalListState {
  return personalStore.use()[id];
}

export function setPersonalQuery(id: PersonalListId, query: string): void {
  const current = personalStore.get();
  if (current[id].query === query) return;
  personalStore.set({ ...current, [id]: { query } });
}

export function resetPersonalListViewsForTest(): void {
  personalStore.set({
    'inventory-all': { query: '' },
    mothers: { query: '' },
  });
}

export interface GroupListState {
  query: string;
  /**
   * `help` / `all` 是一期遗留值：新界面改成「我缺的 / 需求中心 / 共同寻找」，
   * 读到旧值时按「需求中心」处理（见 MotherGroupResources）。
   */
  view: 'missing' | 'mine' | 'seeking' | 'help' | 'all';
  /** 「需求中心」的需求方筛选（单选）；空 = 全部需求方。 */
  memberFilter: string;
  /**
   * 「我缺的」能补我的成员（多选）：空 = 全部成员。
   * 勾多个人时取并集——只要其中一人能补就算命中（2026-10-28 用户口径）。
   */
  missingMembers: string[];
  /**
   * 「共同寻找」的范围（多选）：空 = 全部成员。
   * 与 memberFilter 分开记：前者回答「我们几个共同缺什么」，后者回答「谁有 / 谁缺」。
   */
  seekingMembers: string[];
  onlyOwned: boolean;
  /** 只看我发过需求的蛋（2026-10-26）。 */
  onlyDemanded: boolean;
  /** 「我缺的」目标口径：只影响查看与下一次发需求的默认值，不改已发需求。 */
  targetGender: DemandGender;
  targetNature: string;
  targetBody: DemandBody;
  targetVoice: DemandVoice;
  /** 我缺的类型：母本（按蛋）或种公（按蛋组）。 */
  targetKind: 'mother' | 'stud';
  /** 种公页只显示「组内有人能产」的推荐。 */
  onlyGroupLine: boolean;
}

const GROUP_DEFAULT: GroupListState = {
  query: '',
  view: 'missing',
  memberFilter: '',
  missingMembers: [],
  seekingMembers: [],
  onlyOwned: false,
  onlyDemanded: false,
  targetGender: DEFAULT_DEMAND_GENDER,
  targetNature: '',
  targetBody: DEFAULT_DEMAND_BODY,
  targetVoice: DEFAULT_DEMAND_VOICE,
  targetKind: 'mother',
  onlyGroupLine: false,
};

/**
 * 「我缺的」目标口径（2026-11-01 用户反馈：每次进小组都要重新调「小不点 +100」，很麻烦）。
 *
 * 和查询 / 成员筛选这些**临时**查看条件不同，这几项是「我想追什么」，跨小组、跨会话都该沿用，
 * 所以单独落 localStorage。它是发布需求的默认值来源，读回来要逐项校验（手改 / 旧版本的脏值
 * 会让发布口径悄悄变掉）。
 */
type TargetCriteria = Pick<
  GroupListState,
  'targetGender' | 'targetNature' | 'targetBody' | 'targetVoice' | 'targetKind'
>;

const TARGET_CRITERIA_DEFAULT: TargetCriteria = {
  targetGender: DEFAULT_DEMAND_GENDER,
  targetNature: '',
  targetBody: DEFAULT_DEMAND_BODY,
  targetVoice: DEFAULT_DEMAND_VOICE,
  targetKind: 'mother',
};

const TARGET_CRITERIA_FIELDS = [
  'targetGender',
  'targetNature',
  'targetBody',
  'targetVoice',
  'targetKind',
] as const satisfies ReadonlyArray<keyof GroupListState>;

const isOneOf = <T extends string>(options: readonly T[], value: unknown): value is T =>
  options.includes(value as T);

const targetCriteriaStore = createModuleStore<TargetCriteria>(TARGET_CRITERIA_DEFAULT, {
  persistKey: 'roco.groupTargetCriteria',
  migrate: (loaded) => ({
    targetGender: isOneOf(DEMAND_GENDERS, loaded?.targetGender)
      ? loaded.targetGender
      : TARGET_CRITERIA_DEFAULT.targetGender,
    targetNature: typeof loaded?.targetNature === 'string' ? loaded.targetNature : '',
    targetBody: isOneOf(DEMAND_BODIES, loaded?.targetBody)
      ? loaded.targetBody
      : TARGET_CRITERIA_DEFAULT.targetBody,
    targetVoice: isOneOf(DEMAND_VOICES, loaded?.targetVoice)
      ? loaded.targetVoice
      : TARGET_CRITERIA_DEFAULT.targetVoice,
    targetKind: loaded?.targetKind === 'stud' ? 'stud' : 'mother',
  }),
});

const keyOf = (accountId: string, groupId: string): string => `${accountId}|${groupId}`;

type GroupLists = Record<string, GroupListState>;

const groupStore = createModuleStore<GroupLists>({});

/** 当前本次会话最近一次看到的小组身份（用于换身份时清旧临时态） */
let lastGroupAccountId: string | null = null;

export function ensureGroupSession(accountId: string): void {
  if (lastGroupAccountId !== null && lastGroupAccountId !== accountId) {
    groupStore.set({});
  }
  lastGroupAccountId = accountId;
}

export function useGroupList(accountId: string, groupId: string): GroupListState {
  const session = groupStore.use()[keyOf(accountId, groupId)] ?? GROUP_DEFAULT;
  // 目标口径走持久化 store：临时查看条件（查询 / 成员筛选等）仍在会话里
  const target = targetCriteriaStore.use();
  return { ...session, ...target };
}

export function setGroupList(
  accountId: string,
  groupId: string,
  patch: Partial<GroupListState>,
): void {
  const sessionPatch: Partial<GroupListState> = {};
  let targetChanged = false;
  const nextTarget: TargetCriteria = { ...targetCriteriaStore.get() };
  for (const [field, value] of Object.entries(patch) as Array<
    [keyof GroupListState, unknown]
  >) {
    if ((TARGET_CRITERIA_FIELDS as readonly string[]).includes(field)) {
      (nextTarget as Record<string, unknown>)[field] = value;
      targetChanged = true;
      continue;
    }
    (sessionPatch as Record<string, unknown>)[field] = value;
  }
  if (targetChanged) targetCriteriaStore.set(nextTarget);
  if (Object.keys(sessionPatch).length === 0) return;
  const key = keyOf(accountId, groupId);
  const current = groupStore.get();
  groupStore.set({ ...current, [key]: { ...(current[key] ?? GROUP_DEFAULT), ...sessionPatch } });
}

export function clearGroupListSession(): void {
  lastGroupAccountId = null;
  groupStore.set({});
}

/** 供单元测试复位：目标口径是持久化的，测试之间要单独清。 */
export function resetGroupTargetCriteriaForTest(): void {
  targetCriteriaStore.set({ ...TARGET_CRITERIA_DEFAULT });
  try {
    window.localStorage.removeItem('roco.groupTargetCriteria');
  } catch {
    // 忽略
  }
}

/** 重置导入数据时清空个人清单搜索与小组临时筛选。 */
export function resetListViews(): void {
  personalStore.set({
    'inventory-all': { query: '' },
    mothers: { query: '' },
  });
  clearGroupListSession();
}
