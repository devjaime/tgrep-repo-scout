import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const script = fileURLToPath(new URL('../skills/tgrep-repo-scout/scripts/eval-local.mjs', import.meta.url));
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'scout-eval-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return { root, out: join(root, 'run'), call: (...args) => spawnSync(process.execPath, [script, '--out', join(root, 'run'), ...args], { encoding: 'utf8' }) };
}
test('local evaluation refuses implicit model selection without side effects', t => {
  const f = fixture(t); const r = f.call('--model', 'auto');
  assert.equal(r.status, 2); assert.equal(existsSync(f.out), false);
});
test('local-only confirmation is required before preparation/inference', t => {
  const f = fixture(t); const config = join(f.root, 'config.json');
  writeFileSync(config, '{"ollama":{"localOnlyConfirmed":false}}');
  const r = f.call('--pudu-script', script, '--config', config, '--model', 'local');
  assert.equal(r.status, 2); assert.match(r.stderr, /local-only/); assert.equal(existsSync(f.out), false);
});
const integration = { skip: process.env.SCOUT_INTEGRATION !== '1' };
test('prepare uses real evidence and relative manifests without exposing expected answers in prompts', integration, t => {
  const f = fixture(t); const r = f.call('--prepare-only'); assert.equal(r.status, 0, r.stderr);
  for (const id of ['locate', 'config', 'abstain']) {
    const request = JSON.parse(readFileSync(join(f.out, `${id}.request.json`)));
    assert.equal(request.verification.type, 'exact-text');
    assert.ok(request.contextManifest.every(m => !m.path.includes('..') && !m.path.startsWith('/') && m.startLine > 0 && /^[a-f0-9]{64}$/.test(m.sha256)));
    assert.ok(request.messages.every(m => !m.content.split('Source evidence:')[0].includes(request.verification.expected) || id === 'abstain'));
    const bound = request.messages.reduce((n, m) => n + Buffer.byteLength(m.content) + 64, 256);
    assert.ok(bound + request.options.num_predict <= request.options.num_ctx);
  }
  const before = readFileSync(join(f.out, 'suite.json'), 'utf8');
  assert.equal(f.call('--prepare-only').status, 2);
  assert.equal(readFileSync(join(f.out, 'suite.json'), 'utf8'), before);
});
function mockPudu(root, failRuntime = false) {
  const path = join(root, 'pudu.mjs');
  writeFileSync(path, `import fs from 'node:fs'; import path from 'node:path';
const args=process.argv.slice(2), cmd=args[0];
const repo=args[args.indexOf('--repo')+1];
fs.appendFileSync(path.join(repo,'calls.txt'), cmd+'\\n');
if(cmd==='start') console.log(JSON.stringify({taskId:'12345678-1234-1234-1234-123456789abc'}));
else if(cmd==='run-local') {
 if(${failRuntime}) {console.log(JSON.stringify({error:'runtime unavailable'})); process.exit(4);}
 const id=args[args.indexOf('--request-file')+1];
 const passed=!id.startsWith('config');
 console.log(JSON.stringify({attempt:{attemptId:id, status:'completed', verification:{status:passed?'passed':'failed'},metrics:{}}}));
 process.exit(passed?0:6);
} else console.log(JSON.stringify({ok:true}));`);
  const config = join(root, 'config.json'); writeFileSync(config, '{"ollama":{"localOnlyConfirmed":true}}');
  return ['--pudu-script', path, '--config', config, '--model', 'synthetic-test-double'];
}
test('failed exact check remains failed while remaining cases run and task closes', integration, t => {
  const f = fixture(t); const r = f.call(...mockPudu(f.root)); assert.equal(r.status, 6, r.stderr);
  const summary = JSON.parse(readFileSync(join(f.out, 'summary.json')));
  assert.equal(summary.passed, 2); assert.equal(summary.total, 3);
  assert.equal(readFileSync(join(f.out, 'calls.txt'), 'utf8'), 'doctor\nstart\nrun-local\nrun-local\nrun-local\nfinish\nreport\n');
});
test('runtime failure stops without retries, preserves task identity and incomplete state', integration, t => {
  const f = fixture(t); const r = f.call(...mockPudu(f.root, true)); assert.equal(r.status, 2);
  const fail = JSON.parse(readFileSync(join(f.out, 'failure.json')));
  assert.ok(fail.taskId); assert.equal(fail.cases.length, 0);
  assert.equal(existsSync(join(f.out, 'summary.json')), false);
  assert.equal(readFileSync(join(f.out, 'calls.txt'), 'utf8'), 'doctor\nstart\nrun-local\n');
});
