/**
 * 账号排序与配窝建议账号格列数（2026-11-20 用户口径）。
 *
 * - 账号名里有数字的**先按数字排**（「洛筱（2号）」排在「洛迩（3号）」前面，
 *   不再被前缀的拼音挤到第六位），没有数字的账号排在数字号前面、彼此按拼音排；
 *   重名时补的「(UID)」后缀不参与数字判断。
 * - 看板 / 家园 / 收集等所有列出账号的地方共用 compareAccountNames，
 *   排序口径只有这一份。
 * - 配窝建议账号格：一行放 3 个账号；名字（含「N 窝」小字）放不下就整行改 2 个；
 *   再放不下就 1 个。任何情况下都不换行、不截断账号名。
 */

const nameCollator = new Intl.Collator('zh-Hans-CN', {
  numeric: true,
  sensitivity: 'base',
});

/** 重名时 labelerFor 补的「(UID)」后缀（半角括号）：排序时去掉，不能把 UID 当成账号号。 */
const withoutUidSuffix = (name: string): string => name.replace(/\s*\(\d+\)\s*$/u, '');

/** 名字里的第一个数字（全角数字先转半角）；没有数字返回 null。 */
const firstNumberIn = (name: string): number | null => {
  const match = withoutUidSuffix(name).normalize('NFKC').match(/\d+/);
  return match ? Number(match[0]) : null;
};

/**
 * 账号名排序（2026-11-20 用户口径修正）：
 * 名字里有数字的按数字排，数字相同再按名字；没有数字的账号排在数字号前面。
 * 例：莱茵 → 洛筱（2号） → 洛迩（3号） → … → 洛乌（6号）。
 */
export function compareAccountNames(a: string, b: string): number {
  const nameA = withoutUidSuffix(a);
  const nameB = withoutUidSuffix(b);
  const numberA = firstNumberIn(nameA);
  const numberB = firstNumberIn(nameB);
  if (numberA !== null && numberB !== null) {
    return numberA - numberB || nameCollator.compare(nameA, nameB);
  }
  if (numberA !== null) return 1;
  if (numberB !== null) return -1;
  return nameCollator.compare(nameA, nameB);
}

/** 账号名列表排序（不改原数组）。 */
export function sortAccountNames(names: readonly string[]): string[] {
  return [...names].sort(compareAccountNames);
}

/** 按账号名给任意列表排序（账号快照 / 导入结果 / 小组共享账号等），不改原数组。 */
export function sortByAccountName<T>(
  items: readonly T[],
  accountNameOf: (item: T) => string,
): T[] {
  return [...items].sort((a, b) => compareAccountNames(accountNameOf(a), accountNameOf(b)));
}

/** 全角 / 中日韩字符按 12px、其余按 6.6px 估宽（账号格文字是 text-xs 12px）。 */
const isWide = (char: string): boolean =>
  /[\u1100-\u115f\u2e80-\ua4cf\uac00-\ud7a3\uf900-\ufaff\ufe30-\ufe4f\uff00-\uff60\uffe0-\uffe6]/.test(
    char,
  );

const CHAR_GAP = 6;

/** 账号格左右内边距合计（px-2）。 */
const TAB_PADDING = 16;

const textWidthOf = (text: string): number =>
  [...text].reduce((sum, char) => sum + (isWide(char) ? 12 : 6.6), 0);

/**
 * 一行放几个账号：标签 = 账号名 + 后面的小字（如「0 窝」「待补」）。
 * `availableWidth` 是账号格那一行的实际宽度；还没量到（0 / 负）时先按 3 个排。
 */
export function accountTabColumns(
  labels: readonly string[],
  availableWidth: number,
): 1 | 2 | 3 {
  if (availableWidth <= 0) return 3;
  const widest = Math.max(0, ...labels.map((label) => textWidthOf(label) + TAB_PADDING));
  const fits = (columns: 1 | 2 | 3): boolean =>
    (availableWidth - CHAR_GAP * (columns - 1)) / columns >= widest;
  if (fits(3)) return 3;
  if (fits(2)) return 2;
  return 1;
}
