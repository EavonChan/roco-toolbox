#!/usr/bin/env node
/**
 * 任务看板工作台 —— W2：任务 + 会话双视图，加审批节点。
 *
 * 数据源（每次请求都重读，不做任何缓存）：
 *   - docs/任务看板.md   任务与状态
 *   - docs/会话台账.md   会话与产出（只读解析，不建第二份状态）
 *
 * 写操作只有一处：POST /api/approve
 *   ① 把改前内容备份到 docs/进度/snapshots/<时间戳>.md
 *   ② 把看板里该行的状态符号改成 🟢（确认）或 🔴（打回）
 *   ③ 追加一行到 docs/进度/审批.jsonl（append-only）
 *   任何一步失败都回滚 md 并报错，不留半截。
 *
 * 用法：
 *   node tools/workbench/server.mjs
 *   → http://127.0.0.1:4320（占用时自动 +1，打印实际地址）
 *
 * 可选环境变量（只影响读哪个文件/写哪个目录，不产生第二份状态）：
 *   WORKBENCH_BOARD     看板 md 路径
 *   WORKBENCH_LEDGER    会话台账 md 路径
 *   WORKBENCH_PROGRESS  审批日志与快照目录（内含 审批.jsonl、snapshots/）
 *   PORT / HOST         起始端口 / 绑定地址（默认 4320 / 127.0.0.1）
 *
 * 原生 Node，零 npm 依赖。
 */
import { createServer } from 'node:http';
import { readFile, writeFile, appendFile, stat, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const DEFAULT_BOARD = path.join(REPO_ROOT, 'docs', '任务看板.md');
const DEFAULT_LEDGER = path.join(REPO_ROOT, 'docs', '会话台账.md');
const DEFAULT_PROGRESS = path.join(REPO_ROOT, 'docs', '进度');
const BOARD_FILE = process.env.WORKBENCH_BOARD
  ? path.resolve(process.env.WORKBENCH_BOARD)
  : DEFAULT_BOARD;
const LEDGER_FILE = process.env.WORKBENCH_LEDGER
  ? path.resolve(process.env.WORKBENCH_LEDGER)
  : DEFAULT_LEDGER;
const PROGRESS_DIR = process.env.WORKBENCH_PROGRESS
  ? path.resolve(process.env.WORKBENCH_PROGRESS)
  : DEFAULT_PROGRESS;
const APPROVALS_FILE = path.join(PROGRESS_DIR, '审批.jsonl');
const SNAPSHOT_DIR = path.join(PROGRESS_DIR, 'snapshots');

const STATIC_DIR = HERE;
const START_PORT = Number(process.env.PORT || 4320);
const HOST = process.env.HOST || '127.0.0.1';
const MAX_PORT_TRIES = 20;
const MAX_BODY_BYTES = 64 * 1024;

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
// 注意：emoji 是代理对，字符类必须带 u 标志，否则只换掉一半（会写出半个代理）。
const SYMBOL_CLASS = new RegExp(`[${SYMBOLS}]`, 'u');

/** 会话阶段（只在会话视图用；由台账文字 + 看板行推导，不是看板符号）。 */
const STAGES = [
  { key: 'backlog', label: '待派', match: /待派|未开始|空白|排队|等待派发/ },
  { key: 'doing', label: '执行中', match: /运行中|执行中|在跑|进行中|做中/ },
  { key: 'delivered', label: '已交付', match: /已交付|待验收|已交付，待验收/ },
  { key: 'accepted', label: '已验收', match: /已验收|验收通过|已通过验收/ },
  { key: 'closed', label: '已收口', match: /已收口|已收尾|已归档|已结束|已完成|关闭/ },
];
const STAGE_BY_KEY = new Map(STAGES.map((s) => [s.key, s]));

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

class HttpError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

// ───────────────────────────── 小工具 ─────────────────────────────

const stripMd = (s) => s.replace(/\*\*/g, '').replace(/`/g, '').trim();
const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const isTableRow = (line) => /^\s*\|/.test(line);
const isSeparator = (line) => /^\s*\|?[\s:|-]+\|?\s*$/.test(line) && line.includes('-');
const relPath = (file) => {
  const rel = path.relative(REPO_ROOT, file);
  return rel.startsWith('..') ? file : rel.split(path.sep).join('/');
};

function splitRow(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

/** 一行里每个单元格的内容区间（用于"没有符号时塞进哪个格子"）。 */
function cellRanges(line) {
  const pipes = [];
  for (let i = 0; i < line.length; i += 1) if (line[i] === '|') pipes.push(i);
  if (!pipes.length) return [{ start: 0, end: line.length }];
  const ranges = [];
  if (line.slice(0, pipes[0]).trim()) ranges.push({ start: 0, end: pipes[0] });
  for (let k = 0; k + 1 < pipes.length; k += 1) ranges.push({ start: pipes[k] + 1, end: pipes[k + 1] });
  const last = pipes[pipes.length - 1];
  if (line.slice(last + 1).trim()) ranges.push({ start: last + 1, end: line.length });
  return ranges;
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

/**
 * 一行里表示"状态"的符号：先只看「任务」列以外的单元格。
 * 标题里的 🔴/🟡 往往是"这条要紧"的标记（看板里真的这么写），不是状态，更不许被审批改写；
 * 非标题列里都没有符号时，才退一步把标题里的算上（W1 的兼容口径）。
 */
function statusSymbolOf(cells, titleIdx) {
  for (let i = 0; i < cells.length; i += 1) {
    if (i === titleIdx) continue;
    const sym = firstSymbol(stripMd(cells[i] || ''));
    if (sym) return { ...sym, cellIdx: i, inTitle: false };
  }
  if (titleIdx >= 0) {
    const sym = firstSymbol(stripMd(cells[titleIdx] || ''));
    if (sym) return { ...sym, cellIdx: titleIdx, inTitle: true };
  }
  return null;
}

function localDate(dateStr, hhmm) {
  if (!dateStr) return null;
  const [y, mo, d] = dateStr.split('-').map(Number);
  const h = hhmm ? hhmm.h : 23;
  const mi = hhmm ? hhmm.min : 59;
  return new Date(y, mo - 1, d, h, mi, 0, 0);
}

/** 详情列的值 → 可点的东西：markdown 链接 / URL / 本地路径 / 纯文本。没有值返回 null。 */
function detailLinkOf(raw) {
  const s = stripMd(raw || '');
  if (!s || /^[—–-]+$/.test(s)) return null;
  // 看板里常用 markdown 链接写法：[方案 HTML](docs/preview/x.html)
  const md = /\[([^[\]]*)\]\(([^()\s]+)\)/.exec(s);
  if (md) {
    const label = md[1].trim() || md[2];
    const target = md[2].trim();
    if (/^https?:\/\//i.test(target)) return { raw: target, kind: 'url', href: target, label };
    return { raw: target, kind: 'path', href: null, label };
  }
  if (/^https?:\/\//i.test(s)) return { raw: s, kind: 'url', href: s, label: s };
  if (/[\\/]/.test(s) || /\.(?:md|png|jpe?g|json|tsx?|html?|mjs|txt|pdf|zip)$/i.test(s) || /[*?]/.test(s)) {
    return { raw: s, kind: 'path', href: null, label: s };
  }
  return { raw: s, kind: 'text', href: null, label: s };
}

/** 产出格里的路径 / URL。不是路径的纯文字不硬塞成链接。 */
function outputsOf(cell) {
  const raw = cell || '';
  const found = new Map();
  const take = (token) => {
    const s = stripMd(token).replace(/[。；;，,、]+$/, '');
    if (!s || found.has(s)) return;
    if (/^https?:\/\//i.test(s)) { found.set(s, { raw: s, label: s, kind: 'url', href: s }); return; }
    if (!(/[\\/]/.test(s) || /\.(?:md|png|jpe?g|json|tsx?|html?|mjs|txt|pdf|zip)$/i.test(s) || /[*?]/.test(s))) return;
    found.set(s, { raw: s, label: s, kind: 'path', href: null });
  };
  for (const m of raw.matchAll(/`([^`]+)`/g)) take(m[1]);
  for (const m of raw.matchAll(/https?:\/\/[^\s，、；)）]+/g)) take(m[0]);
  for (const m of raw.matchAll(/(?:docs|原型|scripts|src|tools|releases)\/[^\s，、；)）（）]+/g)) take(m[0]);
  return [...found.values()];
}

// ───────────────────────────── Markdown 解析：任务看板 ─────────────────────────────

/** 表头列名 → 字段角色。识别不了就返回 null，按位置兜底。 */
function roleOf(header) {
  const h = header.replace(/[（(][^）)]*[）)]/g, '').trim();
  if (/^详情|详情链接|^链接$/.test(h)) return 'link';
  if (/代号|编号|^id$/i.test(h)) return 'code';
  if (h === '任务' || h === '事项' || h === '项') return 'title';
  if (/派给|归属|负责|执行/.test(h)) return 'assignee';
  if (/开始|日期|时间/.test(h)) return 'time';
  if (/进展|结果|等什么|备注|内容|说明/.test(h)) return 'detail';
  if (/下一步|在哪看|凭据|验收|产出/.test(h)) return 'next';
  return null;
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
  const keyCounts = new Map();

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
        dataRows.push({ cells: splitRow(lines[j]), lineIndex: j, raw: lines[j] });
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
      for (const { cells } of dataRows) {
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
    const linkIdx = roles.indexOf('link');
    const hasExplicitCode = codeIdx >= 0 && titleIdx >= 0 && titleIdx !== codeIdx;

    for (const { cells, lineIndex, raw } of dataRows) {
      if (cells.every((c) => !c.trim())) continue;
      const col = columns.get(section.columnKey);

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

      const status = statusSymbolOf(cells, titleIdx) || STATUS_BY_SYMBOL.get(col.status);
      const startCell = get('time') || cells.map(stripMd).find((c) => parseTimeCell(c)) || '';
      const startTime = startCell ? parseTimeCell(startCell) : null;

      const blockedCell = status.key === 'blocked'
        ? cells.map(stripMd).find((c) => c.includes('🔴'))
        : null;
      const blocker = status.key !== 'blocked'
        ? null
        : blockedCell
          ? blockedCell.replace(/🔴/g, '').trim() || detailText || nextText || rawTitle
          : detailText || nextText || rawTitle;

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

      // 审批用的稳定标识：章节 + 代号 + 标题。状态符号变了它也不变，加行/挪行也不会认错。
      const keyBase = `${section.columnKey}|${derivedCode}|${rawTitle}`;
      const baseKey = 'k' + createHash('sha1').update(keyBase).digest('hex').slice(0, 10);
      const seen = keyCounts.get(baseKey) || 0;
      keyCounts.set(baseKey, seen + 1);
      const key = seen ? `${baseKey}-${seen + 1}` : baseKey;

      const task = {
        id: `${section.columnKey}-${col.tasks.length + 1}`,
        key,
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
        sectionKey: section.columnKey,
        detailLink: linkIdx >= 0 ? detailLinkOf(cells[linkIdx] || '') : null,
        cells: header.map((h, idx) => ({ header: stripMd(h), value: stripMd(cells[idx] || '') })),
      };
      // 写回时定位用；不可枚举，所以不会出现在 /api/board 的 JSON 里。
      Object.defineProperty(task, '_row', {
        enumerable: false,
        value: { lineIndex, rawLine: raw, detailIdx, titleIdx },
      });
      col.tasks.push(task);
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

// ───────────────────────────── Markdown 解析：会话台账 ─────────────────────────────

function ledgerRoleOf(header) {
  const h = header.replace(/[（(][^）)]*[）)]/g, '').trim();
  if (/代号|编号|^id$/i.test(h)) return 'code';
  if (/叫法|会话名|名称/.test(h)) return 'name';
  if (/会话\s*ID/i.test(h) || /^ID$/i.test(h)) return 'sid';
  if (/状态/.test(h)) return 'status';
  if (/产出|结果|交付/.test(h)) return 'output';
  if (/原因|备注|说明/.test(h)) return 'reason';
  return null;
}

function parseLedger(text, boardTasks, fallbackTime, boardDeclaredUpdatedAt) {
  const snapshotMatch = /最近一次快照[（(]\s*(\d{4}-\d{2}-\d{2})(?:\s+(\d{1,2}:\d{2}))?/.exec(text);
  const snapshotAt = snapshotMatch
    ? localDate(snapshotMatch[1], snapshotMatch[2] ? parseTimeCell(snapshotMatch[2]) : null)
    : null;

  const lines = text.split(/\r?\n/);
  let heading = null;
  const sessions = [];
  let archivedCount = 0;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^##\s+/.test(line)) {
      heading = line.replace(/^##\s+/, '').trim();
      continue;
    }
    if (!heading || !isTableRow(line) || isSeparator(line)) continue;
    if (i + 1 >= lines.length || !isSeparator(lines[i + 1])) continue;

    const isActive = /现役/.test(heading);
    const isArchived = /归档/.test(heading);
    if (!isActive && !isArchived) continue;

    const header = splitRow(line);
    const roles = header.map(ledgerRoleOf);
    const idx = (role) => roles.indexOf(role);

    let j = i + 2;
    while (j < lines.length) {
      if (isTableRow(lines[j]) && !isSeparator(lines[j])) {
        const cells = splitRow(lines[j]);
        if (!cells.every((c) => !c.trim())) {
          if (isArchived) archivedCount += 1;
          else {
            const get = (role) => (idx(role) >= 0 ? stripMd(cells[idx(role)] || '') : '');
            const code = get('code');
            const name = get('name');
            const sessionId = get('sid');
            const ledgerStatus = get('status');
            const outputCell = get('output');
            sessions.push({
              code: code || '',
              name: name || '',
              sessionId: sessionId || '',
              ledgerStatus: ledgerStatus || '',
              ledgerReason: get('reason'),
              outputText: outputCell,
              outputs: outputsOf(outputCell),
              lineIndex: j,
            });
          }
        }
        j += 1;
        continue;
      }
      if (/^\s*$/.test(lines[j])) {
        j += 1;
        continue;
      }
      break;
    }
    i = j - 1;
  }

  const byCode = new Map();
  for (const task of boardTasks) {
    if (!task.code) continue;
    const k = task.code.toUpperCase();
    if (!byCode.has(k)) byCode.set(k, []);
    byCode.get(k).push(task);
  }

  const stageFromBoard = (tasks) => {
    if (!tasks.length) return null;
    const keys = tasks.map((t) => t.statusKey);
    if (keys.includes('doing') || keys.includes('blocked')) return 'doing';
    if (keys.includes('waiting')) return 'delivered';
    if (keys.includes('done')) return 'closed';
    if (keys.includes('backlog')) return 'backlog';
    return null;
  };

  for (const s of sessions) {
    s.id = s.code && s.code !== '—' ? s.code : `ledger-${sessions.indexOf(s) + 1}`;
    const matched = s.code && s.code !== '—' ? (byCode.get(s.code.toUpperCase()) || []) : [];

    let stageKey = null;
    let stageSource = 'ledger';
    const ledgerText = `${s.ledgerStatus} ${s.ledgerReason || ''}`;
    for (const stage of STAGES) {
      if (stage.match.test(ledgerText)) { stageKey = stage.key; break; }
    }
    if (!stageKey) {
      const fromBoard = stageFromBoard(matched);
      if (fromBoard) { stageKey = fromBoard; stageSource = 'board'; }
    }
    if (!stageKey) { stageKey = 'backlog'; stageSource = 'ledger'; }

    // 台账与看板明显打架时点出来，不替任何一边改口径
    let conflict = null;
    if (stageKey === 'doing' && matched.length && matched.every((t) => t.statusKey === 'done')) {
      conflict = `看板这几行都已 🟢 完成，台账仍写「${s.ledgerStatus || '执行中'}」`;
    } else if (stageKey === 'closed' && matched.some((t) => t.statusKey === 'doing')) {
      conflict = '台账已收口，看板仍有 🟡 进行中';
    }

    const blockedTask = matched.find((t) => t.blocker);
    const updatedCandidates = matched
      .map((t) => ({ at: t.updatedAt, src: t.updatedSource === 'row' ? 'board-row' : t.updatedSource === 'doc' ? 'board-doc' : 'board-file' }))
      .filter((c) => c.at);
    const ledgerSnapshot = snapshotAt ? { at: snapshotAt.toISOString(), src: 'ledger-snapshot' } : null;
    const boardDeclared = boardDeclaredUpdatedAt ? { at: boardDeclaredUpdatedAt, src: 'board-doc' } : null;
    const fileTime = fallbackTime ? { at: fallbackTime.toISOString(), src: 'ledger-file' } : null;
    const picked = updatedCandidates.sort((a, b) => new Date(b.at) - new Date(a.at))[0] || ledgerSnapshot || boardDeclared || fileTime;

    s.stage = { key: stageKey, label: STAGE_BY_KEY.get(stageKey).label, sourceLabel: stageSource === 'board' ? '看板' : '台账' };
    s.stageSource = stageSource;
    s.conflict = conflict;
    s.blocker = blockedTask ? { text: blockedTask.blocker, taskTitle: blockedTask.title, status: blockedTask.status } : null;
    s.updatedAt = picked ? picked.at : null;
    s.updatedSource = picked ? picked.src : null;
    s.tasks = matched.map((t) => ({
      id: t.id,
      key: t.key,
      code: t.code,
      title: t.title,
      status: t.status,
      statusKey: t.statusKey,
      statusLabel: t.statusLabel,
      sectionKey: t.sectionKey,
    }));
    delete s.lineIndex;
  }

  const byStage = {};
  for (const stage of STAGES) byStage[stage.key] = 0;
  for (const s of sessions) byStage[s.stage.key] += 1;

  return {
    sessions,
    archivedCount,
    byStage,
    stageOrder: STAGES.map((s) => ({ key: s.key, label: s.label })),
    snapshotAt: snapshotAt ? snapshotAt.toISOString() : null,
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

// ───────────────────────────── 审批日志（只读回显） ─────────────────────────────

async function approvalsTail(limit = 5) {
  try {
    const text = await readFile(APPROVALS_FILE, 'utf8');
    const lines = text.split(/\r?\n/).filter(Boolean);
    const items = lines.slice(-limit).map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line, parseError: true };
      }
    });
    return { available: true, path: relPath(APPROVALS_FILE), total: lines.length, items };
  } catch (err) {
    return {
      available: false,
      path: relPath(APPROVALS_FILE),
      total: 0,
      items: [],
      reason: err && err.code === 'ENOENT' ? '还没有审批记录' : String(err && err.message ? err.message : err),
    };
  }
}

// ───────────────────────────── /api/board ─────────────────────────────

async function boardPayload() {
  const [text, info] = await Promise.all([readFile(BOARD_FILE, 'utf8'), stat(BOARD_FILE)]);
  const parsed = parseBoard(text, info.mtime);
  const repo = repoInfo();
  repo.version = await readVersion();
  repo.boardRelativePath = relPath(BOARD_FILE);

  const boardCommit = git(['log', '-1', '--format=%cI%n%h%n%s', '--', BOARD_FILE]);
  const [commitAt, commitHash, ...commitSubject] = (boardCommit || '').split('\n');

  return {
    schema: 2,
    generatedAt: new Date().toISOString(),
    source: {
      path: relPath(BOARD_FILE),
      absolutePath: BOARD_FILE,
      bytes: info.size,
      mtime: info.mtime.toISOString(),
      declaredUpdatedAt: parsed.declaredUpdatedAt,
      sha256: sha256(text),
      commit: commitAt ? { at: commitAt, hash: commitHash, subject: commitSubject.join('\n') } : null,
      readPolicy: '每次请求重读，不缓存',
    },
    repo,
    counts: parsed.counts,
    columns: parsed.columns,
    legend: parsed.legend,
    approvals: await approvalsTail(5),
  };
}

// ───────────────────────────── /api/sessions ─────────────────────────────

async function sessionsPayload() {
  const [boardText, boardInfo] = await Promise.all([readFile(BOARD_FILE, 'utf8'), stat(BOARD_FILE)]);
  const board = parseBoard(boardText, boardInfo.mtime);
  const boardTasks = board.columns.flatMap((c) => c.tasks);

  const [ledgerText, ledgerInfo] = await Promise.all([readFile(LEDGER_FILE, 'utf8'), stat(LEDGER_FILE)]);
  const parsed = parseLedger(ledgerText, boardTasks, ledgerInfo.mtime, board.declaredUpdatedAt);
  const repo = repoInfo();
  repo.version = await readVersion();

  return {
    schema: 2,
    generatedAt: new Date().toISOString(),
    repo,
    source: {
      board: relPath(BOARD_FILE),
      ledger: relPath(LEDGER_FILE),
      ledgerAbsolutePath: LEDGER_FILE,
      bytes: ledgerInfo.size,
      mtime: ledgerInfo.mtime.toISOString(),
      sha256: sha256(ledgerText),
      snapshotAt: parsed.snapshotAt,
      readPolicy: '每次请求重读两份 md，不缓存、不落盘',
    },
    counts: {
      total: parsed.sessions.length,
      archived: parsed.archivedCount,
      byStage: parsed.byStage,
    },
    boardCounts: board.counts,
    stages: parsed.stageOrder,
    sessions: parsed.sessions,
  };
}

// ───────────────────────────── POST /api/approve（唯一写操作） ─────────────

let approveChain = Promise.resolve();
function withLock(fn) {
  const run = approveChain.then(fn, fn);
  approveChain = run.then(() => {}, () => {});
  return run;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let done = false;
    const fail = (err) => {
      if (done) return;
      done = true;
      reject(err);
    };
    req.on('data', (buf) => {
      size += buf.length;
      if (size > MAX_BODY_BYTES) {
        fail(new HttpError(413, 'body_too_large', `请求体超过 ${MAX_BODY_BYTES} 字节`));
        req.destroy();
        return;
      }
      chunks.push(buf);
    });
    req.on('end', () => {
      if (done) return;
      done = true;
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new HttpError(400, 'bad_json', '请求体不是合法 JSON'));
      }
    });
    req.on('error', (err) => fail(err));
  });
}

function snapshotName(date = new Date()) {
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${date.getUTCFullYear()}-${p(date.getUTCMonth() + 1)}-${p(date.getUTCDate())}` +
    `T${p(date.getUTCHours())}-${p(date.getUTCMinutes())}-${p(date.getUTCSeconds())}` +
    `-${p(date.getUTCMilliseconds(), 3)}Z.md`;
}

async function writeSnapshot(beforeText) {
  await mkdir(SNAPSHOT_DIR, { recursive: true });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const name = attempt === 0 ? snapshotName() : snapshotName().replace(/\.md$/, `-${attempt}.md`);
    const file = path.join(SNAPSHOT_DIR, name);
    try {
      await writeFile(file, beforeText, { encoding: 'utf8', flag: 'wx' });
      return { path: relPath(file), absolutePath: file, name, bytes: Buffer.byteLength(beforeText, 'utf8') };
    } catch (err) {
      if (err && err.code === 'EEXIST') continue;
      throw new HttpError(500, 'snapshot_failed', `备份失败，未改看板：${err.message}`, { snapshotDir: relPath(SNAPSHOT_DIR) });
    }
  }
  throw new HttpError(500, 'snapshot_failed', '备份文件名连续冲突，未改看板', { snapshotDir: relPath(SNAPSHOT_DIR) });
}

function replaceLine(text, lineIndex, newLine) {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) if (text[i] === '\n') starts.push(i + 1);
  if (lineIndex < 0 || lineIndex >= starts.length) return null;
  const start = starts[lineIndex];
  let end = text.indexOf('\n', start);
  if (end === -1) end = text.length;
  let contentEnd = end;
  if (contentEnd > start && text[contentEnd - 1] === '\r') contentEnd -= 1;
  return text.slice(0, start) + newLine + text.slice(contentEnd);
}

/** 第一个不同的位置（只用于把写失败说清楚）。 */
function firstDiff(a, b) {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) if (a[i] !== b[i]) return i;
  return n;
}

/**
 * 改状态符号。规则：
 *   1. 先在不属于「任务」列、且已经有符号的单元格里，换掉那个符号（看板惯例：符号写在「最近进展」开头）；
 *   2. 都没有符号，就把符号插到「最近进展」格首（没有这列就最后一格）；
 *   3. **永远不碰「任务」列**——标题里的 🔴/🟡 是标记，不是状态，改了就是把看板写坏。
 */
function patchLineSymbol(line, symbol, detailIdx, titleIdx) {
  const ranges = cellRanges(line);
  if (!ranges.length) return null;
  for (let i = 0; i < ranges.length; i += 1) {
    if (i === titleIdx) continue;
    const range = ranges[i];
    const cell = line.slice(range.start, range.end);
    if (!SYMBOL_CLASS.test(cell)) continue;
    return line.slice(0, range.start) + cell.replace(SYMBOL_CLASS, symbol) + line.slice(range.end);
  }
  const idx0 = detailIdx >= 0 && detailIdx < ranges.length ? detailIdx : ranges.length - 1;
  let idx = idx0;
  if (idx === titleIdx) idx = ranges.length - 1;
  if (idx === titleIdx) return null; // 只有「任务」一格能写 → 宁可报错，也不改标题
  const range = ranges[idx];
  const cell = line.slice(range.start, range.end);
  const insertAt = range.start + cell.match(/^\s*/)[0].length;
  return line.slice(0, insertAt) + symbol + ' ' + line.slice(insertAt);
}

function findRow(parsed, { id, key }) {
  const tasks = parsed.columns.flatMap((c) => c.tasks);
  if (key) {
    const byKey = tasks.find((t) => t.key === key);
    if (byKey) return { task: byKey, matchedBy: 'key' };
  }
  if (id) {
    const byId = tasks.find((t) => t.id === id);
    if (byId) return { task: byId, matchedBy: 'id' };
  }
  return null;
}

function taskBrief(task) {
  return {
    id: task.id,
    key: task.key,
    code: task.code,
    title: task.title,
    status: task.status,
    statusKey: task.statusKey,
    statusLabel: task.statusLabel,
    section: task.section,
    sectionKey: task.sectionKey,
  };
}

async function boardMeta() {
  const [text, info] = await Promise.all([readFile(BOARD_FILE, 'utf8'), stat(BOARD_FILE)]);
  return { path: relPath(BOARD_FILE), sha256: sha256(text), bytes: info.size, mtime: info.mtime.toISOString() };
}

async function writeApproval({ id, key, action, note }) {
  const before = await readFile(BOARD_FILE, 'utf8');
  const parsed = parseBoard(before, new Date());
  const found = findRow(parsed, { id, key });
  if (!found) {
    throw new HttpError(404, 'row_not_found',
      `看板里找不到这条任务（id=${id || '-'}，key=${key || '-'}）。可能刚被改过，等面板刷新后再点一次。`);
  }
  const task = found.task;
  const symbol = action === 'approve' ? '🟢' : '🔴';

  // 已经是目标状态（含"该列默认就是这个状态"）：不写文件、不备份、不记日志
  if (task.status === symbol) {
    return {
      changed: false,
      note: `这一行已经是 ${symbol}，没有重复写。`,
      record: null,
      snapshot: null,
      task: taskBrief(task),
      board: await boardMeta(),
    };
  }

  const record = { id: task.id, action, note: note || null, at: new Date().toISOString() };
  const snapshot = await writeSnapshot(before);
  const newLine = patchLineSymbol(task._row.rawLine, symbol, task._row.detailIdx, task._row.titleIdx);
  const newText = newLine == null ? null : replaceLine(before, task._row.lineIndex, newLine);
  // 写前先确认"任务"列一个字都没动（防止把标题里的标记改掉）
  const titleBefore = task._row.titleIdx >= 0 ? splitRow(task._row.rawLine)[task._row.titleIdx] : null;
  const titleAfter = newLine != null && task._row.titleIdx >= 0 ? splitRow(newLine)[task._row.titleIdx] : null;
  if (titleBefore !== null && titleBefore !== titleAfter) {
    throw new HttpError(500, 'patch_failed', '这次改符号会动到「任务」列标题，已拒绝', { snapshot, boardUnchanged: true });
  }
  if (newText == null) {
    throw new HttpError(500, 'patch_failed', '没能定位到看板里的那一行，未改看板', { snapshot, boardUnchanged: true });
  }

  const restore = async () => {
    try {
      await writeFile(BOARD_FILE, before, 'utf8');
      return (await readFile(BOARD_FILE, 'utf8')) === before;
    } catch {
      return false;
    }
  };

  try {
    await writeFile(BOARD_FILE, newText, 'utf8');
  } catch (err) {
    let unchanged = false;
    try {
      unchanged = (await readFile(BOARD_FILE, 'utf8')) === before;
    } catch { /* 读不回来就按未回滚处理 */ }
    if (!unchanged) {
      const rolledBack = await restore();
      throw new HttpError(500, 'write_failed',
        `写看板失败：${err.message}。已回滚：${rolledBack ? '是' : '否'}`, { snapshot, boardUnchanged: rolledBack, rolledBack });
    }
    throw new HttpError(500, 'write_failed',
      `写看板失败：${err.message}。看板内容未变。`, { snapshot, boardUnchanged: true, rolledBack: false });
  }

  // 写完先自检：重新解析必须能看到目标符号、条数不变，否则回滚
  const afterText = await readFile(BOARD_FILE, 'utf8');
  const recheck = parseBoard(afterText, new Date());
  const again = recheck.columns.flatMap((c) => c.tasks).find((t) => t.key === task.key);
  const badWrite = afterText !== newText || !again || again.status !== symbol || recheck.counts.total !== parsed.counts.total;
  if (badWrite) {
    const rolledBack = await restore();
    const why = afterText !== newText ? '字节不一致' : !again ? '行丢失' : '状态没变成 ' + symbol;
    throw new HttpError(500, 'verify_failed',
      `写入后校验没过（${why}），已回滚：${rolledBack ? '是' : '否'}`,
      {
        snapshot,
        boardUnchanged: rolledBack,
        rolledBack,
        diffAt: afterText !== newText ? firstDiff(afterText, newText) : null,
        bytes: { written: Buffer.byteLength(newText, 'utf8'), readBack: Buffer.byteLength(afterText, 'utf8') },
      });
  }

  try {
    await mkdir(PROGRESS_DIR, { recursive: true });
    await appendFile(APPROVALS_FILE, JSON.stringify(record) + '\n', 'utf8');
  } catch (err) {
    const rolledBack = await restore();
    throw new HttpError(500, 'log_failed',
      `审批日志写入失败：${err.message}。看板已回滚：${rolledBack ? '是' : '否'}`, { snapshot, boardUnchanged: rolledBack, rolledBack });
  }

  return {
    changed: true,
    record,
    snapshot,
    task: taskBrief(recheck.columns.flatMap((c) => c.tasks).find((t) => t.key === task.key)),
    board: await boardMeta(),
    approvalsPath: relPath(APPROVALS_FILE),
  };
}

async function approveHandler(req, res) {
  const body = await readJsonBody(req);
  const action = body.action;
  if (action !== 'approve' && action !== 'reject') {
    throw new HttpError(400, 'bad_action', 'action 只能是 approve（确认已完成）或 reject（打回）');
  }
  const note = body.note == null ? '' : String(body.note);
  if (note.length > 500) throw new HttpError(400, 'note_too_long', 'note 最多 500 字');
  const id = body.id == null ? '' : String(body.id);
  const key = body.key == null ? '' : String(body.key);
  if (!id && !key) throw new HttpError(400, 'missing_id', '缺少 id（任务标识）');

  const result = await withLock(() => writeApproval({ id, key, action, note: note.trim() }));
  sendJson(res, 200, { schema: 2, ok: true, ...result });
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

function errorBody(err, fallbackHint) {
  const message = err && err.message ? err.message : String(err);
  if (err instanceof HttpError) {
    return {
      status: err.status,
      body: { schema: 2, ok: false, error: err.code, message, ...err.extra },
    };
  }
  return {
    status: 503,
    body: {
      schema: 2,
      ok: false,
      error: 'unavailable',
      message,
      hint: fallbackHint,
    },
  };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || HOST}`);
  try {
    if (url.pathname === '/api/approve') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        sendText(res, 405, 'method not allowed');
        return;
      }
      await approveHandler(req, res);
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendText(res, 405, 'method not allowed');
      return;
    }
    if (url.pathname === '/api/board') {
      sendJson(res, 200, await boardPayload());
      return;
    }
    if (url.pathname === '/api/sessions') {
      sendJson(res, 200, await sessionsPayload());
      return;
    }
    if (url.pathname === '/favicon.ico') {
      res.writeHead(204).end();
      return;
    }
    await serveStatic(res, url.pathname);
  } catch (err) {
    const hint = url.pathname === '/api/sessions'
      ? `无法读取会话台账：${LEDGER_FILE}`
      : url.pathname === '/api/approve'
        ? `写看板失败：${BOARD_FILE}`
        : `无法读取看板：${BOARD_FILE}`;
    const { status, body } = errorBody(err, hint);
    process.stderr.write(`[workbench] ${url.pathname} → ${status} ${body.error}: ${body.message}\n`);
    sendJson(res, status, body);
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
    console.log(`  任务数据源      ${BOARD_FILE}`);
    console.log(`  会话数据源      ${LEDGER_FILE}`);
    console.log(`  审批日志/快照   ${APPROVALS_FILE}`);
    console.log(`  写入策略        唯一写操作 POST /api/approve；写前备份、失败回滚`);
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
    return sessionsPayload();
  })
  .then((payload) => {
    const line = payload.stages.map((s) => `${s.label} ${payload.counts.byStage[s.key] || 0}`).join(' / ');
    console.log(`[workbench] 已解析 ${payload.counts.total} 个现役会话（${line}）`);
    listen(START_PORT, 0);
  })
  .catch((err) => {
    console.error(`[workbench] 启动失败：${err.message}`);
    console.error(`  看板：${BOARD_FILE}`);
    console.error(`  台账：${LEDGER_FILE}`);
    process.exit(1);
  });
