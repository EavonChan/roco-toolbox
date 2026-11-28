import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';

/**
 * e2e 播种：走**壳内采集**同一条 `roco-share` 路径（文件导入 UI 已删除）。
 *
 * 壳把抓包字节挂在 `__rocoPendingShare` 上并派发事件 → 页面 fetch 拦截地址 →
 * `readCaptureFile` 按魔数分流：JSON 备份按 JSON 解析，PCAP 走采集器解析器。
 * 所以这里既能播种 backup JSON，也能播种 pcap。
 */
const CAPTURE_BASE = 'https://roco-share.invalid/e2e';

export interface ImportFixtureOptions {
  /** 是否等每条都落盘到「已保存到本机」（默认 true） */
  waitForSaved?: boolean;
}

/**
 * 直接派发一条「壳拦下的抓包字节」；body 可以是任意内容（用于验证坏文件）。
 * 返回派发后不等待入库结果，调用方自己断言。
 */
export async function sendCapture(page: Page, name: string, body: Buffer | string): Promise<void> {
  if (page.url() === 'about:blank') await page.goto('/');
  const url = `${CAPTURE_BASE}/raw/${Date.now()}.json`;
  await page.route(url, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/octet-stream',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body,
    }),
  );
  await page.evaluate(
    ({ captureUrl, fileName }) => {
      (window as unknown as { __rocoPendingShare: unknown }).__rocoPendingShare = {
        kind: 'capture',
        name: fileName,
        url: captureUrl,
      };
      window.dispatchEvent(new Event('roco-share'));
    },
    { captureUrl: url, fileName: name },
  );
}

export async function importFixtures(
  page: Page,
  fixtures: string[],
  options: ImportFixtureOptions = {},
): Promise<void> {
  const waitForSaved = options.waitForSaved ?? true;
  if (page.url() === 'about:blank') await page.goto('/');

  const urls = fixtures.map((_, index) => `${CAPTURE_BASE}/${index}/${Date.now()}-${index}.json`);
  for (let index = 0; index < fixtures.length; index += 1) {
    const body = readFileSync(join(process.cwd(), fixtures[index]));
    await page.route(urls[index], (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/octet-stream',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body,
      }),
    );
  }

  for (let index = 0; index < fixtures.length; index += 1) {
    await page.evaluate(
      ({ url, name }) => {
        (window as unknown as { __rocoPendingShare: unknown }).__rocoPendingShare = {
          kind: 'capture',
          name,
          url,
        };
        window.dispatchEvent(new Event('roco-share'));
      },
      { url: urls[index], name: `e2e-${index}.json` },
    );
    if (waitForSaved) {
      await expect(page.getByTestId('import-outcome')).toContainText('已保存到本机', {
        timeout: 30_000,
      });
      // 多文件是「一次一条」消费：等上一条保存落定，再派下一条
      await page.waitForTimeout(150);
    }
  }
}
