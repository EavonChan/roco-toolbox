/**
 * 桌面版预加载脚本：把主进程的采集能力注入成与安卓壳一致的 window.RocoCapture。
 *
 * 网页端（src/collector/nativeCollector.ts）对返回值的约定是「空字符串 = 成功，
 * 非空字符串 = 给用户看的错误」，这里保持同一语义，所以前端采集面板不用分叉。
 */
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('rocoDesktop', {
  platform: process.platform,
  version: process.versions.electron,
  // 附近精灵悬浮小窗（2026-11-08）：主窗口把解析好的附近列表推过去
  showOverlay: () => invoke('overlay:show'),
  hideOverlay: () => invoke('overlay:hide'),
  updateNearbyOverlay: (text) => invoke('overlay:update', text),
  setOverlayClickThrough: (flag) => invoke('overlay:click-through', flag),
  getOverlayState: () => invoke('overlay:get-state'),
});

// 悬浮小窗页面自己用的接口（与 RocoCapture 分开，避免主窗口误用）
contextBridge.exposeInMainWorld('rocoOverlay', {
  getPayload: () => invoke('overlay:get-payload'),
  setClickThrough: (flag) => invoke('overlay:click-through', flag),
  setTheme: (theme) => invoke('overlay:set-theme', theme),
  setCollapsed: (flag) => invoke('overlay:set-collapsed', flag),
  hide: () => invoke('overlay:hide'),
  onPayload: (listener) => ipcRenderer.on('overlay:payload', (_event, text) => listener(text)),
  onClickThrough: (listener) => ipcRenderer.on('overlay:click-through', (_event, flag) => listener(flag)),
});

contextBridge.exposeInMainWorld('RocoCapture', {
  // 与安卓壳同名同签名
  getState: () => invoke('capture:state'),
  inspectCapture: () => invoke('capture:inspect'),
  startCapture: () => invoke('capture:start'),
  stopCapture: () => invoke('capture:stop'),
  importCapture: (id) => invoke('capture:import', id),
  shareCapture: (id) => invoke('capture:share', id),
  deleteCapture: (id) => invoke('capture:delete', id),
  openGame: () => invoke('capture:open-game'),
  notifyRareAlert: (title, body) => invoke('capture:notify', title, body),
  // 桌面版没有系统悬浮窗，网页端会回退到应用内悬浮球
  requestOverlayPermission: () => 'unsupported',
  updateBattleOverlay: () => 'unsupported',
  // 桌面专属：网卡选择（安卓不需要）
  listDevices: () => invoke('capture:devices'),
  selectDevice: (name) => invoke('capture:select-device', name),
});
