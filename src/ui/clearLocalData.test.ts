import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';
import { ingestCaptureFiles } from '../import/captureIngest';
import { saveSnapshot, listSnapshots } from '../storage/snapshots';
import { refreshSnapshots, resetSnapshotCacheForTest } from '../storage/snapshotStore';
import {
  getLastImportResult,
  resetLastImportForTest,
  setLastImportResult,
} from '../storage/lastImportStore';
import { clearLocalData } from './clearLocalData';
import {
  beginImport,
  getImportOutcome,
  resetImportOutcomeForTest,
  updateImportOutcome,
} from './importOutcomeStore';
import { getMotherPlan, mergeMotherPlan, resetMotherPlanForTest } from './motherPlanStore';

const fixture = JSON.parse(
  readFileSync(resolve(process.cwd(), 'src/domain/__fixtures__/backup-sample.json'), 'utf8'),
);

const snapshot = {
  accountName: '本机测试号',
  gameId: 1000001,
  exportedAt: '2026-11-28T00:00:00.000Z',
  importedAt: '2026-11-28T00:00:00.000Z',
  pets: [],
  eggs: [],
};

beforeEach(async () => {
  resetSnapshotCacheForTest();
  resetLastImportForTest();
  resetImportOutcomeForTest();
  resetMotherPlanForTest();
  await clearLocalData();
  window.localStorage.clear();
});

describe('清空本机数据', () => {
  test('清空快照与派生状态，但保留身份与设置', async () => {
    await saveSnapshot(snapshot);
    await refreshSnapshots();
    mergeMotherPlan(['chain-a']);
    setLastImportResult([
      { accountName: '本机测试号', accountKey: 'uid:1000001', isFirstImport: false, studs: [], mothers: [] },
    ]);
    const id = beginImport();
    updateImportOutcome(id, { local: 'saved', cloud: 'not-enabled' });
    window.localStorage.setItem('roco.accountId', 'acc-keep');

    await clearLocalData();

    expect(await listSnapshots()).toEqual([]);
    expect(getLastImportResult()).toBeNull();
    expect(getImportOutcome().local).toBe('idle');
    expect(getMotherPlan()).toEqual([]);
    // 身份没有动：清的是本机数据，不是登录态
    expect(window.localStorage.getItem('roco.accountId')).toBe('acc-keep');
  });

  test('清空后能立刻重新采集入库（回到可用的空态）', async () => {
    await saveSnapshot(snapshot);
    await refreshSnapshots();

    await clearLocalData();
    expect(await listSnapshots()).toEqual([]);

    const imported = await ingestCaptureFiles({
      files: [new File([JSON.stringify(fixture)], 'capture.json', { type: 'application/json' })],
      snapshots: [],
    });

    expect(imported).toHaveLength(1);
    expect(await listSnapshots()).toHaveLength(1);
    expect(getImportOutcome().local).toBe('saved');
  });
});
