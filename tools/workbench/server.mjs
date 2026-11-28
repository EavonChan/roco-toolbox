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
 * 汇报（W4，只读）：GET /api/reports 列 docs/汇报/ 下的 .md，GET /api/reports/<名> 回原文。
 *   只读这一个目录；`..` / 绝对路径 / 非 .md 一律 400，绝不把别处的文件吐出去。
 *
 * 工时计时器（T1）：/api/timer/*  —— 数据只存本机，**不在仓库里**、不上传、不做考勤：
 *   %USERPROFILE%\.workbench\timer\YYYY-MM-DD.jsonl  一天一个事件日志（只追加）
 *   日志在仓库外，所以 `git status` 永远看不见它；答案只回答"今天时间去哪了"。
 *
 * 用法：
 *   node tools/workbench/server.mjs
 *   → http://127.0.0.1:4320（占用时自动 +1，打印实际地址）
 *
 * 可选环境变量（只影响读哪个文件/写哪个目录，不产生第二份状态）：
 *   WORKBENCH_BOARD     看板 md 路径
 *   WORKBENCH_LEDGER    会话台账 md 路径
 *   WORKBENCH_PROGRESS  审批日志与快照目录（内含 审批.jsonl、snapshots/）
 *   WORKBENCH_REPORTS   汇报 md 目录（默认 docs/汇报，只读）
 *   WORKBENCH_TIMER_DIR 计时数据目录（默认 %USERPROFILE%\.workbench\timer；验收脚本用临时目录）
 *   PORT / HOST         起始端口 / 绑定地址（默认 4320 / 127.0.0.1）
 *
 * 原生 Node，零 npm 依赖。
 */
import { createServer } from 'node:http';
import { readFile, writeFile, appendFile, stat, mkdir, readdir, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const DEFAULT_BOARD = path.join(REPO_ROOT, 'docs', '任务看板.md');
const DEFAULT_LEDGER = path.join(REPO_ROOT, 'docs', '会话台账.md');
const DEFAULT_PROGRESS = path.join(REPO_ROOT, 'docs', '进度');
const DEFAULT_REPORTS = path.join(REPO_ROOT, 'docs', '汇报');
const DEFAULT_DECISIONS = path.join(REPO_ROOT, 'docs', '待决策.md');
const BOARD_FILE = process.env.WORKBENCH_BOARD
  ? path.resolve(process.env.WORKBENCH_BOARD)
  : DEFAULT_BOARD;
const LEDGER_FILE = process.env.WORKBENCH_LEDGER
  ? path.resolve(process.env.WORKBENCH_LEDGER)
  : DEFAULT_LEDGER;
const PROGRESS_DIR = process.env.WORKBENCH_PROGRESS
  ? path.resolve(process.env.WORKBENCH_PROGRESS)
  : DEFAULT_PROGRESS;
const REPORTS_DIR = process.env.WORKBENCH_REPORTS
  ? path.resolve(process.env.WORKBENCH_REPORTS)
  : DEFAULT_REPORTS;
// 「待决策」那一页（Q-xxx 选项的来源）。工作台只读它，绝不回写。
const DECISIONS_DOC = process.env.WORKBENCH_DECISIONS
  ? path.resolve(process.env.WORKBENCH_DECISIONS)
  : DEFAULT_DECISIONS;
const APPROVALS_FILE = path.join(PROGRESS_DIR, '审批.jsonl');
// 决策/评论：**只追加**，和审批.jsonl 分开放，互不影响格式
const DECISIONS_FILE = path.join(PROGRESS_DIR, '决策.jsonl');
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

/** 看板行的决策标识：标题的稳定 hash。状态变了、行挪到别的列，历史决策还认得出是哪一条。 */
const decisionIdOf = (title) => 'b' + createHash('sha1').update(title || '').digest('hex').slice(0, 10);

/**
 * 「选项」格 → 选项数组。写法：`A 锁 720（推荐）, B 三栏`
 *   - 中文逗号、英文逗号、顿号、分号都当分隔符；
 *   - 每一项前面的一两个字母/数字是提交时用的 key；
 *   - 带「推荐」的单独标出来，UI 只做次要高亮；
 *   - 空值 / `—` / 没这一列 → 返回空数组（不报错）。
 * 没有前缀字母的项退化成"整段文字就是 key"，这样写了选项也不至于点不了。
 */
function parseOptions(cell) {
  const raw = stripMd(cell || '');
  if (!raw || /^[—–-]+$/.test(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const part of raw.split(/[,，、;；]/)) {
    const text = part.trim();
    if (!text) continue;
    const m = /^([A-Za-z0-9]{1,2})[\s.．、:：)）-]+(.+)$/.exec(text);
    const key = (m ? m[1] : text).toUpperCase();
    const label = (m ? m[2] : text).trim();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ key, label, text, recommended: /推荐/.test(text) });
  }
  return out;
}
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
  if (/选\s*项|可选/.test(h)) return 'option';
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
    const optionIdx = roles.indexOf('option');
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
        decideId: decisionIdOf(rawTitle),
        code: derivedCode,
        title: rawTitle,
        options: optionIdx >= 0 ? parseOptions(cells[optionIdx] || '') : [],
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

// ───────────────────────────── Markdown 解析：待决策（Q-xxx） ─────────────────────────────

function decisionRoleOf(header) {
  const h = header.replace(/[（(][^）)]*[）)]/g, '').trim();
  if (/编号|代号|^id$/i.test(h)) return 'code';
  if (/选\s*项|可选/.test(h)) return 'option';
  if (/^问题$|^事项$|^项$|^待定$/.test(h)) return 'title';
  if (/谁问|提出|来源/.test(h)) return 'asker';
  if (/建议|结论|答复/.test(h)) return 'suggestion';
  if (/状态/.test(h)) return 'status';
  if (/时间|日期/.test(h)) return 'time';
  return null;
}

/**
 * 解析 docs/待决策.md：只看"有编号 + 有问题"的表。
 * 状态说明 / 规则这种表没有编号列，直接跳过，不报错。
 * 关没关：状态里有 🟢 / 已关闭，或整张表在「已关闭」章节下。
 */
function parseDecisionsDoc(text) {
  const lines = text.split(/\r?\n/);
  let heading = null;
  const items = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (/^##\s+/.test(line)) {
      heading = line.replace(/^##\s+/, '').trim();
      continue;
    }
    if (!heading || !isTableRow(line) || isSeparator(line)) continue;
    if (i + 1 >= lines.length || !isSeparator(lines[i + 1])) continue;

    const header = splitRow(line);
    const roles = header.map(decisionRoleOf);
    const codeIdx = roles.indexOf('code');
    const titleIdx = roles.indexOf('title');
    if (codeIdx < 0 || titleIdx < 0) continue;
    const optionIdx = roles.indexOf('option');
    const askerIdx = roles.indexOf('asker');
    const suggestionIdx = roles.indexOf('suggestion');
    const statusIdx = roles.indexOf('status');
    const timeIdx = roles.indexOf('time');
    const closedByHeading = /已关闭|已收口/.test(heading);
    const waitingByHeading = /等你|拍板/.test(heading);

    let j = i + 2;
    while (j < lines.length) {
      if (!isTableRow(lines[j]) || isSeparator(lines[j])) break;
      const cells = splitRow(lines[j]);
      const id = stripMd(cells[codeIdx] || '');
      const title = stripMd(cells[titleIdx] || '');
      if (id && title) {
        const statusText = statusIdx >= 0 ? stripMd(cells[statusIdx] || '') : '';
        const sym = firstSymbol(statusText);
        const closed = closedByHeading || /已关闭/.test(statusText) || (sym && sym.key === 'done');
        const options = optionIdx >= 0 ? parseOptions(cells[optionIdx] || '') : [];
        items.push({
          id,
          title,
          asker: askerIdx >= 0 ? stripMd(cells[askerIdx] || '') : '',
          suggestion: suggestionIdx >= 0 ? stripMd(cells[suggestionIdx] || '') : '',
          status: statusText,
          statusKey: sym ? sym.key : (closed ? 'done' : 'waiting'),
          closed: !!closed,
          // 只有「等你拍板」那几节（或自己声明了选项的行）才当成要点的卡片
          waiting: !closed && (waitingByHeading || options.length > 0),
          at: timeIdx >= 0 ? stripMd(cells[timeIdx] || '') : '',
          options,
          section: heading,
        });
      }
      j += 1;
    }
    i = j - 1;
  }
  return items;
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

// ───────────────────────────── 汇报：只读 docs/汇报/ ─────────────────────────────

const REPORT_EXT = '.md';
const REPORTS_PREFIX = '/api/reports/';

/**
 * 请求行里的**原始**路径。必须用原串：`new URL()` 会把 `/api/reports/../x` 折叠成 `/api/x`，
 * 那样就悄悄放过了穿越（验收要求是 400，不是 404）。
 */
function rawPathOf(reqUrl) {
  const q = reqUrl.indexOf('?');
  const raw = q >= 0 ? reqUrl.slice(0, q) : reqUrl;
  if (raw.startsWith('/')) return raw;
  try {
    return new URL(raw).pathname; // 代理式绝对 URL（极少数客户端）
  } catch {
    return raw;
  }
}

/** 从 `/api/reports/<名字>` 取文件名；穿越 / 绝对路径 / 非 .md 一律 400。 */
function reportNameOf(rawPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(rawPath);
  } catch {
    throw new HttpError(400, 'bad_report_path', '汇报文件名不是合法 URL 编码');
  }
  const name = decoded.slice(REPORTS_PREFIX.length);
  const reasons = [];
  if (!name) reasons.push('文件名为空');
  if (name.includes('..')) reasons.push('含 ..');
  if (name.includes('/') || name.includes('\\')) reasons.push('含路径分隔符');
  if (/^[A-Za-z]:/.test(name)) reasons.push('像绝对路径');
  if (/[\u0000-\u001f\u007f]/.test(name)) reasons.push('含控制字符');
  if (!name.toLowerCase().endsWith(REPORT_EXT)) reasons.push(`不是 ${REPORT_EXT} 文件`);
  if (reasons.length) {
    throw new HttpError(400, 'bad_report_path',
      `拒绝这个汇报路径（${reasons.join('，')}）：只允许 docs/汇报/ 下的单个 .md 文件名`);
  }
  return name;
}

/** 名字 → 磁盘路径；再核一遍“解析后仍在汇报目录里”（防软链接跑出去）。 */
async function resolveReport(name) {
  const abs = path.resolve(REPORTS_DIR, name);
  const rel = path.relative(REPORTS_DIR, abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel) || rel.includes(path.sep)) {
    throw new HttpError(400, 'bad_report_path', '这个路径不在 docs/汇报/ 里，已拒绝');
  }
  const realDir = await realpath(REPORTS_DIR).catch(() => path.resolve(REPORTS_DIR));
  const realFile = await realpath(abs).catch(() => null);
  if (realFile && path.dirname(realFile) !== realDir) {
    throw new HttpError(400, 'bad_report_path', '这个文件指向汇报目录之外，已拒绝');
  }
  return abs;
}

/** 标题 = 正文里第一行 `# ` 之后的内容；没有就退回文件名（不猜、不造标题）。 */
function reportTitle(text, name) {
  for (const line of String(text).split(/\r?\n/)) {
    const m = /^#\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) return m[1].trim();
  }
  return name.replace(/\.md$/i, '');
}

async function reportsPayload() {
  let entries;
  try {
    entries = await readdir(REPORTS_DIR, { withFileTypes: true });
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      return {
        schema: 3, ok: true, generatedAt: new Date().toISOString(),
        dir: relPath(REPORTS_DIR), absoluteDir: REPORTS_DIR,
        available: false, count: 0, files: [],
        reason: `还没有 ${relPath(REPORTS_DIR)}/ 目录`,
        readPolicy: '每次请求重读目录与文件，不缓存',
      };
    }
    throw err;
  }
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile() || entry.name.startsWith('.') || !entry.name.toLowerCase().endsWith(REPORT_EXT)) continue;
    const abs = path.join(REPORTS_DIR, entry.name);
    try {
      const [info, text] = await Promise.all([stat(abs), readFile(abs, 'utf8')]);
      files.push({
        name: entry.name,
        path: relPath(abs),
        title: reportTitle(text, entry.name),
        size: info.size,
        bytes: info.size,
        mtime: info.mtime.toISOString(),
        _mtimeMs: info.mtimeMs,
      });
    } catch { /* 单个文件读不了不影响整份清单 */ }
  }
  files.sort((a, b) => b._mtimeMs - a._mtimeMs || a.name.localeCompare(b.name, 'zh'));
  return {
    schema: 3, ok: true, generatedAt: new Date().toISOString(),
    dir: relPath(REPORTS_DIR), absoluteDir: REPORTS_DIR,
    available: true,
    count: files.length,
    sort: 'mtime-desc',
    files: files.map(({ _mtimeMs, ...rest }) => rest),
    readPolicy: '每次请求重读目录与文件，不缓存',
  };
}

/** 返回原文（text/markdown），不是 JSON：页面拿到什么就渲染什么。 */
async function sendReport(res, rawPath) {
  const name = reportNameOf(rawPath);
  const abs = await resolveReport(name);
  let text;
  let info;
  try {
    [text, info] = await Promise.all([readFile(abs, 'utf8'), stat(abs)]);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      throw new HttpError(404, 'report_not_found', `docs/汇报/ 里没有这个文件：${name}`);
    }
    throw err;
  }
  const buf = Buffer.from(text, 'utf8');
  res.writeHead(200, {
    'Content-Type': 'text/markdown; charset=utf-8',
    'Content-Length': buf.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate',
    'X-Report-Name': encodeURIComponent(name),
    'X-Report-Mtime': info.mtime.toISOString(),
    'X-Report-Bytes': String(buf.length),
  });
  res.end(buf);
}

// ───────────────────────────── 决策日志（只追加） ─────────────────────────────

/** 决策/评论：一行一个事件，只追加。文件不在就是"还没人点过"，不报错。 */
async function readDecisions() {
  let text = '';
  try {
    text = await readFile(DECISIONS_FILE, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return new Map();
    throw err;
  }
  const latest = new Map();
  for (const line of text.split(/\r?\n/)) {
    const s = line.trim();
    if (!s) continue;
    let rec = null;
    try { rec = JSON.parse(s); } catch { continue; }
    if (!rec || !rec.id) continue;
    latest.set(String(rec.id), rec); // 后写的覆盖先写的：文件顺序就是时间顺序
  }
  return latest;
}

async function appendDecision(record) {
  await mkdir(PROGRESS_DIR, { recursive: true });
  await appendFile(DECISIONS_FILE, JSON.stringify(record) + '\n', 'utf8');
}

/** 可决策的条目：看板每一行（id = 标题稳定 hash）+ 待决策.md 的 Q-xxx。选项只认 md 里写的。 */
async function decisionTargets() {
  const [boardText, decisionsText] = await Promise.all([
    readFile(BOARD_FILE, 'utf8'),
    readFile(DECISIONS_DOC, 'utf8').catch((err) => {
      if (err && err.code === 'ENOENT') return null;
      throw err;
    }),
  ]);
  const targets = new Map();
  const board = parseBoard(boardText, new Date());
  for (const col of board.columns) {
    for (const task of col.tasks) {
      targets.set(task.decideId, {
        id: task.decideId,
        title: task.title,
        options: task.options,
        source: relPath(BOARD_FILE),
        kind: 'board',
      });
    }
  }
  if (decisionsText != null) {
    for (const item of parseDecisionsDoc(decisionsText)) {
      if (targets.has(item.id)) continue;
      targets.set(item.id, {
        id: item.id,
        title: item.title,
        options: item.options,
        source: relPath(DECISIONS_DOC),
        kind: 'doc',
      });
    }
  }
  return targets;
}

/** 「等你 / 待决策」清单：待决策.md 里还开着的那几条，带上最新决策/评论。 */
async function pendingDecisionItems(decisions) {
  let text = null;
  try {
    text = await readFile(DECISIONS_DOC, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return { source: relPath(DECISIONS_DOC), available: false, count: 0, items: [] };
    throw err;
  }
  const items = parseDecisionsDoc(text)
    .filter((item) => item.waiting && !item.closed)
    .map((item) => ({ ...item, source: relPath(DECISIONS_DOC), decision: decisions.get(item.id) || null }));
  return {
    source: relPath(DECISIONS_DOC),
    absolutePath: DECISIONS_DOC,
    available: true,
    count: items.length,
    log: relPath(DECISIONS_FILE),
    items,
  };
}

async function writeDecision({ id, option, note }) {
  const targets = await decisionTargets();
  const target = targets.get(id);
  if (!target) {
    throw new HttpError(404, 'row_not_found',
      `md 里找不到要决策的这一条（id=${id}）。可能刚被改过，等面板刷新后再点一次。`);
  }
  const declared = target.options.map((o) => o.key);
  if (option && !declared.includes(option)) {
    throw new HttpError(400, 'option_not_declared',
      `「${id}」没有声明选项 ${option}。md 里声明的是：${declared.length ? declared.join('、') : '（空）'}（来源 ${target.source}）`,
      { declared, options: target.options, source: target.source });
  }
  if (!option && !note) {
    throw new HttpError(400, 'empty_decision', 'option 与 note 至少要给一个：只点选项 = 决策，只填一句 = 评论');
  }

  const record = { at: new Date().toISOString(), kind: option ? 'decision' : 'comment', id };
  if (option) record.option = option;
  record.note = note || null;
  record.source = target.source;

  try {
    await appendDecision(record);
  } catch (err) {
    throw new HttpError(500, 'log_failed',
      `决策日志写入失败：${err.message}`, { path: relPath(DECISIONS_FILE) });
  }

  return {
    changed: true,
    record,
    decision: record,
    id,
    title: target.title,
    option: option || null,
    source: target.source,
    options: target.options,
    path: relPath(DECISIONS_FILE),
  };
}

// ───────────────────────────── /api/board ─────────────────────────────

async function boardPayload() {
  const [text, info, decisions] = await Promise.all([
    readFile(BOARD_FILE, 'utf8'),
    stat(BOARD_FILE),
    readDecisions(),
  ]);
  const parsed = parseBoard(text, info.mtime);
  // 每张卡带上最新决策/评论（只读：来源是 决策.jsonl，md 一个字都不动）
  for (const col of parsed.columns) {
    for (const task of col.tasks) task.decision = decisions.get(task.decideId) || null;
  }
  const pending = await pendingDecisionItems(decisions);
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
    pendingDecisions: pending,
    decisionsLog: {
      path: relPath(DECISIONS_FILE),
      count: decisions.size,
      readPolicy: '每次请求重读 JSONL，不缓存',
    },
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

// ───────────────────────────── POST /api/decide（只追加 决策.jsonl） ─────────────
/**
 * 快速决策 + 评论：md 仍是唯一权威，这里只往事件流写一行，**不碰任何 md**。
 *   { id, option?: 'A', note?: string }
 *   - option 必须在该行 md 声明的「选项」里；
 *   - option 与 note 至少一个非空（只填备注 = 评论）；
 *   - 与审批共用同一把串行锁（withLock），不会两条写入交叉。
 */
async function decideHandler(req, res) {
  const body = await readJsonBody(req);
  const id = body.id == null ? '' : String(body.id).trim();
  const option = body.option == null ? '' : String(body.option).trim().toUpperCase();
  const note = body.note == null ? '' : String(body.note).trim();
  if (!id) throw new HttpError(400, 'missing_id', '缺少 id（Q-xxx 或看板行的 decideId）');
  if (note.length > 500) throw new HttpError(400, 'note_too_long', 'note 最多 500 字');
  if (!option && !note) {
    throw new HttpError(400, 'empty_decision', 'option 与 note 至少要给一个：只点选项 = 决策，只填一句 = 评论');
  }
  const result = await withLock(() => writeDecision({ id, option, note }));
  sendJson(res, 200, { schema: 2, ok: true, ...result });
}

// ───────────────────────────── 工时计时器（T1） ─────────────────────────────
/**
 * 三条硬约束（用户原话）：
 *   ① 数据只存本机，绝不上传、不进 git、不做考勤 → 落盘在 %USERPROFILE%\.workbench\timer\，
 *      刻意放在仓库**外面**：工作台别的数据源都在 docs/ 里，只有这份"我今天怎么过的"不外流，
 *      删掉这个目录就等于全部清零，`git status` 里也永远看不到它。
 *   ② 不做 AI 时间统计，不标"谁打断的"：这里只有任务名与时间，没有别的维度。
 *   ③ 界面上只有一条状态条（前端），服务端只负责事实。
 *
 * 日志一行一个事件（只追加，不改写）：
 *   {"ts":"...","type":"start","task":"需求评审"}
 *   {"ts":"...","type":"switch","from":"需求评审","to":"写 PRD"}
 *   {"ts":"...","type":"stop","task":"写 PRD"}
 *
 * **不做空闲自动停止**（设计决定，也写进 README）：用户可能同时在两台电脑上工作，
 * 自动停会把在另一台机器上的时间误判为离开。所以一段计时只会因为**手动切换 / 停止**而结束。
 * 心跳（前端 15 秒一次）只用来回答"面板还连着没连着"（state.online），绝不拿来停计时。
 */
const HOME_DIR = process.env.USERPROFILE || homedir();
const TIMER_DIR = process.env.WORKBENCH_TIMER_DIR
  ? path.resolve(process.env.WORKBENCH_TIMER_DIR)
  : path.join(HOME_DIR, '.workbench', 'timer');
const TIMER_TASK_MAX = 60;
const TIMER_RECENT_LIMIT = 20;
/** 心跳 15 秒一次；连着 = 最近 20 秒内有心跳（一拍 + 一点网络抖动，避免刚好卡在两拍之间闪成灰的）。 */
const TIMER_ONLINE_MS = 20000;

const p2 = (n) => String(n).padStart(2, '0');

/** 本机时区的 ISO（带 +08:00 这种偏移）。日志里就用它：人直接读得懂，也不丢时区。 */
function localIso(date = new Date()) {
  const off = -date.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const abs = Math.abs(off);
  return `${date.getFullYear()}-${p2(date.getMonth() + 1)}-${p2(date.getDate())}` +
    `T${p2(date.getHours())}:${p2(date.getMinutes())}:${p2(date.getSeconds())}` +
    `${sign}${p2(Math.floor(abs / 60))}:${p2(abs % 60)}`;
}
const dayKey = (date = new Date()) => `${date.getFullYear()}-${p2(date.getMonth() + 1)}-${p2(date.getDate())}`;
const dayStartOf = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const hhmm = (ms) => { const d = new Date(ms); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };
const tsMs = (value) => { const t = new Date(value).getTime(); return Number.isFinite(t) ? t : NaN; };
const timerFileFor = (ms) => path.join(TIMER_DIR, `${dayKey(new Date(ms))}.jsonl`);
/** 路径里的家目录缩成 ~，给界面显示用（真实路径仍在 absolutePath 里）。 */
function tilde(file) {
  const rel = path.relative(HOME_DIR, file);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return file;
  return '~' + path.sep + rel;
}

const TIMER_EVENT_LABEL = {
  start: '开始',
  switch: '切换',
  stop: '停止',
};

function cleanTask(value) {
  const s = String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) throw new HttpError(400, 'missing_task', 'task 不能为空：告诉我这段时间在做什么');
  if (s.length > TIMER_TASK_MAX) throw new HttpError(400, 'task_too_long', `task 最多 ${TIMER_TASK_MAX} 字`);
  return s;
}

async function readTimerEvents(file) {
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return [];
    throw err;
  }
  const events = [];
  let broken = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const ev = JSON.parse(line);
      if (ev && typeof ev === 'object' && ev.type) events.push(ev);
      else broken += 1;
    } catch {
      broken += 1; // 坏行跳过：一行写坏了不该让整天的时间线消失
    }
  }
  if (broken) events.broken = broken;
  return events;
}

async function appendTimerEvent(ev) {
  await mkdir(TIMER_DIR, { recursive: true });
  const file = timerFileFor(Number.isFinite(tsMs(ev.ts)) ? tsMs(ev.ts) : Date.now());
  await appendFile(file, JSON.stringify(ev) + '\n', 'utf8');
  return file;
}

/** 只有内存里记「当前在做什么」；时间线一律从日志重放，所以服务重启也不编造时间。 */
const timerState = { current: null, since: 0, lastBeat: 0 };
let timerChain = Promise.resolve();
function withTimerLock(fn) {
  const run = timerChain.then(fn, fn);
  timerChain = run.then(() => {}, () => {});
  return run;
}

/**
 * 从当天日志还原时间线。日志是唯一真相：进程重启、浏览器关掉，只要日志还在时间线就还在。
 * 一段计时只会被 start / switch / stop 断开——**没有自动停**，所以最后一段没收到 stop 就一直算到现在。
 */
function replayTimer(events, now) {
  const segments = [];
  let cur = null;
  const pushSeg = (task, from, to) => {
    if (!Number.isFinite(from) || !Number.isFinite(to) || to - from < 1000) return;
    segments.push({ task, from, to, ms: to - from });
  };
  const closeCur = (to) => {
    if (!cur) return;
    pushSeg(cur.task, cur.from, to);
    cur = null;
  };

  for (const ev of events) {
    const t = tsMs(ev.ts);
    if (!Number.isFinite(t)) continue;
    if (ev.type === 'start' || ev.type === 'switch') {
      closeCur(t);
      // switch 事件写的是 from / to，start 写的是 task；两种都要认
      const task = String((ev.type === 'switch' ? ev.to : ev.task) || ev.task || '').trim();
      if (!task) continue;
      cur = { task, from: t };
    } else if (ev.type === 'stop') {
      closeCur(t);
    }
  }
  closeCur(now);
  return { segments };
}

/** 日志里最后一段是不是还开着（= 还在计时）。启动时用它把"当前任务"接回来。 */
function openSegmentOf(events) {
  let cur = null;
  for (const ev of events) {
    const t = tsMs(ev.ts);
    if (!Number.isFinite(t)) continue;
    if (ev.type === 'start' || ev.type === 'switch') {
      const task = String((ev.type === 'switch' ? ev.to : ev.task) || ev.task || '').trim();
      cur = task ? { task, from: t } : null;
    } else if (ev.type === 'stop') {
      cur = null;
    }
  }
  return cur;
}

function mergeIntervals(list) {
  const out = [];
  for (const it of [...list].sort((a, b) => a.from - b.from)) {
    const last = out[out.length - 1];
    if (last && it.from <= last.to) last.to = Math.max(last.to, it.to);
    else out.push({ from: it.from, to: it.to });
  }
  return out;
}

/** 一行记录的说法。 */
function describeTimerEvent(ev) {
  const task = String(ev.task || '').trim();
  if (ev.type === 'switch') return `${String(ev.from || '—')} → ${String(ev.to || ev.task || '—')}`;
  if (ev.type === 'start') return `开始 · ${task || '（没写任务）'}`;
  if (ev.type === 'stop') return `停止 · ${task || '（没写任务）'}`;
  return TIMER_EVENT_LABEL[ev.type] || ev.type;
}

async function timerPayload() {
  const now = Date.now();
  const file = timerFileFor(now);
  const events = await readTimerEvents(file);
  const { segments } = replayTimer(events, now);
  const dayStart = dayStartOf(new Date(now));

  // 跨天：只留今天的部分
  const todaySegments = segments
    .map((s) => ({ ...s, from: Math.max(s.from, dayStart), to: Math.min(s.to, now) }))
    .filter((s) => s.to - s.from >= 1000)
    .map((s) => ({ ...s, ms: s.to - s.from }));

  const covered = mergeIntervals(todaySegments.map((s) => ({ from: s.from, to: s.to })));

  const firstAt = todaySegments.length ? Math.min(...todaySegments.map((s) => s.from)) : now;
  // 时间线窗口：从第一段前 5 分钟画起；今天什么都还没记就画最近 1 小时。
  // 不把"打开工作台之前"算成空白——那不是忘了记，那是没开始。
  const from = todaySegments.length
    ? Math.max(dayStart, Math.min(firstAt - 5 * 60000, now - 5 * 60000))
    : Math.max(dayStart, now - 60 * 60000);
  const windowMs = Math.max(now - from, 60000);
  const holes = [];
  let cursor = from;
  for (const iv of covered) {
    if (iv.from > cursor) holes.push({ from: cursor, to: Math.min(iv.from, now) });
    cursor = Math.max(cursor, iv.to);
  }
  if (cursor < now) holes.push({ from: cursor, to: now });

  const trackedMs = todaySegments.reduce((sum, s) => sum + s.ms, 0);
  const holeMs = holes.reduce((sum, h) => sum + (h.to - h.from), 0);

  const byTask = new Map();
  for (const s of todaySegments) {
    const row = byTask.get(s.task) || { task: s.task, ms: 0, count: 0, firstAt: s.from, lastAt: s.to };
    row.ms += s.ms;
    row.count += 1;
    row.firstAt = Math.min(row.firstAt, s.from);
    row.lastAt = Math.max(row.lastAt, s.to);
    byTask.set(s.task, row);
  }
  const tasks = [...byTask.values()]
    .sort((a, b) => b.ms - a.ms || a.task.localeCompare(b.task, 'zh'))
    .map((row) => ({
      ...row,
      firstAt: localIso(new Date(row.firstAt)),
      lastAt: localIso(new Date(row.lastAt)),
      firstHhmm: hhmm(row.firstAt),
      lastHhmm: hhmm(row.lastAt),
      share: trackedMs ? Math.round((row.ms / trackedMs) * 100) : 0,
    }));

  // 最近 20 条：开始 / 切换 / 停止，一行一条
  const recent = events.slice(-TIMER_RECENT_LIMIT).map((ev) => ({
    ts: ev.ts,
    at: Number.isFinite(tsMs(ev.ts)) ? hhmm(tsMs(ev.ts)) : '',
    type: ev.type,
    typeLabel: TIMER_EVENT_LABEL[ev.type] || ev.type,
    task: String(ev.task || ev.to || ''),
    text: describeTimerEvent(ev),
  }));

  // online 只说明"面板还连着没连着"，跟计时一点关系都没有：心跳停了，计时照跑。
  const online = !!timerState.lastBeat && now - timerState.lastBeat <= TIMER_ONLINE_MS;

  return {
    schema: 1,
    generatedAt: new Date(now).toISOString(),
    now: localIso(new Date(now)),
    date: dayKey(new Date(now)),
    storage: {
      dir: tilde(TIMER_DIR),
      dirLabel: tilde(TIMER_DIR),
      absoluteDir: TIMER_DIR,
      logFile: tilde(file),
      logLabel: tilde(file),
      absoluteLogFile: file,
      outsideRepo: !path.resolve(file).startsWith(REPO_ROOT + path.sep),
      note: '只存本机：不上传、不进 git、不做考勤，删掉这个目录就全清了',
    },
    online,
    lastHeartbeat: timerState.lastBeat ? localIso(new Date(timerState.lastBeat)) : null,
    current: timerState.current
      ? {
        task: timerState.current.task,
        since: localIso(new Date(timerState.since)),
        sinceMs: timerState.since,
        elapsedMs: Math.max(0, now - Math.max(timerState.since, dayStart)),
      }
      : null,
    day: {
      from: localIso(new Date(from)),
      to: localIso(new Date(now)),
      fromMs: from,
      toMs: now,
      fromHhmm: hhmm(from),
      toHhmm: hhmm(now),
      spanMs: windowMs,
      segments: todaySegments.map((s) => ({
        task: s.task,
        from: localIso(new Date(s.from)),
        to: localIso(new Date(s.to)),
        fromHhmm: hhmm(s.from),
        toHhmm: hhmm(s.to),
        ms: s.ms,
      })),
      holes: holes.map((h) => ({
        from: localIso(new Date(h.from)),
        to: localIso(new Date(h.to)),
        fromHhmm: hhmm(h.from),
        toHhmm: hhmm(h.to),
        ms: h.to - h.from,
      })),
    },
    summary: { trackedMs, holeMs, sinceHhmm: hhmm(from), tasks },
    recent,
    brokenLines: events.broken || 0,
    readPolicy: '每次请求重读当天日志，不缓存；事件只追加，不改写',
  };
}

async function timerStartHandler(body, viaSwitch) {
  const task = cleanTask(body.task);
  return withTimerLock(async () => {
    const now = Date.now();
    const prev = timerState.current;
    // 当前有任务 → 记 switch（日志里能看出是"切"过去的）；没有 → 记 start
    const ev = prev
      ? { ts: localIso(new Date(now)), type: 'switch', from: prev.task, to: task }
      : { ts: localIso(new Date(now)), type: 'start', task };
    await appendTimerEvent(ev);
    timerState.current = { task };
    timerState.since = now;
    return { event: ev, changed: true, viaSwitch: !!viaSwitch };
  });
}

async function timerStopHandler() {
  return withTimerLock(async () => {
    const now = Date.now();
    const prev = timerState.current;
    if (!prev) return { event: null, changed: false };
    const ev = { ts: localIso(new Date(now)), type: 'stop', task: prev.task };
    await appendTimerEvent(ev);
    timerState.current = null;
    timerState.since = 0;
    return { event: ev, changed: true };
  });
}

/**
 * 心跳只为一件事：让状态条上的圆点知道"面板还连着"。它**不碰计时**——
 * 用户可能在另一台电脑上干活，心跳停了不代表人走了，一段计时只有手动切换/停止才结束。
 */
async function timerBeatHandler() {
  timerState.lastBeat = Date.now();
  return { event: null, changed: false };
}

const TIMER_ROUTES = {
  '/api/timer/state': ['GET'],
  '/api/timer/start': ['POST'],
  '/api/timer/switch': ['POST'],
  '/api/timer/stop': ['POST'],
  '/api/timer/heartbeat': ['POST'],
};

async function timerRoute(req, res, apiPath) {
  const allow = TIMER_ROUTES[apiPath];
  if (!allow) {
    throw new HttpError(400, 'bad_api_path',
      `没有这个计时器接口：${apiPath}。只认 ${Object.keys(TIMER_ROUTES).join('、')}`);
  }
  if (!allow.includes(req.method)) {
    res.setHeader('Allow', allow.join(', '));
    sendText(res, 405, 'method not allowed');
    return;
  }
  const body = req.method === 'POST' ? await readJsonBody(req) : {};

  let extra = { event: null, changed: false };
  if (apiPath === '/api/timer/start') extra = await timerStartHandler(body, false);
  else if (apiPath === '/api/timer/switch') extra = await timerStartHandler(body, true);
  else if (apiPath === '/api/timer/stop') extra = await timerStopHandler();
  else if (apiPath === '/api/timer/heartbeat') extra = await timerBeatHandler();

  const payload = await timerPayload();
  sendJson(res, 200, {
    ...payload,
    ok: true,
    event: extra.event || null,
    changed: extra.changed === true,
  });
}

/**
 * 启动自检：把日志里"还开着"的最后一段接回内存——因为计时**只由手动切换/停止结束**，
 * 服务重启不该把正在跑的一段悄悄掐掉。只在内存里恢复，不写任何事件。
 * 心跳从 0 开始（online=false），等页面打第一次心跳才点亮。
 */
async function bootTimer() {
  const now = Date.now();
  const events = await readTimerEvents(timerFileFor(now));
  const open = openSegmentOf(events);
  timerState.current = open ? { task: open.task } : null;
  timerState.since = open ? open.from : 0;
  timerState.lastBeat = 0;
  if (open) {
    console.log(`[workbench] 计时器：日志里「${open.task}」那段从 ${hhmm(open.from)} 起还开着，` +
      '按"还在计时"接回来（要结束请手动切换或停止）');
  }
  return { events: events.length, dir: TIMER_DIR, current: open };
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
  const rawPath = rawPathOf(req.url || '/');
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
    if (url.pathname === '/api/decide') {
      if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        sendText(res, 405, 'method not allowed');
        return;
      }
      await decideHandler(req, res);
      return;
    }
    // 计时器有自己的方法表：state 收 GET，其余收 POST（POST 一律回当前状态）
    if (url.pathname.startsWith('/api/timer')) {
      await timerRoute(req, res, url.pathname);
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendText(res, 405, 'method not allowed');
      return;
    }
    if (rawPath === '/api/reports') {
      sendJson(res, 200, await reportsPayload());
      return;
    }
    if (rawPath.startsWith(REPORTS_PREFIX)) {
      await sendReport(res, rawPath);
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
    // 不认识的 /api/ 路径一律 400（不是 404）：有的客户端会把 /api/reports/../x 先归一化成 /api/x，
    // 那一层归一化服务端看不见；把它当"非法接口路径"挡掉，穿越在任何客户端下都不会变成 200。
    if (url.pathname.startsWith('/api/')) {
      throw new HttpError(400, 'bad_api_path',
        `没有这个接口：${url.pathname}。工作台只认 GET /api/board、GET /api/sessions、` +
        'GET /api/reports、GET /api/reports/<文件名>、POST /api/approve、POST /api/decide，' +
        '以及 /api/timer/ 下的 state / start / switch / stop / heartbeat');
    }
    await serveStatic(res, url.pathname);
  } catch (err) {
    const hint = rawPath.startsWith('/api/reports')
      ? `无法读取汇报目录：${REPORTS_DIR}`
      : url.pathname.startsWith('/api/timer')
        ? `计时数据目录不可用：${TIMER_DIR}`
        : url.pathname === '/api/sessions'
        ? `无法读取会话台账：${LEDGER_FILE}`
        : url.pathname === '/api/approve'
          ? `写看板失败：${BOARD_FILE}`
          : url.pathname === '/api/decide'
            ? `写决策日志失败：${DECISIONS_FILE}`
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
    console.log(`  汇报目录        ${REPORTS_DIR}`);
    console.log(`  审批日志/快照   ${APPROVALS_FILE}`);
    console.log(`  决策日志        ${DECISIONS_FILE}`);
    console.log(`  决策数据源      ${DECISIONS_DOC}`);
    console.log(`  工时数据        ${TIMER_DIR}（${tilde(TIMER_DIR)}，仓库外、只存本机）`);
    console.log(`  写入策略        审批 POST /api/approve（改 md）；决策 POST /api/decide（只追加 JSONL）；计时 POST /api/timer/*（只追加日志）`);
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
  .then(async (payload) => {
    const line = payload.stages.map((s) => `${s.label} ${payload.counts.byStage[s.key] || 0}`).join(' / ');
    console.log(`[workbench] 已解析 ${payload.counts.total} 个现役会话（${line}）`);
    const reports = await reportsPayload().catch(() => null);
    if (reports) console.log(`[workbench] 汇报 ${reports.count} 份（${reports.dir}${reports.available ? '' : '，目录还没建'}）`);
    await bootTimer().catch((err) => {
      console.warn(`[workbench] 计时器启动自检跳过：${err && err.message ? err.message : err}（计时数据目录 ${TIMER_DIR}）`);
    });
    listen(START_PORT, 0);
  })
  .catch((err) => {
    console.error(`[workbench] 启动失败：${err.message}`);
    console.error(`  看板：${BOARD_FILE}`);
    console.error(`  台账：${LEDGER_FILE}`);
    process.exit(1);
  });
