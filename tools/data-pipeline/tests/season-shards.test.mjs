import { describe, expect, test } from 'vitest';
import {
  decodeSeasonShard,
  mergeSeasonCatalog,
  readSeasonManifest,
  seasonShardModuleTitle,
} from '../src/season-shards.mjs';

const season = {
  array_tag: 2,
  codec: 'dragon-tuples-1',
  modules: { Arts: '技能', Aux: '辅助', Gifts: '特性', Links: '关联', Roster: '精灵' },
  namespace: '精灵图鉴/S5/数据',
  object_tag: 1,
};

// 打包结构：[codec, 字段名表（1 基）, 数据]。对象节点的键也走字段表，所以宠物键同样在表里。
const rosterText =
  'return {"dragon-tuples-1", {"pet_000638","name","number","egg_group"}, {1, {{1, {1, {{2,"小冥龙"},{3,"469"},{4,{2,{1}}}}}}}}}';

describe('decodeSeasonShard', () => {
  test('按字段表把对象节点还原成宠物记录', () => {
    expect(decodeSeasonShard(rosterText, season)).toEqual({
      pet_000638: { name: '小冥龙', number: '469', egg_group: [1] },
    });
  });

  test('数组节点还原成数组，嵌套对象继续解码', () => {
    const text =
      'return {"dragon-tuples-1", {"pet_000001","stats","hp","atk"}, {1, {{1, {1, {{2, {1, {{3,65},{4,66}}}}}}}}}}';
    expect(decodeSeasonShard(text, season)).toEqual({
      pet_000001: { stats: { hp: 65, atk: 66 } },
    });
  });

  test('缺省标签时按 wiki 默认值：对象 1、数组 2', () => {
    expect(decodeSeasonShard(rosterText, { codec: 'dragon-tuples-1' })).toEqual({
      pet_000638: { name: '小冥龙', number: '469', egg_group: [1] },
    });
  });

  test('格式版本不匹配时报错，避免静默读错数据', () => {
    expect(() => decodeSeasonShard('return {"dragon-tuples-2", {}, {}}', season)).toThrow(/格式/);
  });

  test('遇到未知节点标签时报错', () => {
    const text = 'return {"dragon-tuples-1", {"pet_000001","name"}, {1, {{1, {9, {{2,"喵喵"}}}}}}}';
    expect(() => decodeSeasonShard(text, season)).toThrow(/节点/);
  });

  test('字段索引越界时报错', () => {
    const text = 'return {"dragon-tuples-1", {"pet_000001"}, {1, {{1, {1, {{9,"喵喵"}}}}}}}';
    expect(() => decodeSeasonShard(text, season)).toThrow(/字段/);
  });
});

describe('mergeSeasonCatalog', () => {
  test('新增条目直接并入', () => {
    const base = { pet_000001: { name: '喵喵' } };
    const merged = mergeSeasonCatalog(base, { pet_000638: { name: '小冥龙' } });
    expect(merged).toEqual({ pet_000001: { name: '喵喵' }, pet_000638: { name: '小冥龙' } });
  });

  test('同键按 wiki 语义整条替换，不是逐字段深合并', () => {
    const base = { pet_000001: { name: '喵喵', stats: { hp: 65, atk: 66 } } };
    const merged = mergeSeasonCatalog(base, { pet_000001: { name: '喵喵' } });
    expect(merged.pet_000001).toEqual({ name: '喵喵' });
  });

  test('不改动传入的旧图鉴对象', () => {
    const base = { pet_000001: { name: '喵喵' } };
    mergeSeasonCatalog(base, { pet_000001: { name: '喵喵改' } });
    expect(base.pet_000001.name).toBe('喵喵');
  });
});

describe('readSeasonManifest / seasonShardModuleTitle', () => {
  test('从赛季配置与清单读出命名空间和赛季列表', () => {
    const seasonConfig = 'return {view_namespace="精灵图鉴/S5"}';
    const manifest =
      'return {current={season="S5",name="圣龙宝藏"},seasons={{array_tag=2,codec="dragon-tuples-1",modules={Roster="精灵"},namespace="精灵图鉴/S5/数据",object_tag=1}}}';
    const result = readSeasonManifest(seasonConfig, manifest);
    expect(result.viewNamespace).toBe('精灵图鉴/S5');
    expect(result.seasons).toHaveLength(1);
    expect(result.seasons[0].codec).toBe('dragon-tuples-1');
  });

  test('按赛季清单拼出分片模块标题', () => {
    expect(seasonShardModuleTitle(season, 'Roster')).toBe('Module:精灵图鉴/S5/数据/精灵');
  });
});
