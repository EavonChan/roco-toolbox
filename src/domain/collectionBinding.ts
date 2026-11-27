/**
 * 「绑定游戏号」的四个勾选态（2026-11-27）。
 *
 * 为什么需要这层：服务端发布是**整份替换**——`publishMemberResource()` 先删掉本人在本组的
 * 全部 `mother_group_accounts`，再按本次选号插入。也就是说「从选号里去掉一个号」= 解绑，
 * 机器人立刻认不到那个 UID。老界面只画了绿框，用户看不出"这一勾一取消"分别是绑定还是解绑。
 *
 * 四个态按「线上是否已发布」× 「本次是否勾选」：
 * - 已发布 + 勾着 = 已绑定
 * - 已发布 + 取消 = 将解绑（发布前必须再确认一次）
 * - 没发布 + 勾上 = 将绑定
 * - 没发布 + 没勾 = 未绑定
 */
export type BindingState = '已绑定' | '将绑定' | '将解绑' | '未绑定';

export function bindingStateOf(input: { selected: boolean; published: boolean }): BindingState {
  if (input.published) return input.selected ? '已绑定' : '将解绑';
  return input.selected ? '将绑定' : '未绑定';
}

/** 「将解绑」的确认文案：解绑 = 机器人马上认不到这个号，必须把号名列出来。 */
export function unbindConfirmText(names: readonly string[]): string {
  const list = names.join('、');
  const count = names.length;
  return `解绑后机器人就认不到这些游戏号了：${list}。确定要解绑这 ${count} 个号吗？`;
}
