import type { DecodedCapture } from './decodeCapture';
import { isCollectorCaptureUrl } from './collectorUrl';
import type { CaptureAnalysis } from '../collector/captureProgress';

const defaultWorker = () => new Worker(new URL('./decodeCapture.worker.ts', import.meta.url), { type: 'module' });
type Input = ({ bytes: Uint8Array; fileName: string } | { url: string; fileName: string }) & {
  mode?: 'inspect'; windowBytes?: number;
  /** 冷启动恢复点（见 collector/liveDecodeStore）：裁剪过的文件靠它继续解尾窗 */
  resume?: string;
};
const REQUEST_TIMEOUT_MS = 120_000;

interface Reply<T> { ok: boolean; value?: T; error?: string }
interface Slot {
  worker: Worker;
  /** 自增请求号 → 回调；每个请求独立超时 / 取消，Worker 本身跨请求复用 */
  pending: Map<number, (reply: Reply<unknown>) => void>;
}

/**
 * Worker 长驻（2026-11-08 性能修复）。
 *
 * core.js 里有跨轮解密缓存：TCP 流 append-only，已解出的帧可以直接复用，
 * 每轮只真正解密新增帧。但缓存是模块级状态，Worker 一旦 terminate 就全丢，
 * 于是每轮都要把整个文件重新解密一遍（7MiB 约 4s，手机上更慢）。
 * 这里按「创建函数」复用 Worker：生产只建一次，测试各自 factory 互相隔离。
 */
const slots = new WeakMap<() => Worker, Slot>();
let nextId = 1;

function slotFor(createWorker: () => Worker): Slot {
  const existing = slots.get(createWorker);
  if (existing) return existing;
  const worker = createWorker();
  const pending = new Map<number, (reply: Reply<unknown>) => void>();
  const slot: Slot = { worker, pending };
  const failAll = (message: string) => {
    const items = Array.from(pending.values());
    pending.clear();
    items.forEach((settle) => settle({ ok: false, error: message }));
  };
  worker.onmessage = (event: MessageEvent<Reply<unknown> & { id?: number }>) => {
    const id = event.data?.id;
    const settle = id == null ? undefined : pending.get(id);
    if (!settle) return; // 已取消 / 超时的请求：结果直接丢弃
    pending.delete(id!);
    settle(event.data);
  };
  worker.onerror = (event) => {
    event.preventDefault();
    slots.delete(createWorker);
    worker.terminate();
    failAll('无法完成后台解析，原始文件仍保留；请重试或导出后在电脑导入');
  };
  worker.onmessageerror = () => {
    slots.delete(createWorker);
    worker.terminate();
    failAll('无法读取后台解析结果，原始文件仍保留');
  };
  slots.set(createWorker, slot);
  return slot;
}

/** 丢弃当前 Worker（超时 / 无法恢复时调用），下次请求会重建并重新预热缓存。 */
function resetSlot(createWorker: () => Worker): void {
  const slot = slots.get(createWorker);
  if (!slot) return;
  slots.delete(createWorker);
  slot.pending.clear();
  try { slot.worker.terminate(); } catch { /* 已销毁 */ }
}

function run<T>(input: Input, createWorker: () => Worker, signal?: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const slot = slotFor(createWorker);
    const id = nextId++;
    let finished = false;
    const finish = (error: Error | null, value?: T) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      slot.pending.delete(id);
      signal?.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(value!);
    };
    const abort = () => finish(new DOMException('采集进度检查已暂停', 'AbortError'));
    const timer = setTimeout(() => {
      // 卡死的 Worker 不能继续复用，否则后面所有请求都会排队到同样超时
      finish(new Error('解析用时过长，原始文件仍保留，请稍后重试'));
      resetSlot(createWorker);
    }, REQUEST_TIMEOUT_MS);
    slot.pending.set(id, (reply) => {
      if (reply.ok && reply.value !== undefined) finish(null, reply.value as T);
      else finish(new Error(reply.error || '抓包解析失败，原始文件仍保留'));
    });
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) { abort(); return; }
    try {
      // Transfer one owned buffer; subarrays must not expose unrelated bytes.
      if ('bytes' in input) {
        const { bytes, fileName, mode, windowBytes, resume } = input;
        const owned = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength && bytes.buffer instanceof ArrayBuffer
          ? bytes : bytes.slice();
        // mode 必须一起发：漏发会让 worker 走默认导入模式，采到一半的文件直接被当成
        // 「完整导入」解析，抛出「解析准备已完成，但后续数据仍不完整」（2026-11-08 事故）。
        slot.worker.postMessage({ id, bytes: owned, fileName, mode, windowBytes, resume }, [owned.buffer]);
      } else slot.worker.postMessage({ id, ...input }, []);
    } catch (error) {
      resetSlot(createWorker);
      finish(error instanceof Error ? error : new Error('无法交付抓包字节'));
    }
  });
}

/** 测试用：清空长驻 Worker，避免用例之间互相复用。 */
export function resetDecodeWorkerForTest(): void {
  resetSlot(defaultWorker);
}

export function decodeInWorker(bytes: Uint8Array, fileName: string, createWorker = defaultWorker): Promise<DecodedCapture> {
  return run<DecodedCapture>({ bytes, fileName }, createWorker);
}
export async function decodeUrlInWorker(url: string, fileName: string, createWorker = defaultWorker): Promise<DecodedCapture> {
  if (!isCollectorCaptureUrl(url)) throw new Error('无效的本机采集授权链接');
  return run<DecodedCapture>({ url, fileName }, createWorker);
}
export async function inspectUrlInWorker(url: string, fileName: string, signal: AbortSignal, createWorker = defaultWorker, windowBytes = 0, resume?: string): Promise<CaptureAnalysis> {
  if (!isCollectorCaptureUrl(url)) throw new Error('无效的本机采集授权链接');
  return run<CaptureAnalysis>({ url, fileName, mode: 'inspect', windowBytes, resume }, createWorker, signal);
}

/**
 * 巡检字节版（2026-11-08 增量读取配套）：字节由调用方增量拼接好后传入。
 * 注意传入的 buffer 会被 transfer 给 worker，调用方要保留请自己 slice 一份。
 */
export function inspectBytesInWorker(bytes: Uint8Array, fileName: string, signal: AbortSignal, createWorker = defaultWorker, windowBytes = 0, resume?: string): Promise<CaptureAnalysis> {
  return run<CaptureAnalysis>({ bytes, fileName, mode: 'inspect', windowBytes, resume }, createWorker, signal);
}
