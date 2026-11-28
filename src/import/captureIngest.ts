import { track } from '../api/analytics';
import { readAccountId } from '../api/session';
import { syncNow } from '../api/sync';
import { CATALOG_VERSION, eggGroupNames, species } from '../data/catalog';
import { analyzeImport } from '../domain/importDiff';
import { accountKeyOf, parseBackup, type AccountSnapshot } from '../domain/parseBackup';
import {
  isToolboxBackup,
  mergeImportedSnapshot,
  mergeSnapshots,
  parseToolboxBackup,
  type MergeResult,
  type ToolboxBackup,
} from '../domain/backup';
import { groupMothersByEgg, plannedAchievements, type TargetMode } from '../domain/petFilters';
import { isCollectorCaptureUrl } from '../pcap/collectorUrl';
import { decodeUrlInWorker } from '../pcap/decodeInWorker';
import { readCaptureFile } from '../pcap/readCaptureFile';
import { fetchShellCapture, takeNativeShare } from '../share/nativeShare';
import { takeSharedFile } from '../share/shareTarget';
import { setLastImportResult } from '../storage/lastImportStore';
import { refreshSnapshots } from '../storage/snapshotStore';
import { saveSnapshot, writeSnapshots } from '../storage/snapshots';
import { autoPublishGroups, collectPendingDemandClaims } from '../ui/groupAutoPublish';
import { setImportMessage } from '../ui/importMessageStore';
import { beginImport, updateImportOutcome } from '../ui/importOutcomeStore';
import { getMotherPlan, mergeMotherPlan } from '../ui/motherPlanStore';
import { setSyncConflict, setSyncNotice } from '../ui/syncNoticeStore';
import { recordSyncedPets } from '../ui/syncAdditions';
import { adoptBackupTargetMode, getTargetMode } from '../ui/targetModeStore';

/**
 * 采集入库（2026-11-28 从 `ImportPanel` 抽出，Stage 0）。
 *
 * 这里是**壳内采集与「解析并导入」共用的唯一入库链路**：
 * `roco-share` → 解码 → 按账号写库 → 刷新快照 → 本次新增 / 三阶段反馈 → 自动同步 / 小组发布。
 *
 * 抽出的原因：文件导入 UI 要删，但这条链路是安卓 / 桌面采集的主流程。
 * 本模块只搬代码、不改行为；`ImportPanel` 与壳内采集都调它。
 */

const speciesByGameId = new Map(species.map((entry) => [entry.gameId, entry]));

export interface IngestCaptureOptions {
  files: File[];
  /** 导入前的本机快照：「本次新增」与计划达成都要和它比 */
  snapshots: AccountSnapshot[];
  /** 目标模式（默认读全局 store）：决定「本次新增」的分类口径 */
  mode?: TargetMode;
  /** 来源说明，放在结果最前面（分享 / 采集 / 手选） */
  sourceLabel?: string;
  /** 读文件方式：默认 readCaptureFile（按魔数分流 pcap / JSON） */
  readFile?: (file: File) => Promise<unknown>;
}

/** 合并结果的反馈文案，两个入口（手选 / 分享）共用 */
export function mergeMessage(name: string, merged: MergeResult): string {
  return `已合并导入「${name}」：新增 ${merged.added.length} 个账号 · 更新 ${merged.updated.length} 个 · 保留本地较新的 ${merged.kept.length} 个`;
}

/**
 * 备份里的「规划数据」：目标模式（本地优先，本机没选过才采用备份的值）+ 计划收集（并集）。
 * 返回给用户的说明文案。
 */
export function applyBackupPlanning(backup: ToolboxBackup): string[] {
  adoptBackupTargetMode(backup.targetMode);
  const addedCount = mergeMotherPlan(backup.motherPlan ?? []);
  return addedCount > 0 ? [`计划收集新增 ${addedCount} 条`] : [];
}

/** 计划收集的达成提示：只报这次导入「从不合格变合格」的链 */
export function achievementMessages(
  previous: AccountSnapshot[],
  next: AccountSnapshot[],
  planBefore: readonly string[],
): string[] {
  if (planBefore.length === 0) return [];
  const modeNow = getTargetMode();
  const groupsOf = (list: AccountSnapshot[]) =>
    groupMothersByEgg(list.flatMap((item) => item.pets), speciesByGameId, species, modeNow);
  const beforeKeys = new Set(
    plannedAchievements(groupsOf(previous), planBefore).map((group) => group.chainKey),
  );
  const achieved = plannedAchievements(groupsOf(next), planBefore).filter(
    (group) => !beforeKeys.has(group.chainKey),
  );
  if (achieved.length === 0) return [];
  const names = achieved.slice(0, 3).map((group) => group.formLabel || '未知精灵');
  return [`计划收集达成 ${achieved.length} 个：${names.join('、')}${achieved.length > 3 ? ' 等' : ''}`];
}

/**
 * 导入后的尽力而为收尾：把资源同步到已加入的小组 + 看看有没有人接了我的需求。
 * 主入口与「合并导入」共用，避免两条导入路径行为不一致。
 * 失败不影响本机与云同步，也不打断用户操作。
 */
export function afterImport(
  operationId: number,
  working: AccountSnapshot[],
  touched: Set<string>,
): void {
  void Promise.all([
    autoPublishGroups({
      snapshots: working,
      species,
      catalogVersion: CATALOG_VERSION,
      touchedAccountKeys: [...touched],
    }).catch(() => 0),
    // 顺带看看有没有人接了我的需求，且这次导入的数据里确实已经有这颗蛋
    collectPendingDemandClaims({ snapshots: working, species }).catch(() => []),
  ]).then(([count, claims]) => {
    if (count === 0 && claims.length === 0) return;
    updateImportOutcome(operationId, {
      ...(count > 0 ? { group: 'updated' as const, groupCount: count } : {}),
      ...(claims.length > 0 ? { claims } : {}),
    });
  });
}

/** 导入后把「本次新增里符合看板分类的」记下来，给顶部那张卡片用；然后自动云同步 */
export function reportNewPets(
  previous: AccountSnapshot[],
  imported: AccountSnapshot[],
  operationId: number,
  mode: TargetMode,
): void {
  setLastImportResult(
    analyzeImport({
      previous,
      imported,
      species,
      eggGroupNames,
      mode,
    }),
  );
  // 埋点：只报规模，不报内容（账号数 / 精灵数）
  track('import_success', {
    accounts: imported.length,
    pets: imported.reduce((sum, snapshot) => sum + snapshot.pets.length, 0),
  });
  // 开了云同步的话，导入成功后直接做一次「云同步」（拉云端 → 与本机合并 → 推回云端，
  // 2026-10-07）：分享导入是跨设备的主路径，顺手对齐就不必让用户再去「云同步」点一次。
  // 尽力而为：失败不影响本地，也不打断用户操作。
  // 2026-10-06 修：遇 409 是**正常返回 `{ok:false}` 而不是抛异常**，
  // 原来的 `.catch(() => {})` 因此永远不触发 → 冲突被静默吞掉，用户以为同步好了。
  // 现在把冲突交给「云同步」面板展示（用户在那里二选一），并在顶部给一条提示。
  if (readAccountId()) {
    updateImportOutcome(operationId, { cloud: 'syncing' });
    void syncNow()
      .then((result) => {
        if (!result.ok) {
          updateImportOutcome(operationId, { cloud: 'conflict' });
          setSyncConflict(result.conflict);
          return;
        }
        updateImportOutcome(operationId, { cloud: 'synced' });
        // 从云端补上了本机没有的设置键：这些键是模块级 store 启动时读的，刷新才生效。
        // 这里**不刷新**——分享导入后还要跳看板看「本次新增」，刷新会把它冲掉；
        // 所以只给一条提示，用户想立刻生效就自己刷新。
        if (result.prefsAdopted.length > 0) {
          setSyncNotice('设置已按云端更新，刷新页面后生效。');
        }
        // 同步带进来的精灵也算进「本次新增」：比的是**这次导入前**的本机快照，
        // 所以导入 + 同步合并起来一起展示（覆盖掉上面只按导入内容写的卡片）
        if (result.added.length > 0 || result.updated.length > 0) {
          void recordSyncedPets(previous);
        }
      })
      // 网络/服务端异常也要留一条提示：这是导入后自动触发的，用户没主动点过任何按钮
      .catch(() => {
        updateImportOutcome(operationId, { cloud: 'failed' });
        setSyncNotice('自动同步没成功（网络异常），到「我的 · 私有同步」点一次「立即同步」重试。');
      });
  }
}

/**
 * 入库入口。一份文件可能是：
 * - 采集器抓包（.pcap / 抓包 JSON）→ 按账号替换该账号的快照（「重新抓了一次」的正确语义）
 * - 工具箱备份（自己导出的）→ **合并**，多设备同步靠它
 *
 * 之所以不分成两个按钮：微信收到备份后「分享给小布助手」时走的就是这条入口，
 * 那时用户没机会选按钮，只能靠内容自己认。
 */
export async function ingestCaptureFiles({
  files,
  snapshots,
  mode = getTargetMode(),
  sourceLabel,
  readFile = readCaptureFile,
}: IngestCaptureOptions): Promise<AccountSnapshot[] | null> {
  const operationId = beginImport();
  try {
    // 先记住导入前的数据，"本次新增"才有得比
    const previous = snapshots;
    // 计划收集的达成判定要用「导入前」的计划（备份带进来的新计划不参与本次判定）
    const planBefore = [...getMotherPlan()];
    // 合并以「当前写进去的状态」为准，多文件时后一个能看见前一个的结果
    let working = [...snapshots];
    const imported: AccountSnapshot[] = [];
    /** 这次导入涉及的账号：自动发布时并进小组的选号（手动取消过的旧账号不会被加回来） */
    const touched = new Set<string>();
    const messages: string[] = [];

    for (const file of files) {
      // 抓包文件（.pcap）会自动交给采集器那套解析器解成 JSON，其余按 JSON 读
      const raw = await readFile(file);

      if (isToolboxBackup(raw)) {
        const backup = parseToolboxBackup(raw);
        const merged = mergeSnapshots(working, backup.accounts);
        working = merged.snapshots;
        await writeSnapshots(working);
        for (const account of backup.accounts) {
          touched.add(account.accountKey ?? accountKeyOf(account));
        }
        messages.push(mergeMessage(file.name, merged));
        messages.push(...applyBackupPlanning(backup));
        continue;
      }

      const parsed = parseBackup(raw, new Date().toISOString());
      // 按**账号身份（游戏 UID）**替换：重名但不同 UID 的两个账号是两个账号，互不顶掉
      const key = accountKeyOf(parsed);
      // 这次抓包没进家园场景时不要丢掉本机已有的家园（2026-11-01 用户反馈）
      const snapshot = mergeImportedSnapshot(
        parsed,
        working.find((item) => accountKeyOf(item) === key),
      );
      await saveSnapshot(snapshot);
      working = [...working.filter((item) => accountKeyOf(item) !== key), snapshot];
      imported.push(snapshot);
      touched.add(key);
    }

    await refreshSnapshots();
    reportNewPets(previous, working, operationId, mode);
    // 抓包导入也可能让计划里的链达标
    messages.push(...achievementMessages(previous, working, planBefore));
    // 分享进来的来源说明放最前面，后面接合并/计划的说明（合并结果不在「本次新增」卡片里）
    const parts = sourceLabel ? [sourceLabel, ...messages] : messages;
    const text = parts.length > 0 ? parts.join('；') : null;
    if (text) setImportMessage(text);
    updateImportOutcome(operationId, {
      local: 'saved',
      message: text,
      cloud: readAccountId() ? 'syncing' : 'not-enabled',
    });
    // 导入后直接把资源同步到已加入的小组（发布不再是用户必须记得的一步）。
    afterImport(operationId, working, touched);
    return imported;
  } catch (error) {
    updateImportOutcome(operationId, {
      local: 'failed',
      message: error instanceof Error ? error.message : '导入失败',
    });
    return null;
  }
}

/** 导入一个待消费的文件（壳 / 浏览器分享共用），由调用方提供最新的入库函数。 */
export type PendingShareIngest = (
  file: File,
  sourceLabel: string,
  readFile?: (file: File) => Promise<unknown>,
) => Promise<AccountSnapshot[] | null>;

/**
 * 消费分享进来的数据（三条来源）：
 * 1. 浏览器里走系统分享（Web Share Target）→ Service Worker 存进缓存，见 shareTarget.ts
 * 2. 原生壳接住分享的 JSON → 壳直接注入文本，见 nativeShare.ts
 * 3. 原生壳接住分享的抓包（采集器的「分享文件」）→ 壳拦下请求返回字节，页面自己去取
 *
 * 由调用方保证「本机数据已读完」再调（否则「本次新增」是在和空数据比）；
 * 解码失败会抛错，让调用方展示可读提示。
 */
export async function consumePendingShares(ingest: PendingShareIngest): Promise<void> {
  const fromBrowser = await takeSharedFile();
  if (fromBrowser) {
    const name = fromBrowser.name || 'shared.json';
    // 原始字节交给 readCaptureFile 按魔数分流：JSON 走解析、PCAP 走采集器解析器
    await ingest(new File([fromBrowser.blob], name), `已导入分享进来的采集数据（${name}）`);
    return;
  }

  const fromShell = takeNativeShare();
  if (!fromShell) return;

  if (fromShell.kind === 'capture') {
    const name = fromShell.name || 'capture.pcap';
    if (isCollectorCaptureUrl(fromShell.url)) {
      // Metadata only on the UI thread: Worker streams the native file and decodes there.
      await ingest(
        new File([], name),
        `已解析并导入本机采集数据（${name}）`,
        async () => (await decodeUrlInWorker(fromShell.url, name)).payload,
      );
      return;
    }
    const bytes = await fetchShellCapture(fromShell.url);
    await ingest(
      new File([bytes], name, { type: 'application/octet-stream' }),
      `已解析并导入分享进来的抓包数据（${name}）`,
    );
    return;
  }

  const name = fromShell.name || 'shared.json';
  await ingest(
    new File([fromShell.text], name, { type: 'application/json' }),
    `已导入分享进来的采集数据（${name}）`,
  );
}
