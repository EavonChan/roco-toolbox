import type { AccountImportResult } from '../domain/importDiff';

/**
 * 「本次导入新增」结果的模块级缓存（localStorage 持久化由页面层的展示决定，见 useLastImportResult）。
 *
 * 导入 / 同步完成后写入，看板据此渲染卡片。切到别的页签再回来卡片还在
 * （页面组件会卸载重建，所以不能把结果放在组件自身的 state 里）。
 *
 * 2026-11-28 CLEAN2：导入历史（最近 5 次）随「导入历史」入口一起删除；
 * 本 store 只保留最新一次结果。云同步与采集入库都写这里。
 */
let result: AccountImportResult[] | null = null;
const listeners = new Set<(next: AccountImportResult[] | null) => void>();

export function getLastImportResult(): AccountImportResult[] | null {
  return result;
}

export function subscribeLastImportResult(
  listener: (next: AccountImportResult[] | null) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 写入最新一次结果（看板「本次新增」卡据此渲染）。 */
export function setLastImportResult(next: AccountImportResult[]): void {
  result = next;
  for (const listener of listeners) listener(next);
}

export function clearLastImportResult(): void {
  result = null;
  for (const listener of listeners) listener(null);
}

/** 仅供测试：清空缓存。 */
export function resetLastImportForTest(): void {
  result = null;
  listeners.clear();
}
