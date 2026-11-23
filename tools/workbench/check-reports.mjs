#!/usr/bin/env node
/**
 * W4 验收：汇报视图（只读 Markdown 预览）。
 *   node tools/workbench/check-reports.mjs
 *
 * 验七件事：
 *   1. GET /api/reports 列出 docs/汇报/ 下的 .md：文件名 / 标题（首行 `# `）/ 大小 / 修改时间，按时间倒序；
 *   2. GET /api/reports/<文件名> 回的字节 == 磁盘上那份文件的字节；
 *   3. 路径穿越（`..`、编码过的 `..`、绝对路径、反斜杠、空名字）一律 400，且响应里没有半字节别的文件；
 *   4. 没有的文件 404；非 .md、隐藏文件不进清单；空文件能列能读；
 *   5. 页面渲染出标题层级 / 表格边框 / 代码块浅灰底 / 列表 / 引用 / 链接（零依赖自渲染）；
 *   6. 空文件在页面上是空态，不是白屏；
 *   7. 375 / 1440 截图落 docs/preview/W4-汇报-*.png（SKIP_SHOTS=1 可跳过）。
 *
 * 只读：不写 docs/汇报/、不动看板。临时文件全部在 %TEMP%。依赖仓库已有的 playwright。
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { connect } from 'node:net';
import { readFile, writeFile, mkdir, mkdtemp, rm, stat, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.join(HERE, 'server.mjs');
const REPO_ROOT = path.resolve(HERE, '..', '..');
const REPORTS = path.join(REPO_ROOT, 'docs', '汇报');
const PREVIEW = path.join(REPO_ROOT, 'docs', 'preview');
const SAMPLE = '2026-11-24.md';
const PORT_MAIN = Number(process.env.CHECK_REPORTS_PORT || 4480);
const PORT_TMP = PORT_MAIN + 1;
const SKIP_SHOTS = process.env.SKIP_SHOTS === '1';
const SHOTS = [
  { width: 375, height: 812, label: '375' },
  { width: 1440, height: 900, label: '1440' },
];

let failures = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => { failures += 1; console.error(`  ✗ ${m}`); };
const step = (n, total, msg) => console.log(`\n[${n}/${total}] ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function startServer(env) {
  const child = spawn(process.execPath, [SERVER], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let out = '';
  let err = '';
  child.stderr.on('data', (b) => { err += b; });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`服务 8 秒没起来。stderr:\n${err}`)), 8000);
    child.stdout.on('data', (buf) => {
      out += buf.toString('utf8');
      const m = /\[ready\]\s+(http:\/\/\S+)/.exec(out);
      if (m) { clearTimeout(timer); resolve(m[1].replace(/\/$/, '')); }
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`服务提前退出（code=${code}）。输出:\n${out}\n${err}`));
    });
  });
  return { child, ready, log: () => out, stop: () => child.kill() };
}

/** 用裸 socket 发原始请求行：Node 的 fetch 会把 `..` 规范化掉，测不出服务端到底拦没拦。 */
function rawGet(port, rawPath) {
  return new Promise((resolve, reject) => {
    const sock = connect(port, '127.0.0.1');
    let data = '';
    sock.setEncoding('utf8');
    sock.on('connect', () => {
      sock.write(`GET ${rawPath} HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n`);
    });
    sock.on('data', (d) => { data += d; });
    sock.on('end', () => {
      const status = Number((/^HTTP\/1\.1 (\d{3})/.exec(data) || [])[1]);
      const body = data.split('\r\n\r\n').slice(1).join('\r\n\r\n');
      resolve({ status, body, raw: data });
    });
    sock.on('error', reject);
  });
}

// ───────────────────────────── 开始 ─────────────────────────────
const servers = [];
let tmpDir = null;
let browser = null;

try {
  const samplePath = path.join(REPORTS, SAMPLE);
  try {
    await stat(samplePath);
  } catch {
    throw new Error(`没找到示例汇报 ${samplePath}，先放一份再跑验收`);
  }
  const sampleText = await readFile(samplePath, 'utf8');
  const sampleStat = await stat(samplePath);

  step(1, 8, 'GET /api/reports：列出 docs/汇报/ 下的 .md（文件名 / 标题 / 大小 / 时间，按时间倒序）');
  const main = startServer({ PORT: String(PORT_MAIN), WORKBENCH_REPORTS: '' });
  servers.push(main);
  const base = await main.ready;
  ok(`服务启动：${base}`);
  const listRes = await fetch(base + '/api/reports', { cache: 'no-store' });
  const list = await listRes.json();
  if (listRes.status !== 200) bad(`/api/reports 状态码 ${listRes.status}`);
  if (list.dir !== 'docs/汇报') bad(`清单里的目录是 ${list.dir}，预期 docs/汇报`);
  else ok(`目录 ${list.dir}/，共 ${list.count} 份`);
  const sample = (list.files || []).find((f) => f.name === SAMPLE);
  if (!sample) {
    bad(`清单里没有 ${SAMPLE}`);
  } else {
    ok(`列出 ${sample.name}：标题「${sample.title}」`);
    const firstHeading = /^#\s+(.+)$/m.exec(sampleText);
    const expectTitle = firstHeading ? firstHeading[1].trim() : SAMPLE.replace(/\.md$/, '');
    if (sample.title === expectTitle) ok(`标题 == 首行 # 之后的内容（${expectTitle}）`);
    else bad(`标题不对：接口「${sample.title}」/ 文件「${expectTitle}」`);
    if (sample.size === sampleStat.size) ok(`大小 ${sample.size} B 与磁盘一致`);
    else bad(`大小不一致：接口 ${sample.size} / 磁盘 ${sampleStat.size}`);
    if (sample.mtime === sampleStat.mtime.toISOString()) ok(`修改时间 ${sample.mtime}`);
    else bad(`修改时间不一致：接口 ${sample.mtime} / 磁盘 ${sampleStat.mtime.toISOString()}`);
    const times = (list.files || []).map((f) => Date.parse(f.mtime));
    const sorted = times.every((t, i) => i === 0 || times[i - 1] >= t);
    if (sorted) ok(`按修改时间倒序（${times.length} 份）`);
    else bad('清单不是按修改时间倒序');
    const nonMd = (list.files || []).filter((f) => !f.name.endsWith('.md'));
    if (!nonMd.length) ok('清单里没有非 .md 文件');
    else bad(`清单里混进了非 md：${nonMd.map((f) => f.name).join(', ')}`);
  }

  step(2, 8, 'GET /api/reports/<文件名>：回的字节 == 磁盘上那份文件');
  const raw = await fetch(base + '/api/reports/' + encodeURIComponent(SAMPLE), { cache: 'no-store' });
  const rawText = await raw.text();
  if (raw.status !== 200) bad(`读 ${SAMPLE} 状态码 ${raw.status}`);
  if (rawText === sampleText) ok(`原文一致（${Buffer.byteLength(rawText, 'utf8')} B，sha 相同）`);
  else bad(`原文不一致：接口 ${rawText.length} 字符 / 磁盘 ${sampleText.length} 字符`);
  if (/text\/markdown/.test(raw.headers.get('content-type') || '')) ok(`Content-Type ${raw.headers.get('content-type')}`);
  else bad(`Content-Type 不是 markdown：${raw.headers.get('content-type')}`);

  step(3, 8, '路径穿越：`..` / 编码 `..` / 绝对路径 / 反斜杠 / 空名字 → 400，且不吐别处内容');
  const portMain = Number(new URL(base).port);
  const evil = [
    ['/api/reports/../package.json', '裸 ..'],
    ['/api/reports/..%2Fpackage.json', '编码的 ../'],
    ['/api/reports/%2e%2e%2fpackage.json', '全编码的 ../'],
    ['/api/reports/C:%5CWindows%5Cwin.ini', '绝对路径（盘符 + 反斜杠）'],
    ['/api/reports/..', '只有 ..'],
    ['/api/reports/', '空名字'],
  ];
  for (const [p, label] of evil) {
    const r = await rawGet(portMain, p);
    if (r.status === 400) ok(`${label} → 400`);
    else bad(`${label} → ${r.status}（预期 400）`);
    if (/roco-toolbox|"dependencies"|\[extensions\]/.test(r.body)) bad(`${label} 的响应里出现了别处文件的内容`);
  }
  const missing = await rawGet(portMain, '/api/reports/no-such-report-0000.md');
  if (missing.status === 404) ok('不存在的 .md → 404');
  else bad(`不存在的 .md → ${missing.status}（预期 404）`);
  const wrongExt = await rawGet(portMain, '/api/reports/package.json');
  if (wrongExt.status === 400) ok('同目录外/非 .md 的 package.json → 400');
  else bad(`非 .md → ${wrongExt.status}（预期 400）`);
  // curl / fetch 之类会先把 `..` 归一化掉，服务端只看到 /api/package.json：同样不能是 200
  for (const p of ['/api/package.json', '/api/reports%2F..%2Fpackage.json']) {
    const r = await rawGet(portMain, p);
    if (r.status === 400) ok(`归一化后的穿越形态 ${p} → 400`);
    else bad(`归一化后的穿越形态 ${p} → ${r.status}（预期 400）`);
    if (/roco-toolbox|"dependencies"/.test(r.body)) bad(`${p} 的响应里出现了 package.json 内容`);
  }

  step(4, 8, '临时目录：空文件能列能读、非 md 与隐藏文件不进清单、标题回退文件名');
  tmpDir = await mkdtemp(path.join(tmpdir(), 'workbench-reports-'));
  await writeFile(path.join(tmpDir, 'b.md'), '# B 的标题\n\n正文一行。\n', 'utf8');
  await writeFile(path.join(tmpDir, 'a.md'), '没有一级标题的汇报\n\n正文。\n', 'utf8');
  await writeFile(path.join(tmpDir, 'c.txt'), 'not markdown', 'utf8');
  await writeFile(path.join(tmpDir, '.hidden.md'), '# 不该出现\n', 'utf8');
  await writeFile(path.join(tmpDir, 'empty.md'), '', 'utf8');
  // 排序只看 mtime：三份都显式设时间（写文件落盘的 mtime 带亚毫秒，不能拿来比大小）
  const now = Date.now();
  await utimes(path.join(tmpDir, 'a.md'), new Date(now - 120000), new Date(now - 120000));
  await utimes(path.join(tmpDir, 'empty.md'), new Date(now - 60000), new Date(now - 60000));
  await utimes(path.join(tmpDir, 'b.md'), new Date(now - 1000), new Date(now - 1000));
  const t = startServer({ PORT: String(PORT_TMP), WORKBENCH_REPORTS: tmpDir });
  servers.push(t);
  const tUrl = await t.ready;
  const tList = await (await fetch(tUrl + '/api/reports', { cache: 'no-store' })).json();
  const names = (tList.files || []).map((f) => f.name);
  if (names.length === 3 && !names.includes('c.txt') && !names.includes('.hidden.md')) {
    ok(`临时目录列出 ${names.join(' / ')}（.txt 与隐藏文件已排除）`);
  } else {
    bad(`临时目录清单不对：${names.join(' / ') || '（空）'}`);
  }
  if (names[0] === 'b.md') ok('按修改时间倒序：b.md 在最前');
  else bad(`倒序不对，第一份是 ${names[0]}`);
  const aItem = (tList.files || []).find((f) => f.name === 'a.md');
  if (aItem && aItem.title === 'a') ok('没有一级标题时，标题回退成文件名（a）');
  else bad(`标题回退不对：${aItem && aItem.title}`);
  const emptyRes = await fetch(tUrl + '/api/reports/empty.md', { cache: 'no-store' });
  const emptyText = await emptyRes.text();
  if (emptyRes.status === 200 && emptyText === '') ok('空文件：200 + 空正文');
  else bad(`空文件：${emptyRes.status} / ${JSON.stringify(emptyText.slice(0, 20))}`);
  const tPort = Number(new URL(tUrl).port);
  for (const [p, label] of [['/api/reports/../package.json', '临时目录里的裸 ..'], ['/api/reports/%2e%2e%2f..%2fpackage.json', '临时目录里的编码 ..']]) {
    const r = await rawGet(tPort, p);
    if (r.status === 400) ok(`${label} → 400`);
    else bad(`${label} → ${r.status}（预期 400）`);
  }

  step(5, 8, '页面：标题层级 / 表格边框 / 代码块浅灰底 / 列表 / 引用 / 链接');
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto(base + '/#reports', { waitUntil: 'networkidle' });
  await page.waitForSelector('.ritem', { timeout: 10000 });
  await page.waitForSelector('.md h1', { timeout: 10000 });
  const itemCount = await page.locator('.ritem').count();
  if (itemCount >= 1) ok(`左列 ${itemCount} 份汇报`);
  else bad('左列没有汇报条目');
  const current = await page.locator('.ritem[aria-current="true"]').count();
  if (current === 1) ok('默认选中第一份（aria-current）');
  else bad(`默认选中 ${current} 份，应恰好 1 份`);
  const structure = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const cs = (s) => (q(s) ? getComputedStyle(q(s)) : null);
    const th = cs('.md table th');
    const td = cs('.md table td');
    const tbl = cs('.md table');
    const pre = cs('.md pre');
    const code = cs('.md pre code');
    const body = getComputedStyle(document.body);
    return {
      h1: cs('.md h1') && cs('.md h1').fontSize,
      h2: cs('.md h2') && cs('.md h2').fontSize,
      h3: cs('.md h3') && cs('.md h3').fontSize,
      h1Text: q('.md h1') && q('.md h1').textContent.trim(),
      h2Count: document.querySelectorAll('.md h2').length,
      h3Count: document.querySelectorAll('.md h3').length,
      ul: document.querySelectorAll('.md ul li').length,
      ol: document.querySelectorAll('.md ol li').length,
      quote: document.querySelectorAll('.md blockquote').length,
      rows: document.querySelectorAll('.md table tr').length,
      thBorder: th && `${th.borderTopWidth} ${th.borderTopStyle}`,
      tdBorder: td && `${td.borderTopWidth} ${td.borderTopStyle}`,
      collapse: tbl && tbl.borderCollapse,
      thBg: th && th.backgroundColor,
      preBg: pre && pre.backgroundColor,
      codeFont: code && code.fontFamily,
      bold: document.querySelectorAll('.md strong').length,
      inlineCode: document.querySelectorAll('.md p code').length,
      links: [...document.querySelectorAll('.md a')].map((a) => a.getAttribute('href')).filter(Boolean),
      bodyBg: body.backgroundColor,
      bodyText: document.querySelector('.md') ? document.querySelector('.md').innerText.length : 0,
    };
  });
  if (structure.h1 && structure.h2 && structure.h3) ok(`标题三档：h1 ${structure.h1} / h2 ${structure.h2} / h3 ${structure.h3}（h2 ${structure.h2Count} 个、h3 ${structure.h3Count} 个）`);
  else bad(`标题层级缺失：${JSON.stringify({ h1: structure.h1, h2: structure.h2, h3: structure.h3 })}`);
  if (structure.h1Text && structure.h1Text.includes('2026-11-24')) ok(`h1 就是汇报标题「${structure.h1Text}」`);
  else bad(`h1 内容不对：${structure.h1Text}`);
  if (structure.thBorder === '1px solid' && structure.tdBorder === '1px solid' && structure.collapse === 'collapse') {
    ok(`表格有边框：th/td ${structure.thBorder}，border-collapse: ${structure.collapse}（${structure.rows} 行）`);
  } else {
    bad(`表格边框不对：th=${structure.thBorder} / td=${structure.tdBorder} / collapse=${structure.collapse}`);
  }
  if (structure.preBg && structure.preBg !== 'rgba(0, 0, 0, 0)' && structure.preBg !== structure.bodyBg) {
    ok(`代码块有浅灰底：${structure.preBg}（页面底 ${structure.bodyBg}），等宽字体 ${structure.codeFont}`);
  } else {
    bad(`代码块底色不对：pre=${structure.preBg} / body=${structure.bodyBg}`);
  }
  if (structure.ul > 0 && structure.ol > 0) ok(`列表：无序 ${structure.ul} 项、有序 ${structure.ol} 项`);
  else bad(`列表没渲染：ul=${structure.ul} / ol=${structure.ol}`);
  if (structure.quote > 0) ok(`引用块 ${structure.quote} 个`);
  else bad('引用块没渲染');
  if (structure.bold > 0) ok(`加粗 ${structure.bold} 处`);
  else bad('加粗没渲染');
  if (structure.links.length >= 1 && structure.links.every((h) => /^(https?:\/\/|mailto:|\/|\.{1,2}\/|#)/i.test(h))) {
    ok(`链接 ${structure.links.length} 个：${structure.links.slice(0, 2).join(' , ')}`);
  } else {
    bad(`链接没渲染或协议不安全：${JSON.stringify(structure.links)}`);
  }
  if (structure.bodyText > 200) ok(`正文渲染出 ${structure.bodyText} 字`);
  else bad(`正文太短（${structure.bodyText} 字），可能白屏`);
  if (!errors.length) ok('控制台无报错');
  else bad(`控制台报错：${errors.join(' | ')}`);

  step(6, 8, '空文件在页面上是空态，不是白屏');
  const emptyPage = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await emptyPage.goto(tUrl + '/#reports', { waitUntil: 'networkidle' });
  await emptyPage.waitForSelector('.ritem', { timeout: 10000 });
  await emptyPage.locator('.ritem', { hasText: 'empty.md' }).click();
  await emptyPage.waitForFunction(() => {
    const el = document.getElementById('reportBody');
    return el && !el.getAttribute('aria-busy') && /这份汇报是空的/.test(el.textContent);
  }, { timeout: 5000 }).catch(() => null);
  const emptyState = await emptyPage.evaluate(() => ({
    text: document.getElementById('reportBody').textContent,
    hasEmpty: !!document.querySelector('#reportBody .empty'),
    height: document.getElementById('reportBody').getBoundingClientRect().height,
  }));
  if (emptyState.hasEmpty && /这份汇报是空的/.test(emptyState.text) && emptyState.height > 20) {
    ok(`空文件显示空态文案（${Math.round(emptyState.height)}px 高），没有白屏`);
  } else {
    bad(`空文件页面对不上：${JSON.stringify(emptyState).slice(0, 200)}`);
  }
  await emptyPage.close();

  step(7, 8, '375 下：列表在上、正文在下，且没有横向溢出');
  const narrow = await browser.newPage({ viewport: { width: 375, height: 812 } });
  await narrow.goto(base + '/#reports', { waitUntil: 'networkidle' });
  await narrow.waitForSelector('.md h1', { timeout: 10000 });
  const layout = await narrow.evaluate(() => {
    const list = document.querySelector('.rlist').getBoundingClientRect();
    const body = document.querySelector('.rbody').getBoundingClientRect();
    return {
      listBottom: Math.round(list.bottom),
      bodyTop: Math.round(body.top),
      bodyLeft: Math.round(body.left),
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      tabs: [...document.querySelectorAll('.tab')].map((t) => t.textContent.trim()),
    };
  });
  if (layout.bodyTop >= layout.listBottom - 1) ok(`列表在上（底 ${layout.listBottom}px）、正文在下（顶 ${layout.bodyTop}px）`);
  else bad(`375 下正文没排到列表下面：列表底 ${layout.listBottom} / 正文顶 ${layout.bodyTop}`);
  if (!layout.overflow) ok('375 无横向溢出');
  else bad('375 出现横向溢出（页面被撑宽）');
  if (layout.tabs.length === 3) ok(`顶部三个视图：${layout.tabs.join(' / ')}`);
  else bad(`顶部视图数 ${layout.tabs.length}，预期 3：${layout.tabs.join(' / ')}`);
  await narrow.close();

  step(8, 8, SKIP_SHOTS ? '截图（SKIP_SHOTS=1，跳过）' : '375 / 1440 截图落 docs/preview/W4-汇报-*.png');
  if (!SKIP_SHOTS) {
    await mkdir(PREVIEW, { recursive: true });
    for (const size of SHOTS) {
      const shotPage = await browser.newPage({
        viewport: { width: size.width, height: size.height },
        deviceScaleFactor: 2,
      });
      await shotPage.goto(base + '/#reports', { waitUntil: 'networkidle' });
      await shotPage.waitForSelector('.md table th', { timeout: 10000 });
      await sleep(300); // 等字体与 5 秒轮询首帧稳定
      const file = path.join(PREVIEW, `W4-汇报-${size.label}.png`);
      await shotPage.screenshot({ path: file, fullPage: true });
      const info = await shotPage.evaluate(() => ({
        h: document.documentElement.scrollHeight,
        w: document.documentElement.scrollWidth,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
      }));
      ok(`${size.label}  ${file}  ${info.w}×${info.h}  横向溢出 ${info.overflow ? '有' : '无'}`);
      if (info.overflow) bad(`${size.label} 截图有横向溢出`);
      await shotPage.close();
    }
  }
} catch (err) {
  console.error('\n[check-reports] 异常：', err && err.stack ? err.stack : err);
  failures += 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  for (const s of servers) s.stop();
  if (tmpDir && path.resolve(tmpDir).startsWith(path.resolve(tmpdir()))) {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

console.log(failures === 0
  ? '\nPASS 汇报视图全部通过（列表 / 原文 / 穿越拦截 / 渲染 / 空态 / 375 布局 / 截图）'
  : `\nFAIL：${failures} 项没通过`);
process.exitCode = failures === 0 ? 0 : 1;
