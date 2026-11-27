import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { MotherResourceEditor } from './MotherResourceEditor';
import type { MotherGroupsHook } from './useMotherGroups';
import type { MotherResourceDraft } from '../shared/motherGroups';
import {
  FIXTURE_CATALOG_VERSION,
  catalog,
  member,
  mother,
  resourceWith,
  sharedAccount,
  snapshot,
} from '../test/fixtures/motherSharing';
import { motherResourceCriteriaIdOf } from '../shared/motherGroups';
import { diffMotherResources } from '../domain/motherResource';

const resource: MotherResourceDraft = {
  schemaVersion: 1,
  criteriaId: motherResourceCriteriaIdOf('perfect'),
  catalogVersion: FIXTURE_CATALOG_VERSION,
  accounts: [sharedAccount(1001, [101])],
};

const hookOf = (overrides: Partial<MotherGroupsHook> = {}): MotherGroupsHook => ({
  accountId: 'A',
  groups: [],
  groupsLoaded: true,
  currentGroupId: 'g1',
  currentGroup: null,
  loading: false,
  error: '',
  offline: false,
  nextPollAt: null,
  draftSelection: ['uid:1001'],
  draftDirty: false,
  publishPreview: {
    resource,
    diff: {
      addedEggGameIds: [101],
      removedEggGameIds: [],
      addedAccounts: [],
      removedAccounts: [],
      changedAccounts: [],
      unchanged: false,
    },
    missingAccountKeys: [],
    error: '',
  },
  myMember: member('A', resourceWith([101], { accounts: [sharedAccount(1001, [101])] })),
  selectGroup: vi.fn(),
  setDraftSelection: vi.fn(),
  refresh: vi.fn().mockResolvedValue(undefined),
  createGroup: vi.fn(),
  joinGroup: vi.fn(),
  publish: vi.fn().mockResolvedValue(undefined),
  stopSharing: vi.fn().mockResolvedValue(undefined),
  updateProfile: vi.fn(),
  resetInvite: vi.fn(),
  leave: vi.fn(),
  dissolve: vi.fn(),
  clearError: vi.fn(),
  ...overrides,
});

const snapshots = [snapshot(1001, '甲', [mother(101)])];

beforeEach(() => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('MotherResourceEditor', () => {
  test('旧小组面板卸载后，发布失败不得触发新小组的刷新', async () => {
    let reject!: (error: Error) => void;
    const publish = vi.fn(() => new Promise<void>((_resolve, rej) => { reject = rej; }));
    const hook = hookOf({ publish });
    const { unmount } = render(<MotherResourceEditor hook={hook} snapshots={snapshots} species={catalog} />);
    fireEvent.click(screen.getByTestId('mother-publish'));
    unmount();
    reject(new Error('旧组发布失败'));
    await waitFor(() => expect(publish).toHaveBeenCalledOnce());
    expect(hook.refresh).not.toHaveBeenCalled();
  });

  test('覆盖不变但图鉴版本升级时仍可更新资源', async () => {
    const published = resourceWith([101], { catalogVersion: 'old', accounts: resource.accounts });
    const hook = hookOf({ myMember: member('A', published), publishPreview: {
      resource, diff: diffMotherResources(published, resource), missingAccountKeys: [], error: '',
    } });
    render(<MotherResourceEditor hook={hook} snapshots={snapshots} species={catalog} />);
    expect(screen.getByTestId('mother-publish')).toBeEnabled();
    expect(screen.queryByText('当前选号与线上一致，无需更新。')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('mother-publish'));
    await waitFor(() => expect(hook.publish).toHaveBeenCalledOnce());
  });

  test('覆盖及版本都未变时仍不重复发布', () => {
    const published = resourceWith([101], { accounts: resource.accounts });
    render(<MotherResourceEditor hook={hookOf({ myMember: member('A', published), publishPreview: {
      resource, diff: diffMotherResources(published, resource), missingAccountKeys: [], error: '',
    } })} snapshots={snapshots} species={catalog} />);
    expect(screen.getByTestId('mother-publish')).toBeDisabled();
  });

  test('缺本地快照的已共享账号可以取消，也可以在发布前重新选回', () => {
    const published = resourceWith([101], { accounts: [sharedAccount(1001, [101]), sharedAccount(2002, [201])] });
    const hook = hookOf({ myMember: member('A', published), draftSelection: ['uid:1001', 'uid:2002'], publishPreview: {
      resource: null, diff: null, missingAccountKeys: ['uid:2002'], error: '缺少本地数据',
    } });
    const { rerender } = render(<MotherResourceEditor hook={hook} snapshots={snapshots} species={catalog} />);
    const missing = screen.getByTestId('mother-account-uid:2002');
    expect(missing).toHaveTextContent('本机无数据');
    fireEvent.click(missing);
    expect(hook.setDraftSelection).toHaveBeenLastCalledWith(['uid:1001']);
    rerender(<MotherResourceEditor hook={{ ...hook, draftSelection: ['uid:1001'] }} snapshots={snapshots} species={catalog} />);
    fireEvent.click(screen.getByTestId('mother-account-uid:2002'));
    expect(hook.setDraftSelection).toHaveBeenLastCalledWith(['uid:1001', 'uid:2002']);
  });

  test('本机完全无数据时仍能明确撤回所有已共享账号', () => {
    const hook = hookOf({ draftSelection: ['uid:1001'] });
    render(<MotherResourceEditor hook={hook} snapshots={[]} species={catalog} />);
    fireEvent.click(screen.getByTestId('mother-account-uid:1001'));
    expect(hook.setDraftSelection).toHaveBeenCalledWith([]);
  });

  test('勾选账号只改本地草稿；预览显示新增/移除', () => {
    const hook = hookOf({ draftSelection: [], publishPreview: { resource: null, diff: null, missingAccountKeys: [], error: '' } });
    render(<MotherResourceEditor hook={hook} snapshots={snapshots} species={catalog} />);

    fireEvent.click(screen.getByTestId('mother-account-uid:1001'));
    expect(hook.setDraftSelection).toHaveBeenCalledWith(['uid:1001']);
  });

  test('发布调用 hook.publish，成功后给出提示', async () => {
    const hook = hookOf();
    render(<MotherResourceEditor hook={hook} snapshots={snapshots} species={catalog} />);

    fireEvent.click(screen.getByTestId('mother-publish'));
    await waitFor(() => expect(hook.publish).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId('mother-editor-message')).toHaveTextContent('已更新');
  });

  test('选号清空且已发布时，二次确认后停止共享', async () => {
    const hook = hookOf({ draftSelection: [], publishPreview: { resource: null, diff: null, missingAccountKeys: [], error: '' } });
    render(<MotherResourceEditor hook={hook} snapshots={snapshots} species={catalog} />);

    fireEvent.click(screen.getByTestId('mother-stop-sharing'));
    await waitFor(() => expect(hook.stopSharing).toHaveBeenCalledTimes(1));
    expect(window.confirm).toHaveBeenCalled();
  });

  test('本机缺少服务器记录的账号时禁止发布', () => {
    const hook = hookOf({
      draftSelection: ['uid:2002'],
      publishPreview: {
        resource: null,
        diff: null,
        missingAccountKeys: ['uid:2002'],
        error: '本机缺少这些账号的数据：先导入或云同步，或在选号里撤回',
      },
    });
    render(<MotherResourceEditor hook={hook} snapshots={snapshots} species={catalog} />);

    expect(screen.getByTestId('mother-missing-accounts')).toHaveTextContent('uid:2002');
    expect(screen.getByTestId('mother-publish')).toBeDisabled();
  });

  test('本地数据变化但选号未改时提示更新', () => {
    render(<MotherResourceEditor hook={hookOf()} snapshots={snapshots} species={catalog} />);
    expect(screen.getByTestId('mother-local-changed')).toHaveTextContent('本地数据有变化');
    expect(screen.getByTestId('mother-preview-diff')).toHaveTextContent('新增 1 种');
  });
});

/* ------------------------------------------------------------------
 * 2026-11-27 追加：找不到号的出口 / 四态勾选 / 解绑确认 / 「N 个游戏号」聚合
 * ------------------------------------------------------------------ */

/** 本机两个游戏号：1001 已发布，1002 是新号。 */
const twoAccounts = [snapshot(1001, '主号', [mother(101)]), snapshot(1002, '小号', [])];

const bindPreview = (uids: number[]) => ({
  resource: {
    schemaVersion: 1 as const,
    criteriaId: motherResourceCriteriaIdOf('perfect'),
    catalogVersion: FIXTURE_CATALOG_VERSION,
    accounts: uids.map((uid) => sharedAccount(uid, [101])),
  },
  diff: null,
  missingAccountKeys: [],
  error: '',
});

const bindHookOf = (overrides: Partial<MotherGroupsHook> = {}) =>
  hookOf({ myMember: null, draftSelection: [], publishPreview: bindPreview([]), ...overrides });

const publishedMain = () =>
  member(
    'A',
    resourceWith([101], {
      accounts: [sharedAccount(1001, [101], { accountName: '主号' })],
    }),
  );

describe('绑定面板：找不到游戏号的出口（2026-11-27）', () => {
  test('列表下方有「＋ 没有找到你的游戏号？」并说明要先导入一次', () => {
    const onGoImport = vi.fn();
    render(
      <MotherResourceEditor
        hook={bindHookOf()}
        snapshots={twoAccounts}
        species={catalog}
        onGoImport={onGoImport}
      />,
    );

    const entry = screen.getByTestId('mother-add-account');
    expect(entry).toHaveTextContent('没有找到你的游戏号');
    expect(screen.getByTestId('mother-add-account-hint')).toHaveTextContent(
      '需要先用这个游戏号在小布助手里导入一次数据',
    );

    fireEvent.click(entry.querySelector('button') as HTMLButtonElement);
    expect(onGoImport).toHaveBeenCalledTimes(1);
  });

  test('没有本机数据时「去导入数据」走导入，而不是去登录（身份页）', () => {
    const onGoImport = vi.fn();
    const onGoAccount = vi.fn();
    render(
      <MotherResourceEditor
        hook={bindHookOf()}
        snapshots={[]}
        species={catalog}
        onGoImport={onGoImport}
        onGoAccount={onGoAccount}
      />,
    );

    fireEvent.click(screen.getByText('去导入数据'));
    expect(onGoImport).toHaveBeenCalledTimes(1);
    expect(onGoAccount).not.toHaveBeenCalled();
  });
});

describe('绑定面板：勾选态看得出「新增 / 解绑」（2026-11-27）', () => {
  test('已绑定的号勾着是「已绑定」，本次新勾的是「将绑定」', () => {
    render(
      <MotherResourceEditor
        hook={bindHookOf({
          myMember: publishedMain(),
          draftSelection: ['uid:1001', 'uid:1002'],
          publishPreview: bindPreview([1001, 1002]),
        })}
        snapshots={twoAccounts}
        species={catalog}
      />,
    );

    expect(screen.getByTestId('mother-account-state-uid:1001')).toHaveTextContent('已绑定');
    expect(screen.getByTestId('mother-account-state-uid:1002')).toHaveTextContent('将绑定');
  });

  test('把已发布的号从选号里去掉 → 显示「将解绑」', () => {
    render(
      <MotherResourceEditor
        hook={bindHookOf({
          myMember: publishedMain(),
          draftSelection: ['uid:1002'],
          publishPreview: bindPreview([1002]),
        })}
        snapshots={twoAccounts}
        species={catalog}
      />,
    );

    expect(screen.getByTestId('mother-account-state-uid:1001')).toHaveTextContent('将解绑');
    expect(screen.getByTestId('mother-account-state-uid:1002')).toHaveTextContent('将绑定');
  });

  test('从没发布过的号没勾时是「未绑定」', () => {
    render(
      <MotherResourceEditor
        hook={bindHookOf({ draftSelection: [], publishPreview: bindPreview([]) })}
        snapshots={twoAccounts}
        species={catalog}
      />,
    );
    expect(screen.getByTestId('mother-account-state-uid:1001')).toHaveTextContent('未绑定');
    expect(screen.getByTestId('mother-account-state-uid:1002')).toHaveTextContent('未绑定');
  });
});

describe('绑定面板：解绑前必须确认（2026-11-27）', () => {
  test('取消发布中的号：确认框点取消就不发布；点确定才发布', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    try {
      const publish = vi.fn().mockResolvedValue(undefined);
      render(
        <MotherResourceEditor
          hook={bindHookOf({
            myMember: publishedMain(),
            draftSelection: ['uid:1002'],
            publishPreview: bindPreview([1002]),
            publish,
          })}
          snapshots={twoAccounts}
          species={catalog}
        />,
      );

      confirm.mockReturnValueOnce(false);
      fireEvent.click(screen.getByTestId('mother-publish'));
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(String(confirm.mock.calls[0][0])).toContain('主号');
      expect(String(confirm.mock.calls[0][0])).toContain('解绑');
      expect(publish).not.toHaveBeenCalled();

      confirm.mockReturnValueOnce(true);
      fireEvent.click(screen.getByTestId('mother-publish'));
      await waitFor(() => expect(publish).toHaveBeenCalledTimes(1));
    } finally {
      confirm.mockRestore();
    }
  });

  test('只是新增、没有减少时不该弹确认框', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    try {
      const publish = vi.fn().mockResolvedValue(undefined);
      render(
        <MotherResourceEditor
          hook={bindHookOf({
            myMember: publishedMain(),
            draftSelection: ['uid:1001', 'uid:1002'],
            publishPreview: bindPreview([1001, 1002]),
            publish,
          })}
          snapshots={twoAccounts}
          species={catalog}
        />,
      );

      fireEvent.click(screen.getByTestId('mother-publish'));
      await waitFor(() => expect(publish).toHaveBeenCalledTimes(1));
      expect(confirm).not.toHaveBeenCalled();
    } finally {
      confirm.mockRestore();
    }
  });
});

describe('绑定面板：一人多号要聚合成「N 个游戏号」（2026-11-27）', () => {
  test('面板写清一人可绑多个号、不用第二个账号；状态与预览都按「游戏号」计数', () => {
    render(
      <MotherResourceEditor
        hook={bindHookOf({
          myMember: publishedMain(),
          draftSelection: ['uid:1001', 'uid:1002'],
          publishPreview: bindPreview([1001, 1002]),
        })}
        snapshots={twoAccounts}
        species={catalog}
      />,
    );

    expect(screen.getByTestId('mother-bind-scope')).toHaveTextContent('一个人可以绑多个游戏号');
    expect(screen.getByTestId('mother-bind-scope')).toHaveTextContent('不用再注册第二个账号');
    expect(screen.getByTestId('mother-my-status')).toHaveTextContent('已绑定 1 个游戏号');
    expect(screen.getByTestId('mother-preview')).toHaveTextContent('本次绑定 2 个游戏号');
    expect(screen.getByTestId('mother-preview')).toHaveTextContent('机器人两个号都认');
  });
});
