import { useEffect, useMemo, useRef, useState } from 'react';
import { bindingStateOf, unbindConfirmText } from '../domain/collectionBinding';
import { isBreedableGroup } from '../domain/eggs';
import { accountKeyOf, type AccountSnapshot } from '../domain/parseBackup';
import type { SpeciesEntry } from '../domain/types';
import type { MotherGroupsHook } from './useMotherGroups';
import { sortByAccountName } from './accountOrder';

const timeText = (ms: number | null | undefined): string =>
  ms ? new Date(ms).toLocaleString() : '—';

export interface MotherResourceEditorProps {
  hook: MotherGroupsHook;
  snapshots: AccountSnapshot[];
  species: SpeciesEntry[];
  /** 「没有找到你的游戏号？」→ 去「我的 · 游戏数据」导入（不是去登录） */
  onGoImport?: () => void;
  onGoAccount?: () => void;
}

/**
 * 「我的共享资源」：从**原始账号快照**选号 → 预览覆盖增减 → 手动发布/更新。
 *
 * 选号只是本地草稿，不改变已经发布的内容；发布前必须预览。
 * 本机缺少已共享的账号时不允许发布（避免把服务器摘要静默缩小）。
 */
export function MotherResourceEditor({
  hook,
  snapshots,
  species,
  onGoImport,
  onGoAccount,
}: MotherResourceEditorProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const published = hook.myMember?.resource ?? null;
  const preview = hook.publishPreview;
  const selection = hook.draftSelection;

  /** 每个本机账号的母本种数（全部母本；缺口由小组页的本地筛选决定）。 */
  const coverageOf = useMemo(() => {
    const byGameId = new Map(species.map((entry) => [entry.gameId, entry]));
    const eggIds = new Set(
      species
        .filter(
          (entry) =>
            entry.eggGameId === entry.gameId && (entry.eggGroups ?? []).some(isBreedableGroup),
        )
        .map((entry) => entry.gameId),
    );
    return (snapshot: AccountSnapshot): number => {
      const ids = new Set<number>();
      for (const pet of snapshot.pets) {
        if (pet.gender !== '母') continue;
        const eggGameId = byGameId.get(pet.gameId)?.eggGameId;
        if (eggGameId != null && eggIds.has(eggGameId)) ids.add(eggGameId);
      }
      return ids.size;
    };
  }, [species]);

  // 有未发布的选号修改时，关闭/刷新页面前提醒（发布成功或草稿回到服务器状态后自动解除）
  useEffect(() => {
    if (!hook.draftDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hook.draftDirty]);

  const toggle = (accountKey: string) => {
    hook.setDraftSelection(
      selection.includes(accountKey)
        ? selection.filter((key) => key !== accountKey)
        : [...selection, accountKey],
    );
  };

  const run = async (action: () => Promise<void>, success: string) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      if (!mounted.current) return;
      setMessage(success);
    } catch (failure) {
      if (!mounted.current) return;
      setError(failure instanceof Error ? failure.message : '操作失败，请稍后再试');
      // 409/429 等冲突后重新取服务器版本；草稿保留，用户重新预览再发布
      await hook.refresh().catch(() => {});
    } finally {
      if (mounted.current) setBusy(false);
    }
  };

  /**
   * 发布 = **整份替换**：不在本次选号里的号会被解绑，机器人立刻认不到。
   * 所以先看「这次少了谁」，少了就再确认一次（2026-11-27 用户口径：误取消不能悄悄解绑）。
   */
  const publishedKeys = new Set((published?.accounts ?? []).map((account) => account.accountKey));
  const unbinding = (published?.accounts ?? []).filter(
    (account) => !selection.includes(account.accountKey),
  );

  const handlePublish = () => {
    if (unbinding.length > 0) {
      const names = unbinding.map((account) => account.accountName);
      if (!window.confirm(unbindConfirmText(names))) return;
    }
    return run(
      () => hook.publish(),
      published
        ? `已更新绑定：${selection.length} 个游戏号，组员刷新后就能看到`
        : `已绑定 ${selection.length} 个游戏号，组员刷新后就能看到`,
    );
  };

  const handleStop = () => {
    if (!window.confirm('停止共享会从小组里撤掉你已发布的所有母本（保留组员身份），确定吗？')) {
      return;
    }
    void run(() => hook.stopSharing(), '已停止共享，组员将看到你为「待发布」');
  };

  const unchanged = published != null && preview.diff?.unchanged === true &&
    preview.resource?.catalogVersion === published.catalogVersion &&
    preview.resource?.criteriaId === published.criteriaId &&
    preview.resource?.schemaVersion === published.schemaVersion;
  const localKeys = new Set(snapshots.map((snapshot) => snapshot.accountKey ?? accountKeyOf(snapshot)));
  /** 选号列表与「本机缺少的账号」都按数字排序（2026-11-20 用户口径）。 */
  const localSnapshots = sortByAccountName(snapshots, (snapshot) => snapshot.accountName);
  const missingAccounts = sortByAccountName(
    published?.accounts.filter((account) => !localKeys.has(account.accountKey)) ?? [],
    (account) => account.accountName,
  );
  const canPublish =
    !busy &&
    preview.error === '' &&
    (!published || !unchanged) &&
    (selection.length === 0 ? published != null : preview.resource != null);

  const coverageTotal = preview.resource
    ? new Set(preview.resource.accounts.flatMap((account) => account.eggGameIds)).size
    : 0;

  return (
    <section className="rounded-2xl bg-white p-3 shadow-sm" data-testid="mother-resource-editor">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-slate-500">我的共享资源</h2>
        <span className="text-[11px] text-slate-400" data-testid="mother-my-status">
          {published
            ? `已绑定 ${published.accounts.length} 个游戏号 · ${timeText(published.publishedAt)}`
            : '尚未绑定'}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-slate-400">
        共享全部母本与产线；具体缺什么由你在小组页的本地筛选决定。按人汇总，一个号有就算有。
      </p>
      {/* 2026-11-27：用户问「两个 UID 是不是要建两个账号」——这句就是答案，别再让他猜 */}
      <p className="mt-0.5 text-[11px] text-slate-400" data-testid="mother-bind-scope">
        一个人可以绑多个游戏号，都在这个小布助手账号下——不用再注册第二个账号。
      </p>

      {snapshots.length === 0 ? (
        <div className="mt-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-500" data-testid="mother-no-local-data">
          本机还没有任何账号数据。先采集一次，或登录同一账号同步。
          {published ? '已发布的资源不会因此被撤回。' : ''}
          {onGoImport ?? onGoAccount ? (
            <button
              type="button"
              onClick={onGoImport ?? onGoAccount}
              className="mt-2 block min-h-[30px] rounded-lg border border-emerald-500 px-2.5 text-xs text-emerald-700"
            >
              去采集 / 同步
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="mt-2 space-y-1">
          {localSnapshots.map((snapshot) => {
            const key = snapshot.accountKey ?? accountKeyOf(snapshot);
            const on = selection.includes(key);
            const state = bindingStateOf({ selected: on, published: publishedKeys.has(key) });
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => toggle(key)}
                  aria-pressed={on}
                  data-testid={`mother-account-${key}`}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                    on
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  <span className="font-medium">{snapshot.accountName}</span>
                  <span
                    className={`ml-1 rounded px-1 text-[10px] leading-[1.4] ${
                      state === '将解绑'
                        ? 'bg-amber-50 text-amber-700'
                        : state === '将绑定'
                          ? 'bg-sky-50 text-sky-700'
                          : state === '已绑定'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                    }`}
                    data-testid={`mother-account-state-${key}`}
                  >
                    {state}
                  </span>
                  <span className="ml-1 text-[11px] text-slate-400">
                    UID {snapshot.gameId > 0 ? snapshot.gameId : '未知'} · 母本 {coverageOf(snapshot)} 种
                  </span>
                  <span className="mt-0.5 block text-[11px] text-slate-400">
                    导出 {snapshot.exportedAt ? new Date(snapshot.exportedAt).toLocaleString() : '未知'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* 2026-11-27：列表只来自「本机导入过的账号」，没有这一行用户会一直找"添加"按钮 */}
      {onGoImport && localSnapshots.length > 0 ? (
        <div
          className="mt-2 rounded-xl border border-dashed border-slate-200 px-3 py-2"
          data-testid="mother-add-account"
        >
          <button
            type="button"
            onClick={onGoImport}
            className="min-h-[28px] text-xs font-medium text-emerald-700"
          >
            ＋ 没有找到你的游戏号？
          </button>
          <p
            className="mt-0.5 text-[11px] leading-snug text-slate-400"
            data-testid="mother-add-account-hint"
          >
            需要先用这个游戏号采集一次（或登录同步），它才会出现在上面。
          </p>
        </div>
      ) : null}

      {missingAccounts.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {missingAccounts.map((account) => (
            <li key={account.accountKey}>
              <button
                type="button"
                onClick={() => toggle(account.accountKey)}
                aria-pressed={selection.includes(account.accountKey)}
                data-testid={`mother-account-${account.accountKey}`}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                  selection.includes(account.accountKey)
                    ? 'border-emerald-400 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                <span className="font-medium">{account.accountName}</span>
                <span className="ml-1 text-[11px] text-slate-400">UID {account.accountKey.slice(4)} · 本机无数据</span>
                <span className="mt-0.5 block text-[11px] text-slate-400">
                  {selection.includes(account.accountKey) ? '点此从本次共享中撤回；发布后生效' : '已从本次选号撤回；可点此选回'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {preview.missingAccountKeys.length > 0 ? (
        <p className="mt-2 text-xs text-rose-600" data-testid="mother-missing-accounts">
          本机缺少这些账号的数据（{preview.missingAccountKeys.join('、')}）：先导入或云同步，或在选号里撤回。
        </p>
      ) : null}

      {preview.error ? (
        <p className="mt-2 text-xs text-rose-600" data-testid="mother-preview-error">
          {preview.error}
        </p>
      ) : null}

      <div className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5" data-testid="mother-preview">
        {selection.length === 0 ? (
          <p className="text-xs text-slate-500">
            {published
              ? '当前选号为空：点下面的按钮会停止共享（保留组员身份）。'
              : '还没有选号。勾选你要共享的游戏账号。'}
          </p>
        ) : (
          <>
            <p className="text-xs text-slate-500">
              本次绑定 {selection.length} 个游戏号 · 覆盖 {coverageTotal} 种母本
              {selection.length > 1 ? (
                <span className="ml-1 text-slate-400">（同一个账号，机器人两个号都认）</span>
              ) : null}
              {preview.diff && !preview.diff.unchanged ? (
                <span className="ml-1" data-testid="mother-preview-diff">
                  （新增 {preview.diff.addedEggGameIds.length} 种、移除{' '}
                  {preview.diff.removedEggGameIds.length} 种
                  {(preview.diff.addedLines?.length ?? 0) + (preview.diff.removedLines?.length ?? 0) > 0
                    ? `；产线（蛋 × 档位）+${preview.diff.addedLines?.length ?? 0} / -${
                        preview.diff.removedLines?.length ?? 0
                      }`
                    : ''}
                  ）
                </span>
              ) : null}
            </p>
            {preview.diff &&
            (preview.diff.addedLines?.length ?? 0) + (preview.diff.removedLines?.length ?? 0) > 0 ? (
              <p className="mt-0.5 text-[10px] leading-snug text-slate-400" data-testid="mother-preview-line-hint">
                产线按「蛋 × 档位」计；同一颗蛋可能有多个档位 / 性格，所以条数会多于母本数。
              </p>
            ) : null}
          </>
        )}
        {!hook.draftDirty && preview.diff && !preview.diff.unchanged ? (
          <p className="mt-1 text-[11px] text-amber-700" data-testid="mother-local-changed">
            本地数据有变化，更新后组员才能看到。
          </p>
        ) : null}
        {hook.draftDirty ? (
          <p className="mt-1 text-[11px] text-amber-700" data-testid="mother-draft-dirty">
            选号有未发布的修改，发布前请确认上面的预览。
          </p>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {selection.length === 0 && published ? (
          <button
            type="button"
            onClick={handleStop}
            disabled={busy}
            data-testid="mother-stop-sharing"
            className="min-h-[36px] flex-1 rounded-lg border border-rose-200 px-3 text-sm font-medium text-rose-600 disabled:opacity-50"
          >
            {busy ? '处理中…' : '停止共享我的资源'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handlePublish()}
            disabled={!canPublish}
            data-testid="mother-publish"
            className="min-h-[36px] flex-1 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? '发布中…' : published ? '更新我的资源' : '发布我的资源'}
          </button>
        )}
      </div>
      {published && unchanged ? (
        <p className="mt-1 text-[11px] text-slate-400">当前选号与线上一致，无需更新。</p>
      ) : null}
      {message ? (
        <p className="mt-2 text-xs text-emerald-700" data-testid="mother-editor-message">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-2 text-xs text-rose-600" data-testid="mother-editor-error">
          {error}
        </p>
      ) : null}
    </section>
  );
}
