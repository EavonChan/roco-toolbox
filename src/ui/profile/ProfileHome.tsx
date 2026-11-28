import { PROFILE_ACTIVE } from './recipes';
import type { ProfilePageContext, SectionDef } from './types';

/**
 * 「我的」页的渲染器：按配方顺序逐块渲染，`when` 为 false 的块直接不出现（不占高度）。
 *
 * 页面壳（页签、二级分区、页脚版本）不在这里；这里只有首页的区块组合，
 * 所以删掉任意一块、或把配方换成 `PROFILE_STABLE_V1`，都不会影响别的页面。
 */
export interface ProfileHomeProps {
  ctx: ProfilePageContext;
  /** 默认用线上配方；测试可以传任意子集（含空数组） */
  recipe?: readonly SectionDef[];
}

export function ProfileHome({ ctx, recipe = PROFILE_ACTIVE }: ProfileHomeProps) {
  const visible = recipe.filter((section) => (section.when ? section.when(ctx) : true));
  return (
    <div data-testid="profile-home" data-sections={visible.map((section) => section.id).join(',')}>
      {visible.map((section) => (
        <section.render key={section.id} ctx={ctx} />
      ))}
    </div>
  );
}
