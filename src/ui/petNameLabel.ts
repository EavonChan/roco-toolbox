/**
 * 卡片上的精简名字（2026-11-22 用户口径）。
 *
 * 问题：图鉴里带形态的名字很长（`乌达_极夜的样子`、`石肤蜥_本来的样子`），
 * 10px 的卡上放不下，之前靠 `fitName` 把字号一路缩到 8px —— 结果同一行卡片
 * 字号不一样、短名字反而比长名字大，两列卡对不齐。
 *
 * 做法：名字里保留**基础名 + 精简形态**（`乌达·极夜`），字号恒为 10px；
 * 完整名仍然放在 `title` 里，鼠标悬停能看到原文。
 */

/** 形态里可省掉的尾巴：`极夜的样子` → `极夜`，`穿旧睡衣的样子` → `穿旧睡衣`。 */
const FORM_TAILS = ['的样子', '形态', '的模样'];

/** `乌达_极夜的样子` → `乌达·极夜`；没有形态或形态为空时只留基础名。
 *  超过 `maxLength` 时退到「只要基础名」，保证 10px 下不被截断。 */
export function compactPetName(fullName: string, maxLength = 7): string {
  const raw = (fullName ?? '').trim();
  if (!raw) return '';
  const [baseRaw, ...rest] = raw.split('_');
  const base = baseRaw.trim();
  const form = rest.join('_').trim();
  if (!form) return base;

  let short = form;
  for (const tail of FORM_TAILS) {
    if (short.endsWith(tail)) {
      short = short.slice(0, -tail.length);
      break;
    }
  }
  short = short.trim();
  if (!short) return base;
  const compact = `${base}·${short}`;
  return compact.length > maxLength ? base : compact;
}
