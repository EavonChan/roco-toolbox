import { describe, expect, test } from 'vitest';
import { listSnapshots, saveSnapshot } from '../storage/snapshots';
import { getExcludedAccounts, toggleAccount } from './accountFilterStore';
import { beginImport, getImportOutcome, updateImportOutcome } from './importOutcomeStore';
import { getImportMessage, setImportMessage } from './importMessageStore';
import { getMotherPlan, toggleMotherPlan } from './motherPlanStore';
import { getMyPetsSelected, setMyPetsSelected } from './myPetsFilterStore';
import { resetImportedData } from './resetImportedData';
import { getTargetMode, setTargetMode } from './targetModeStore';
import { toggleSuggestionDone } from './suggestionCardStore';
import { mother, snapshot } from '../test/fixtures/motherSharing';

describe('重置导入数据', () => {
  test('清空账号快照，以及由它派生的计划、已换到、筛选与导入反馈', async () => {
    await saveSnapshot(snapshot(1001, '甲', [mother(101)]));
    toggleAccount('甲');
    toggleMotherPlan('fire|1');
    toggleSuggestionDone('rec-1');
    setMyPetsSelected(new Set(['标签']));
    window.localStorage.setItem('roco.lastImportResults', JSON.stringify([{ at: 'x', results: [] }]));
    const operation = beginImport();
    updateImportOutcome(operation, { local: 'saved', message: '已保存到本机' });
    setImportMessage('已导入 1 个账号');
    // 目标档位属于「设置」，重置账号数据时应保留
    setTargetMode('medal');

    await resetImportedData();

    expect(await listSnapshots()).toEqual([]);
    expect(getMotherPlan()).toEqual([]);
    expect(getExcludedAccounts().size).toBe(0);
    expect(getMyPetsSelected().size).toBe(0);
    expect(getImportOutcome().local).toBe('idle');
    expect(getImportMessage()).toBeNull();
    expect(window.localStorage.getItem('roco.lastImportResults')).toBeNull();
    const suggestion = JSON.parse(window.localStorage.getItem('roco.suggestionCard') ?? '{}') as {
      doneAt?: Record<string, number>;
    };
    expect(suggestion.doneAt ?? {}).toEqual({});
    expect(getTargetMode()).toBe('medal');
  });

  test('按云身份清掉「已上窝」「完成回执已读」「账号折叠」（R2-2-M07）', async () => {
    await saveSnapshot(snapshot(1001, '甲', [mother(101)]));
    window.localStorage.setItem('roco.accountId', 'acc-me');
    window.localStorage.setItem('roco.demandPlacements:acc-me', JSON.stringify({ 'g1|m1|k|1': true }));
    window.localStorage.setItem('roco.demandCompletionRead:acc-me', JSON.stringify({ 'g1|m1|k|1': true }));
    window.localStorage.setItem('roco.demandCollapsedAccounts:acc-me', JSON.stringify(['uid:11']));
    window.localStorage.setItem(
      'roco.demandCancelled:acc-me:g1',
      JSON.stringify({ claimed: ['g1|m1|k|1'], notified: [] }),
    );
    // 别人的身份不受影响
    window.localStorage.setItem('roco.demandPlacements:acc-other', JSON.stringify({ x: true }));

    await resetImportedData();

    expect(window.localStorage.getItem('roco.demandPlacements:acc-me')).toBeNull();
    expect(window.localStorage.getItem('roco.demandCompletionRead:acc-me')).toBeNull();
    expect(window.localStorage.getItem('roco.demandCollapsedAccounts:acc-me')).toBeNull();
    expect(window.localStorage.getItem('roco.demandCancelled:acc-me:g1')).toBeNull();
    expect(window.localStorage.getItem('roco.demandPlacements:acc-other')).not.toBeNull();
  });
});
