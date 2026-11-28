import type { AppNavigation } from './navigation';

/**
 * 「我的」页的滚动位置记忆（2026-11-28 FX1 ③，依据 `docs/评审-UI-2026-11-28.md` §6.5）。
 *
 * 只服务一个场景：**我的首页 → 「我的身份」/「我的小组」 → 返回首页**。
 * 不做全局路由的滚动恢复（那是 C 类改版，不在这一轮）：别的页面切换仍然回顶部。
 */

/** 离开「我的」首页去二级分区时，记下当前位置；其他跳转一律返回 null。 */
export function rememberProfileScroll(
  from: Pick<AppNavigation, 'page' | 'profileSection'>,
  to: Pick<AppNavigation, 'page' | 'profileSection'>,
  scrollY: number,
): number | null {
  const leavingHome = from.page === 'profile' && from.profileSection === 'data';
  const enteringSubPage = to.page === 'profile' && to.profileSection !== 'data';
  if (!leavingHome || !enteringSubPage) return null;
  // 停在全页最上面（没滚过）就不必记：返回时本来就该在顶部
  if (!Number.isFinite(scrollY) || scrollY <= 0) return null;
  return Math.round(scrollY);
}

/**
 * 返回首页时恢复到的位置：`min(记住的位置, 当前最大可滚)`。
 * 返回时数据变了、页面变短，就落到最大可滚处，不硬撑一个够不到的位置。
 */
export function restoreProfileScroll(saved: number, maxScroll: number): number {
  if (!Number.isFinite(saved) || saved <= 0) return 0;
  const limit = Number.isFinite(maxScroll) && maxScroll > 0 ? Math.round(maxScroll) : 0;
  return Math.min(Math.round(saved), limit);
}
