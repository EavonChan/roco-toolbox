import { describe, expect, test } from 'vitest';
import { isCollectorCaptureUrl } from './collectorUrl';

describe('本机原包地址', () => {
  test('安卓壳的拦截地址', () => {
    expect(isCollectorCaptureUrl('https://roco-share.invalid/collector/2b5f0c1e-6a1d-4b3e-9a6e-1f2c3d4e5f60')).toBe(true);
  });
  test('桌面版本地服务地址', () => {
    expect(isCollectorCaptureUrl('http://127.0.0.1:54321/capture/capture-1793900360948.pcap')).toBe(true);
  });
  test('拒绝站外地址与路径穿越', () => {
    expect(isCollectorCaptureUrl('http://example.com/capture/capture-1.pcap')).toBe(false);
    expect(isCollectorCaptureUrl('http://127.0.0.1:54321/capture/../secret.pcap')).toBe(false);
    expect(isCollectorCaptureUrl('https://roco-share.invalid/collector/not-a-uuid')).toBe(false);
  });
});
