import { beforeEach, describe, expect, test } from 'vitest';
import { member, resourceWith } from '../test/fixtures/motherSharing';
import type {
  CollectionDemand,
  CollectionGroupDetail,
  CollectionGroupSummary,
} from '../shared/collectionGroups';
import {
  clearCollectionGroupCache,
  clearCollectionGroupCacheDemands,
  clearCollectionGroupCacheDetail,
  readCollectionGroupCache,
  readCollectionGroupCacheDemands,
  readCollectionGroupCacheDetail,
  saveCollectionGroupCacheDemands,
  saveCollectionGroupCacheDetail,
  saveCollectionGroupCacheGroups,
} from './collectionGroupCache';

const summary = (id: string, groupType: 'mother' | 'stud'): CollectionGroupSummary => ({
  id,
  name: id,
  ownerAccountId: 'A',
  memberCount: 1,
  groupType,
  targetRevision: 0,
  targetReady: true,
});

const detail = (id: string, groupType: 'mother' | 'stud'): CollectionGroupDetail => ({
  group: {
    id,
    name: id,
    ownerAccountId: 'A',
    createdAt: 1,
    groupType,
    targetRevision: 0,
    resourceEpoch: 0,
    target: null,
  },
  members: [
    {
      ...member('A', resourceWith([101])),
      studResource: null,
    },
  ],
});

const demand = (groupId: string, eggGameId: number): CollectionDemand => ({
  groupId,
  demanderAccountId: 'A',
  eggGameId,
  nature: '固执',
  gender: '母',
  body: '大块头',
  voice: '+100',
  status: 'open',
  claimerAccountId: null,
  version: 0,
  createdAt: 1,
  updatedAt: 2,
});

beforeEach(() => {
  window.localStorage.clear();
});

describe('小组页缓存（二期）', () => {
  test('列表与每个组的详情分开存，切组读得到、互不顶掉', () => {
    saveCollectionGroupCacheGroups('A', [summary('gm', 'mother'), summary('gs', 'stud')]);
    saveCollectionGroupCacheDetail('A', detail('gm', 'mother'));
    saveCollectionGroupCacheDetail('A', detail('gs', 'stud'));
    const cache = readCollectionGroupCache('A');
    expect(cache?.groups.map((group) => group.id)).toEqual(['gm', 'gs']);
    // 详情按组单独一个 key：切组时直接读这一组就能秒开（2026-10-31）
    expect(readCollectionGroupCacheDetail('A', 'gm')?.group.groupType).toBe('mother');
    expect(readCollectionGroupCacheDetail('A', 'gs')?.group.groupType).toBe('stud');
  });

  test('写某一组的详情不会动到别的组', () => {
    saveCollectionGroupCacheDetail('A', detail('gm', 'mother'));
    saveCollectionGroupCacheDetail('A', detail('gs', 'stud'));
    saveCollectionGroupCacheDetail('A', detail('gm', 'mother'));
    expect(readCollectionGroupCacheDetail('A', 'gs')).not.toBeNull();
  });

  test('只清指定组的详情，别的组保留', () => {
    saveCollectionGroupCacheDetail('A', detail('gm', 'mother'));
    saveCollectionGroupCacheDetail('A', detail('gs', 'stud'));
    clearCollectionGroupCacheDetail('A', 'gm');
    expect(readCollectionGroupCacheDetail('A', 'gm')).toBeNull();
    expect(readCollectionGroupCacheDetail('A', 'gs')).not.toBeNull();
  });

  test('清空账号缓存时把各组的详情一起清掉（换号不会读到别人的组）', () => {
    saveCollectionGroupCacheGroups('A', [summary('gm', 'mother')]);
    saveCollectionGroupCacheDetail('A', detail('gm', 'mother'));
    saveCollectionGroupCacheDetail('A', detail('gs', 'mother'));
    clearCollectionGroupCache('A');
    expect(readCollectionGroupCache('A')).toBeNull();
    expect(readCollectionGroupCacheDetail('A', 'gm')).toBeNull();
    expect(readCollectionGroupCacheDetail('A', 'gs')).toBeNull();
  });

  test('需求列表按组单独存：进组先出需求，不用等接口', () => {
    saveCollectionGroupCacheDemands('A', 'gm', [demand('gm', 101)]);
    saveCollectionGroupCacheDemands('A', 'gs', [demand('gs', 102)]);
    expect(readCollectionGroupCacheDemands('A', 'gm')?.[0].eggGameId).toBe(101);
    expect(readCollectionGroupCacheDemands('A', 'gs')?.[0].eggGameId).toBe(102);
    // 清详情不该把需求一起清掉（两件事分别失效）
    clearCollectionGroupCacheDetail('A', 'gm');
    expect(readCollectionGroupCacheDemands('A', 'gm')?.[0].eggGameId).toBe(101);
    clearCollectionGroupCacheDemands('A', 'gm');
    expect(readCollectionGroupCacheDemands('A', 'gm')).toBeNull();
  });

  test('退出登录清缓存时，各组的详情与需求一起清掉', () => {
    saveCollectionGroupCacheDetail('A', detail('gm', 'mother'));
    saveCollectionGroupCacheDemands('A', 'gm', [demand('gm', 101)]);
    clearCollectionGroupCache('A');
    expect(readCollectionGroupCacheDetail('A', 'gm')).toBeNull();
    expect(readCollectionGroupCacheDemands('A', 'gm')).toBeNull();
  });

  test('需求缓存损坏或结构不符按不存在处理', () => {
    window.localStorage.setItem('roco.collectionGroupDemands:A:gm', '{bad json');
    expect(readCollectionGroupCacheDemands('A', 'gm')).toBeNull();
    window.localStorage.setItem(
      'roco.collectionGroupDemands:A:gm',
      JSON.stringify({ schemaVersion: 3, savedAt: 1, demands: [{ eggGameId: 'x' }] }),
    );
    expect(readCollectionGroupCacheDemands('A', 'gm')).toBeNull();
  });

  test('旧版本或损坏的缓存按不存在处理', () => {
    window.localStorage.setItem('roco.collectionGroupCache:A', '{bad json');
    expect(readCollectionGroupCache('A')).toBeNull();
    window.localStorage.setItem(
      'roco.collectionGroupCache:A',
      JSON.stringify({ schemaVersion: 1, groups: [], details: {}, savedAt: 1 }),
    );
    expect(readCollectionGroupCache('A')).toBeNull();
  });
});
