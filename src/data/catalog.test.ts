import { describe, expect, test } from 'vitest';
import { allNatureNames, species } from './catalog';
import catalogGenJson from './catalog.gen.json';
import productEggNatures from './productEggNatures.json';

/**
 * 图鉴管线把「多分支进化按最终形态汇总推荐性格」的结果烘进 `catalog.gen.json` 的 `eggRecommendedNatures`；
 * `catalog.ts` 随后会用产品数据（`productEggNatures.json`）覆盖同名字段，而产品数据现在覆盖了全部 209 颗蛋——
 * 物种层已经看不到管线值，所以这里直接读烘好的数据产物，守住这条汇总规则。
 */
const bakedEggNatures = (name: string): string[] | undefined => {
  const entries = (
    catalogGenJson as unknown as {
      species: Array<{ name: string; gameId: number; eggGameId?: number; eggRecommendedNatures?: string[] }>;
    }
  ).species.filter((entry) => entry.name === name && entry.eggGameId === entry.gameId);
  expect(entries, `${name} 在图鉴里应当只有一条「自成一蛋」的条目`).toHaveLength(1);
  return entries[0].eggRecommendedNatures;
};

describe('图鉴数据', () => {
  test('新赛季精灵（云梦豚 / 长江豚）已按蛋物种接入', () => {
    const base = species.find((entry) => entry.name === '云梦豚');
    const grown = species.find((entry) => entry.name === '长江豚');
    expect(base?.eggGameId).toBe(base?.gameId);
    // 长江豚是进化形态，归到云梦豚那颗蛋
    expect(grown?.eggGameId).toBe(base?.gameId);
  });

  test('可孵蛋物种都有蛋归属；图鉴缺性别比例时不能当成纯母', () => {
    const missing = species.filter(
      (entry) => entry.eggGroups.some((group) => group >= 2 && group <= 15) && entry.eggGameId == null,
    );
    // 例外：阿瓦鲨（3806 / 3807）是成熟形态，2026-11-17 用户拍板「彻底不计入任何蛋」，
    // 所以它虽然可孵蛋组、却没有蛋归属；除它之外不应再有漏归属的物种。
    expect(missing.map((entry) => entry.name)).toEqual(['阿瓦鲨', '阿瓦鲨']);
    const base = species.find((entry) => entry.name === '云梦豚');
    expect(base?.maleCapable).toBe(true);
  });

  test('多分支进化的蛋按最终形态汇总推荐性格（2026-10-25）', () => {
    // 小灵面自己只有 30% 调皮，但两个分支最终形态都是胆小为主 → 只推胆小
    expect(bakedEggNatures('小灵面')).toEqual(['胆小']);
    // 书魔虫两个分支各有主流（古卷执政官 聪明 / 古卷匣魔像 固执）→ 都保留
    expect(bakedEggNatures('书魔虫')).toEqual(['聪明', '固执']);
  });

  test('产品设定的推荐性格（2026-11-27）覆盖到对应的每一颗蛋', () => {
    const eggs = new Map(
      species.filter((entry) => entry.eggGameId === entry.gameId).map((entry) => [entry.gameId, entry]),
    );
    for (const [key, natures] of Object.entries(productEggNatures.natures)) {
      const egg = eggs.get(Number(key));
      expect(egg, `产品推荐性格里没有这颗蛋：${key}`).toBeTruthy();
      expect(egg!.eggRecommendedNatures).toEqual(natures);
      for (const nature of natures) expect(allNatureNames).toContain(nature);
    }
    // 图鉴原本没有推荐值的蛋也能用产品口径（2026-11-02 首版 → 2026-11-27 按孵蛋攻略表更新）
    expect(species.find((entry) => entry.name === '云梦豚')?.eggRecommendedNatures).toEqual([
      '胆小',
      '开朗',
      '急躁',
    ]);
  });
});
