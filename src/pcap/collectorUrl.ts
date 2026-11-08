/**
 * 哪些 URL 表示「本机原包」。
 *
 * - 安卓壳：https://roco-share.invalid/collector/<uuid>（WebView 拦截器返回字节）
 * - 桌面版（Electron）：http://127.0.0.1:<port>/capture/capture-<ts>.pcap（本地服务读文件）
 */
const ANDROID_CAPTURE_URL = /^https:\/\/roco-share\.invalid\/collector\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DESKTOP_CAPTURE_URL = /^http:\/\/127\.0\.0\.1:\d{2,5}\/capture\/capture-\d+\.pcap$/;

export const isCollectorCaptureUrl = (url: string): boolean =>
  ANDROID_CAPTURE_URL.test(url) || DESKTOP_CAPTURE_URL.test(url);
export const MAX_CAPTURE_BYTES = 128 * 1024 * 1024;
