import { afterEach, describe, expect, test, vi } from 'vitest';

/**
 * 占窝勾选（R2-P1-02）：看板宽横屏会同时挂两份配窝卡，状态必须只有一份，
 * 并且**继续存在旧 key `roco.nestPicks.v1` 上**——老用户勾过的窝不能因为改实现就清零。
 */
const LEGACY_KEY = 'roco.nestPicks.v1';

afterEach(() => {
  localStorage.clear();
  vi.resetModules();
});

describe('nestPicksStore（占窝勾选唯一状态源）', () => {
  test('勾一窝即写到旧 key；重开 store 仍是同一份勾选', async () => {
    const store = await import('./nestPicksStore');
    store.setNestPicked(['账号甲|normal|m|f|大婉'], true);

    expect(store.getNestPicks()).toEqual({ '账号甲|normal|m|f|大婉': true });
    expect(JSON.parse(localStorage.getItem(LEGACY_KEY) ?? '{}')).toEqual({
      '账号甲|normal|m|f|大婉': true,
    });

    // 模拟刷新 / 重开应用：模块重新求值，只从 localStorage 读回
    vi.resetModules();
    const reloaded = await import('./nestPicksStore');
    expect(reloaded.getNestPicks()).toEqual({ '账号甲|normal|m|f|大婉': true });
  });

  test('取消勾选是删键，不留 false；一次勾一组只通知一次', async () => {
    const store = await import('./nestPicksStore');
    store.setNestPicked(['甲|a', '甲|b'], true);
    expect(store.getNestPicks()).toEqual({ '甲|a': true, '甲|b': true });

    const seen: Array<Record<string, boolean>> = [];
    store.subscribeNestPicks(() => seen.push(store.getNestPicks()));

    store.setNestPicked(['甲|a'], false);
    expect(store.getNestPicks()).toEqual({ '甲|b': true });
    expect(JSON.parse(localStorage.getItem(LEGACY_KEY) ?? '{}')).toEqual({ '甲|b': true });
    expect(seen).toEqual([{ '甲|b': true }]);

    // 取消一个本来就沒勾的键：状态没变，不该再通知（免得两栏互相抖）
    store.setNestPicked(['甲|a'], false);
    expect(seen).toHaveLength(1);
  });

  test('旧 key 上的脏数据一律当空：只保留 true，非对象退回 {}', async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify({ '甲|a': true, '甲|b': false, '甲|c': 1 }));
    let store = await import('./nestPicksStore');
    expect(store.getNestPicks()).toEqual({ '甲|a': true });

    localStorage.setItem(LEGACY_KEY, JSON.stringify([1, 2, 3]));
    vi.resetModules();
    store = await import('./nestPicksStore');
    expect(store.getNestPicks()).toEqual({});

    localStorage.setItem(LEGACY_KEY, '{坏 JSON');
    vi.resetModules();
    store = await import('./nestPicksStore');
    expect(store.getNestPicks()).toEqual({});
  });
});
