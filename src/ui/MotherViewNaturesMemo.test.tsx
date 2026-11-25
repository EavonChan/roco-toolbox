import { render } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { MotherGroup } from '../domain/petFilters';
import { DEFAULT_MOTHER_CRITERIA } from '../domain/motherCriteria';
import { MotherView } from './MotherView';
import { setMotherCriteria } from './motherCriteriaStore';
import { setTargetMode } from './targetModeStore';
import { clearMotherPlan } from './motherPlanStore';

/**
 * 推荐性格只按「蛋」算一次（2026-11-25 P3）。
 *
 * 旧实现渲染时对每一行再调一次 `eggNatures()`，和 `missingNaturesByEgg` 里算过的重复；
 * `defaultEggNatures` 内部是 `species.find()`（665 条线性扫），165 行一帧就要 11～21ms
 * （见 `docs/分析-收集页卡顿-2026-11-25.md`）。
 *
 * 这里锁的是「同一颗蛋在一次渲染里最多算一次」——不看时间，看调用次数与去重。
 */
const { natureCalls } = vi.hoisted(() => ({ natureCalls: [] as number[] }));

vi.mock('../domain/recommendedNatures', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../domain/recommendedNatures')>();
  return {
    ...actual,
    eggNatures: (speciesList: Parameters<typeof actual.eggNatures>[0], eggGameId: number, overrides?: Parameters<typeof actual.eggNatures>[2]) => {
      natureCalls.push(eggGameId);
      return actual.eggNatures(speciesList, eggGameId, overrides);
    },
  };
});

const groups: MotherGroup[] = [1, 2, 3, 4, 5, 6, 7, 8].map((id) => ({
  chainKey: `egg:${id}`,
  eggGameId: id,
  collected: false,
  quality: false,
  motherClass: null,
  formLabel: `测试精灵${id}`,
  number: String(id).padStart(3, '0'),
  eggGroups: [1],
  memberIndexes: [],
}));

beforeEach(() => {
  natureCalls.length = 0;
  clearMotherPlan();
  setMotherCriteria({ ...DEFAULT_MOTHER_CRITERIA });
  setTargetMode('perfect');
});

describe('MotherView 推荐性格计算次数', () => {
  test('8 条链、8 张卡：每颗蛋最多算一次，不随行数重复', () => {
    render(
      <MotherView
        owned={[]}
        searchIndex={new Map()}
        eggGroupNames={{ 1: '怪兽组' }}
        motherGroups={groups}
        mode="perfect"
        status="missing"
      />,
    );

    // 只看本用例这 8 颗蛋（id 1~8）。页面里还挂着「推荐性格」编辑器，
    // 它会把全图鉴的蛋也算一遍（另一个已知问题，见回执 P3b），不在本条断言范围。
    const forOurGroups = natureCalls.filter((eggGameId) => eggGameId >= 1 && eggGameId <= groups.length);
    // 旧实现：missingNaturesByEgg 8 次 + 每行 8 次 = 16 次，同一颗蛋算两遍
    expect(forOurGroups.length).toBe(groups.length);
    expect(new Set(forOurGroups).size).toBe(groups.length);
  });
});
