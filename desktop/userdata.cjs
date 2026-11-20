'use strict';

/**
 * userData 目录迁移（2026-11-17；2026-11-19 按真实产物修正旧目录判定）。
 *
 * 产品名从「洛克工具箱」改成「小布助手」后，桌面版顶层 package.json 带上了
 * productName「小布助手」，Electron 的 userData 会从 %APPDATA%\roco-toolbox
 * 变成 %APPDATA%\小布助手。老用户的采集文件、设置、缓存都还在旧目录里，
 * 所以启动时整目录搬一次。
 *
 * 旧目录名按真实产物判定，不再硬编码中文名：
 * - 最近几个版本的打包产物只有 name=roco-toolbox，真实目录就是 roco-toolbox；
 * - 更早版本是否用过「洛克工具箱」无法从仓库静态确认，所以只作为候选，
 *   哪个目录真实存在、且不是当前 userData，就搬哪个。
 *
 * 规则：
 * - 只搬一次：迁完在新目录写标记文件，之后启动直接跳过（不会反复拷贝、不会覆盖新数据）；
 * - 新目录里已经有本应用自己的数据（采集文件 / 设置 / 窗口状态）：不覆盖、不合并，原样跳过；
 * - 先复制到临时目录再逐个搬进新目录：中途失败就把搬过去的删掉，旧目录始终完整；
 * - 新目录里已有同名条目（Chromium 启动时自己建的缓存目录等）直接跳过，不冲突；
 * - 任何异常都不抛出，返回值交给调用方决定是否退回旧目录继续用（不崩）。
 */

const fs = require('node:fs');
const path = require('node:path');

const LEGACY_DIR_NAMES = ['roco-toolbox', '洛克工具箱'];
const MARKER_FILE = '.migrated-userdata';
/** 判断「新目录里是不是已经有用户自己的数据」只看这几个，避免把 Chromium 的缓存目录当成数据 */
const OWN_DATA = ['captures', 'desktop-settings.json', 'window-state.json', 'overlay-state.json'];

function hasOwnData(dir) {
  return OWN_DATA.some((name) => fs.existsSync(path.join(dir, name)));
}

/** 在候选名里找真实存在、且不是当前 userData 的旧目录 */
function findLegacyDir(appData, userData, names) {
  const target = path.resolve(userData);
  for (const name of names) {
    const dir = path.resolve(appData, name);
    if (dir === target) continue;
    try {
      if (fs.statSync(dir).isDirectory()) return dir;
    } catch {
      /* 不存在或不可读：继续看下一个候选 */
    }
  }
  return '';
}

/**
 * @param {{ appData: string, userData: string, legacyNames?: string[] }} options
 * @returns {{ status: 'migrated'|'skipped'|'failed', legacy: string, to?: string, reason?: string, error?: Error }}
 */
function migrateUserData({ appData, userData, legacyNames = LEGACY_DIR_NAMES }) {
  const legacy = findLegacyDir(appData, userData, legacyNames);
  const marker = path.join(userData, MARKER_FILE);
  const skip = (reason) => ({ status: 'skipped', reason, legacy });

  if (fs.existsSync(marker)) return skip('already-migrated');
  if (!legacy) return skip('no-legacy');
  if (hasOwnData(userData)) return skip('target-has-data');

  const staging = `${userData}.migrating`;
  const moved = [];
  let stagingReady = false;
  try {
    fs.rmSync(staging, { recursive: true, force: true });
    fs.mkdirSync(staging, { recursive: true });
    stagingReady = true;
    fs.cpSync(legacy, staging, { recursive: true, force: true, errorOnExist: false });
    fs.mkdirSync(userData, { recursive: true });
    for (const name of fs.readdirSync(staging)) {
      const target = path.join(userData, name);
      // 新目录里已有的同名条目（Chromium 的缓存目录等）保留不动
      if (fs.existsSync(target)) continue;
      fs.renameSync(path.join(staging, name), target);
      moved.push(name);
    }
    fs.writeFileSync(marker, `${new Date().toISOString()} migrated from ${legacy}\n`);
    return { status: 'migrated', legacy, to: userData };
  } catch (error) {
    // 半途失败：把已经搬进新目录的条目撤掉（旧目录里是完整副本），下次启动还能重试
    for (const name of moved.reverse()) {
      try {
        fs.rmSync(path.join(userData, name), { recursive: true, force: true });
      } catch {
        /* 尽力而为：删不掉也不影响旧目录的数据 */
      }
    }
    return { status: 'failed', legacy, error };
  } finally {
    if (stagingReady) {
      try {
        fs.rmSync(staging, { recursive: true, force: true });
      } catch {
        /* 临时目录残留不影响使用 */
      }
    }
  }
}

module.exports = { LEGACY_DIR_NAMES, MARKER_FILE, migrateUserData };
