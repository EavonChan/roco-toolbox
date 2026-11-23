/**
 * 卡片对账：设计稿里的精灵卡 vs 线上真卡的实测盒子。
 *
 * 为什么值得写：卡片最容易「看起来差不多、实际差 2px」，而这类误差会一路带到
 * 组件库和质量门禁里。这里用同一台浏览器把两边量一遍，逐条比。
 *
 * 注意两种「不可比」的量：
 *   · 卡宽 —— 由各自的网格容器决定（看板 4 列在 351、小组需求卡在 337），
 *     所以宽只比「同一容器下应当相同的」那几项，需求卡干脆不卡宽；
 *   · 卡高 —— 需求卡的文案行会随宽度换行，宽度不同就别硬比高度。
 *
 * 用法：
 *   node 原型/设计稿/_tools/compare-cards.mjs --user 用户名 --pass 密码
 *
 * 退出码：超过允许误差即 1。
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveBase } from './lib/nav.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROTO = pathToFileURL(path.resolve(HERE, '..', '精灵卡专题', 'index.html')).href;
const BASE_URL = resolveBase();
const TOL = 1;

const argOf = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const USER = argOf('--user');
const PASS = argOf('--pass');

const results = [];
function record(kind, field, live, proto) {
  if (live == null || proto == null) {
    results.push({ kind, field, live, proto, ok: true, skipped: true });
    return;
  }
  results.push({ kind, field, live, proto, ok: Math.abs(live - proto) <= TOL });
}

async function dismiss(page) {
  for (let i = 0; i < 8; i += 1) {
    let clicked = false;
    for (const text of ['跳过', '知道了']) {
      const btn = page.getByRole('button', { name: text, exact: true }).first();
      if ((await btn.count()) && (await btn.isVisible().catch(() => false))) {
        await btn.click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(300);
        clicked = true;
        break;
      }
    }
    if (!clicked) break;
  }
}

/** 量一张卡：根盒子 + 头像 + 名字 + 底部状态条 */
async function measureCard(locator) {
  return locator.evaluate((el) => {
    const box = (node) => {
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { w: +r.width.toFixed(1), h: +r.height.toFixed(1) };
    };
    const img = el.querySelector('img');
    const name = el.querySelector('h3') || (el.tagName === 'BUTTON' ? el.children[1] : null);
    const status = el.querySelector('.demand-status') || (el.tagName === 'BUTTON' ? el.lastElementChild : null);
    const cs = getComputedStyle(el);
    return {
      card: box(el),
      // 头像一律量 <img>：需求卡外层 span 带 6px 上内边距，拿 span 会比线上大 8px
      avatar: box(img),
      name: box(name),
      nameFont: name ? getComputedStyle(name).fontSize : null,
      status: box(status),
      radius: parseFloat(cs.borderTopLeftRadius),
      border: parseFloat(cs.borderTopWidth),
    };
  });
}

const browser = await chromium.launch();

async function livePage(pageId) {
  const ctx = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
  });
  const page = await ctx.newPage();
  await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 90000 });
  await page.waitForTimeout(900);
  await dismiss(page);
  if (USER && PASS) {
    await page.getByRole('button', { name: '我的', exact: true }).first().click();
    await page.waitForTimeout(700);
    await dismiss(page);
    await page.getByRole('button', { name: '我的身份', exact: true }).first().click();
    await page.waitForTimeout(400);
    const loginMode = page.getByTestId('account-mode-login');
    if (await loginMode.count()) await loginMode.click();
    await page.getByTestId('account-username-input').fill(USER);
    await page.getByTestId('account-password-input').fill(PASS);
    await page.getByTestId('account-login').click({ timeout: 20000 });
    await page.waitForTimeout(6000);
    await page.waitForLoadState('networkidle').catch(() => {});
    await dismiss(page);
  }
  const labels = { dashboard: '看板', collection: '收集', swap: '换蛋' };
  await page.getByRole('button', { name: labels[pageId], exact: true }).first().click();
  await page.waitForTimeout(1800);
  await dismiss(page);
  await page
    .waitForFunction(() => !(document.body.innerText || '').includes('正在读取'), { timeout: 15000 })
    .catch(() => {});
  await page.waitForTimeout(600);
  return { ctx, page };
}

async function protoCards() {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 1, locale: 'zh-CN' });
  const page = await ctx.newPage();
  await page.goto(`${PROTO}?embed=1&w=375`, { waitUntil: 'load' });
  await page
    .waitForFunction(() => [...document.querySelectorAll('img')].every((i) => i.complete), { timeout: 20000 })
    .catch(() => {});
  await page.waitForTimeout(400);
  const pick = async (selector) => {
    const locator = page.locator(selector).first();
    return (await locator.count()) ? measureCard(locator) : null;
  };
  const out = {
    种公推荐卡: await pick('.grid-4 .pet-card'),
    母本卡: await pick('.pet-card[data-size="mother"]'),
    缺口卡: await pick('.pet-card[data-size="gap"]'),
    需求卡: await pick('.demand-card'),
  };
  await ctx.close();
  return out;
}

const proto = await protoCards();

/* ---------------- 种公推荐卡：看板默认视图 ---------------- */
{
  const { ctx, page } = await livePage('dashboard');
  const locator = page.locator('main article').first();
  if (await locator.count()) {
    const live = await measureCard(locator);
    const mine = proto['种公推荐卡'];
    record('种公推荐卡', '宽', live.card.w, mine.card.w);
    record('种公推荐卡', '高', live.card.h, mine.card.h);
    record('种公推荐卡', '头像高', live.avatar.h, mine.avatar.h);
    record('种公推荐卡', '名字高', live.name.h, mine.name.h);
    record('种公推荐卡', '名字字号', parseFloat(live.nameFont), parseFloat(mine.nameFont));
    record('种公推荐卡', '圆角', live.radius, mine.radius);
  }

  /* ---------------- 缺口卡：切到「母本缺口」 ---------------- */
  const tab = page.getByRole('button', { name: '母本缺口', exact: true }).first();
  if (await tab.count()) {
    await tab.click();
    await page.waitForTimeout(1200);
    const gap = page.locator('[data-testid="mother-action-item"] article').first();
    if (await gap.count()) {
      const live = await measureCard(gap);
      const mine = proto['缺口卡'];
      record('缺口卡', '宽', live.card.w, mine.card.w);
      record('缺口卡', '高', live.card.h, mine.card.h);
      record('缺口卡', '头像高', live.avatar.h, mine.avatar.h);
      record('缺口卡', '名字高', live.name.h, mine.name.h);
      record('缺口卡', '名字字号', parseFloat(live.nameFont), parseFloat(mine.nameFont));
    }
  }
  await ctx.close();
}

/* ---------------- 母本卡：收集页 ---------------- */
{
  const { ctx, page } = await livePage('collection');
  const locator = page.locator('main article').first();
  if (await locator.count()) {
    const live = await measureCard(locator);
    const mine = proto['母本卡'];
    record('母本卡', '宽', live.card.w, mine.card.w);
    record('母本卡', '高', live.card.h, mine.card.h);
    record('母本卡', '头像高', live.avatar.h, mine.avatar.h);
    record('母本卡', '名字高', live.name.h, mine.name.h);
    record('母本卡', '名字字号', parseFloat(live.nameFont), parseFloat(mine.nameFont));
    record('母本卡', '圆角', live.radius, mine.radius);
    record('母本卡', '描边', live.border, mine.border);
  }
  await ctx.close();
}

/* ---------------- 需求卡：小组页（窄容器，只比与宽度无关的量） ---------------- */
{
  const { ctx, page } = await livePage('swap');
  const locator = page.locator('button[data-demand-id]').first();
  if (await locator.count()) {
    const live = await measureCard(locator);
    const mine = proto['需求卡'];
    record('需求卡', '头像高', live.avatar.h, mine.avatar.h);
    record('需求卡', '名字高', live.name.h, mine.name.h);
    record('需求卡', '名字字号', parseFloat(live.nameFont), parseFloat(mine.nameFont));
    record('需求卡', '状态条高', live.status.h, mine.status.h);
    record('需求卡', '圆角', live.radius, mine.radius);
    record('需求卡', '描边', live.border, mine.border);
  }
  await ctx.close();
}

await browser.close();

let bad = 0;
console.log('卡片尺寸对账（设计稿 vs 线上真卡，375 宽，允许 ±1px）');
console.log('─'.repeat(70));
for (const r of results) {
  if (!r.ok) bad += 1;
  const line = `${r.ok ? '✅' : '❌'} ${r.kind.padEnd(8)} ${r.field.padEnd(6)} 线上 ${String(r.live).padStart(6)}  设计稿 ${String(r.proto).padStart(6)}`;
  console.log(r.skipped ? `${line}  （无对应元素，跳过）` : line);
}
console.log('─'.repeat(70));
const checked = results.filter((r) => !r.skipped).length;
console.log(
  `共 ${checked} 条：一致 ${checked - bad}，不一致 ${bad}` + (results.length - checked ? `，跳过 ${results.length - checked}` : ''),
);
process.exit(bad ? 1 : 0);

