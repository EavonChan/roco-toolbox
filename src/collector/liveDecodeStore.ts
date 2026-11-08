/**
 * 实时解码会话的跨 Worker 恢复状态（2026-11-08）。
 *
 * 附近页只解文件尾部窗口，解密 key 与账号 / 场景基线都活在 Worker 里。采集文件被原生
 * 滚动裁剪后，文件头里的握手帧与 profile 帧已经不存在，Worker 一旦被系统回收，
 * 光靠文件再也解不出数据。这里把 Worker 导出的状态按采集会话存进 localStorage，
 * 下一轮（冷启动）注入回去；只保留最近一个会话，避免越积越多。
 */
const KEY = 'roco.liveDecodeState.v1';
/** localStorage 同步写入较贵（状态里带附近精灵列表），每 4 秒最多落一次盘。 */
const WRITE_INTERVAL_MS = 4000;

let cached: { session: string; state: string } | null = null;
let lastWrite = 0;

export function readLiveDecodeState(session: string): string | null {
  if (cached?.session === session) return cached.state;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { session?: unknown; state?: unknown };
    if (parsed?.session !== session || typeof parsed.state !== 'string') return null;
    cached = { session, state: parsed.state };
    return parsed.state;
  } catch {
    return null;
  }
}

export function writeLiveDecodeState(session: string, state: string): void {
  // 换采集会话时立刻落盘一次，别让 4 秒节流把新会话的第一个恢复点吞掉
  if (cached?.session !== session) lastWrite = 0;
  cached = { session, state };
  const now = Date.now();
  if (now - lastWrite < WRITE_INTERVAL_MS) return;
  lastWrite = now;
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ session, state }));
  } catch {
    // 配额不足 / 隐私模式：丢一次恢复点不影响实时观看，下一轮继续尝试
  }
}

/** 测试用：清空内存缓存与落盘状态。 */
export function resetLiveDecodeStateForTest(): void {
  cached = null;
  lastWrite = 0;
  try { window.localStorage.removeItem(KEY); } catch { /* 无 localStorage 的测试环境 */ }
}
