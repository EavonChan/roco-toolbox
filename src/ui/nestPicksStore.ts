import { createModuleStore } from './createModuleStore';

/**
 * 配窝卡的「占窝勾选」唯一状态源（2026-11-22，R2-P1-02）。
 *
 * 用户口径（2026-11-20）：默认 **零个窝**，不按方案自动算；用户在对应号的配窝卡
 * 右上角自己点圆圈，种公卡和母本卡记在同一份窝数里。
 *
 * 为什么提升成模块级 store：看板宽横屏（≥1120px）会同时挂两份 `NestPlanCard`
 * （左「种公推荐」、右「母本缺口」）。以前两份实例各持一份 `useState`、各自整份
 * 回写 localStorage，任何一边再勾一次都会用「不含另一边新增」的那份整体覆盖，
 * 用户手动标记的窝位就丢了。现在两栏订阅同一个 store，只有一份数据。
 *
 * 持久化继续沿用旧 key `roco.nestPicks.v1`：老用户勾过的窝不能因为改实现就清零。
 */
export const NEST_PICKS_STORAGE_KEY = 'roco.nestPicks.v1';

/** 勾选表：键是 `账号|卡键`，值恒为 `true`（取消就是删键，不留 false）。 */
export type NestPicks = Record<string, boolean>;

/** localStorage 里可能是手改 / 旧版本的脏值：只保留值为 true 的键，其它一律丢掉。 */
const sanitize = (value: unknown): NestPicks => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const picks: NestPicks = {};
  for (const [key, picked] of Object.entries(value as Record<string, unknown>)) {
    if (picked === true) picks[key] = true;
  }
  return picks;
};

const store = createModuleStore<NestPicks>({}, {
  persistKey: NEST_PICKS_STORAGE_KEY,
  migrate: sanitize,
});

export function getNestPicks(): NestPicks {
  return store.get();
}

/** 页面 hook：取当前勾选并订阅变化（两个实例订阅同一份，勾一处两处一起变）。 */
export function useNestPicks(): NestPicks {
  return store.use();
}

export function subscribeNestPicks(listener: () => void): () => void {
  return store.subscribe(listener);
}

/**
 * 一次改一组卡的勾选（`picked` 为 true 勾上，false 删键）。
 *
 * 状态没变化时不写盘、不通知：两个实例互相订阅时不会来回抖，
 * 也避免每次渲染都往 localStorage 里写一遍。
 */
export function setNestPicked(keys: readonly string[], picked: boolean): void {
  const prev = store.get();
  let next: NestPicks | null = null;
  for (const key of keys) {
    if (picked) {
      if (prev[key] === true) continue;
      next ??= { ...prev };
      next[key] = true;
    } else {
      if (!(key in prev)) continue;
      next ??= { ...prev };
      delete next[key];
    }
  }
  if (next) store.set(next);
}

/** 供单元测试复位。 */
export function resetNestPicksForTest(): void {
  store.set({});
}
