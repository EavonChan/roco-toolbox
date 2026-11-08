import { RareAlertGate } from '../pcap/rareAlertGate';
import type { LiveNearbyPet } from './captureProgress';

/**
 * 附近提醒的共享去重表（2026-11-06）。
 *
 * 采集页和附近页都可能触发提醒，但两页不会同时挂载；用模块级单例保证
 * 「同一只精灵只响一次」，切页回来不会重复弹通知。
 */
export const nearbyAlertGate: RareAlertGate<LiveNearbyPet> = new RareAlertGate<LiveNearbyPet>();

/** 测试用：清空去重表。 */
export function resetNearbyAlertGateForTest(): void {
  nearbyAlertGate.reset();
}
