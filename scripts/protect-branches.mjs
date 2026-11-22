#!/usr/bin/env node
// 给 test / release 分支上保护：Require PR + Require verify + 禁 force-push + 禁删分支。
// 规则说明见 docs/协作与合并规则.md §5。
//
// 用法（需要对该仓库有 admin 权限的 token，classic 带 repo scope 或 fine-grained 带
// Administration: read/write）：
//   GITHUB_TOKEN=xxx node scripts/protect-branches.mjs
//   GITHUB_TOKEN=xxx node scripts/protect-branches.mjs --dry-run   # 只打印将提交的配置
//
// 幂等：重复跑就是覆盖成这套配置。先 dry-run 看清楚再真跑。

const OWNER = process.env.REPO_OWNER ?? 'sasaki-ishiran';
const REPO = process.env.REPO_NAME ?? 'roco-toolbox';
const TOKEN = process.env.GITHUB_TOKEN;
const DRY = process.argv.includes('--dry-run');

/** @type {{branch: string, checks: string[], note: string}[]} */
const TARGETS = [
  {
    branch: 'test',
    checks: ['verify', 'pr-size'],
    note: '日常集成分支：PR 必过 verify 与粒度检查',
  },
  {
    branch: 'release',
    checks: ['verify'],
    note: '发版通道（默认分支）：更要防强推与直推',
  },
];

function payload({ checks }) {
  return {
    required_status_checks: { strict: true, contexts: checks },
    enforce_admins: true, // 不开这项，admin 自己仍能强推
    required_pull_request_reviews: {
      dismiss_stale_reviews: true,
      require_code_owner_reviews: true, // 让 CODEOWNERS 真正生效
      required_approving_review_count: 1,
    },
    restrictions: null,
    required_conversation_resolution: true,
    allow_force_pushes: false,
    allow_deletions: false,
    block_creations: false,
    required_linear_history: false,
  };
}

async function main() {
  for (const t of TARGETS) {
    const body = payload(t);
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/branches/${t.branch}/protection`;
    console.log(`\n== ${t.branch} — ${t.note}\n   PUT ${url}`);
    console.log('   ' + JSON.stringify(body));

    if (DRY) continue;
    if (!TOKEN) {
      console.error('缺少 GITHUB_TOKEN；先加 --dry-run 看配置，或带上 token 重跑。');
      process.exit(1);
    }

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        'User-Agent': 'roco-toolbox-protect-branches',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`   ✗ ${res.status} ${text.slice(0, 500)}`);
      // 404/403 多半是 token 权限不够或不是 admin；清空旧 status checks 也会 422
      process.exitCode = 1;
      continue;
    }
    const json = await res.json();
    console.log(`   ✓ 已生效：required=${json.required_status_checks?.contexts?.join(',')} ` +
      `admins=${json.enforce_admins?.enabled} force=${json.allow_force_pushes?.enabled} ` +
      `delete=${json.allow_deletions?.enabled}`);
  }

  if (DRY) console.log('\n(dry-run，没有发出任何请求)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
