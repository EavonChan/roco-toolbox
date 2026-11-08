import { describe, expect, test, vi } from 'vitest';
import { decodeInWorker, decodeUrlInWorker, inspectBytesInWorker, inspectUrlInWorker } from './decodeInWorker';

interface FakeWorker {
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: (() => void) | null;
  postMessage: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
}

function harness() {
  const worker: FakeWorker = {
    onmessage: null, onerror: null, onmessageerror: null,
    postMessage: vi.fn(), terminate: vi.fn(),
  };
  return { worker, factory: () => worker as unknown as Worker };
}

/** 取最近一次发往 Worker 的消息（长驻后消息带请求号 id）。 */
function lastRequest(worker: FakeWorker) {
  const calls = worker.postMessage.mock.calls;
  return calls[calls.length - 1] as [{ id: number } & Record<string, unknown>, Transferable[]];
}

function reply(worker: FakeWorker, id: number, data: Record<string, unknown>) {
  worker.onmessage!({ data: { id, ...data } } as MessageEvent);
}

describe('PCAP 后台解析', () => {
  test('暂停进度检查只取消本次请求，Worker 保持长驻以复用解密缓存', async () => {
    const { worker, factory } = harness();
    const controller = new AbortController();
    const result = inspectUrlInWorker('https://roco-share.invalid/collector/12345678-1234-1234-1234-123456789abc', 'capture-1.pcap', controller.signal, factory);
    controller.abort();
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
    expect(worker.terminate).not.toHaveBeenCalled();
    // 晚到结果不能再让已取消的请求复活
    reply(worker, lastRequest(worker)[0].id, { ok: true, value: { fingerprint: 'late' } });
    await expect(result).rejects.toMatchObject({ name: 'AbortError' });
  });
  test('本机授权 URL 直接交给 Worker，主线程不读取原包', async () => {
    const { worker, factory } = harness();
    const url = 'https://roco-share.invalid/collector/12345678-1234-1234-1234-123456789abc';
    const result = decodeUrlInWorker(url, 'capture-123.pcap', factory);
    const [payload, transfer] = lastRequest(worker);
    expect(payload).toMatchObject({ url, fileName: 'capture-123.pcap' });
    expect(transfer).toEqual([]);
    reply(worker, payload.id, { ok: true, value: { mainName: 'parsed.json' } });
    await expect(result).resolves.toEqual({ mainName: 'parsed.json' });
  });
  test('同一工厂的多次请求复用同一个 Worker（解密缓存跨轮存活）', async () => {
    const { worker, factory } = harness();
    const first = inspectBytesInWorker(new Uint8Array([1]), 'capture-1.pcap', new AbortController().signal, factory);
    const firstId = lastRequest(worker)[0].id;
    const second = inspectBytesInWorker(new Uint8Array([2]), 'capture-1.pcap', new AbortController().signal, factory);
    const secondPayload = lastRequest(worker)[0];
    expect(secondPayload.id).not.toBe(firstId);
    expect(worker.postMessage).toHaveBeenCalledTimes(2);
    reply(worker, secondPayload.id, { ok: true, value: { step: 2 } });
    reply(worker, firstId, { ok: true, value: { step: 1 } });
    await expect(first).resolves.toEqual({ step: 1 });
    await expect(second).resolves.toEqual({ step: 2 });
    expect(worker.terminate).not.toHaveBeenCalled();
  });
  test('外部链接和伪造授权不能交给 Worker 下载', async () => {
    const { factory, worker } = harness();
    for (const url of ['https://example.com/x.pcap', 'https://roco-share.invalid/collector/../../secret', 'https://roco-share.invalid/collector/12345678-1234-1234-1234-123456789abc?x=1']) {
      await expect(decodeUrlInWorker(url, 'x.pcap', factory)).rejects.toThrow('无效');
    }
    expect(worker.postMessage).not.toHaveBeenCalled();
  });
  test('转移字节时把内存所有权交给 Worker', async () => {
    const { worker, factory } = harness();
    const bytes = new Uint8Array([1, 2, 3]);
    const result = decodeInWorker(bytes, 'x.pcap', factory);
    const [payload, transfer] = lastRequest(worker);
    expect(payload).toMatchObject({ bytes, fileName: 'x.pcap' });
    expect(transfer).toEqual([bytes.buffer]);
    reply(worker, payload.id, { ok: true, value: { mainName: 'parsed.json' } });
    await expect(result).resolves.toEqual({ mainName: 'parsed.json' });
  });
  // 回归（2026-11-08 事故）：字节分支漏发 mode 会让 worker 走默认导入模式，
  // 采到一半的文件被 convertPcapBytes 解析，抛「解析准备已完成，但后续数据仍不完整」，
  // 附近页 / 我的页实时采集全部卡死。
  test('巡检字节必须带 inspect 标记交给 Worker', async () => {
    const { worker, factory } = harness();
    const bytes = new Uint8Array([1, 2, 3]);
    const result = inspectBytesInWorker(bytes, 'capture-1.pcap', new AbortController().signal, factory);
    const [payload] = lastRequest(worker);
    expect(payload).toMatchObject({ bytes, fileName: 'capture-1.pcap', mode: 'inspect' });
    reply(worker, payload.id, { ok: true, value: { fingerprint: 'abc' } });
    await expect(result).resolves.toEqual({ fingerprint: 'abc' });
  });
  // 附近页 / 悬浮球只解尾部窗口（2026-11-08）：窗口参数必须跟着请求一起进 Worker，
  // 漏发就退回全量解析，实时刷新又会卡到十几秒。
  test('巡检字节的尾部窗口大小必须透传给 Worker', async () => {
    const { worker, factory } = harness();
    const result = inspectBytesInWorker(new Uint8Array([1]), 'capture-1.pcap', new AbortController().signal, factory, 2 * 1024 * 1024);
    const [payload] = lastRequest(worker);
    expect(payload).toMatchObject({ mode: 'inspect', windowBytes: 2 * 1024 * 1024 });
    reply(worker, payload.id, { ok: true, value: { fingerprint: 'abc' } });
    await expect(result).resolves.toEqual({ fingerprint: 'abc' });
  });
  test('解析失败只影响本次请求，Worker 保留以便下一轮复用', async () => {
    const { worker, factory } = harness();
    const result = decodeInWorker(new Uint8Array([1]), 'x.pcap', factory);
    reply(worker, lastRequest(worker)[0].id, { ok: false, error: '缺少握手，请重新登录采集' });
    await expect(result).rejects.toThrow('缺少握手');
    expect(worker.terminate).not.toHaveBeenCalled();
  });
  test('Worker 崩溃和转移失败都会丢弃 Worker 并允许重建', async () => {
    const first = harness();
    const result = decodeInWorker(new Uint8Array([1]), 'x.pcap', first.factory);
    first.worker.onerror!({ preventDefault: vi.fn() } as unknown as ErrorEvent);
    await expect(result).rejects.toThrow('原始文件');
    expect(first.worker.terminate).toHaveBeenCalledOnce();
    const second = harness();
    second.worker.postMessage.mockImplementation(() => { throw new Error('clone failed'); });
    await expect(decodeInWorker(new Uint8Array([1]), 'x.pcap', second.factory)).rejects.toThrow();
    expect(second.worker.terminate).toHaveBeenCalledOnce();
  });
});
