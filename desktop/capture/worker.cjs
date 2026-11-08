/**
 * 采集工作线程：Npcap 抓包 + 写 PCAP 文件。
 *
 * 放在 Worker 里而不是主进程，是因为 pcap_next_ex 每次最多阻塞 100ms，
 * 放主进程会卡住窗口与 IPC（状态轮询 1.5s 一次，会明显掉帧）。
 *
 * 支持一次打开多块网卡（自动模式）：用户往往分不清游戏流量走的是 Wi‑Fi、
 * VPN 加速器 TAP 还是虚拟网卡，逐块试太折腾；全部打开后把包写进同一个 pcap。
 * 只接受链路类型为 Ethernet(1) 的网卡——回环（DLT_NULL）写进 pcap 会让解码器读不了。
 *
 * 与主进程的协议：
 *  主 → 工作线程  { type:'start', devices: string[], file, filter? } | { type:'stop' }
 *  工作线程 → 主  { type:'started', opened, skipped } | { type:'stats', packets, bytes }
 *                { type:'error', message } | { type:'stopped', reason }
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parentPort } = require('node:worker_threads');
const npcap = require('./npcap.cjs');

let captures = [];
let fd = null;
let packets = 0;
let bytes = 0;
let running = false;
let lastReport = 0;

function report(force = false) {
  const now = Date.now();
  if (!force && now - lastReport < 500) return;
  lastReport = now;
  parentPort.postMessage({ type: 'stats', packets, bytes });
}

function stop(reason) {
  if (!running) return;
  running = false;
  try {
    if (fd != null) fs.closeSync(fd);
  } catch {
    /* 已关闭 */
  }
  fd = null;
  for (const capture of captures) {
    try {
      capture.close();
    } catch {
      /* 已关闭 */
    }
  }
  captures = [];
  report(true);
  parentPort.postMessage({ type: 'stopped', reason });
}

function start({ device, devices, file, filter }) {
  if (running) throw new Error('已经在采集');
  const list = (Array.isArray(devices) && devices.length > 0 ? devices : [device]).filter(Boolean);
  if (list.length === 0) throw new Error('没有可用的网卡');

  const opened = [];
  const skipped = [];
  const failures = [];
  for (const name of list) {
    try {
      const capture = new npcap.LiveCapture({ device: name, filter }).open();
      if (capture.linktype !== 1) {
        // 回环 / 原始 IP 等链路类型与 pcap 的以太网头不一致，混进去会解不出来
        capture.close();
        skipped.push(name);
        continue;
      }
      opened.push(capture);
    } catch (error) {
      failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (opened.length === 0) {
    throw new Error(`没有可用的网卡${failures.length ? `（${failures[0]}）` : ''}`);
  }

  captures = opened;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fd = fs.openSync(file, 'w');
  fs.writeSync(fd, npcap.pcapHeader(1));
  packets = 0;
  bytes = fs.statSync(file).size;
  running = true;
  parentPort.postMessage({ type: 'started', opened: opened.length, skipped });

  const pump = () => {
    if (!running) return;
    try {
      // 每轮把每块网卡缓冲区里现有的包取走（最多 64 个），然后立刻让出事件循环：
      // 否则没流量时 10 块网卡 × 100ms 超时会攒成好几秒，状态与「停止」都会明显卡顿。
      for (const capture of captures) {
        for (let i = 0; i < 64; i += 1) {
          const packet = capture.next();
          if (!packet) break;
          const [header, payload] = npcap.pcapRecord(packet.data, packet.tsSec, packet.tsUsec);
          fs.writeSync(fd, header);
          fs.writeSync(fd, payload);
          packets += 1;
          bytes += header.length + payload.length;
        }
      }
      report();
      setImmediate(pump);
    } catch (error) {
      parentPort.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
      stop('error');
    }
  };
  setImmediate(pump);
}

parentPort.on('message', (message) => {
  if (!message || typeof message !== 'object') return;
  if (message.type === 'start') {
    try {
      start(message);
    } catch (error) {
      parentPort.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
      parentPort.postMessage({ type: 'stopped', reason: 'error' });
    }
  } else if (message.type === 'stop') {
    stop('user');
  }
});

process.on('exit', () => {
  if (running) stop('exit');
});

parentPort.postMessage({ type: 'ready', version: npcap.version() });
