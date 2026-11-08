import { useEffect, useState } from 'react';
import { inspectBytesInWorker, inspectUrlInWorker } from '../pcap/decodeInWorker';
import { nextCaptureProgress, type CaptureAnalysis, type CaptureProgress } from './captureProgress';
import { clearCaptureProgressCache, readCaptureProgressCache, writeCaptureProgressCache } from './captureProgressCache';
import { writeNearbySnapshot } from './nearbyStore';
import { readLiveDecodeState, writeLiveDecodeState } from './liveDecodeStore';
import { readCaptureSnapshot, readCaptureSnapshotBytes, type CollectorState } from './nativeCollector';

interface ProgressState { progress: CaptureProgress | null; sourceBytes: number; error: string | null; checking: boolean }
const empty: ProgressState = { progress: null, sourceBytes: 0, error: null, checking: false };
/** live 刷新的自适应区间：解一次很快就在 500ms 后继续，慢则最多等 1.5s，避免连续占满 CPU。 */
const LIVE_INTERVAL_MIN_MS = 500;
const LIVE_INTERVAL_MAX_MS = 1500;
export interface CaptureProgressOptions {
  /** 持续获取模式：进度走满也不停止轮询，继续按固定间隔刷新实时计数。 */
  live?: boolean;
  /**
   * 是否写 `captureProgressCache`（默认 true）。附近页用 live 轮询时传 false，
   * 避免把 ready 缓存写脏、回到采集页触发提前自动停止。
   */
  persist?: boolean;
  /** 手动刷新：递增后重启轮询 effect，立即重新读取快照 */
  refreshKey?: number;
  /**
   * 切到后台也继续轮询 / 解码（默认 false）。
   * 2026-11-08：安卓壳的系统悬浮窗要在游戏上方实时变色，网页退到后台后
   * document.hidden 为真，普通模式会停掉解码；只有原生浮窗场景才需要打开。
   */
  background?: boolean;
  /**
   * 尾部窗口字节数（2026-11-08 性能）：只解析文件最后 N 字节。
   * 附近页 / 悬浮球实时雷达用 2MiB，刷新从 ~10s 降到 ~1s；
   * 「我的」页不传（0 = 全量），进度判断与导入仍按整份文件。
   */
  windowBytes?: number;
}

export function useCaptureProgress(state: CollectorState | null, options: CaptureProgressOptions = {}): ProgressState {
  const live = Boolean(options.live);
  const windowBytes = Number(options.windowBytes) || 0;
  // 窗口化解析结果不完整，绝不能写进进度缓存（否则采集页会拿它当作已收齐）
  const persistCache = options.persist !== false && windowBytes === 0;
  const refreshKey = options.refreshKey ?? 0;
  const background = Boolean(options.background);
  const enabled = state?.phase === 'capturing' && state.progressVersion === 1;
  const session = state?.fileId;
  const hydrated = session ? readCaptureProgressCache(session) : null;
  const [result, setResult] = useState<ProgressState>(() =>
    hydrated
      ? {
          progress: hydrated.progress,
          sourceBytes: hydrated.sourceBytes,
          error: hydrated.error,
          checking: hydrated.checking,
        }
      : empty,
  );
  useEffect(() => {
    if (!enabled || !session) return;
    const cached = readCaptureProgressCache(session);
    const initial: ProgressState = cached
      ? {
          progress: cached.progress,
          sourceBytes: cached.sourceBytes,
          error: cached.error,
          checking: cached.checking,
        }
      : empty;
    setResult(initial);
    // 已经走满：彻底停下，不再读快照 / 解码。否则走满后再来个数据包就会重新复核，
    // 拖住紧随其后的自动停止与导入（2026-10-25 用户要求）。
    // 持续获取模式例外：不能停，否则实时计数就死在「已收齐」那一刻。
    if (initial.progress?.stage === 'ready' && !live) return;

    let disposed = false, epoch = 0;
    let timer: number | undefined;
    let controller: AbortController | undefined;
    let settled = false;
    let previous: CaptureProgress | null = cached?.progress ?? null;
    let analysisCache: { size: number; analysis: CaptureAnalysis } | null = cached
      ? { size: cached.sourceBytes, analysis: cached.analysis }
      : null;
    const active = (run: number) => !disposed && (background || !document.hidden) && run === epoch;

    const persist = (next: ProgressState, analysis: CaptureAnalysis | null) => {
      if (!persistCache || !analysis || !next.progress) return;
      writeCaptureProgressCache({
        session,
        progress: next.progress,
        analysis,
        sourceBytes: next.sourceBytes,
        error: next.error,
        checking: next.checking,
      });
    };

    const check = async (run: number) => {
      if (!active(run) || settled) return;
      const startedAt = performance.now();
      try {
        const snapshot = await readCaptureSnapshot();
        if (!active(run)) return;
        if (!snapshot || snapshot.id !== session) {
          previous = null;
          analysisCache = null;
          if (persistCache) clearCaptureProgressCache();
          setResult(empty);
        } else {
          // live 模式每次都重新解码：不按文件尺寸跳过，避免「文件在涨但界面不动」的假缓存
          let analysis = !live && analysisCache?.size === snapshot.size ? analysisCache.analysis : null;
          if (!analysis) {
            setResult((current) => ({ ...current, checking: true }));
            controller = new AbortController();
            if (live) {
              // 增量读取（2026-11-08）：只搬新增的一段，拼接后送 worker。
              // run() 会 transfer 走传入的 buffer，slice 一份保住主线程的增量缓存。
              const bytes = await readCaptureSnapshotBytes(snapshot);
              // 冷启动恢复点：Worker 被回收后靠它继续解裁剪过的文件（见 liveDecodeStore）
              const resume = windowBytes ? readLiveDecodeState(snapshot.id) : null;
              analysis = await inspectBytesInWorker(bytes.slice(), snapshot.id, controller.signal, undefined, windowBytes, resume ?? undefined);
            } else {
              analysis = await inspectUrlInWorker(snapshot.url, snapshot.id, controller.signal, undefined, windowBytes);
            }
          }
          if (!active(run)) return;
          if (live && windowBytes && analysis.liveState) writeLiveDecodeState(snapshot.id, analysis.liveState);
          analysisCache = { size: snapshot.size, analysis };
          writeNearbySnapshot({
            session,
            scene: analysis.nearbyScene ?? null,
            pets: analysis.nearby ?? [],
            self: analysis.nearbySelf ?? null,
            encounter: analysis.encounter ?? null,
            updatedAt: Date.now(),
          });
          previous = nextCaptureProgress(previous, analysis, performance.now(), session);
          const next: ProgressState = {
            progress: previous,
            sourceBytes: snapshot.size,
            error: null,
            checking: false,
          };
          setResult(next);
          persist(next, analysis);
          if (next.progress?.stage === 'ready' && !live) {
            settled = true;
            return;
          }
        }
      } catch (error) {
        if (!active(run)) return;
        previous = null;
        analysisCache = null;
        const next: ProgressState = {
          ...empty,
          error: error instanceof Error ? error.message : '暂时无法核对数据进度，正在重试',
        };
        setResult(next);
        if (cached) {
          if (persistCache) writeCaptureProgressCache({
            session,
            progress: cached.progress,
            analysis: cached.analysis,
            sourceBytes: cached.sourceBytes,
            error: next.error,
            checking: false,
          });
        }
      }
      // live 模式要尽可能跟上游戏：按上一轮解码耗时自适应，解码快就 400ms 一轮，
      // 解码慢（低端机 / 大文件）就等它跑完再排下一轮，避免把 CPU 一直压满反而更卡。
      if (active(run)) {
        const interval = live
          ? Math.max(LIVE_INTERVAL_MIN_MS, Math.min(LIVE_INTERVAL_MAX_MS, performance.now() - startedAt))
          : 3000;
        timer = window.setTimeout(() => { void check(run); }, interval);
      }
    };

    const visibility = () => {
      if (settled) return;
      const run = ++epoch;
      window.clearTimeout(timer); controller?.abort();
      if (background || !document.hidden) void check(run);
    };
    visibility();
    document.addEventListener('visibilitychange', visibility);
    return () => {
      disposed = true; epoch++; window.clearTimeout(timer); controller?.abort();
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [enabled, session, live, refreshKey, background, windowBytes]);
  if (!enabled || result.progress?.session !== session) return { ...empty, error: enabled ? result.error : null };
  return result;
}
