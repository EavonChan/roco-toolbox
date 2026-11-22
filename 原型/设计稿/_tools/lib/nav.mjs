/**
 * 截图脚本的公共底座：基准 origin、页面清单、关闭浮层、建上下文。
 *
 * 为什么单独抽出来：`capture-baseline` / `capture-logged-in` / 以后的对账脚本
 * 必须用同一套导航路径，否则「同一次发版的两个状态」会截出不一样的东西。
 *
 * 基准 origin：默认取 test（2026-11-22 起测试站是最新构建，正式站落后一个版本）。
 * 想回到正式站：`--base https://roco-toolbox.pages.dev`。
 */

export const DEFAULT_BASE = 'https://test.roco-toolbox.pages.dev';

/** 解析 --base，并去掉末尾斜杠。 */
export function resolveBase(argv = process.argv.slice(2)) {
  const i = argv.indexOf('--base');
  const raw = i >= 0 ? argv[i + 1] : DEFAULT_BASE;
  return raw.replace(/\/+$/, '');
}

/**
 * 页面清单（2026-11-22 新导航：看板 / 家园 / 收集 / 换蛋 / 我的）。
 *
 * `steps` 是人类路径：先点哪个页签、再点页内哪个按钮。
 * 页签文案用 label（线上文案），文件名用 id（ASCII，便于脚本与排序）。
 * 「附近」「小组」已经不是页签了，降级成「我的 · 游戏数据」与「我的 · 小组」的入口。
 */
export const PAGES = [
  { id: 'dashboard', label: '看板', steps: [{ tab: '看板' }] },
  { id: 'home', label: '家园', steps: [{ tab: '家园' }] },
  { id: 'collection', label: '收集', steps: [{ tab: '收集' }] },
  { id: 'swap', label: '换蛋', note: '代码里 page=groups，界面上叫换蛋', steps: [{ tab: '换蛋' }] },
  { id: 'profile-data', label: '我的 · 游戏数据', steps: [{ tab: '我的' }, { role: '游戏数据' }] },
  { id: 'profile-nearby', label: '我的 · 附近', steps: [{ tab: '我的' }, { role: '游戏数据' }, { role: '附近' }] },
  { id: 'profile-identity', label: '我的 · 我的身份', steps: [{ tab: '我的' }, { role: '我的身份' }] },
  { id: 'profile-groups', label: '我的 · 小组', steps: [{ tab: '我的' }, { role: '小组' }] },
];

/** 手机上下文（375×812 / 390×844），真机 SDK 之外的参数一律照抄线上验收口径。 */
export function mobileContext(browser, width, extra = {}) {
  return browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 812 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    userAgent:
      'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    ...extra,
  });
}

/** 关掉新手引导 / 更新日志。分段引导每进一页弹一次，所以每换一页都要重清。 */
export async function dismissOverlays(page, log = () => {}) {
  for (let i = 0; i < 8; i += 1) {
    let clicked = false;
    for (const text of ['跳过', '知道了']) {
      const btn = page.getByRole('button', { name: text, exact: true }).first();
      if ((await btn.count()) && (await btn.isVisible().catch(() => false))) {
        await btn.click({ timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(350);
        log(`关闭浮层：${text}`);
        clicked = true;
        break;
      }
    }
    if (!clicked) break;
  }
}

/** 按 steps 走到目标页；每步都先清浮层，避免引导挡住下一步的按钮。 */
export async function gotoPage(page, target, log = () => {}) {
  for (const step of target.steps) {
    if (step.tab) {
      await page.getByRole('button', { name: step.tab, exact: true }).first().click();
    } else if (step.role) {
      await page.getByRole('button', { name: step.role, exact: true }).first().click();
    }
    await page.waitForTimeout(1200);
    await dismissOverlays(page, log);
  }
}

/**
 * 等页面「真的画完」：小组/家园的数据是登录后从云端异步拉的，
 * 截图前必须等「正在读取…」消失，再滚一遍触发懒加载图片，否则截到半截骨架。
 */
export async function settlePage(page, log = () => {}) {
  await page
    .waitForFunction(() => !(document.body.innerText || '').includes('正在读取'), { timeout: 15000 })
    .catch(() => log('⚠ 仍有「正在读取…」未消失'));
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(900);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  await page
    .waitForFunction(() => [...document.querySelectorAll('img')].every((i) => i.complete), { timeout: 15000 })
    .catch(() => {});
}
