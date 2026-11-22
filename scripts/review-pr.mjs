#!/usr/bin/env node
/**
 * review-pr.mjs — 合并前只读预检。
 *
 * 用途：在任何 fork / PR 分支被合并进主线之前，先看清它到底会动什么。
 * 只读：不 fetch、不合并、不改工作区、不联网。
 *
 * 用法：
 *   node scripts/review-pr.mjs <ref> [--base=test] [--max-files=8] [--max-lines=400]
 *                                  [--block-files=30] [--block-lines=1500]
 *
 * 例：
 *   node scripts/review-pr.mjs fd877a1
 *   node scripts/review-pr.mjs eavon/friend/20261119 --base=test
 *
 * 退出码：0 = 通过（可能有提醒）；1 = 阻断；2 = 参数或 git 错误。
 */
import { execFileSync } from "node:child_process";

const RAW = process.argv.slice(2);
const ref = RAW.find((a) => !a.startsWith("--"));

const opts = {
  base: "test",
  maxFiles: 8,
  maxLines: 400,
  blockFiles: 30,
  blockLines: 1500,
};
for (const a of RAW.filter((x) => x.startsWith("--"))) {
  const [k, v] = a.replace(/^--/, "").split("=");
  if (k === "base") opts.base = v;
  else if (k === "max-files") opts.maxFiles = Number(v);
  else if (k === "max-lines") opts.maxLines = Number(v);
  else if (k === "block-files") opts.blockFiles = Number(v);
  else if (k === "block-lines") opts.blockLines = Number(v);
  else {
    console.error(`未知参数：--${k}`);
    process.exit(2);
  }
}

if (!ref) {
  console.error("用法：node scripts/review-pr.mjs <ref> [--base=test]");
  process.exit(2);
}

/** 跑 git，返回 { code, out, err }，不抛异常。 */
function git(args, input) {
  try {
    const out = execFileSync("git", args, {
      encoding: "utf8",
      input,
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 64 * 1024 * 1024,
    });
    return { code: 0, out: out ?? "", err: "" };
  } catch (e) {
    return {
      code: typeof e.status === "number" ? e.status : 1,
      out: (e.stdout ?? "").toString(),
      err: (e.stderr ?? "").toString(),
    };
  }
}

const head = git(["rev-parse", "--verify", `${ref}^{commit}`]);
if (head.code !== 0) {
  console.error(`找不到 ref：${ref}`);
  process.exit(2);
}
const baseSha = git(["rev-parse", "--verify", `${opts.base}^{commit}`]);
if (baseSha.code !== 0) {
  console.error(`找不到 base：${opts.base}`);
  process.exit(2);
}

const short = (s) => s.trim().slice(0, 10);
const headSha = short(head.out);
const baseShort = short(baseSha.out);

// 1) 双向分歧
const lr = git(["rev-list", "--left-right", "--count", `${opts.base}...${ref}`]).out.trim().split(/\s+/);
const onlyBase = Number(lr[0] ?? 0);
const onlyHead = Number(lr[1] ?? 0);

// 2) 合并预演（只看有没有文本冲突）
const merge = git(["merge-tree", "--write-tree", `${opts.base}`, `${ref}`]);
const hasConflict = merge.code !== 0;
const mergeTree = merge.out.split(/\r?\n/)[0]?.trim() ?? "";

// 3) 相对 merge-base 的实际改动（三点，排除 base 自身的提交）
const stat = git(["diff", "--shortstat", `${opts.base}...${ref}`]).out.trim();
const files = git(["diff", "--name-only", `${opts.base}...${ref}`])
  .out.split(/\r?\n/)
  .filter(Boolean);
const nums = stat.match(/(\d+)\s+files?\s+changed(?:,\s+(\d+)\s+insertions?\(\+\))?(?:,\s+(\d+)\s+deletions?\(-\))?/);
const nFiles = nums ? Number(nums[1]) : files.length;
const nAdd = nums && nums[2] ? Number(nums[2]) : 0;
const nDel = nums && nums[3] ? Number(nums[3]) : 0;
const nLines = nAdd + nDel;

// 4) 禁区：这些目录只有主线交付通道能碰
const FORBIDDEN = [/^release\//, /^\.github\//, /^scripts\/deploy/, /^functions\/schema\.sql$/, /^android-shell\/.*\.gradle/];
const forbiddenHits = files.filter((f) => FORBIDDEN.some((re) => re.test(f)));

// 5) 重复补丁（同一改动被重放两次）
const logPatch = git(["log", "-p", "--no-merges", `${opts.base}..${ref}`]);
let dupGroups = 0;
if (logPatch.code === 0 && logPatch.out) {
  const ids = git(["patch-id", "--stable"], logPatch.out).out.split(/\r?\n/).filter(Boolean);
  const seen = new Map();
  for (const line of ids) {
    const [id, sha] = line.trim().split(/\s+/);
    if (!id || !sha) continue;
    if (!seen.has(id)) seen.set(id, []);
    seen.get(id).push(sha.slice(0, 7));
  }
  dupGroups = [...seen.values()].filter((g) => g.length > 1).length;
}

// 6) 结论
const blocks = [];
if (nFiles > opts.blockFiles) blocks.push(`文件数 ${nFiles} > 阻断阈值 ${opts.blockFiles}`);
if (nLines > opts.blockLines) blocks.push(`改动行数 ${nLines} > 阻断阈值 ${opts.blockLines}`);
if (forbiddenHits.length > 0) blocks.push(`命中禁区 ${forbiddenHits.length} 个文件`);

const warns = [];
if (nFiles > opts.maxFiles) warns.push(`超过协议上限（${opts.maxFiles} 文件）`);
if (nLines > opts.maxLines) warns.push(`超过协议上限（${opts.maxLines} 行）`);
if (hasConflict) warns.push("存在文本冲突");
if (dupGroups > 0) warns.push(`含 ${dupGroups} 组重复补丁`);
if (onlyBase > 0) warns.push(`落后 base ${onlyBase} 个提交，需要先 rebase`);

console.log(`PR 预检：${opts.base}(${baseShort}) ← ${ref}(${headSha})`);
console.log(`  分歧：base 独有 ${onlyBase} / head 独有 ${onlyHead}`);
console.log(`  改动：${nFiles} 个文件，+${nAdd} / -${nDel}`);
console.log(`  合并：${hasConflict ? "有文本冲突" : "无文本冲突（注意：无冲突 ≠ 不覆盖）"}${mergeTree ? `  tree=${mergeTree.slice(0, 10)}` : ""}`);
console.log(`  禁区：${forbiddenHits.length ? forbiddenHits.slice(0, 10).join(", ") : "无"}`);
console.log(`  重复补丁：${dupGroups ? `${dupGroups} 组` : "无"}`);

if (blocks.length) {
  console.log(`\n结论：BLOCK — ${blocks.join("；")}`);
  process.exit(1);
}
if (warns.length) {
  console.log(`\n结论：WARN — ${warns.join("；")}（需要人工确认后再合并）`);
  process.exit(0);
}
console.log("\n结论：PASS");
