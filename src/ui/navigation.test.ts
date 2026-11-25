import { describe, expect, test } from 'vitest';
import {
  eggStockPending,
  focusPending,
  initialNavigation,
  legacyLocation,
  resolveNavigation,
  type AppNavigation,
  type CollectionLocation,
} from './navigation';

const EGG_LOCATION: CollectionLocation = { kind: 'studs', view: 'eggs' };

const openCollection = (current: AppNavigation, location: CollectionLocation): AppNavigation =>
  resolveNavigation(current, { type: 'open-collection', location });

describe('initialNavigation：旧页签 / 子视图映射', () => {
  test.each([
    ['dashboard', null, 'dashboard'],
    ['home', null, 'home'],
    ['myPets', null, 'collection'],
    ['coverage', null, 'collection'],
    ['swap', 'eggs', 'groups'],
    ['swap', null, 'groups'],
    ['swap', 'sharing', 'groups'],
    ['import', null, 'profile'],
    [null, null, 'profile'],
    ['nope', null, 'profile'],
  ] as const)('lastTab=%s swapView=%s → page=%s', (lastTab, swapView, page) => {
    expect(initialNavigation(lastTab, swapView).page).toBe(page);
  });

  test('旧 myPets 进入精灵背包的全部精灵', () => {
    expect(initialNavigation('myPets', null).collection).toEqual({ kind: 'inventory' });
  });

  test('旧 coverage 进入种公覆盖矩阵', () => {
    expect(initialNavigation('coverage', null).collection).toEqual({
      kind: 'studs',
      view: 'coverage',
    });
  });

  test('旧 swap + 旧求蛋子视图落到小组 · 个人求种公', () => {
    expect(initialNavigation('swap', 'nonsense').page).toBe('groups');
    expect(initialNavigation('swap', 'nonsense').groupType).toBe('stud');
    expect(initialNavigation('swap', 'eggs').groupType).toBe('stud');
    expect(initialNavigation('swap', 'sharing').groupType).toBeUndefined();
  });

  test('默认（空存储）落在我的 · 游戏数据', () => {
    const nav = initialNavigation(null, null);
    expect(nav.page).toBe('profile');
    expect(nav.profileSection).toBe('data');
  });

  test('初始收集落点为母本未收集', () => {
    expect(initialNavigation('dashboard', null).collection).toEqual({
      kind: 'mothers',
      status: 'missing',
    });
  });
});

describe('resolveNavigation：意图', () => {
  test('从共享恢复后，种公求蛋意图切回小组并带类型', () => {
    const restored = initialNavigation('swap', 'sharing');
    expect(restored.page).toBe('groups');
    const next = resolveNavigation(restored, {
      type: 'open-groups',
      groupType: 'stud',
    });
    expect(next.page).toBe('groups');
    expect(next.groupType).toBe('stud');
  });

  test('切普通主导航只改 page，保留同次会话子视图', () => {
    const inEggs = openCollection(initialNavigation('dashboard', null), EGG_LOCATION);
    const dashboard = resolveNavigation(inEggs, { type: 'tab', page: 'dashboard' });
    expect(dashboard.page).toBe('dashboard');
    expect(dashboard.collection).toEqual(EGG_LOCATION);

    const back = resolveNavigation(dashboard, { type: 'tab', page: 'collection' });
    expect(back.page).toBe('collection');
    expect(back.collection).toEqual(EGG_LOCATION);
  });

  test('重复直达同一目标也递增 focusRevision（聚焦 effect 必须重跑）', () => {
    const first = openCollection(initialNavigation('dashboard', null), EGG_LOCATION);
    const second = openCollection(first, EGG_LOCATION);
    expect(second.focusRevision).toBe(first.focusRevision + 1);
  });

  test('直达切换子视图后不再保留旧蛋组聚焦', () => {
    const focused = openCollection(initialNavigation('dashboard', null), {
      kind: 'studs',
      view: 'coverage',
      groupId: 5,
    });
    expect(focused.collection).toMatchObject({ groupId: 5 });
  });

  test('打开我的可要求「返回小组」，切普通主导航会清掉它', () => {
    const profile = resolveNavigation(initialNavigation('swap', 'sharing'), {
      type: 'open-profile',
      section: 'identity',
      returnToGroups: true,
    });
    expect(profile.page).toBe('profile');
    expect(profile.profileSection).toBe('identity');
    expect(profile.returnToGroups).toBe(true);
    expect(resolveNavigation(profile, { type: 'tab', page: 'dashboard' }).returnToGroups).toBe(false);
  });

  test('打开小组可带收集类型，手动切页后清掉', () => {
    const groups = resolveNavigation(initialNavigation('dashboard', null), {
      type: 'open-groups',
      groupType: 'stud',
    });
    expect(groups.page).toBe('groups');
    expect(groups.groupType).toBe('stud');
    expect(
      resolveNavigation(groups, { type: 'tab', page: 'groups' }).groupType,
    ).toBeUndefined();
  });
});

describe('蛋仓直达（U2「我的」→ 换蛋 · 蛋仓，2026-11-25）', () => {
  test('open-egg-stock 切到换蛋页并挂起一次蛋仓请求', () => {
    const nav = resolveNavigation(initialNavigation('profile', null), { type: 'open-egg-stock' });
    expect(nav.page).toBe('groups');
    expect(eggStockPending(nav)).toBe(true);
    expect(nav.eggStockRevision).toBe(1);
  });

  test('请求被消费后仍记住来源是「我的」，返回该回我的而不是换蛋页', () => {
    const opened = resolveNavigation(initialNavigation('profile', null), { type: 'open-egg-stock' });
    expect(opened.eggStockFromProfile).toBe(true);
    const consumed = resolveNavigation(opened, {
      type: 'consume-egg-stock',
      revision: opened.eggStockRevision,
    });
    // 消费只影响「要不要再自动打开」，不影响来源：用户在蛋仓屏里点返回还得回「我的」
    expect(eggStockPending(consumed)).toBe(false);
    expect(consumed.eggStockFromProfile).toBe(true);
  });

  test('离开换蛋页（切页签 / 打开我的 / 打开小组 / 去收集）后来源作废', () => {
    const opened = resolveNavigation(initialNavigation('profile', null), { type: 'open-egg-stock' });
    const intents: NavigationIntent[] = [
      { type: 'tab', page: 'groups' },
      { type: 'open-profile', section: 'data' },
      { type: 'open-groups' },
      { type: 'open-collection', location: EGG_LOCATION },
    ];
    for (const intent of intents) {
      expect(resolveNavigation(opened, intent).eggStockFromProfile).toBe(false);
    }
  });

  test('重复直达同一目标也递增（第二次点也要重新打开蛋仓）', () => {
    const first = resolveNavigation(initialNavigation('profile', null), { type: 'open-egg-stock' });
    const consumed = resolveNavigation(first, {
      type: 'consume-egg-stock',
      revision: first.eggStockRevision,
    });
    expect(eggStockPending(consumed)).toBe(false);
    const second = resolveNavigation(consumed, { type: 'open-egg-stock' });
    expect(second.eggStockRevision).toBe(2);
    expect(eggStockPending(second)).toBe(true);
  });

  test('晚到的旧消费不能清掉后来的新请求', () => {
    const first = resolveNavigation(initialNavigation('profile', null), { type: 'open-egg-stock' });
    const second = resolveNavigation(first, { type: 'open-egg-stock' });
    const late = resolveNavigation(second, {
      type: 'consume-egg-stock',
      revision: first.eggStockRevision,
    });
    expect(late).toBe(second);
    expect(eggStockPending(late)).toBe(true);
  });
});

describe('focusRevision 消费', () => {
  test('成功后 consume-focus 关闭待聚焦；旧消费不改状态', () => {
    const nav = openCollection(initialNavigation('dashboard', null), EGG_LOCATION);
    expect(focusPending(nav)).toBe(true);

    const stale = resolveNavigation(nav, { type: 'consume-focus', revision: nav.focusRevision - 1 });
    expect(stale).toBe(nav);
    expect(focusPending(stale)).toBe(true);

    const consumed = resolveNavigation(nav, { type: 'consume-focus', revision: nav.focusRevision });
    expect(focusPending(consumed)).toBe(false);
  });

  test('晚到的旧消费不能清掉后来的新直达', () => {
    const first = openCollection(initialNavigation('dashboard', null), EGG_LOCATION);
    const second = openCollection(first, EGG_LOCATION);
    const late = resolveNavigation(second, {
      type: 'consume-focus',
      revision: first.focusRevision,
    });
    expect(focusPending(late)).toBe(true);
  });
});

describe('legacyLocation：新页面写回旧键', () => {
  const base = initialNavigation('dashboard', null);

  test('小组 → swap/sharing', () => {
    expect(legacyLocation({ ...base, page: 'groups' })).toEqual({
      lastTab: 'swap',
      swapView: 'sharing',
    });
  });

  test('种公组 → swap/eggs；母本组 → swap/sharing', () => {
    expect(legacyLocation({ ...base, page: 'groups', groupType: 'stud' })).toEqual({
      lastTab: 'swap',
      swapView: 'eggs',
    });
    expect(legacyLocation({ ...base, page: 'groups', groupType: 'mother' })).toEqual({
      lastTab: 'swap',
      swapView: 'sharing',
    });
  });

  test('收集页的种公页不再写回已下线的 swap/eggs（2026-11-01 R2-5-M02）', () => {
    expect(legacyLocation({ ...base, page: 'collection', collection: EGG_LOCATION })).toEqual({
      lastTab: 'coverage',
      swapView: 'eggs',
    });
  });

  test('覆盖矩阵 → coverage', () => {
    expect(
      legacyLocation({
        ...base,
        page: 'collection',
        collection: { kind: 'studs', view: 'coverage' },
      }).lastTab,
    ).toBe('coverage');
  });

  test('库存 / 母本 → myPets；我的 → import；看板 → dashboard', () => {
    expect(
      legacyLocation({ ...base, page: 'collection', collection: { kind: 'inventory' } }).lastTab,
    ).toBe('myPets');
    expect(
      legacyLocation({ ...base, page: 'collection', collection: { kind: 'mothers', status: 'collecting' } })
        .lastTab,
    ).toBe('myPets');
    expect(legacyLocation({ ...base, page: 'profile' }).lastTab).toBe('import');
    expect(legacyLocation({ ...base, page: 'dashboard' }).lastTab).toBe('dashboard');
  });

  test('家园 → home', () => {
    expect(legacyLocation({ ...base, page: 'home' })).toEqual({
      lastTab: 'home',
      swapView: 'eggs',
    });
    expect(legacyLocation({ ...base, page: 'nearby' })).toEqual({
      lastTab: 'import',
      swapView: 'eggs',
    });
  });

  test('不把新 page 字符串写进旧 lastTab', () => {
    for (const page of ['dashboard', 'collection', 'groups', 'profile', 'nearby'] as const) {
      expect(['dashboard', 'myPets', 'coverage', 'swap', 'import']).toContain(
        legacyLocation({ ...base, page }).lastTab,
      );
    }
  });
});
