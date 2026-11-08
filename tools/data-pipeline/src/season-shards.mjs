// 新版 wiki（精灵图鉴/S5）把赛季数据拆成分片，打包成 [格式, 字段表, 数据] 三段式。
// 这里按 wiki 的 Module:精灵图鉴/S5 解码规则还原，并沿用它的合并语义。

import { parseLuaReturn } from './lua-tables.mjs';

const DEFAULT_CODEC = 'dragon-tuples-1';
const DEFAULT_OBJECT_TAG = 1;
const DEFAULT_ARRAY_TAG = 2;

/**
 * 解码一个赛季分片（Lua 源文本）。
 *
 * @param {string} text `return {codec, fields, payload}` 形式的 Lua 模块
 * @param {object} season 清单里的赛季配置（codec / object_tag / array_tag）
 */
export function decodeSeasonShard(text, season = {}) {
  return decodePackedShard(parseLuaReturn(text), season);
}

/** 解码已经解析成 JS 值的三段式分片。 */
export function decodePackedShard(packed, season = {}) {
  if (!Array.isArray(packed) || packed.length < 3) {
    throw new Error('赛季资料不是 [格式, 字段表, 数据] 三段式');
  }
  const codec = season.codec ?? DEFAULT_CODEC;
  if (packed[0] !== codec) {
    throw new Error(`不支持的赛季资料格式：${packed[0]}（期望 ${codec}）`);
  }
  const fields = packed[1];
  if (!Array.isArray(fields)) throw new Error('赛季资料字段表无效');

  const objectTag = season.object_tag ?? DEFAULT_OBJECT_TAG;
  const arrayTag = season.array_tag ?? DEFAULT_ARRAY_TAG;

  const decode = (value) => {
    if (!Array.isArray(value)) return value;
    const tag = value[0];
    const body = value[1] ?? [];
    if (tag === objectTag) {
      const out = {};
      for (const entry of body) {
        if (!Array.isArray(entry) || entry.length < 2) throw new Error('赛季资料对象节点格式无效');
        const key = fields[entry[0] - 1];
        if (typeof key !== 'string' || key === '') throw new Error(`赛季资料字段索引无效：${entry[0]}`);
        out[key] = decode(entry[1]);
      }
      return out;
    }
    if (tag === arrayTag) return body.map(decode);
    throw new Error(`赛季资料节点标签无效：${tag}`);
  };

  return decode(packed[2]);
}

/**
 * 把赛季分片并入图鉴，语义与 wiki 的 SeasonData 适配器一致：
 * 同键整条替换（`result[key] = value`），不是逐字段深合并。
 */
export function mergeSeasonCatalog(catalog, shard) {
  return { ...catalog, ...shard };
}

/** 读取赛季配置（view_namespace）与分片清单。 */
export function readSeasonManifest(seasonConfigText, manifestText) {
  const seasonConfig = parseLuaReturn(seasonConfigText);
  const manifest = parseLuaReturn(manifestText);
  return {
    viewNamespace: seasonConfig.view_namespace ?? '',
    seasons: manifest.seasons ?? [],
    current: manifest.current ?? null,
  };
}

/** 按清单拼出某个分片的模块标题，例如 Roster → Module:精灵图鉴/S5/数据/精灵。 */
export function seasonShardModuleTitle(season, kind) {
  const module = (season.modules ?? {})[kind] ?? kind;
  return `Module:${season.namespace}/${module}`;
}
