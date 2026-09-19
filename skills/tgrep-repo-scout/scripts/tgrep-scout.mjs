#!/usr/bin/env node
// No dependencies, shell evaluation, persistent state, or automatic setup.
import { spawnSync } from 'node:child_process';
import { realpathSync, statSync, accessSync, constants } from 'node:fs';
import { resolve, relative, isAbsolute, sep } from 'node:path';

const HELP = `tgrep-scout (Node.js >=20, Microsoft tgrep)
  doctor --repo PATH [--index-path PATH] [--json]
  search --repo PATH (--literal TEXT | --regex TEXT) [options]

Search options:
  --files-only           Return filenames (default: matching lines)
  --file PATH            Scope to a file/directory inside repo (repeatable)
  --glob GLOB            Filter eligible paths (repeatable)
  --type TYPE            tgrep language type (repeatable)
  --context N           Context lines, 0..20 (default: 2)
  --fresh               Bypass index; normal ignore rules still apply
  --hidden              Include hidden, non-ignored files
  --no-require-git       Apply .gitignore outside Git repositories
  --index-path PATH     Use an existing custom index
  --max-records N        Returned files/line records, 1..1000 (default: 80)
  --timeout-ms N         Process timeout, 100..120000 (default: 15000)
  --json                Structured result, including errors and warnings

Exit codes: 0 success/matches, 1 no matches, 2 error/incomplete results.
Output capture is capped at 1 MiB; narrow scope after truncation.
Use --literal=VALUE when VALUE starts with --. Never evaluates shell text.
`;

function parse(argv) {
  const command = argv.shift();
  if (!command || command === '--help' || command === 'help') return { help: true };
  if (!['doctor', 'search'].includes(command)) throw Error(`Unknown command: ${command}`);
  const flags = new Set(['json', 'files-only', 'fresh', 'hidden', 'no-require-git']);
  const values = new Set(['repo', 'literal', 'regex', 'file', 'glob', 'type', 'context', 'max-records', 'timeout-ms', 'index-path']);
  const multi = new Set(['file', 'glob', 'type']);
  const o = { command };
  for (let i = 0; i < argv.length; i++) {
    const m = /^--([^=]+)(?:=(.*))?$/s.exec(argv[i]);
    if (!m || (!flags.has(m[1]) && !values.has(m[1]))) throw Error(`Unknown option: ${argv[i]}`);
    const [, key, inline] = m;
    if (Object.hasOwn(o, key) && !multi.has(key)) throw Error(`Duplicate --${key}`);
    if (flags.has(key)) {
      if (inline !== undefined) throw Error(`--${key} takes no value`);
      o[key] = true;
    } else {
      const value = inline ?? argv[++i];
      if (value === undefined || (inline === undefined && value.startsWith('--'))) throw Error(`Missing value for --${key}; use --${key}=VALUE for leading --`);
      if (multi.has(key)) (o[key] ??= []).push(value);
      else o[key] = value;
    }
  }
  if (command === 'doctor') {
    for (const key of Object.keys(o)) if (!['command', 'repo', 'json', 'index-path', 'timeout-ms'].includes(key)) throw Error(`doctor does not accept --${key}`);
  } else if (Object.hasOwn(o, 'literal') === Object.hasOwn(o, 'regex')) {
    throw Error('Supply exactly one of --literal or --regex');
  }
  for (const [key, fallback, min, max] of [['context', 2, 0, 20], ['max-records', 80, 1, 1000], ['timeout-ms', 15000, 100, 120000]]) {
    const raw = o[key] ?? String(fallback);
    if (!/^\d+$/.test(raw) || Number(raw) < min || Number(raw) > max) throw Error(`--${key} must be ${min}..${max}`);
    o[key] = Number(raw);
  }
  if (o.literal === '' || o.regex === '') throw Error('Empty searches are not useful; supply a nonempty pattern');
  return o;
}

function run(executable, args, cwd, timeout) {
  const r = spawnSync(executable, args, { cwd, encoding: 'utf8', shell: false, timeout, maxBuffer: 1024 * 1024, windowsHide: true });
  return { exitCode: r.status, signal: r.signal, stdout: r.stdout ?? '', stderr: r.stderr ?? '', error: r.error?.code ?? null };
}

function scopedPath(repo, input) {
  const path = realpathSync(resolve(repo, input));
  const rel = relative(repo, path);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) throw Error(`Scope escapes repository: ${input}`);
  return path;
}

function execute(o) {
  const repo = realpathSync(resolve(o.repo ?? '.'));
  if (!statSync(repo).isDirectory()) throw Error('Repository must be a directory');
  accessSync(repo, constants.R_OK | constants.X_OK);
  const index = o['index-path'] ? ['--index-path', resolve(o['index-path'])] : [];
  if (o.command === 'doctor') {
    const version = run('tgrep', ['--version'], repo, o['timeout-ms']);
    const available = version.exitCode === 0 && !version.error;
    const git = run('git', ['rev-parse', '--is-inside-work-tree'], repo, o['timeout-ms']);
    const status = available ? run('tgrep', ['status', repo, ...index], repo, o['timeout-ms']) : null;
    return { ok: available, exitCode: available ? 0 : 2,
      repository: { path: repo, readable: true, git: git.error ? null : git.exitCode === 0 && git.stdout.trim() === 'true' },
      tgrep: { available, version: version.stdout.trim(), diagnostic: version.error || version.stderr || null },
      // Keep upstream status verbatim: a successful command does not mean an index exists.
      search: { status, freshness: 'unknown', note: 'Status is diagnostic only, not proof of freshness. Searches work without an index.' } };
  }
  const scope = (o.file ?? ['.']).map(p => scopedPath(repo, p));
  const args = o['files-only'] ? ['-l', '-0'] : ['--json', '-n', '-C', String(o.context)];
  if (Object.hasOwn(o, 'literal')) args.push('-F');
  if (o.fresh) args.push('--no-index');
  if (o.hidden) args.push('--hidden');
  if (o['no-require-git']) args.push('--no-require-git');
  for (const [key, flag] of [['glob', '-g'], ['type', '-t']]) for (const value of o[key] ?? []) args.push(flag, value);
  args.push(...index, '--', o.literal ?? o.regex, ...scope);
  const result = run('tgrep', args, repo, o['timeout-ms']);
  const failed = !!result.error || ![0, 1].includes(result.exitCode);
  const base = { ok: !failed, exitCode: failed ? 2 : result.exitCode,
    query: { pattern: o.literal ?? o.regex, mode: Object.hasOwn(o, 'literal') ? 'literal' : 'regex', repo, scope, freshness: o.fresh ? 'filesystem' : 'automatic' },
    invocation: { executable: 'tgrep', args }, stderr: result.stderr,
    error: result.error, signal: result.signal, truncated: !!result.error, complete: !failed };
  // Never misrepresent a partial capture as an exhaustive search or a no-match.
  if (failed) return { ...base, records: [], next: 'Inspect stderr; narrow scope if output or time limits were exceeded.' };
  let records;
  if (o['files-only']) records = result.stdout.split('\0').filter(Boolean).map(file => ({ file }));
  else records = result.stdout.split('\n').filter(Boolean).map(line => JSON.parse(line))
    .filter(r => r.type === 'match' || r.type === 'context')
    .map(r => ({ kind: r.type, file: r.data.path.text ?? null, pathBytes: r.data.path.bytes,
      line: r.data.line_number, text: r.data.lines.text ?? null }));
  const truncated = records.length > o['max-records'];
  return { ...base, ok: !truncated, exitCode: truncated ? 2 : result.exitCode,
    truncated, complete: !truncated, records: records.slice(0, o['max-records']),
    metrics: { searchCount: 1, returnedRecords: Math.min(records.length, o['max-records']), capturedRecords: records.length },
    ...(truncated ? { next: 'Narrow directory, file, glob, or identifier before drawing conclusions.' } : {}) };
}

try {
  const o = parse(process.argv.slice(2));
  if (o.help) console.log(HELP);
  else {
    const result = execute(o);
    if (o.json || o.command === 'doctor') console.log(JSON.stringify(result, null, 2));
    else {
      for (const r of result.records ?? []) console.log(r.line == null ? r.file : `${r.file}:${r.line}:${(r.text ?? '').trimEnd()}`);
      if (result.stderr) process.stderr.write(result.stderr);
      if (result.error || result.next) console.error(result.error ?? '', result.next ?? '');
    }
    process.exitCode = result.exitCode;
  }
} catch (error) {
  console.log(JSON.stringify({ ok: false, exitCode: 2, complete: false, error: error.message }));
  process.exitCode = 2;
}
