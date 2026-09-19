import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const script = fileURLToPath(new URL('../skills/tgrep-repo-scout/scripts/tgrep-scout.mjs', import.meta.url));
test('real tgrep: discover, trace, filters, no-match, regex, freshness, no writes', { skip: process.env.SCOUT_INTEGRATION !== '1' }, t => {
  const root = mkdtempSync(join(tmpdir(), 'scout-real-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const repo = join(root, 'repo'); mkdirSync(repo); mkdirSync(join(repo, 'src'));
  writeFileSync(join(repo, 'src', 'route.ts'), 'router.post("/password/reset", resetPassword);\nfunction resetPassword(token) {\n  return validateResetToken(token);\n}\n');
  writeFileSync(join(repo, 'src', 'reset.ts'), 'export function validateResetToken(token) {\n  if (token.expired) throw Error("expired reset token");\n  return true;\n}\n');
  writeFileSync(join(repo, 'src', 'reset.test.ts'), 'test("reject expiry", () => expect(() => validateResetToken(expired)).toThrow("expired reset token"));\n');
  writeFileSync(join(repo, '.env.example'), 'RESET_TIMEOUT=60\n');
  writeFileSync(join(repo, '.gitignore'), 'ignored.ts\n');
  writeFileSync(join(repo, 'ignored.ts'), 'validateResetToken\n');
  function call(...args) {
    const r = spawnSync(process.execPath, [script, ...args, '--repo', repo, '--json'], { encoding: 'utf8' });
    return { code: r.status, data: JSON.parse(r.stdout) };
  }
  assert.equal(call('doctor').data.tgrep.available, true);
  const files = call('search', '--literal', 'validateResetToken', '--files-only', '--no-require-git');
  assert.equal(files.code, 0); assert.equal(files.data.records.length, 3);
  const trace = call('search', '--literal', 'validateResetToken', '--file', 'src/route.ts', '--context', '0');
  assert.equal(trace.code, 0); assert.equal(trace.data.records[0].line, 3); assert.match(trace.data.records[0].text, /return validate/);
  assert.equal(call('search', '--literal', 'absent').code, 1);
  assert.equal(call('search', '--regex', '[').code, 2);
  assert.equal(call('search', '--literal', 'RESET_TIMEOUT').code, 1);
  assert.equal(call('search', '--literal', 'RESET_TIMEOUT', '--hidden').code, 0);
  assert.equal(call('search', '--literal', 'validateResetToken', '--files-only', '--glob', '*test.ts').data.records.length, 1);
  assert.equal(call('search', '--literal', 'validateResetToken', '--max-records', '1').data.truncated, true);
  assert.equal(existsSync(join(repo, '.tgrep')), false);
  // Explicit indexing is confined to this disposable fixture, never the user's repo.
  const idx = spawnSync('tgrep', ['index', repo, '--no-require-git'], { encoding: 'utf8' });
  assert.equal(idx.status, 0, idx.stderr);
  writeFileSync(join(repo, 'src', 'new.ts'), 'BrandNewResetSymbol\n');
  assert.equal(call('search', '--literal', 'BrandNewResetSymbol', '--no-require-git').code, 1);
  const fresh = call('search', '--literal', 'BrandNewResetSymbol', '--fresh', '--no-require-git');
  assert.equal(fresh.code, 0); assert.equal(fresh.data.records[0].line, 1);
  assert.equal(fresh.data.query.freshness, 'filesystem');
});
