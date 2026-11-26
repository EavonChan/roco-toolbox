import { describe, expect, test } from 'vitest';
import {
  TOUR_HINT_STEP_ID,
  TOUR_SEGMENT_ORDER,
  TOUR_SEGMENTS,
  TOUR_VERSION,
  detectStartEnv,
  startStepsFor,
  tourSuppressed,
} from './tour';

describe('测试版不自动弹新手引导', () => {
  test('test / internal 子域一律不弹', () => {
    expect(tourSuppressed('test.roco-toolbox.pages.dev')).toBe(true);
    expect(tourSuppressed('internal.roco-toolbox.pages.dev')).toBe(true);
  });

  test('正式域名与本地开发照常弹', () => {
    expect(tourSuppressed('roco-toolbox.pages.dev')).toBe(false);
    expect(tourSuppressed('localhost')).toBe(false);
  });
});

// 2026-11-25 v5：从「界面导览」改成任务式大纲（首启 6 步 + 页内 14 步 = 22 步）
describe('教程大纲（v5）', () => {
  test('版本号升到 5（改内容要让老用户重看一次）', () => {
    expect(TOUR_VERSION).toBe('5');
  });

  test('首启 6 步，收尾仍是最後一步且带 hint', () => {
    const steps = startStepsFor({ hasCapture: true, desktop: false });
    expect(steps).toHaveLength(6);
    expect(steps[steps.length - 1].id).toBe(TOUR_HINT_STEP_ID);
    expect(steps[steps.length - 1].hint).toBe(true);
    expect(steps[steps.length - 1].anchor).toBe('guide-open');
  });

  test('采集步按平台二选一：有采集桥讲「开始采集」，没有就讲「导入游戏数据」', () => {
    const capture = startStepsFor({ hasCapture: true, desktop: false });
    const web = startStepsFor({ hasCapture: false, desktop: false });

    expect(capture.some((step) => step.anchor === 'collector-start')).toBe(true);
    expect(capture.some((step) => step.anchor === 'profile-import')).toBe(false);

    // 网页 / 无采集桥：不能出现「开始采集」那步，否则会卡在禁用的「下一步」
    expect(web.some((step) => step.anchor === 'collector-start')).toBe(false);
    expect(web.some((step) => step.anchor === 'profile-import')).toBe(true);

    // 两版都有「等导入」那步，并且都落在「我的 · 游戏数据」
    for (const steps of [capture, web]) {
      const wait = steps.find((step) => step.waitForImport);
      expect(wait?.profileSection).toBe('data');
    }
  });

  test('桌面版文案换成选网卡，不再说 VPN', () => {
    const desktop = startStepsFor({ hasCapture: true, desktop: true });
    const captureStep = desktop.find((step) => step.waitForImport);
    expect(captureStep?.body).toContain('网卡');
    expect(captureStep?.body).not.toContain('VPN');
  });

  test('首启跨页的步骤都写明「跳到」哪个页面', () => {
    const steps = startStepsFor({ hasCapture: false, desktop: false });
    const dashboardStep = steps.find((step) => step.page === 'dashboard');
    const homeStep = steps.find((step) => step.page === 'home');
    expect(dashboardStep?.body).toContain('看板');
    expect(dashboardStep?.body).toContain('跳');
    expect(homeStep?.body).toContain('家园');
    expect(homeStep?.body).toContain('跳');
  });

  test('蛋仓入口那步明说门槛：要登录并加入小组', () => {
    const steps = startStepsFor({ hasCapture: false, desktop: false });
    const eggStep = steps.find((step) => String(step.selector).includes('home-egg-stock'));
    expect(eggStep).toBeTruthy();
    expect(eggStep?.body).toContain('登录');
    expect(eggStep?.body).toContain('小组');
  });

  test('各页步数：看板 2 / 家园 4 / 收集 3 / 附近 2 / 换蛋 3', () => {
    expect(TOUR_SEGMENTS.dashboard).toHaveLength(2);
    expect(TOUR_SEGMENTS.home).toHaveLength(4);
    expect(TOUR_SEGMENTS.collection).toHaveLength(3);
    expect(TOUR_SEGMENTS.nearby).toHaveLength(2);
    expect(TOUR_SEGMENTS.groups).toHaveLength(3);
  });

  test('个人页两步保持原文（本轮不动个人页教程）', () => {
    expect(TOUR_SEGMENTS.profile).toHaveLength(2);
    expect(TOUR_SEGMENTS.profile.map((step) => step.id)).toEqual([
      'profile-import',
      'profile-account',
    ]);
    expect(TOUR_SEGMENTS.profile.map((step) => step.anchor)).toEqual([
      'profile-import',
      'profile-account',
    ]);
    expect(TOUR_SEGMENTS.profile.map((step) => step.profileSection)).toEqual(['data', 'identity']);
    expect(TOUR_SEGMENTS.profile[0].title).toBe('先导入一次数据');
    expect(TOUR_SEGMENTS.profile[1].title).toBe('云同步（可选）');
  });

  test('每步都有锚点或选择器（每步都能框到一个真实位置）', () => {
    for (const segment of TOUR_SEGMENT_ORDER) {
      for (const step of TOUR_SEGMENTS[segment]) {
        expect(Boolean(step.anchor || step.selector), `${segment}/${step.id} 缺少定位`).toBe(true);
      }
    }
  });

  test('条件步骤都标了 skipWhenMissing：锚点不存在时自动跳过，不留居中空卡', () => {
    const conditional = [
      ...TOUR_SEGMENTS.dashboard.filter((step) => String(step.selector).includes('transfer-task-list')),
      ...TOUR_SEGMENTS.home.filter((step) => String(step.selector).includes('home-pair-cards')),
      ...TOUR_SEGMENTS.home.filter((step) => String(step.selector).includes('egg-stock-character')),
      ...TOUR_SEGMENTS.home.filter((step) => String(step.selector).includes('egg-stock-grid')),
      ...TOUR_SEGMENTS.nearby.filter((step) => step.anchor === 'nearby-radar'),
      ...TOUR_SEGMENTS.groups.filter((step) => step.anchor === 'egg-matching-hub'),
      ...TOUR_SEGMENTS.groups.filter((step) => String(step.selector).includes('group-feed-hint')),
    ];
    expect(conditional.length).toBeGreaterThanOrEqual(7);
    for (const step of conditional) {
      expect(step.skipWhenMissing, `${step.id} 应标 skipWhenMissing`).toBe(true);
    }

    // 无条件步骤不能被标记，否则会误跳过
    const stable = TOUR_SEGMENTS.dashboard.find((step) => step.anchor === 'dashboard-target');
    expect(stable?.skipWhenMissing).toBeFalsy();
  });

  test('删掉新人看不到的 group-card 步（只有已入组 + 管理视图才渲染）', () => {
    for (const segment of TOUR_SEGMENT_ORDER) {
      for (const step of TOUR_SEGMENTS[segment]) {
        expect(step.anchor).not.toBe('group-card');
        expect(step.anchor).not.toBe('group-setup');
      }
    }
  });

  test('换蛋段改名：不再说「小组」，入组 / 广场 / 成交各有一步', () => {
    const titles = TOUR_SEGMENTS.groups.map((step) => step.title).join('|');
    expect(titles).toContain('入组');
    expect(titles).toContain('广场');
    expect(titles).toContain('成交');
  });

  test('家园段讲三块 + 蛋仓，不再说「分两页」', () => {
    const titles = TOUR_SEGMENTS.home.map((step) => step.title).join('|');
    const bodies = TOUR_SEGMENTS.home.map((step) => step.body).join('|');
    expect(titles).toContain('三块');
    expect(titles + bodies).toContain('蛋仓');
    expect(bodies).not.toContain('分两页');
  });

  test('本机（无采集桥）解析出的首启是导入版；同一环境取到的数组是同一份', () => {
    expect(detectStartEnv().hasCapture).toBe(false);
    expect(TOUR_SEGMENTS.start.some((step) => step.anchor === 'profile-import')).toBe(true);
    expect(TOUR_SEGMENTS.start).toBe(TOUR_SEGMENTS.start);
  });

  test('全部 22 步（首启 6 + 其它页 16）都能取到，且 id 不重复', () => {
    const all = TOUR_SEGMENT_ORDER.flatMap((segment) => TOUR_SEGMENTS[segment]);
    expect(all).toHaveLength(22);
    const ids = all.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
