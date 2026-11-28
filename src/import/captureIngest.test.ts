import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { getImportOutcome, resetImportOutcomeForTest } from '../ui/importOutcomeStore';
import { resetLastImportForTest } from '../storage/lastImportStore';
import { clearAllSnapshots, listSnapshots } from '../storage/snapshots';
import { resetSnapshotCacheForTest } from '../storage/snapshotStore';
import { consumePendingShares, ingestCaptureFiles } from './captureIngest';
import { decodeUrlInWorker } from '../pcap/decodeInWorker';
import { takeNativeShare } from '../share/nativeShare';
import { takeSharedFile } from '../share/shareTarget';

vi.mock('../api/analytics', () => ({
  track: vi.fn(),
  analyticsEnabled: () => false,
  setAnalyticsEnabled: vi.fn(),
}));

vi.mock('../pcap/decodeInWorker', () => ({ decodeUrlInWorker: vi.fn() }));

vi.mock('../share/nativeShare', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../share/nativeShare')>();
  return { ...actual, takeNativeShare: vi.fn() };
});

vi.mock('../share/shareTarget', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../share/shareTarget')>();
  return { ...actual, takeSharedFile: vi.fn(async () => null) };
});

const fixture = JSON.parse(
  readFileSync(resolve(process.cwd(), 'src/domain/__fixtures__/backup-sample.json'), 'utf8'),
);
const COLLECTOR_URL = 'https://roco-share.invalid/collector/12345678-1234-1234-1234-123456789abc';

beforeEach(async () => {
  await clearAllSnapshots();
  resetSnapshotCacheForTest();
  resetImportOutcomeForTest();
  resetLastImportForTest();
  vi.mocked(takeSharedFile).mockResolvedValue(null);
  vi.mocked(takeNativeShare).mockReturnValue(null);
  vi.mocked(decodeUrlInWorker).mockReset();
});

describe('采集入库（壳内采集与文件导入共用）', () => {
  test('壳内采集数据经 roco-share 注入后：解码 → 写库 → 结果到 saved', async () => {
    vi.mocked(takeNativeShare).mockReturnValue({
      kind: 'capture',
      name: 'capture-1.pcap',
      url: COLLECTOR_URL,
    });
    vi.mocked(decodeUrlInWorker).mockResolvedValue({ payload: fixture } as never);

    await consumePendingShares((file, label, readFile) =>
      ingestCaptureFiles({ files: [file], snapshots: [], sourceLabel: label, readFile }),
    );

    // 走的是 Worker 解码（元数据留在 UI 线程，字节在 Worker 里读）
    expect(decodeUrlInWorker).toHaveBeenCalledTimes(1);

    const stored = await listSnapshots();
    expect(stored).toHaveLength(1);
    expect(stored[0].gameId).toBe(1000001);

    const outcome = getImportOutcome();
    expect(outcome.local).toBe('saved');
    expect(outcome.cloud).toBe('not-enabled');
    expect(outcome.message).toContain('已解析并导入本机采集数据（capture-1.pcap）');
  });

  test('入库函数自己也能写库（桌面「解析并导入」走同一条路）', async () => {
    const file = new File([JSON.stringify(fixture)], 'capture.json', { type: 'application/json' });

    const imported = await ingestCaptureFiles({ files: [file], snapshots: [] });

    expect(imported).toHaveLength(1);
    expect(imported?.[0].accountName).toBeTruthy();
    expect(await listSnapshots()).toHaveLength(1);
    expect(getImportOutcome().local).toBe('saved');
  });
});
