import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { CollectorState } from '../collector/nativeCollector';
import { resetCaptureSessionMarks } from '../collector/captureSessionStore';
import { resetAutoImportForTest } from '../collector/autoImportFlow';
import { markCaptureOrigin, resetCaptureOriginForTest } from '../collector/captureOriginStore';
import { beginImport, resetImportOutcomeForTest, updateImportOutcome } from './importOutcomeStore';
import { NativeCollectorPanel } from './NativeCollectorPanel';

vi.mock('./CaptureProgressView', () => ({
  CaptureProgressView: ({ onReady }: { onReady?: () => void }) => (
    <button type="button" onClick={() => onReady?.()}>模拟进度走满</button>
  ),
}));

const file = { id: 'capture-123.pcap', name: 'capture-123.pcap', size: 1234, createdAt: 123, valid: true };

beforeEach(() => {
  resetCaptureSessionMarks();
  resetImportOutcomeForTest();
  resetAutoImportForTest();
  resetCaptureOriginForTest();
});

afterEach(() => {
  delete window.RocoCapture;
});

/** 模拟 ImportPanel 的导入：真实环境里这一步由 roco-share 事件驱动 */
const finishImport = (cloud: 'not-enabled' | 'syncing' | 'synced' = 'not-enabled') => {
  const operationId = beginImport();
  updateImportOutcome(operationId, { local: 'saved', cloud });
  return operationId;
};

function setup() {
  let state: CollectorState = {
    version: 1, supported: true, phase: 'capturing', message: '采集中', packets: 2, bytes: 1234,
    files: [file], progressVersion: 1, fileId: file.id, savedBytes: 1234,
  };
  const bridge = {
    getState: () => JSON.stringify(state),
    stopCapture: vi.fn(() => { state = { ...state, phase: 'idle', message: '已停止并保存' }; return ''; }),
    importCapture: vi.fn(() => { finishImport(); return ''; }),
    shareCapture: vi.fn(() => ''),
    startCapture: vi.fn(() => ''),
    openGame: vi.fn(() => ''),
    deleteCapture: vi.fn(() => ''),
    uploadCapture: vi.fn(() => ''),
  };
  window.RocoCapture = bridge;
  render(<NativeCollectorPanel />);
  return bridge;
}

describe('采集完成自动停止与自动导入', () => {
  test('导入结束后才弹「导入完成」；按钮只给取消 / 上传', async () => {
    const bridge = setup();
    const ready = await screen.findByRole('button', { name: '模拟进度走满' });
    fireEvent.click(ready);

    await waitFor(() => expect(bridge.stopCapture).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(bridge.importCapture).toHaveBeenCalledWith(file.id));

    const dialog = await screen.findByRole('dialog', { name: '导入完成' });
    expect(dialog).toHaveTextContent('已自动停止并保存本次采集');
    expect(dialog).toHaveTextContent('游戏数据已保存到本机');
    expect(within(dialog).getByRole('button', { name: '取消' })).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: '解析并导入' })).toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: '上传蛋神助手' }));
    await waitFor(() => expect(bridge.uploadCapture).toHaveBeenCalledWith(file.id));
  });

  test('同一个采集会话只自动停止、自动导入一次', async () => {
    const bridge = setup();
    const ready = await screen.findByRole('button', { name: '模拟进度走满' });
    fireEvent.click(ready);
    fireEvent.click(ready);
    await waitFor(() => expect(bridge.stopCapture).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(bridge.importCapture).toHaveBeenCalledTimes(1));
    expect(bridge.stopCapture).toHaveBeenCalledTimes(1);
    expect(bridge.importCapture).toHaveBeenCalledTimes(1);
  });

  test('壳还在保存时先重试；本机导入与云同步都结束后才弹窗', async () => {
    const bridge = setup();
    let calls = 0;
    bridge.importCapture.mockImplementation(() => {
      calls += 1;
      if (calls <= 2) throw new Error('请先停止采集并等待保存完成');
      const operationId = finishImport('syncing');
      window.setTimeout(() => updateImportOutcome(operationId, { cloud: 'synced' }), 60);
      return '';
    });

    fireEvent.click(await screen.findByRole('button', { name: '模拟进度走满' }));
    // 还在保存 / 导入 / 同步：不弹窗
    expect(screen.queryByRole('dialog', { name: '导入完成' })).toBeNull();

    const dialog = await screen.findByRole('dialog', { name: '导入完成' }, { timeout: 6000 });
    expect(within(dialog).getByTestId('capture-complete-cloud')).toHaveTextContent('私有云已同步');
    expect(bridge.importCapture).toHaveBeenCalledTimes(3);
  });

  test('完成弹窗带出云同步结果与小组自动更新提示', async () => {
    const bridge = setup();
    bridge.importCapture.mockImplementation(() => {
      const operationId = finishImport('synced');
      updateImportOutcome(operationId, { group: 'updated', groupCount: 2 });
      return '';
    });

    fireEvent.click(await screen.findByRole('button', { name: '模拟进度走满' }));

    const dialog = await screen.findByRole('dialog', { name: '导入完成' });
    expect(within(dialog).getByTestId('capture-complete-cloud')).toHaveTextContent('私有云已同步');
    expect(within(dialog).getByTestId('capture-complete-group')).toHaveTextContent('2 个小组');
  });

  test('等待保存期间切页：自动导入在后台继续跑完，回来弹「导入完成」且不重复导入', async () => {
    let state: CollectorState = {
      version: 1, supported: true, phase: 'capturing', message: '采集中', packets: 2, bytes: 1234,
      files: [file], progressVersion: 1, fileId: file.id, savedBytes: 1234,
    };
    const bridge = {
      getState: () => JSON.stringify(state),
      stopCapture: vi.fn(() => {
        state = { ...state, phase: 'idle', message: '已停止并保存' };
        return '';
      }),
      importCapture: vi.fn(() => { finishImport(); return ''; }),
      shareCapture: vi.fn(() => ''),
      startCapture: vi.fn(() => ''),
      openGame: vi.fn(() => ''),
      deleteCapture: vi.fn(() => ''),
      uploadCapture: vi.fn(() => ''),
    };
    window.RocoCapture = bridge;
    const view = render(<NativeCollectorPanel />);
    fireEvent.click(await screen.findByRole('button', { name: '模拟进度走满' }));
    await waitFor(() => expect(bridge.stopCapture).toHaveBeenCalledTimes(1));

    // 切页卸载面板：2026-11-07 起自动导入流程在模块级继续跑（保存 → 导入 → 等结果）
    view.unmount();
    await act(async () => { await new Promise((resolve) => { window.setTimeout(resolve, 700); }); });
    expect(bridge.importCapture).toHaveBeenCalledWith(file.id);

    render(<NativeCollectorPanel />);
    const dialog = await screen.findByRole('dialog', { name: '导入完成' });
    expect(within(dialog).getByTestId('capture-complete-outcome')).toHaveTextContent('游戏数据已保存到本机');
    // 面板回来后不会再触发一次导入
    fireEvent.click(within(dialog).getByRole('button', { name: '取消' }));
    expect(bridge.importCapture).toHaveBeenCalledTimes(1);
  });

  test('附近页发起的采集：不自动停止 / 导入，并给出一行说明', async () => {
    const bridge = setup();
    markCaptureOrigin('nearby');
    fireEvent.click(await screen.findByRole('button', { name: '模拟进度走满' }));

    expect(screen.getByTestId('capture-nearby-owned')).toHaveTextContent('本次采集由「附近」页开始');
    await act(async () => { await new Promise((resolve) => { window.setTimeout(resolve, 300); }); });
    expect(bridge.stopCapture).not.toHaveBeenCalled();
    expect(bridge.importCapture).not.toHaveBeenCalled();
  });
});
