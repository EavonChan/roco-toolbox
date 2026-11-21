import assert from 'node:assert/strict';
import { pbkdf2Sync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createServer } from 'vite';

test('legacy password upgrades on login; change keeps only the current token', async () => {
  const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' });
  const sqlite = new DatabaseSync(':memory:');
  try {
    const auth = await server.ssrLoadModule('/functions/_lib/auth.ts');
    const { authenticate } = await server.ssrLoadModule('/functions/_lib/util.ts');
    sqlite.exec(readFileSync('functions/schema.sql', 'utf8'));
    const prepare = (sql) => {
      let args = [];
      const statement = {
        bind(...values) { args = values; return statement; },
        async first() { return sqlite.prepare(sql).get(...args) ?? null; },
        async run() { return { meta: { changes: Number(sqlite.prepare(sql).run(...args).changes) } }; },
      };
      return statement;
    };
    const env = { DB: { prepare, async batch(statements) {
      sqlite.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    } } };
    const password = 'old-fixture-password';
    const salt = Buffer.alloc(16, 2);
    const hash = pbkdf2Sync(password, salt, 10_000, 32, 'sha256');
    sqlite.prepare(`INSERT INTO accounts (id, created_at, last_seen_at, recovery_hash, username, username_lower, password_hash)
      VALUES ('a', 1, 1, 'keep-recovery', 'fixture', 'fixture', ?)`).run(`pbkdf2$10000$${salt.toString('hex')}$${hash.toString('hex')}`);
    const request = (body, token) => new Request('https://fixture.local/api/auth', {
      method: 'POST', body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    });
    const login = (value) => auth.handleLogin(request({ username: 'fixture', password: value }), env, null);
    const first = await login(password);
    assert.equal(first.status, 200);
    const { token: current } = await first.json();
    const account = () => sqlite.prepare("SELECT password_hash, recovery_hash FROM accounts WHERE id = 'a'").get();
    assert.match(account().password_hash, /^pbkdf2\$100000\$/);
    const second = await login(password);
    assert.equal(second.status, 200);
    const { token: other } = await second.json();
    const next = 'new-fixture-password';
    const change = (oldPassword) => auth.handleChangePassword(request({ oldPassword, newPassword: next }, current), env, null);
    assert.equal((await change('wrong-password')).status, 400);
    assert.equal(await authenticate(request({}, current), env), 'a');
    assert.equal(await authenticate(request({}, other), env), 'a');
    assert.equal((await change(password)).status, 200);
    assert.equal(await authenticate(request({}, current), env), 'a');
    assert.equal(await authenticate(request({}, other), env), null);
    assert.equal(account().recovery_hash, 'keep-recovery');
    assert.equal((await login(password)).status, 401);
    assert.equal((await login(next)).status, 200);
  } finally {
    sqlite.close();
    await server.close();
  }
});
