import { afterEach, describe, expect, test, vi } from 'vitest';
import { canDrawOverlay, collectorAction, notifyRareAlert, readCollectorState, readCaptureSnapshot, readCaptureSnapshotBytes, resetCaptureBytesCacheForTest, startCollectorCapture } from './nativeCollector';

afterEach(() => { delete window.RocoCapture; vi.unstubAllGlobals(); });
const state = { version: 1, supported: true, phase: 'idle', message: '', packets: 0, bytes: 0, files: [] };
describe('内置采集桥', () => {
  test('网页和旧 APK 不显示可用采集器', async () => {
    await expect(readCollectorState()).resolves.toBeNull();
    await expect(collectorAction('startCapture')).rejects.toThrow('更新');
  });
  test('读取真实能力与文件元数据，拒绝未知版本', async () => {
    window.RocoCapture = { getState: () => JSON.stringify(state) };
    await expect(readCollectorState()).resolves.toEqual(state);
    window.RocoCapture.getState = () => JSON.stringify({ ...state, version: 2 });
    await expect(readCollectorState()).rejects.toThrow('版本');
  });
  test('开始采集时把战斗模式透传给原生，未更新壳仍可完整采集', async () => {
    const startCapture = vi.fn(() => '');
    window.RocoCapture = { getState: () => JSON.stringify(state), startCapture };
    await startCollectorCapture('battle');
    expect(startCapture).toHaveBeenCalledWith('battle');
    startCapture.mockReturnValue('采集正在进行或保存中');
    await expect(startCollectorCapture('battle')).rejects.toThrow('正在进行');
    startCapture.mockReturnValue('');
    await collectorAction('startCapture');
    expect(startCapture).toHaveBeenLastCalledWith();
  });
  test('悬浮窗权限查询：新壳返回布尔，旧壳与异常按未知处理', async () => {
    await expect(canDrawOverlay()).resolves.toBeNull();
    window.RocoCapture = { getState: () => JSON.stringify(state) };
    await expect(canDrawOverlay()).resolves.toBeNull();
    window.RocoCapture.canDrawOverlay = () => 'true';
    await expect(canDrawOverlay()).resolves.toBe(true);
    window.RocoCapture.canDrawOverlay = () => 'false';
    await expect(canDrawOverlay()).resolves.toBe(false);
    window.RocoCapture.canDrawOverlay = () => { throw new Error('桥超时'); };
    await expect(canDrawOverlay()).resolves.toBeNull();
  });
  test('损坏的状态必须报错，不能伪装空清单', async () => {
    window.RocoCapture = { getState: () => '{' };
    await expect(readCollectorState()).rejects.toThrow();
    window.RocoCapture.getState = () => JSON.stringify({ ...state, files: [{ id: '../secret' }] });
    await expect(readCollectorState()).rejects.toThrow('状态');
  });
  test('动作明确调用原生入口并传递文件 ID；错误可见', async () => {
    const importCapture = vi.fn(() => '');
    window.RocoCapture = { getState: () => JSON.stringify(state), importCapture };
    await collectorAction('importCapture', 'capture-123.pcap');
    expect(importCapture).toHaveBeenCalledWith('capture-123.pcap');
    window.RocoCapture.importCapture = () => '该文件未完整保存';
    await expect(collectorAction('importCapture', 'capture-123.pcap')).rejects.toThrow('未完整保存');
  });
  test('进度快照只接受受限本机地址和有效长度，兼容旧壳', async () => {
    window.RocoCapture = { getState: () => JSON.stringify(state) };
    await expect(readCaptureSnapshot()).resolves.toBeNull();
    const snapshot = { id: 'capture-123.pcap', size: 100, url: 'https://roco-share.invalid/collector/12345678-1234-1234-1234-123456789abc' };
    window.RocoCapture.inspectCapture = () => JSON.stringify(snapshot);
    await expect(readCaptureSnapshot()).resolves.toEqual(snapshot);
    for (const bad of [{ ...snapshot, url: 'https://example.com/x' }, { ...snapshot, size: 24 }, { ...snapshot, id: '../x' }]) {
      window.RocoCapture.inspectCapture = () => JSON.stringify(bad);
      await expect(readCaptureSnapshot()).rejects.toThrow('快照');
    }
  });
  test('稀有提醒：旧壳静默跳过，新壳裁剪长度并回传原生错误', async () => {
    window.RocoCapture = { getState: () => JSON.stringify(state) };
    await expect(notifyRareAlert('稀有精灵出现！', '护主犬')).resolves.toBe(false);
    const notify = vi.fn(() => '');
    window.RocoCapture = { getState: () => JSON.stringify(state), notifyRareAlert: notify };
    await expect(notifyRareAlert('  稀有精灵出现！  ', 'x'.repeat(600))).resolves.toBe(true);
    expect(notify).toHaveBeenCalledWith('稀有精灵出现！', 'x'.repeat(500));
    window.RocoCapture.notifyRareAlert = () => '提醒发送失败';
    await expect(notifyRareAlert('标题', '正文')).rejects.toThrow('提醒发送失败');
  });
});

describe('实时采集的增量读取（readCaptureSnapshotBytes）', () => {
  const snapshot = { id: 'capture-123.pcap', size: 0, url: 'https://roco-share.invalid/collector/12345678-1234-1234-1234-123456789abc' };
  /** 模拟壳内文件：ref.content 是「当前完整内容」，支持 ?from=N 时只回新增段 */
  const stubShell = (ref: { content: Uint8Array }, supportDelta = true) => {
    const fetchMock = vi.fn(async (input: string) => {
      const match = /[?&]from=(\d+)/.exec(String(input));
      const from = match ? Number(match[1]) : 0;
      const body = ref.content.slice(match && supportDelta ? from : 0);
      return {
        ok: true,
        headers: { get: (name: string) => (name === 'X-Capture-From' && match && supportDelta ? String(from) : null) },
        arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
      } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  };

  test('首轮全量，之后只拉新增段并拼接', async () => {
    resetCaptureBytesCacheForTest();
    const ref = { content: new Uint8Array([1, 2, 3]) };
    const fetchMock = stubShell(ref);
    const first = await readCaptureSnapshotBytes({ ...snapshot, size: 3 });
    expect([...first]).toEqual([1, 2, 3]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('from=');

    // 文件涨到 6 字节：第二轮只取 [3, 6)，缓存拼成完整内容
    ref.content = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const second = await readCaptureSnapshotBytes({ ...snapshot, size: 6 });
    expect([...second]).toEqual([1, 2, 3, 4, 5, 6]);
    expect(String(fetchMock.mock.calls[1][0])).toContain('from=3');

    // 没涨：直接命中缓存，不再请求
    const again = await readCaptureSnapshotBytes({ ...snapshot, size: 6 });
    expect(again).toBe(second);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('旧壳忽略 from 返回全量（响应头对不上）时回退全量重取', async () => {
    resetCaptureBytesCacheForTest();
    const fetchMock = stubShell({ content: new Uint8Array([1, 2, 3]) }, false);
    await readCaptureSnapshotBytes({ ...snapshot, size: 3 });
    const second = await readCaptureSnapshotBytes({ ...snapshot, size: 6 });
    // 旧壳第二轮也回全量 [1,2,3]（ignore from），回退逻辑把结果当全量处理
    expect([...second]).toEqual([1, 2, 3]);
    expect(fetchMock).toHaveBeenCalledTimes(3); // 增量尝试一次 + 回退全量一次
  });

  test('换了采集文件（id 不同）就重新全量', async () => {
    resetCaptureBytesCacheForTest();
    const fetchMock = stubShell({ content: new Uint8Array([9, 9]) });
    await readCaptureSnapshotBytes({ ...snapshot, size: 2 });
    const other = await readCaptureSnapshotBytes({ ...snapshot, id: 'capture-456.pcap', size: 2 });
    expect([...other]).toEqual([9, 9]);
    expect(String(fetchMock.mock.calls[1][0])).not.toContain('from=');
  });
});
