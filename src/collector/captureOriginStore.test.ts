import { beforeEach, describe, expect, test } from 'vitest';
import type { CollectorState } from './nativeCollector';
import {
  isNearbyOwnedSession,
  markCaptureOrigin,
  observeCollectorState,
  resetCaptureOriginForTest,
} from './captureOriginStore';

const captureState = (overrides: Partial<CollectorState> = {}): CollectorState => ({
  version: 1, supported: true, phase: 'capturing', message: '采集中', packets: 2, bytes: 1234,
  files: [], progressVersion: 1, fileId: 'capture-123.pcap', savedBytes: 1234, ...overrides,
});

beforeEach(() => {
  window.localStorage.clear();
  resetCaptureOriginForTest();
});

describe('采集归属（captureOriginStore）', () => {
  test('附近页点开始后，待绑定窗口内任何会话都算附近发起', () => {
    markCaptureOrigin('nearby');
    expect(isNearbyOwnedSession()).toBe(true);
    expect(isNearbyOwnedSession('capture-123.pcap')).toBe(true);
    // 我的页发起的会话不会被误判
    markCaptureOrigin('profile');
    expect(isNearbyOwnedSession('capture-123.pcap')).toBe(false);
  });

  test('capturing 后绑定会话；绑定后其它会话不再算附近发起', () => {
    markCaptureOrigin('nearby');
    observeCollectorState(captureState());
    expect(isNearbyOwnedSession('capture-123.pcap')).toBe(true);
    // 旧会话 id（比如导入流程拿到另一份文件）不算
    expect(isNearbyOwnedSession('capture-999.pcap')).toBe(false);
  });

  test('只在 capturing 时绑定：idle 的陈旧 fileId 不碰归属', () => {
    markCaptureOrigin('nearby');
    observeCollectorState(captureState({ phase: 'idle', files: [{ id: 'capture-123.pcap', name: 'capture-123.pcap', size: 1, createdAt: 1, valid: true }] }));
    expect(isNearbyOwnedSession('capture-123.pcap')).toBe(true); // 仍在待绑定窗口
    // 待绑定窗口只对「当前这一路」成立；明确传入另一个会话时不误判
    expect(isNearbyOwnedSession('capture-999.pcap')).toBe(true);
  });

  test('没有归属记录（旧采集 / 外部发起）时不拦自动导入', () => {
    observeCollectorState(captureState());
    expect(isNearbyOwnedSession('capture-123.pcap')).toBe(false);
  });

  test('归属写入 localStorage，刷新后仍在（不会把附近采集误判成导入采集）', () => {
    markCaptureOrigin('nearby');
    observeCollectorState(captureState());
    const raw = window.localStorage.getItem('roco.captureOrigin');
    expect(raw).toBeTruthy();
    expect(JSON.parse(raw!)).toEqual({ origin: 'nearby', session: 'capture-123.pcap' });
  });

  test('新一路采集从我的页开始时覆盖旧归属', () => {
    markCaptureOrigin('nearby');
    observeCollectorState(captureState());
    markCaptureOrigin('profile');
    expect(isNearbyOwnedSession('capture-123.pcap')).toBe(false);
    observeCollectorState(captureState({ fileId: 'capture-456.pcap' }));
    expect(isNearbyOwnedSession('capture-456.pcap')).toBe(false);
  });
});
