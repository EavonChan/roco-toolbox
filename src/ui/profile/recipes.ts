import { CollectSection } from './sections/CollectSection';
import { EntriesSection } from './sections/EntriesSection';
import { IdentitySection } from './sections/IdentitySection';
import { NewUserSection } from './sections/NewUserSection';
import { SettingsSection } from './sections/SettingsSection';
import { TodosSection } from './sections/TodosSection';
import { hasData, isNewUser, type SectionDef } from './types';

/**
 * 「我的」页配方（2026-11-28）。
 *
 * 回退 = 只改 `PROFILE_ACTIVE` 这一行，不动任何组件：
 * - `PROFILE_REORDER_V2`：重排后（身份 → 待处理 → 三个入口 → 采集 → 更多/设置）；
 * - `PROFILE_STABLE_V1`：重排前的结构快照（身份 → 三个入口 → 采集 → 更多/设置）。
 *
 * 区块之间不互相 import；共享数据从 `ProfilePageContext` 进。
 */
const IDENTITY: SectionDef = {
  id: 'identity',
  title: '身份',
  render: IdentitySection,
};

const TODOS: SectionDef = {
  id: 'todos',
  title: '待处理',
  render: TodosSection,
  // 有数据、取数结束，且至少一项已知（或本机有蹲守目标）才出现；
  // 不知道时不写「没有要处理的」，避免把「没取到」当「没有」。
  when: (ctx) =>
    hasData(ctx) &&
    ctx.todos.loaded &&
    (ctx.todos.known || ctx.todos.nearbyTargets > 0),
};

const ENTRIES: SectionDef = {
  id: 'entries',
  title: '三个入口',
  render: EntriesSection,
  when: hasData,
};

const NEW_USER: SectionDef = {
  id: 'new-user',
  title: '新用户空态',
  render: NewUserSection,
  when: isNewUser,
};

const COLLECT: SectionDef = {
  id: 'collect',
  title: '采集与同步',
  render: CollectSection,
  when: hasData,
};

const SETTINGS: SectionDef = {
  id: 'settings',
  title: '更多与设置',
  render: SettingsSection,
  // 设置类内容不进新用户首屏（RUI-03：其余块等他有了数据再出现）
  when: hasData,
};

/** 重排前的「我的」页结构（拆块后的稳定快照，可整体回退用）。 */
export const PROFILE_STABLE_V1: SectionDef[] = [IDENTITY, ENTRIES, COLLECT, SETTINGS];

/** 重排后的结构：首屏先回答「我现在什么状态 / 有什么要处理」。 */
export const PROFILE_REORDER_V2: SectionDef[] = [
  IDENTITY,
  TODOS,
  ENTRIES,
  NEW_USER,
  COLLECT,
  SETTINGS,
];

/** 线上使用哪份配方。回退一行：改成 PROFILE_STABLE_V1。 */
export const PROFILE_ACTIVE: SectionDef[] = PROFILE_REORDER_V2;

export type SectionId = (typeof PROFILE_ACTIVE)[number]['id'];

/** 调试/测试用：按 id 找区块。 */
export function sectionById(recipe: readonly SectionDef[], id: string): SectionDef | undefined {
  return recipe.find((section) => section.id === id);
}
