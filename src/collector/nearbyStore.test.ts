import { describe, expect, test } from 'vitest';
import {
  freshNearbySnapshot,
  NEARBY_SNAPSHOT_TTL_MS,
  retainedNearbySnapshot,
  type NearbySnapshot,
} from './nearbyStore';

const snapshot = (over: Partial<NearbySnapshot> = {}): NearbySnapshot => ({
  session: 'capture-1.pcap',
  scene: 10003,
  pets: [],
  self: null,
  encounter: null,
  updatedAt: 1_000_000,
  ...over,
});

describe('附近快照新鲜度（O-9）', () => {
  test('换局（session 不同）后旧数据一律失效', () => {
    expect(freshNearbySnapshot(snapshot(), 'capture-2.pcap', 1_000_000)).toBeNull();
  });

  test('同一局内保留最后一帧（停止采集后仍能回看）', () => {
    const value = snapshot();
    expect(freshNearbySnapshot(value, 'capture-1.pcap', 1_000_000 + 5_000)).toBe(value);
  });

  test('超过 TTL 未更新按「等待数据」处理', () => {
    expect(
      freshNearbySnapshot(snapshot(), 'capture-1.pcap', 1_000_000 + NEARBY_SNAPSHOT_TTL_MS + 1),
    ).toBeNull();
  });

  test('当前会话还没读到时不清屏（避免闪烁）', () => {
    const value = snapshot();
    expect(freshNearbySnapshot(value, null, 1_000_000)).toBe(value);
  });
});

describe('悬浮窗快照（停更不清空）', () => {
  test('超过 TTL 仍保留最后一帧，只标 paused', () => {
    const value = snapshot();
    const view = retainedNearbySnapshot(value, 'capture-1.pcap', 1_000_000 + NEARBY_SNAPSHOT_TTL_MS + 1);
    expect(view?.snapshot).toBe(value);
    expect(view?.paused).toBe(true);
  });

  test('TTL 内不标暂停', () => {
    const value = snapshot();
    expect(retainedNearbySnapshot(value, 'capture-1.pcap', 1_000_000 + 5_000)).toEqual({
      snapshot: value,
      paused: false,
    });
  });

  test('换局仍然必须失效：旧一局的精灵不能留在屏幕上', () => {
    expect(retainedNearbySnapshot(snapshot(), 'capture-2.pcap', 1_000_000)).toBeNull();
  });

  test('没有快照时返回 null（壳侧保持收起，不画空面板）', () => {
    expect(retainedNearbySnapshot(null, 'capture-1.pcap')).toBeNull();
  });
});
