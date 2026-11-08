import type { PetGrade } from '../domain/petFilters';
import { createModuleStore } from './createModuleStore';

/**
 * 跨号补种公任务（2026-11-03）：
 * 在种公阵列里选中的「源号配对 → 把蛋传给目标号」，记到看板的配窝建议里。
 * 本质是给自己补种公：源号孵出蛋、传蛋、目标号收货。
 */
export interface StudTransferTask {
  id: string;
  createdAt: number;
  targetAccount: string;
  sourceAccount: string;
  /** 蛋物种（母本蛋血脉）。 */
  eggGameId: number;
  motherGameId: number;
  motherName: string;
  motherNature: string;
  motherCaptureId?: string;
  fatherGameId: number;
  fatherName: string;
  fatherNature: string;
  fatherCaptureId?: string;
  natureName: string;
  grade: PetGrade;
  groupIds: number[];
  chance: number;
}

const KEY = 'roco.studTransferTask.v1';

const store = createModuleStore<StudTransferTask[]>([], { persistKey: KEY });

/** 同一个目标号 + 同一个源号 + 同一颗蛋 + 同一性格/档位，只记一条。 */
const taskKey = (task: Omit<StudTransferTask, 'id' | 'createdAt'>): string =>
  `${task.targetAccount}|${task.sourceAccount}|${task.eggGameId}|${task.natureName}|${task.grade}`;

export function addStudTransferTask(input: Omit<StudTransferTask, 'id' | 'createdAt'>): void {
  const key = taskKey(input);
  const current = store.get();
  if (current.some((task) => taskKey(task) === key)) return;
  store.set([...current, { ...input, id: key, createdAt: Date.now() }]);
}

export function removeStudTransferTask(id: string): void {
  store.set(store.get().filter((task) => task.id !== id));
}

export function useStudTransferTasks(): StudTransferTask[] {
  return store.use();
}

/** 测试之间复位（模块级状态会跨用例串味）。 */
export function resetStudTransferTasksForTest(): void {
  store.set([]);
}
