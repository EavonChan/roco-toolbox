import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Profiler } from 'react';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { MotherGroup } from '../domain/petFilters';
import { DEFAULT_MOTHER_CRITERIA } from '../domain/motherCriteria';
import { MotherView } from './MotherView';
import { setMotherCriteria } from './motherCriteriaStore';
import { setTargetMode } from './targetModeStore';
import { clearMotherPlan } from './motherPlanStore';

/**
 * 渐进渲染（2026-11-25 P1）：横屏「首屏多给蛋组」的内容不削减，但不能一次全挂。
 *
 * 目标口径（用户：平板横着用）：
 * - 点「收集」进去，**先只挂 2~3 组**，首帧没有长任务；
 * - 其余的组在空闲时间一片 1~2 组追加，最终组数与现在一致（宽横屏 10 组）；
 * - 追加期间给占位骨架，高度固定，不能跳。
 *
 * 这里锁两件事：**首帧只挂 N 组** 与 **最终组数不变**（不是时间阈值）。
 */

/** 模拟宽横屏（≥1120px 横屏 → 首屏目标 10 组）；jsdom 没有 matchMedia。 */
function stubWideLandscape(): () => void {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query.includes('landscape'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  return () => {
    window.matchMedia = original;
  };
}

/** 10 条各自落在不同蛋组的链 → 10 个蛋组分区 */
const groups: MotherGroup[] = Array.from({ length: 10 }, (_, index) => {
  const id = index + 1;
  return {
    chainKey: `egg:${id}`,
    eggGameId: id,
    collected: false,
    quality: false,
    motherClass: null,
    formLabel: `测试精灵${id}`,
    number: String(id).padStart(3, '0'),
    eggGroups: [id],
    memberIndexes: [],
  };
});

const sectionSelector = () => screen.queryAllByTestId(/^mother-chain-group-\d+$/);

let restoreMatchMedia: () => void;

beforeEach(() => {
  clearMotherPlan();
  setMotherCriteria({ ...DEFAULT_MOTHER_CRITERIA });
  setTargetMode('perfect');
  restoreMatchMedia = stubWideLandscape();
});

afterEach(() => {
  restoreMatchMedia();
});

function renderView() {
  return render(
    <MotherView
      owned={[]}
      searchIndex={new Map()}
      eggGroupNames={Object.fromEntries(groups.map((group) => [group.eggGroups[0], `蛋组${group.eggGroups[0]}`]))}
      motherGroups={groups}
      mode="perfect"
      status="missing"
    />,
  );
}

/** 带 Profiler 渲染：每次提交时记录「当时屏上有几个组」，用来抓中间那次整屏提交 */
function renderViewProfiled(commits: number[]) {
  return render(
    <Profiler
      id="mothers"
      onRender={() => {
        commits.push(sectionSelector().length);
      }}
    >
      <MotherView
        owned={[]}
        searchIndex={new Map()}
        eggGroupNames={Object.fromEntries(groups.map((group) => [group.eggGroups[0], `蛋组${group.eggGroups[0]}`]))}
        motherGroups={groups}
        mode="perfect"
        status="missing"
      />
    </Profiler>,
  );
}

describe('母本列表渐进渲染', () => {
  test('首帧只挂前几组，剩下的用骨架占位', () => {
    renderView();

    // 首帧不等空闲回调：只挂前 2 组（宽横屏目标是 10 组）
    expect(sectionSelector()).toHaveLength(2);
    // 剩下 8 组给骨架，高度固定（不能让页面先矮后高）
    const skeletons = screen.getAllByTestId('mother-chain-skeleton');
    expect(skeletons).toHaveLength(8);
    for (const skeleton of skeletons) {
      expect(skeleton.style.height).toMatch(/px$/);
    }
  });

  test('空闲后补齐到目标组数：最终仍是 10 组，骨架全部消失', async () => {
    renderView();

    await waitFor(() => expect(sectionSelector()).toHaveLength(10));
    expect(screen.queryAllByTestId('mother-chain-skeleton')).toHaveLength(0);
    // 内容没被削减：10 条链全部还是渲染出来了
    expect(screen.getAllByTestId('mother-chain-row')).toHaveLength(10);
    // 目标组数内不出现「显示更多蛋组」
    expect(screen.queryByTestId('mother-chain-show-more')).toBeNull();
  });

  /**
   * PERF-01（2026-11-26 审查）：重置如果写在 `useEffect` 里，换筛选后的**第一次提交**
   * 还会按上一次的组数（宽横屏 10）把新结果整屏铺一遍，然后再塌回 2 组 + 骨架 ——
   * 宽横屏下每敲一个字抖一次。这里用 Profiler 抓「每次提交时屏上有几组」。
   */
  test('换搜索词后的第一次提交就回到首帧组数，不会先整屏再塌', async () => {
    const commits: number[] = [];
    renderViewProfiled(commits);
    await waitFor(() => expect(sectionSelector()).toHaveLength(10));

    commits.length = 0;
    fireEvent.change(screen.getByTestId('mother-search'), { target: { value: '测试精灵' } });

    // 第一次提交必须已是首帧上限（2）附近，不能是旧的 10
    expect(commits.length).toBeGreaterThan(0);
    expect(commits[0]).toBeLessThanOrEqual(3);
    // 并且之后还能补齐回 10 组（内容没被削）
    await waitFor(() => expect(sectionSelector()).toHaveLength(10));
  });
});
