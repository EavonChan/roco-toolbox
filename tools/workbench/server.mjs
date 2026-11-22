#!/usr/bin/env node
/**
 * 任务看板工作台 —— 只读可视化面板。
 *
 * 唯一数据源：docs/任务看板.md + git（每次请求都重读，不做任何缓存/落盘）。
 * 不建数据库、不建 JSON 状态文件；面板里也改不了状态。
 *
 * 用法：
 *   node tools/workbench/server.mjs
 *   → http://127.0.0.1:4320（占用时自动 +1，打印实际地址）
 *
 * 可选环境变量（只影响读哪个文件/监听哪，不产生第二份状态）：
 *   WORKBENCH_BOARD  覆盖看板 md 路径（验收脚本用它测"改 md 立即生效"，默认不动真文件）
 *   PORT / HOST      起始端口 / 绑定地址（默认 4320 / 127.0.0.1）
 *
 * 原生 Node，零 npm 依赖。
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const DEFAULT_BOARD = path.join(REPO_ROOT, 'docs', '任务看板.md');
const BOARD_FILE = process.env.WORKBENCH_BOARD
  ? path.resolve(process.env.WORKBENCH_BOARD)
  : DEFAULT_BOARD;
const STATIC_DIR = HERE;
const START_PORT = Number(process.env.PORT || 4320);
const HOST = process.env.HOST || '127.0.0.1';
const MAX_PORT_TRIES = 20;

/** 看板的四列。顺序即展示顺序；status 是该列的默认状态（行内写了符号则覆盖）。 */
const COLUMNS = [
  { key: 'doing', title: '进行中', status: '🟡', match: /进行中/ },
  { key: 'waiting', title: '等你', status: '🔵', match: /等你/ },
  { key: 'done', title: '已完成', status: '🟢', match: /已完成/ },
  { key: 'backlog', title: '待派', status: '⚪', match: /待派|backlog/i },
];

/** 状态符号 → 语义。label 会被 md 里的「状态图例」覆盖（仍然只有一个真相）。 */
const STATUSES = [
  { symbol: '🟡', key: 'doing', label: '进行中' },
  { symbol: '🔵', key: 'waiting', label: '等你' },
  { symbol: '⚪', key: 'backlog', label: '待派' },
  { symbol: '🟢', key: 'done', label: '已完成' },
  { symbol: '🔴', key: 'blocked', label: '卡住' },
];
const SYMBOLS = STATUSES.map((s) => s.symbol).join('');
const STATUS_BY_SYMBOL = new Map(STATUSES.map((s) => [s.symbol, s]));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// ───────────────────────────── Markdown 解析 ─────────────────────────────

const stripMd = (s) => s.replace(/\*\*/g, '').replace(/`/g, '').trim();

function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

const isTableRow = (line) => /^\s*\|/.test(line);
const isSeparator = (line) => /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes('-');
const isHeading = (line) => /^#{1,3}\s+/.test(line);

/** 表头列名 → 字段角色。识别不了就返回 null，按位置兜底。 */
function roleOf(header) {
  const h = header.replace(/[（(][^）)]*[）)]/g, '').trim();
  if (/代号|编号|^id$/i.test(h)) return 'code';
  if (h === '任务' || h === '事项' || h === '项') return 'title';
  if (/派给|归属|负责|执行/.test(h)) return 'assignee';
  if (/开始|日期|时间/.test(h)) return 'time';
  if (/进展|结果|等什么|备注|内容|说明/.test(h)) return 'detail';
  if (/下一步|在哪看|凭据|验收|产出/.test(h)) return 'next';
  return null;
}

function parseTimeCell(cell) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(stripMd(cell));
  return m ? { h: Number(m[1]), min: Number(m[2]) } : null;
}

function firstSymbol(text) {
  let best = null;
  for (const ch of SYMBOLS) {
    const at = text.indexOf(ch);
    if (at >= 0 && (!best || at < best.at)) best = { ...STATUS_BY_SYMBOL.get(ch), at };
  }
  return best;
}

function localDate(dateStr, hhmm) {
  if (!dateStr) return null;
  const [y, mo, d] = dateStr.split('-').map(Number);
  const h = hhmm ? hhmm.h : 23;
  const mi = hhmm ? hhmm.min : 59;
  return new Date(y, mo - 1, d, h, mi, 0, 0);
}

function parseBoard(text, fallbackTime) {
  const docDateMatch = /最后更新[：:]\s*(\d{4}-\d{2}-\d{2})(?:\s+(\d{1,2}:\d{2}))?/.exec(text);
  const docDate = docDateMatch ? docDateMatch[1] : null;
  const docTime = docDateMatch && docDateMatch[2] ? parseTimeCell(docDateMatch[2]) : null;
  const declaredUpdatedAt = docDate ? localDate(docDate, docTime) : null;

  const lines = text.split(/\r?\n/);
  let heading = null;
  let section = null;

  const legend = [];
  const columns = new Map(COLUMNS.map((c) => [c.key, { ...c, tasks: [] }]));

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^##\s+/.test(line)) {
      heading = line.replace(/^##\s+/, '').trim();
      const col = COLUMNS.find((c) => c.match.test(heading));
      section = col ? { heading, columnKey: col.key } : null;
      continue;
    }
    if (!heading || !isTableRow(line) || isSeparator(line)) continue;
    if (i + 1 >= lines.length || !isSeparator(lines[i + 1])) continue;

    const header = splitRow(line);
    const dataRows = [];
    let j = i + 2;
    while (j < lines.length) {
      if (isTableRow(lines[j]) && !isSeparator(lines[j])) {
        dataRows.push(splitRow(lines[j]));
        j += 1;
        continue;
      }
      // 真实看板里出现过"表头后多一个空行"的手滑写法；空行不该让整张表消失
      if (/^\s*$/.test(lines[j])) {
        j += 1;
        continue;
      }
      break;
    }
    i = j - 1;

    // 状态图例：拿 md 里的符号与含义，不做第二份文案
    if (/状态图例|图例/.test(heading)) {
      for (const cells of dataRows) {
        const sym = firstSymbol(cells[0] || '');
        if (!sym) continue;
        const label = stripMd(cells[0]).replace(sym.symbol, '').trim() || sym.label;
        legend.push({ symbol: sym.symbol, label, meaning: stripMd(cells[1] || '') });
      }
      continue;
    }
    if (!section) continue;

    const roles = header.map(roleOf);
    const titleIdx = roles.indexOf('title');
    const codeIdx = roles.indexOf('code');
    const nextIdx = roles.indexOf('next');
    const detailIdx = roles.indexOf('detail');
    const hasExplicitCode = codeIdx >= 0 && titleIdx >= 0 && titleIdx !== codeIdx;

    for (const cells of dataRows) {
      if (cells.every((c) => !c.trim())) continue;
      const col = columns.get(section.columnKey);
      const rowText = cells.join(' | ');

      const get = (role) => {
        const idx = roles.indexOf(role);
        return idx >= 0 ? stripMd(cells[idx] || '') : '';
      };
      const nextText = nextIdx >= 0 ? stripMd(cells[nextIdx] || '') : '';
      const detailText = detailIdx >= 0 ? stripMd(cells[detailIdx] || '') : '';

      const rawTitle = titleIdx >= 0 ? stripMd(cells[titleIdx] || '') : stripMd(cells[0] || '');
      const explicitCode = hasExplicitCode ? stripMd(cells[codeIdx] || '') : '';
      const derivedCode =
        explicitCode ||
        (/PR\s*#\d+/i.exec(rawTitle)?.[0]?.replace(/\s+/g, '') ?? '') ||
        (/^[A-Z][A-Za-z]{0,2}\d*(?=\s|[（(]|$)/.exec(rawTitle)?.[0] ?? '');

      const status = firstSymbol(rowText) || STATUS_BY_SYMBOL.get(col.status);
      const startCell = get('time') || cells.map(stripMd).find((c) => parseTimeCell(c)) || '';
      const startTime = startCell ? parseTimeCell(startCell) : null;

      const blockedCell = cells.map(stripMd).find((c) => c.includes('🔴'));
      const blocker = blockedCell
        ? blockedCell.replace(/🔴/g, '').trim() || nextText
        : status.key === 'blocked'
          ? detailText || nextText || rawTitle
          : null;

      // 「多久前更新」优先用行内时间，其次看板声明的更新时间，最后文件 mtime；
      // 如果看板把时间写到了未来（本项目出现过），退回文件 mtime，不显示"未来时间"。
      const rowUpdated = startTime && docDate ? localDate(docDate, startTime) : null;
      const candidates = [
        rowUpdated ? { at: rowUpdated, src: 'row' } : null,
        declaredUpdatedAt ? { at: declaredUpdatedAt, src: 'doc' } : null,
        fallbackTime ? { at: fallbackTime, src: 'file' } : null,
      ].filter(Boolean);
      const picked = candidates.find((c) => c.at.getTime() <= Date.now() + 60000) || candidates[candidates.length - 1] || null;
      const updated = picked ? picked.at : null;

      col.tasks.push({
        id: `${section.columnKey}-${col.tasks.length + 1}`,
        code: derivedCode,
        title: rawTitle,
        assignee: get('assignee'),
        status: status.symbol,
        statusKey: status.key,
        statusLabel: status.label,
        startedAt: startCell || null,
        updatedAt: updated ? updated.toISOString() : null,
        updatedSource: picked ? picked.src : 'file',
        blocker: blocker || null,
        detail: detailText,
        next: nextText,
        section: section.heading,
        cells: header.map((h, idx) => ({ header: h, value: stripMd(cells[idx] || '') })),
      });
    }
  }

  // legend 覆盖默认状态文案（仍然以 md 为准）
  const labelBySymbol = new Map(legend.map((l) => [l.symbol, l.label]));
  for (const col of columns.values()) {
    for (const task of col.tasks) {
      const label = labelBySymbol.get(task.status);
      if (label) task.statusLabel = label;
    }
  }

  const ordered = COLUMNS.map((c) => {
    const col = columns.get(c.key);
    return {
      key: c.key,
      title: c.title,
      status: c.status,
      count: col.tasks.length,
      tasks: col.tasks,
    };
  });

  const counts = { total: 0 };
  for (const col of ordered) {
    counts[col.key] = col.count;
    counts.total += col.count;
  }

  return {
    columns: ordered,
    counts,
    legend,
    declaredUpdatedAt: declaredUpdatedAt ? declaredUpdatedAt.toISOString() : null,
    docDate,
  };
}

// ───────────────────────────── 仓库信息（git） ─────────────────────────────

function git(args) {
  try {
    return execFileSync('git', args, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    }).trim();
  } catch {
    return null;
  }
}

function repoInfo() {
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  const porcelain = git(['status', '--porcelain']);
  const log = git(['log', '-1', '--format=%cI%n%h%n%s']);
  const [lastCommitAt, lastCommitHash, ...subjectParts] = (log || '').split('\n');
  return {
    root: REPO_ROOT,
    branch: branch || null,
    version: null,
    dirtyFiles: porcelain ? porcelain.split('\n').filter(Boolean).length : 0,
    lastCommitAt: lastCommitAt || null,
    lastCommitHash: lastCommitHash || null,
    lastCommitSubject: subjectParts.join('\n') || null,
  };
}

async function readVersion() {
  try {
    const pkg = JSON.parse(await readFile(path.join(REPO_ROOT, 'package.json'), 'utf8'));
    return pkg.version || null;
  } catch {
    return null;
  }
}

// ───────────────────────────── /api/board ─────────────────────────────

async function boardPayload() {
  const [text, info] = await Promise.all([readFile(BOARD_FILE, 'utf8'), stat(BOARD_FILE)]);
  const parsed = parseBoard(text, info.mtime);
  const repo = repoInfo();
  repo.version = await readVersion();
  repo.boardRelativePath = path.relative(REPO_ROOT, BOARD_FILE).split(path.sep).join('/');

  const boardCommit = git(['log', '-1', '--format=%cI%n%h%n%s', '--', BOARD_FILE]);
  const [commitAt, commitHash, ...commitSubject] = (boardCommit || '').split('\n');

  return {
    schema: 1,
    generatedAt: new Date().toISOString(),
    source: {
      path: repo.boardRelativePath,
      absolutePath: BOARD_FILE,
      bytes: info.size,
      mtime: info.mtime.toISOString(),
      declaredUpdatedAt: parsed.declaredUpdatedAt,
      sha256: createHash('sha256').update(text).digest('hex'),
      commit: commitAt ? { at: commitAt, hash: commitHash, subject: commitSubject.join('\n') } : null,
      readPolicy: '每次请求重读，不缓存',
    },
    repo,
    counts: parsed.counts,
    columns: parsed.columns,
    legend: parsed.legend,
  };
}

// ───────────────────────────── HTTP ─────────────────────────────

function sendJson(res, status, body) {
  const buf = Buffer.from(JSON.stringify(body, null, 2));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': buf.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  });
  res.end(buf);
}

function sendText(res, status, text) {
  const buf = Buffer.from(text, 'utf8');
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Content-Length': buf.length });
  res.end(buf);
}

async function serveStatic(res, urlPath) {
  // 只托管这一张单文件页面，不暴露工具目录里的源码/脚本
  if (urlPath !== '/' && urlPath !== '/index.html') {
    sendText(res, 404, 'not found');
    return;
  }
  const file = path.join(STATIC_DIR, 'index.html');
  try {
    const data = await readFile(file);
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': 'no-store',
    });
    res.end(data);
  } catch {
    sendText(res, 404, 'not found');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || HOST}`);
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendText(res, 405, 'method not allowed');
      return;
    }
    if (url.pathname === '/api/board') {
      sendJson(res, 200, await boardPayload());
      return;
    }
    if (url.pathname === '/favicon.ico') {
      res.writeHead(204).end();
      return;
    }
    await serveStatic(res, url.pathname);
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    process.stderr.write(`[workbench] ${message}\n`);
    sendJson(res, 503, {
      schema: 1,
      error: 'board_unavailable',
      message,
      hint: `无法读取看板：${BOARD_FILE}`,
      source: { path: BOARD_FILE },
    });
  }
});

function listen(port, attempt) {
  const onError = (err) => {
    server.off('listening', onListening);
    if (err.code === 'EADDRINUSE' && attempt < MAX_PORT_TRIES) {
      listen(port + 1, attempt + 1);
      return;
    }
    console.error(`[workbench] 启动失败：${err.message}`);
    process.exitCode = 1;
  };
  const onListening = () => {
    server.off('error', onError);
    const actual = server.address().port;
    const url = `http://${HOST}:${actual}`;
    console.log('');
    console.log(`  任务看板工作台  ${url}`);
    console.log(`  数据源          ${BOARD_FILE}`);
    console.log(`  读取策略        每次请求重读（无缓存、只读）`);
    console.log(`  端口            ${actual}${actual !== START_PORT ? `（${START_PORT} 被占用，自动顺延）` : ''}`);
    console.log('');
    console.log('  Ctrl+C 停止');
    console.log('');
    process.stdout.write(`[ready] ${url}\n`);
  };
  server.on('error', onError);
  server.once('listening', onListening);
  server.listen(port, HOST);
}

// 启动时先读一次，配置错/文件不在就立刻报出来，不要等用户打开页面
boardPayload()
  .then((payload) => {
    const line = payload.columns.map((c) => `${c.title} ${c.count}`).join(' / ');
    console.log(`[workbench] 已解析 ${payload.counts.total} 条任务（${line}）`);
    listen(START_PORT, 0);
  })
  .catch((err) => {
    console.error(`[workbench] 读看板失败：${err.message}`);
    console.error(`  路径：${BOARD_FILE}`);
    process.exit(1);
  });
