import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, test } from 'vitest';
import { TOUR_SEGMENT_ORDER, TOUR_SEGMENTS, type TourStep } from './tour';

/**
 * 教程锚点自检（2026-11-25）：教程里每一步都指向一个 `data-tour` / `data-testid` / `aria-label`。
 * 这里直接扫 `src/**` 源码，确认每个被引用的标记真的存在——锚点被改名 / 删掉时，
 * 这条测试会红，而不是等用户点到「找不到元素、卡片飘在中间」。
 *
 * 两条扫描约定：
 * - 组件的 `testId="x"` / `actionTestId="x"` 最终都会渲染成 `data-testid="x"`（`ProgressCard`、
 *   `EggCharacterSelect` 等），所以自检把它们也算进 testid 池；
 * - 没有 testid 的控件（例如蛋仓的角色下拉）用字面量 `aria-label` 定位。
 *
 * 这是源码级检查（不需要把每个页面渲染出来），所以很便宜；它拦的是「标记不存在」，
 * 不拦「标记在某个条件下不渲染」——后者由 `skipWhenMissing` 兜底。
 */
const SRC_ROOT = join(process.cwd(), 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__fixtures__') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    if (/\.test\.(ts|tsx)$/.test(entry.name)) continue;
    out.push(full);
  }
  return out;
}

const files = walk(SRC_ROOT);
const source = files.map((file) => readFileSync(file, 'utf8')).join('\n');

/** 收集某个属性（或组件里等价于它的 prop）的所有字面量值 */
function collect(patterns: readonly string[]): Set<string> {
  const values = new Set<string>();
  for (const attribute of patterns) {
    const pattern = new RegExp(`${attribute}=(?:"([^"]+)"|\\{\`([^\`]+)\`\\})`, 'g');
    for (const match of source.matchAll(pattern)) {
      const value = match[1] ?? match[2];
      if (value && !value.includes('${')) values.add(value);
    }
  }
  return values;
}

const tourValues = collect(['data-tour']);
const testIds = collect(['data-testid', 'testId', 'actionTestId']);
const ariaLabels = collect(['aria-label']);

const POOLS: Record<string, Set<string>> = {
  'data-tour': tourValues,
  'data-testid': testIds,
  'aria-label': ariaLabels,
};

/** 从选择器里取出它依赖的标记：`[data-tour="x"], [data-testid="y"]` */
function tokensOfSelector(
  selector: string,
): Array<{ attribute: 'data-tour' | 'data-testid' | 'aria-label'; value: string }> {
  const tokens: Array<{ attribute: 'data-tour' | 'data-testid' | 'aria-label'; value: string }> = [];
  for (const match of selector.matchAll(/\[(data-tour|data-testid|aria-label)="([^"]+)"\]/g)) {
    tokens.push({
      attribute: match[1] as 'data-tour' | 'data-testid' | 'aria-label',
      value: match[2],
    });
  }
  return tokens;
}

function assertStepTarget(segment: string, step: TourStep): void {
  const label = `${segment}/${step.id}`;

  if (step.anchor) {
    expect(tourValues.has(step.anchor), `${label} 的 data-tour="${step.anchor}" 在 src 里找不到`).toBe(
      true,
    );
  }

  if (step.selector) {
    const tokens = tokensOfSelector(step.selector);
    expect(
      tokens.length,
      `${label} 的 selector 只支持 [data-tour] / [data-testid] / [aria-label]`,
    ).toBeGreaterThan(0);
    for (const token of tokens) {
      expect(
        POOLS[token.attribute].has(token.value),
        `${label} 依赖的 ${token.attribute}="${token.value}" 在 src 里找不到`,
      ).toBe(true);
    }
  }
}

describe('教程锚点自检', () => {
  test('扫描到的源码足够多（防止扫描失效后假绿）', () => {
    expect(files.length).toBeGreaterThan(80);
    expect(tourValues.has('guide-open')).toBe(true);
    expect(testIds.has('home-egg-stock')).toBe(true);
  });

  test('每一步的锚点 / 选择器在 src 里都真实存在', () => {
    const problems: string[] = [];
    for (const segment of TOUR_SEGMENT_ORDER) {
      for (const step of TOUR_SEGMENTS[segment]) {
        try {
          assertStepTarget(segment, step);
        } catch (error) {
          problems.push(error instanceof Error ? error.message : String(error));
        }
      }
    }
    expect(problems).toEqual([]);
  });

  test('每个选择器用的都是 data-tour / data-testid / aria-label，不依赖位置选择器', () => {
    for (const segment of TOUR_SEGMENT_ORDER) {
      for (const step of TOUR_SEGMENTS[segment]) {
        if (!step.selector) continue;
        expect(step.selector, `${segment}/${step.id}`).toMatch(
          /^(\[(data-tour|data-testid|aria-label)="[^"]+"\](,\s*)?)+$/,
        );
      }
    }
  });

  test('每个标记都能定位到源码文件（人工核对时用）', () => {
    // 打印一份「步骤 → 标记 → 首次出现的文件」，锚点改名时按这个清单排查
    const owners = new Map<string, string>();
    const ATTRIBUTES: Array<[string, string]> = [
      ['data-tour', 'tour'],
      ['data-testid', 'testid'],
      ['testId', 'testid'],
      ['actionTestId', 'testid'],
      ['aria-label', 'aria'],
    ];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const [attribute, prefix] of ATTRIBUTES) {
        const pattern = new RegExp(`${attribute}="([^"]+)"`, 'g');
        for (const match of text.matchAll(pattern)) {
          const key = `${prefix}:${match[1]}`;
          if (!owners.has(key)) owners.set(key, relative(process.cwd(), file));
        }
      }
    }

    const prefixOf: Record<string, string> = {
      'data-tour': 'tour',
      'data-testid': 'testid',
      'aria-label': 'aria',
    };
    const rows = TOUR_SEGMENT_ORDER.flatMap((segment) =>
      TOUR_SEGMENTS[segment].flatMap((step) => {
        const keys: string[] = [];
        if (step.anchor) keys.push(`tour:${step.anchor}`);
        if (step.selector) {
          keys.push(
            ...tokensOfSelector(step.selector).map(
              (token) => `${prefixOf[token.attribute]}:${token.value}`,
            ),
          );
        }
        return keys.map(
          (key) => `${segment}/${step.id} → ${key} → ${owners.get(key) ?? '（未找到）'}`,
        );
      }),
    );
    const missing = rows.filter((row) => row.includes('（未找到）'));
    expect(missing).toEqual([]);
    expect(rows.length).toBeGreaterThanOrEqual(22);
  });
});
