import { useEffect, useState } from 'react';
import type { AccountImportResult } from '../domain/importDiff';
import {
  getLastImportResult,
  subscribeLastImportResult,
} from '../storage/lastImportStore';

/**
 * 「本次导入新增」的 hook（2026-10-04 从 lastImportStore 移出，storage 层只留非 React 逻辑）。
 *
 * 2026-11-28 CLEAN2：导入历史已删除，这里只剩最新一次结果（看板「本次新增」卡用）。
 */
export function useLastImportResult(): AccountImportResult[] | null {
  const [value, setValue] = useState<AccountImportResult[] | null>(getLastImportResult());

  useEffect(() => subscribeLastImportResult(setValue), []);

  return value;
}
