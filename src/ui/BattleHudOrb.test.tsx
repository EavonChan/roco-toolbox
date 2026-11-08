import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { SeasonEncounter } from '../collector/captureProgress';
import { resetBattleTargetForTest, setBattleTarget } from '../collector/battleTargetStore';
import { useNearbySnapshot } from '../collector/nearbyStore';
import { BattleHudOrb, resetBattleOrbPosForTest } from './BattleHudOrb';

vi.mock('../collector/useCaptureProgress', () => ({ useCaptureProgress: vi.fn(() => ({ progress: null, sourceBytes: 0, error: null, checking: false })) }));
vi.mock('../collector/nearbyStore', () => ({ useNearbySnapshot: vi.fn() }));

const encounter: SeasonEncounter = {
  guardName: '龙棋士', rewardPetId: 3011, rewardName: '恶魔狼',
  level: 41, natureId: 4, natureConfirmed: true, nature: '勇敢',
  gender: '公', height: 180, weight: 82000, heightPct: 45, weightPct: 30, voiceDb: 14,
};

/** 桥的状态：phase=capturing 时悬浮球才显示 */
const bridgeWith = (phase: 'capturing' | 'idle') => {
  window.RocoCapture = {
    getState: () => JSON.stringify({
      version: 1, supported: true, phase, message: '', packets: 1, bytes: 1,
      files: [], progressVersion: 1, fileId: 'capture-1.pcap', savedBytes: 1,
    }),
  };
};

const feed = (value: SeasonEncounter | null = null) => {
  vi.mocked(useNearbySnapshot).mockReturnValue({
    session: 'capture-1.pcap', scene: null, pets: [], self: null,
    encounter: value, updatedAt: Date.now(),
  });
};

/** 挂载后第一轮状态读取是异步的：把微任务链推完再断言 */
const flushState = async () => {
  await act(async () => {
    for (let i = 0; i < 20; i += 1) await Promise.resolve();
  });
};

/**
 * 派发 pointer 事件（jsdom 没有 PointerEvent 构造器，testing-library 的
 * fireEvent.pointerXxx 会退化成不带坐标的 Event，所以这里用 MouseEvent
 * 构造同名事件；组件的 pointerId 匹配对 undefined 自洽）。
 */
const pointer = (el: HTMLElement, type: 'pointerdown' | 'pointermove' | 'pointerup', x: number, y: number) => {
  fireEvent(el, new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y }));
};

/** 点击球（pointerDown + 同位置 pointerUp，不构成拖动） */
const tapOrb = (orb: HTMLElement, x = 300, y = 300) => {
  pointer(orb, 'pointerdown', x, y);
  pointer(orb, 'pointerup', x, y);
};

beforeEach(() => {
  window.localStorage.clear();
  resetBattleTargetForTest();
  resetBattleOrbPosForTest();
  feed();
});

afterEach(() => {
  delete window.RocoCapture;
});

describe('系统悬浮窗模式（安卓壳）', () => {
  /** 带系统浮窗能力的桥（新壳才有 updateBattleOverlay） */
  const nativeBridge = (status: 'ok' | 'need-permission' | 'unsupported' = 'ok') => {
    let phase: 'capturing' | 'idle' = 'capturing';
    const update = vi.fn(() => status);
    const request = vi.fn(() => '');
    window.RocoCapture = {
      getState: () => JSON.stringify({
        version: 1, supported: true, phase, message: '', packets: 1, bytes: 1,
        files: [], progressVersion: 1, fileId: 'capture-1.pcap', savedBytes: 1,
      }),
      updateBattleOverlay: update,
      requestOverlayPermission: request,
    };
    return { update, request, stop: () => { phase = 'idle'; } };
  };

  /** 最近一次推给原生的载荷（新版直接传对象，bridge 负责整体序列化） */
  const lastPush = (update: { mock: { calls: unknown[][] } }) =>
    update.mock.calls[update.mock.calls.length - 1][0] as {
      visible: boolean; hit?: boolean; fields?: { text: string; row?: 1 | 2 }[];
    };

  test('有系统浮窗能力时网页不再画球，改为把状态推给原生', async () => {
    const { update } = nativeBridge();
    feed(encounter);
    render(<BattleHudOrb />);
    await flushState();

    expect(screen.queryByTestId('battle-hud-orb')).toBeNull();
    const payload = lastPush(update);
    expect(payload.visible).toBe(true);
    expect(payload.hit).toBe(false);
    expect(payload.fields?.map((field) => field.text))
      .toEqual(['恶魔狼', '♂', '41级', '勇敢', '14dB', '1.80m（45%）', '82.00kg（30%）']);
    // 两排：名字/性别/等级/性格/声音 → row 1，身高体重 → row 2
    expect(payload.fields?.map((field) => field.row ?? 1)).toEqual([1, 1, 1, 1, 1, 2, 2]);
  });

  test('命中目标时推送 hit=true，原生球据此变红', async () => {
    const { update } = nativeBridge();
    feed(encounter);
    render(<BattleHudOrb />);
    await flushState();

    act(() => { setBattleTarget({ natures: ['勇敢'] }); });
    await flushState();
    expect(lastPush(update).hit).toBe(true);
  });

  test('采集结束后推送 visible=false 隐藏浮窗', async () => {
    vi.useFakeTimers();
    try {
      const { update, stop } = nativeBridge();
      render(<BattleHudOrb />);
      await flushState();
      expect(lastPush(update).visible).toBe(true);

      stop();
      act(() => { vi.advanceTimersByTime(2600); });
      await flushState();
      expect(lastPush(update).visible).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  test('还没授权时在页面上给出去开启的入口', async () => {
    const { request } = nativeBridge('need-permission');
    render(<BattleHudOrb />);
    await flushState();

    fireEvent.click(await screen.findByTestId('battle-overlay-permission'));
    expect(request).toHaveBeenCalledTimes(1);
  });

  test('原生没接住时回退到页面内的球，不会两边都看不到', async () => {
    nativeBridge('unsupported');
    feed(encounter);
    render(<BattleHudOrb />);
    await flushState();

    expect(await screen.findByTestId('battle-hud-orb')).toBeTruthy();
  });
});

describe('战斗采集悬浮球（BattleHudOrb）', () => {
  test('没有采集桥时不渲染', async () => {
    render(<BattleHudOrb />);
    await flushState();
    expect(screen.queryByTestId('battle-hud-orb')).toBeNull();
  });

  test('未在采集时不渲染球', async () => {
    bridgeWith('idle');
    render(<BattleHudOrb />);
    await flushState();
    expect(screen.queryByTestId('battle-hud-orb')).toBeNull();
  });

  test('采集中点击展开详情；没有奇遇战数据时给出等待提示', async () => {
    bridgeWith('capturing');
    feed(null);
    render(<BattleHudOrb />);
    await flushState();
    const orb = screen.getByTestId('battle-hud-orb');
    expect(orb.getAttribute('data-hit')).toBe('false');
    expect(screen.queryByTestId('battle-hud-detail')).toBeNull();

    tapOrb(orb);
    const detail = screen.getByTestId('battle-hud-detail');
    expect(detail.textContent).toContain('进入赛季奇遇战后，这里会显示守卫的个体数据');

    fireEvent.click(screen.getByTestId('battle-hud-detail-close'));
    expect(screen.queryByTestId('battle-hud-detail')).toBeNull();
  });

  test('有奇遇战数据时点击展开守卫个体详情', async () => {
    bridgeWith('capturing');
    feed(encounter);
    render(<BattleHudOrb />);
    await flushState();
    const orb = screen.getByTestId('battle-hud-orb');
    tapOrb(orb);
    const detail = screen.getByTestId('battle-hud-detail');
    const fields = screen.getByTestId('battle-hud-fields');
    // 每个字段一个小标签，固定两排：名字 / 性别 / 等级 / 性格 / 声音 与 身高 / 体重
    const chips = [...fields.querySelectorAll('span')].map((node) => node.textContent);
    expect(chips).toEqual(['恶魔狼', '♂', '41级', '勇敢', '14dB', '1.80m（45%）', '82.00kg（30%）']);
    const row1 = screen.getByTestId('battle-hud-fields-row1');
    const row2 = screen.getByTestId('battle-hud-fields-row2');
    expect(row1.textContent).toBe('恶魔狼♂41级勇敢14dB');
    expect(row2.textContent).toBe('1.80m（45%）82.00kg（30%）');
    // 不再用「A · B · C」纯文字拼接
    expect(fields.textContent).not.toContain('·');
    expect(detail.textContent).not.toContain('守卫');
    expect(detail.textContent).not.toContain('性格');
    expect(detail.textContent).not.toContain('身高');
    expect(detail.textContent).not.toContain('体重');
    expect(detail.textContent).not.toContain('声音');
  });

  test('未命中目标默认色；命中目标 → 变色并在详情里提示', async () => {
    bridgeWith('capturing');
    feed(encounter);
    render(<BattleHudOrb />);
    await flushState();
    const orb = screen.getByTestId('battle-hud-orb');
    expect(orb.getAttribute('data-hit')).toBe('false');

    act(() => { setBattleTarget({ natures: ['勇敢'] }); });
    expect(orb.getAttribute('data-hit')).toBe('true');
    tapOrb(orb);
    // 命中时多一个红色「命中目标」小标签
    const chips = [...screen.getByTestId('battle-hud-fields').querySelectorAll('span')].map((node) => node.textContent);
    expect(chips).toContain('命中目标');

    act(() => { setBattleTarget({ natures: ['胆小'] }); });
    expect(orb.getAttribute('data-hit')).toBe('false');
  });

  test('按住拖动改位置并记住；下次挂载回到原位', async () => {
    bridgeWith('capturing');
    const { unmount } = render(<BattleHudOrb />);
    await flushState();
    const orb = screen.getByTestId('battle-hud-orb');
    // 拖到 (500, 600)：球中心跟随手指，左上角 = 500-24 / 600-24
    pointer(orb, 'pointerdown', 300, 300);
    pointer(orb, 'pointermove', 500, 600);
    pointer(orb, 'pointerup', 500, 600);

    const saved = window.localStorage.getItem('roco.battleOrbPos');
    expect(saved).toBeTruthy();
    expect(JSON.parse(saved!)).toEqual({ x: 476, y: 576 });

    unmount();
    render(<BattleHudOrb />);
    await flushState();
    const next = screen.getByTestId('battle-hud-orb');
    expect(next.style.left).toBe('476px');
    expect(next.style.top).toBe('576px');
  });

  test('拖动位置贴边：不会超出视口', async () => {
    bridgeWith('capturing');
    render(<BattleHudOrb />);
    await flushState();
    const orb = screen.getByTestId('battle-hud-orb');
    // 拖到视口右下角之外：贴到边缘（jsdom 视口 1024×768）
    pointer(orb, 'pointerdown', 300, 300);
    pointer(orb, 'pointermove', 5000, 5000);
    pointer(orb, 'pointerup', 5000, 5000);
    const saved = JSON.parse(window.localStorage.getItem('roco.battleOrbPos')!);
    expect(saved.x).toBeLessThanOrEqual(1024 - 56);
    expect(saved.y).toBeLessThanOrEqual(768 - 56);
  });
});
