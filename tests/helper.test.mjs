import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const script = fileURLToPath(new URL('../skills/tgrep-repo-scout/scripts/tgrep-scout.mjs', import.meta.url));
function fixture(t, body) {
  const root = mkdtempSync(join(tmpdir(), 'scout-unit-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const repo = join(root, 'repo'); mkdirSync(repo);
  const bin = join(root, 'bin'); mkdirSync(bin);
  // Test doubles are local to this test process; production resolves tgrep on PATH.
  writeFileSync(join(bin, 'tgrep'), `#!${process.execPath}\n${body}`, { mode: 0o755 });
  return { root, repo, bin, call: (...args) => {
    const r = spawnSync(process.execPath, [script, ...args, '--repo', repo, '--json'], { encoding: 'utf8', env: { ...process.env, PATH: bin } });
    return { code: r.status, data: JSON.parse(r.stdout) };
  } };
}
test('missing executable is diagnosed without installing or writing state', t => {
  const f = fixture(t, ''); rmSync(join(f.bin, 'tgrep'));
  const r = f.call('doctor'); assert.equal(r.code, 2); assert.equal(r.data.tgrep.available, false);
  assert.equal(existsSync(join(f.repo, '.tgrep')), false);
});
test('status success is not interpreted as an index or freshness guarantee', t => {
  const f = fixture(t, `console.log(process.argv[2] === '--version' ? 'tgrep 1.0.9' : 'No index found');`);
  const { data, code } = f.call('doctor'); assert.equal(code, 0);
  assert.equal(data.search.freshness, 'unknown'); assert.match(data.search.status.stdout, /No index/);
});
test('untrusted patterns remain one literal argument, after separator', t => {
  const f = fixture(t, `const a=process.argv.slice(2); console.log(JSON.stringify({type:'match',data:{path:{text:'a.go'},line_number:4,lines:{text:JSON.stringify(a)}}}));`);
  const pattern = '--help; $(touch OWNED) `id` "quoted"';
  const { data, code } = f.call('search', `--literal=${pattern}`);
  assert.equal(code, 0);
  const args = JSON.parse(data.records[0].text);
  assert.equal(args[args.indexOf('--') + 1], pattern); assert.ok(args.includes('-F'));
  assert.equal(existsSync(join(f.repo, 'OWNED')), false);
});
test('no matches and backend errors remain distinct, with warnings', t => {
  const f = fixture(t, `console.error('scan warning'); process.exit(process.argv.includes('bad') ? 2 : 1);`);
  const none = f.call('search', '--literal', 'none'); assert.equal(none.code, 1); assert.equal(none.data.complete, true);
  assert.match(none.data.stderr, /scan warning/);
  const bad = f.call('search', '--literal', 'bad'); assert.equal(bad.code, 2); assert.equal(bad.data.complete, false);
});
test('NUL filenames and record truncation are explicit', t => {
  const f = fixture(t, `process.stdout.write('one:two\\nthree.go\\0four.go\\0');`);
  const r = f.call('search', '--literal', 'x', '--files-only', '--max-records', '1');
  assert.equal(r.code, 2); assert.equal(r.data.truncated, true); assert.equal(r.data.records[0].file, 'one:two\nthree.go');
});
test('rejects outside paths including symlink escapes', t => {
  const f = fixture(t, `process.exit(0)`);
  const outside = join(f.root, 'outside'); writeFileSync(outside, 'private');
  symlinkSync(outside, join(f.repo, 'link'));
  for (const file of ['../outside', 'link', outside]) {
    const r = f.call('search', '--literal', 'x', '--file', file);
    assert.equal(r.code, 2); assert.match(r.data.error, /escapes/);
  }
});
test('rejects ambiguous, unsupported or invalid options', t => {
  const f = fixture(t, `process.exit(0)`);
  for (const args of [['--literal', 'x', '--regex', 'x'], ['--literal', ''], ['--literal', 'x', '--context', 'NaN'], ['--literal', 'x', '--fresh=false'], ['--literal', 'x', '--exec', 'id'], ['--literal', 'x', '--repo', 'duplicate']]) {
    assert.equal(f.call('search', ...args).code, 2);
  }
});
test('timeout cannot become a clean no-match', t => {
  const f = fixture(t, `setTimeout(() => {}, 5000);`);
  const r = f.call('search', '--literal', 'x', '--timeout-ms', '100');
  assert.equal(r.code, 2); assert.equal(r.data.complete, false); assert.equal(r.data.error, 'ETIMEDOUT');
});
test('buffer overflow discards incomplete evidence', t => {
  const f = fixture(t, `process.stdout.write('x'.repeat(2 * 1024 * 1024));`);
  const r = f.call('search', '--literal', 'x');
  assert.equal(r.code, 2); assert.equal(r.data.complete, false); assert.deepEqual(r.data.records, []);
});
test('malformed backend JSON produces an explicit error', t => {
  const f = fixture(t, `console.log('not JSON')`);
  const r = f.call('search', '--literal', 'x'); assert.equal(r.code, 2); assert.equal(r.data.complete, false);
});
