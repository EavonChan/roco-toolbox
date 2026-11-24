#!/usr/bin/env node
/**
 * T1 验收：工时计时器（给"一天被打断很多次，事后看清时间去哪了"用，不做考勤）。
 *   node tools/workbench/check-timer.mjs
 *
 * 验六件事：
 *   1. start → 等 2 秒 → state 里已计时 ≈ 2 秒（日志第一行是 start）；
 *   2. switch 到另一个任务 → 前一段落盘（有开始有结束）、新段开始，日志多一行 switch；
 *   3. 停心跳 90 秒 → **计时照跑**（时长继续涨、since 不变），只是 `online:false`；
 *      再打一次心跳 → `online:true`，计时没断（不做空闲自动停：用户可能在另一台电脑上干活）；
 *   4. 日志落在计时目录里（默认 %USERPROFILE%\.workbench\timer\），**不在仓库里**：
 *      用假 USERPROFILE 验默认路径，再用 git status 证明仓库里看不见；
 *   5. 375 / 1440 截图落 docs/preview/T1-工时-*.png，且状态条 / 一次点击切换 / 圆点（连着没连着）都能用；
 *   6. 源码里不残留自动停 / 补记：server.mjs 与 index.html 里
 *      `idle-stop` / `pendingGap` / `timer/fill` 各出现 0 次。
 *
 * 只碰临时目录：WORKBENCH_TIMER_DIR 与 USERPROFILE 都指向 %TEMP%，不读写真实计时数据。
 * 不依赖任何 npm 包；浏览器那几步用仓库已有的 playwright。
 */
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { readFile, writeFile, mkdir, mkdtemp, rm, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER = path.join(HERE, 'server.mjs');
const REPO_ROOT = path.resolve(HERE, '..', '..');
const PREVIEW = path.join(REPO_ROOT, 'docs', 'preview');
const BASE_PORT = Number(process.env.CHECK_TIMER_PORT || 4490);
const SKIP_SHOTS = !!process.env.SKIP_SHOTS;
/** 第 3 步：停心跳 90 秒，计时必须还在跑（自动停已经取消了）。 */
const OFFLINE_WAIT = 90000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const bad = (msg) => { failures += 1; console.error(`  ✗ ${msg}`); };
const step = (n, total, msg) => console.log(`\n[${n}/${total}] ${msg}`);

const pad = (n) => String(n).padStart(2, '0');
const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const localIso = (d) => `${dateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
  (() => {
    const off = -d.getTimezoneOffset();
    const sign = off >= 0 ? '+' : '-';
    const abs = Math.abs(off);
    return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
  })();

const servers = [];
const tmpDirs = [];

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
      if (m) {
        clearTimeout(timer);
        resolve(m[1].replace(/\/$/, ''));
      }
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`服务提前退出（code=${code}）\n${out}\n${err}`));
    });
  });
  const handle = { child, ready, log: () => out, stop: () => { try { child.kill(); } catch (_) { /* 已退出 */ } } };
  servers.push(handle);
  return handle;
}

async function getJson(url) {
  const res = await fetch(url, { cache: 'no-store' });
  const body = await res.json().catch(() => null);
  return { res, body };
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const payload = await res.json().catch(() => null);
  return { res, body: payload };
}

async function readJsonl(file) {
  try {
    const text = await readFile(file, 'utf8');
    return text.split(/\r?\n/).filter(Boolean).map((line) => {
      try { return JSON.parse(line); } catch { return { raw: line, parseError: true }; }
    });
  } catch (err) {
    if (err && err.code === 'ENOENT') return [];
    throw err;
  }
}

async function makeTmp(prefix) {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

/** 给截图用的"一天"：一段一段记下来，中间留一个已补的空档和一个待补的空档。 */
async function seedDay(dir) {
  const now = Date.now();
  const at = (min) => new Date(now - min * 60000);
  const ev = (min, extra) => JSON.stringify({ ts: localIso(at(min)), ...extra });
  const lines = [
    ev(95, { type: 'start', task: '需求评审' }),
    ev(70, { type: 'switch', from: '需求评审', to: '写 PRD' }),
    ev(50, { type: 'switch', from: '写 PRD', to: '改接口文档' }),
    // 手动停 4 分钟后再开 → 时间线上留一段空隙（现在只有手动停会断段）
    ev(44, { type: 'stop', task: '改接口文档' }),
    ev(40, { type: 'start', task: '写 PRD' }),
    ev(20, { type: 'switch', from: '写 PRD', to: '需求评审' }),
    ev(6, { type: 'stop', task: '需求评审' }),
  ];
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${dateKey()}.jsonl`), lines.join('\n') + '\n', 'utf8');
}

// ───────────────────────────── 开始 ─────────────────────────────

const T1 = await makeTmp('wb-t1-api-');
const url = await startServer({ PORT: String(BASE_PORT), WORKBENCH_TIMER_DIR: T1 }).ready;
console.log(`计时目录：${T1}`);
console.log(`服务地址：${url}`);

let browser = null;
try {
  // ── 1 ──
  step(1, 6, 'start → 等 2 秒 → state 里已计时 ≈ 2 秒');
  {
    const t0 = Date.now();
    const started = await postJson(`${url}/api/timer/start`, { task: '需求评审' });
    if (started.res.status !== 200 || !started.body || !started.body.ok) {
      bad(`/api/timer/start 失败：HTTP ${started.res.status} ${started.body && started.body.message}`);
    } else {
      ok(`start 返回 200：当前任务「${started.body.current && started.body.current.task}」`);
      if (started.body.event && started.body.event.type === 'start' && started.body.event.task === '需求评审') {
        ok(`事件 ${started.body.event.type} · ${started.body.event.task}（ts ${started.body.event.ts}）`);
      } else {
        bad(`start 事件不对：${JSON.stringify(started.body.event)}`);
      }
      if (/[+-]\d{2}:\d{2}$/.test(started.body.event.ts)) ok('时间戳带本机时区偏移（日志人直接看得懂）');
      else bad(`时间戳没带时区：${started.body.event.ts}`);
    }
    await sleep(2000);
    const s1 = await getJson(`${url}/api/timer/state`);
    const elapsed = s1.body && s1.body.current ? s1.body.current.elapsedMs : -1;
    const wall = Date.now() - t0;
    if (elapsed >= 1500 && elapsed <= 4000) ok(`等 ${wall} ms 后已计时 ${elapsed} ms（≈ 2 秒，误差 < 1 秒）`);
    else bad(`已计时 ${elapsed} ms，和等过的 ${wall} ms 对不上`);
    if (s1.body && s1.body.day.segments.some((s) => s.task === '需求评审' && s.ms > 0)) {
      ok('今日时间线里有这一段（段没结束也能画）');
    } else {
      bad('时间线里没有正在计时的这一段');
    }
  }

  // ── 2 ──
  step(2, 6, 'switch 到另一个任务 → 前一段落盘、新段开始');
  {
    const sw = await postJson(`${url}/api/timer/switch`, { task: '写 PRD' });
    const b = sw.body || {};
    if (sw.res.status === 200 && b.ok && b.event && b.event.type === 'switch' && b.event.from === '需求评审' && b.event.to === '写 PRD') {
      ok(`事件 switch：${b.event.from} → ${b.event.to}`);
    } else {
      bad(`switch 事件不对：${JSON.stringify(b.event)}`);
    }
    if (b.current && b.current.task === '写 PRD') ok('当前任务已切到「写 PRD」，计时从 0 开始');
    else bad(`当前任务没切过去：${JSON.stringify(b.current)}`);
    const prev = (b.day && b.day.segments ? b.day.segments : []).filter((s) => s.task === '需求评审');
    const first = prev[0];
    if (first && first.ms >= 1500 && first.ms <= 4000) {
      ok(`前一段已落盘：${first.fromHhmm}–${first.toHhmm}，${(first.ms / 1000).toFixed(1)} 秒（有开始也有结束）`);
    } else {
      bad(`前一段没落盘或时长不对：${JSON.stringify(first)}`);
    }
    const log = await readJsonl(path.join(T1, `${dateKey()}.jsonl`));
    if (log.length === 2 && log[0].type === 'start' && log[1].type === 'switch') {
      ok(`日志两行：start → switch（一行一个事件，追加不改写）`);
    } else {
      bad(`日志行不对：${JSON.stringify(log.map((e) => e.type))}`);
    }
  }

  // ── 3 ──
  step(3, 6, `停心跳 ${OFFLINE_WAIT / 1000} 秒 → 计时照跑（只是 online:false）；再打心跳 online 回 true，计时不中断`);
  {
    const beat = await postJson(`${url}/api/timer/heartbeat`, {});
    if (beat.res.status === 200 && beat.body && beat.body.online === true) ok('心跳打上 → online:true（圆点亮）');
    else bad(`第一次心跳后 online 不是 true：${JSON.stringify(beat.body && beat.body.online)}`);

    const before = await getJson(`${url}/api/timer/state`);
    const sinceBefore = before.body && before.body.current && before.body.current.since;
    const elapsedBefore = (before.body && before.body.current && before.body.current.elapsedMs) || 0;
    if (sinceBefore) ok(`停心跳前：当前任务「${before.body.current.task}」，已计时 ${(elapsedBefore / 1000).toFixed(0)} 秒`);

    console.log(`  · 停心跳，等 ${OFFLINE_WAIT / 1000} 秒（这期间一次心跳都不打）…`);
    await sleep(OFFLINE_WAIT);
    const s3 = await getJson(`${url}/api/timer/state`);
    const body = s3.body || {};
    const cur = body.current;
    if (cur && cur.task === '写 PRD') ok(`90 秒没心跳，当前任务还在：${cur.task}（没有自动停）`);
    else bad(`停心跳后任务丢了：${JSON.stringify(cur)}`);
    if (body.online === false) ok('online 变成 false：圆点会变灰（只是"面板没连着"）');
    else bad(`online 还是 ${JSON.stringify(body.online)}，应该变 false`);
    if (cur && cur.since === sinceBefore) ok(`since 没变（${cur.since}）：同一段计时没被断过`);
    else bad(`since 变了：${sinceBefore} → ${cur && cur.since}`);
    const grew = cur ? cur.elapsedMs - elapsedBefore : 0;
    if (grew >= OFFLINE_WAIT - 3000) ok(`已计时长了 ${(grew / 1000).toFixed(0)} 秒（≈ 等待时长），时长继续增长`);
    else bad(`已计时只长了 ${grew} ms，计时被中断了`);

    const log = await readJsonl(path.join(T1, `${dateKey()}.jsonl`));
    const types = log.map((e) => e.type);
    if (!types.includes('idle-stop')) ok(`日志里没有 idle-stop（只有 ${types.join(' / ')}）`);
    else bad('日志里还有 idle-stop，自动停没删干净');

    const beat2 = await postJson(`${url}/api/timer/heartbeat`, {});
    if (beat2.res.status === 200 && beat2.body && beat2.body.online === true) ok('再打一次心跳 → online 回 true');
    else bad('第二次心跳后 online 没回 true');
    const after = await getJson(`${url}/api/timer/state`);
    if (after.body && after.body.current && after.body.current.since === sinceBefore) {
      ok(`计时没中断：还是同一段（since ${sinceBefore}），已计时 ${(after.body.current.elapsedMs / 1000).toFixed(0)} 秒`);
    } else {
      bad(`打心跳把计时弄断了：${JSON.stringify(after.body && after.body.current)}`);
    }
  }

  // ── 4 ──
  step(4, 6, '日志在计时目录里、不在仓库里（默认 %USERPROFILE%\\.workbench\\timer\\）');
  {
    const files = await readdir(T1).catch(() => []);
    const logName = `${dateKey()}.jsonl`;
    if (files.includes(logName)) ok(`日志文件：${path.join(T1, logName)}`);
    else bad(`计时目录里没有 ${logName}：${files.join(', ')}`);
    if (!files.includes('config.json')) ok('目录里只有日志，没有 config.json（idleMinutes 配置已删）');
    else bad('config.json 还在（idleMinutes 配置该删了）');

    const status = execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const dirty = status.split(/\r?\n/).filter(Boolean);
    const leaked = dirty.filter((line) => /\.workbench|\.jsonl\s*$/.test(line) && /timer/.test(line));
    if (!leaked.length) ok(`git status 里看不见计时数据（仓库脏文件 ${dirty.length} 个，没有一个来自计时器）`);
    else bad(`git status 里出现了计时数据：${leaked.join(' | ')}`);
    if (!existsSync(path.join(REPO_ROOT, '.workbench'))) ok('仓库根目录没有 .workbench/ 目录');
    else bad('仓库里出现了 .workbench/ 目录');

    // 默认路径：把 USERPROFILE 指到临时目录，走"没有任何 WORKBENCH_* 覆盖"的那条代码路径
    const fakeHome = await makeTmp('wb-t1-home-');
    const D = startServer({ PORT: String(BASE_PORT + 1), USERPROFILE: fakeHome, WORKBENCH_TIMER_DIR: '' });
    const urlD = await D.ready;
    const st = await postJson(`${urlD}/api/timer/start`, { task: '默认目录测试' });
    const expectedDir = path.join(fakeHome, '.workbench', 'timer');
    const expectedFile = path.join(expectedDir, `${dateKey()}.jsonl`);
    if (st.res.status === 200 && existsSync(expectedFile)) {
      ok(`默认还会落在 %USERPROFILE%\\.workbench\\timer\\：${expectedFile}`);
    } else {
      bad(`默认路径下没有日志：${expectedFile}`);
    }
    const back = await getJson(`${urlD}/api/timer/state`);
    if (back.body && back.body.storage && path.resolve(back.body.storage.absoluteDir) === path.resolve(expectedDir)) {
      ok(`接口自报的目录一致：${back.body.storage.dir}`);
    } else {
      bad(`接口自报的目录不对：${JSON.stringify(back.body && back.body.storage)}`);
    }
    if (back.body && back.body.storage && back.body.storage.outsideRepo === true) {
      ok('接口明确标注：计时数据在仓库之外（outsideRepo=true）');
    } else {
      bad('接口没说清数据在仓库外');
    }
    const realDir = path.join(process.env.USERPROFILE || homedir(), '.workbench', 'timer');
    if (!path.resolve(realDir).startsWith(path.resolve(REPO_ROOT) + path.sep)) ok(`默认目录与仓库没有交集：${realDir}`);
    else bad('默认目录落在仓库里了');
    D.stop();
  }

  // ── 5 ──
  step(5, 6, SKIP_SHOTS ? '面板检查（SKIP_SHOTS=1，跳过截图）' : '面板：状态条 / 圆点 / 输入即开始 + 375 / 1440 截图');
  {
    const demoDir = await makeTmp('wb-t1-demo-');
    await seedDay(demoDir);
    const E = startServer({ PORT: String(BASE_PORT + 2), WORKBENCH_TIMER_DIR: demoDir });
    const urlE = await E.ready;
    const started = await postJson(`${urlE}/api/timer/start`, { task: '整理接口文档' });
    const demoHoles = (started.body && started.body.day && started.body.day.holes) || [];
    if (demoHoles.some((h) => h.ms >= 300000)) ok(`演示数据里留了一段空隙：${demoHoles.map((h) => h.fromHhmm + '–' + h.toHhmm).join(' / ')}`);
    else bad(`演示数据里没有空隙：${JSON.stringify(demoHoles)}`);

    browser = await chromium.launch();
    const openTimer = async (viewport) => {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
      const errors = [];
      page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
      page.on('pageerror', (err) => errors.push(err.message));
      await page.goto(`${urlE}/#timer`, { waitUntil: 'networkidle' });
      await page.waitForSelector('.tbar', { timeout: 10000 });
      await sleep(400);
      return { page, errors };
    };

    const wide = await openTimer({ width: 1440, height: 900 });
    const tabs = await wide.page.locator('.tab').evaluateAll((els) => els.map((el) => el.textContent.trim()));
    if (tabs.some((t) => t.startsWith('工时'))) ok(`顶栏第四个 tab：${tabs.join(' / ')}`);
    else bad(`顶栏没有「工时」tab：${tabs.join(' / ')}`);

    const bar = (await wide.page.locator('.tbar').innerText()).replace(/\s+/g, ' ').trim();
    const barTask = await wide.page.locator('#timerTask').innerText();
    const barClock = await wide.page.locator('#timerClock').innerText();
    if (barTask.includes('整理接口文档')) ok(`状态条是一行：${bar}`);
    else bad(`状态条没显示当前任务：${bar}`);
    if (/^\d{2}:\d{2}:\d{2}$/.test(barClock.trim())) ok(`已计时长按 HH:MM:SS 显示：${barClock.trim()}`);
    else bad(`状态条上的时长格式不对：${barClock}`);
    const barButtons = await wide.page.locator('.tbar [data-t]').evaluateAll((els) => els.map((el) => el.textContent.trim()));
    if (barButtons.join('/') === '切换/停止') ok(`状态条上只有「${barButtons.join(' / ')}」（只有手动的两个动作）`);
    else bad(`状态条按钮不对：${barButtons.join(' / ')}`);

    // 圆点 = 面板连着没连着：页面一开就打心跳，所以应该是亮的
    const onlineAttr = await wide.page.locator('#tbar').getAttribute('data-online');
    if (onlineAttr === 'true') ok('圆点是亮的（data-online=true）：面板连着');
    else bad(`刚打开页面圆点没亮：data-online=${onlineAttr}`);

    if ((await wide.page.locator('#gapBar').count()) === 0) ok('页面上没有“回来补记”的黄色提示了');
    else bad('黄色补记提示还在 DOM 里');

    const segCount = await wide.page.locator('.tl .seg').count();
    if (segCount >= 3) ok(`今日时间线画出了 ${segCount} 段`);
    else bad(`时间线只有 ${segCount} 段`);
    if (demoHoles.some((h) => h.ms >= 300000)) ok('时间线上手动停出来的那段留成了空隙');
    else bad('时间线上没有空隙');
    const sumRows = await wide.page.locator('#timerSummary .sumrow').count();
    if (sumRows >= 2) ok(`按任务汇总 ${sumRows} 行（时长 / 占比 / 次数）`);
    else bad(`按任务汇总只有 ${sumRows} 行`);
    if (!wide.errors.length) ok('页面无脚本错误');
    else bad(`页面有错误：${wide.errors.join(' | ')}`);

    // 记录列表里"停止"是一行：10:05 停止 · 任务
    await wide.page.evaluate(() => { document.querySelector('details.rawrec').open = true; });
    await sleep(200);
    const recLines = await wide.page.locator('#timerRecent li').allInnerTexts();
    const stopLine = recLines.find((line) => /停止 ·/.test(line));
    if (stopLine) ok(`记录里这一行：${stopLine.replace(/\s+/g, ' ').trim()}`);
    else bad(`记录列表里没有「停止 · 任务」：${JSON.stringify(recLines)}`);
    if (!recLines.some((line) => /自动停止|离开 \d+ 分钟/.test(line))) ok('记录里没有“自动停止/离开 N 分钟”了（自动停已删）');
    else bad('记录里还有自动停止的字样');

    if (SKIP_SHOTS) {
      console.log('  · SKIP_SHOTS=1：跳过截图（不碰 docs/preview）');
    } else {
      await mkdir(PREVIEW, { recursive: true });
      // 两张都重新开页面、都展开"最近 20 条记录"，保证 375 / 1440 是同一时刻的同一画面
      const narrow = await openTimer({ width: 375, height: 812 });
      await narrow.page.evaluate(() => { document.querySelector('details.rawrec').open = true; });
      await sleep(200);
      for (const [label, built] of [['375', narrow], ['1440', wide]]) {
        const overflow = await built.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        const file = path.join(PREVIEW, `T1-工时-${label}.png`);
        await built.page.screenshot({ path: file, fullPage: true });
        const info = await stat(file);
        if (info.size > 20000) ok(`${path.relative(REPO_ROOT, file).split(path.sep).join('/')}  ${info.size} 字节`);
        else bad(`${label} 截图太小：${info.size} 字节`);
        if (!overflow) ok(`${label} 无横向溢出`);
        else bad(`${label} 出现横向溢出`);
      }
      await narrow.page.close();
    }

    // 切任务：输入框回车即开始
    await wide.page.locator('#timerSwitch').click();
    await wide.page.locator('#pickInput').fill('换个任务试试');
    await wide.page.locator('#pickInput').press('Enter');
    await sleep(700);
    const switchedTask = await wide.page.locator('#timerTask').innerText();
    if (switchedTask === '换个任务试试') ok('切换面板里输入 + 回车 → 立刻开始计时（不用二次确认）');
    else bad(`切换后状态条显示「${switchedTask}」`);

    await wide.page.close();
    E.stop();
  }

  // ── 6 ──
  step(6, 6, '源码里不残留自动停 / 补记：idle-stop、pendingGap、timer/fill 各 0 次');
  {
    const PATTERNS = ['idle-stop', 'pendingGap', 'timer/fill'];
    for (const rel of ['server.mjs', 'index.html']) {
      const text = await readFile(path.join(HERE, rel), 'utf8');
      const counts = PATTERNS.map((p) => ({ p, n: text.split(p).length - 1 }));
      const total = counts.reduce((sum, c) => sum + c.n, 0);
      const detail = counts.map((c) => `${c.p}=${c.n}`).join(' ');
      if (total === 0) ok(`${rel}：${detail}（全部 0 次）`);
      else bad(`${rel} 里还有残留：${detail}`);
    }
    // 顺手确认两个被删掉的接口是真的没了
    const alive = await getJson(`${url}/api/timer/state`);
    if (alive.body && !('config' in alive.body) && !('pendingGap' in alive.body)) {
      ok('state 里没有 config / pendingGap 字段');
    } else {
      bad('state 里还带着 config / pendingGap');
    }
    const fill = await postJson(`${url}/api/timer/fill`, { task: 'x' });
    const cfg = await postJson(`${url}/api/timer/config`, { idleMinutes: 1 });
    if (fill.res.status === 400 && cfg.res.status === 400) ok('POST /api/timer/fill 与 /api/timer/config 都是 400（接口已删）');
    else bad(`被删的接口还能用：fill=${fill.res.status} config=${cfg.res.status}`);
  }
} catch (err) {
  console.error('\n[check-timer] 异常：', err && err.stack ? err.stack : err);
  failures += 1;
} finally {
  if (browser) await browser.close().catch(() => {});
  for (const s of servers) s.stop();
  if (!process.env.KEEP_TMP) {
    for (const dir of tmpDirs) {
      if (path.resolve(dir).startsWith(path.resolve(tmpdir()))) {
        await rm(dir, { recursive: true, force: true }).catch(() => {});
      }
    }
  }
}

console.log(failures === 0
  ? '\nPASS 工时计时器全部通过（计时 / 切换 / 心跳只报在线不停表 / 本机存储 / 面板与截图）'
  : `\nFAIL：${failures} 项没通过`);
process.exitCode = failures === 0 ? 0 : 1;
