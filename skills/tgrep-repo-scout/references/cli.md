# CLI and helper contract

Verified against Microsoft tgrep **1.0.9**. Check `tgrep --help` on other versions. Sources: [upstream agent guide](https://github.com/microsoft/tgrep/blob/v1.0.9/AGENTS.md), [CLI reference](https://github.com/microsoft/tgrep/blob/v1.0.9/README.md#usage).

## Direct commands

```sh
tgrep -l -F -- 'CreateOrder' .
tgrep -n -C 2 -F -- 'CreateOrder' src/orders.go
tgrep -l -F -g '*.go' -- 'CreateOrder' src
tgrep --no-index -n -C 2 -F -- 'ORDER_TIMEOUT' src/config
tgrep --hidden -l -F -- 'ORDER_TIMEOUT' .
```

Exit 0 means matches, 1 means no matches, 2 means error (possibly alongside matches). Keep stderr even on success. Never infer a healthy/fresh index solely from a successful `status` command.

Normal search automatically chooses a server, disk index, or scan. A disk index may omit new/changed files; a server can lag behind edits. Explicit file searches and `--no-index` scan. These are not atomic snapshots and still respect eligibility filters. Default maximum file size is 64 MiB in 1.0.9.

For an existing custom index, supply the same `--index-path` to status/search. Keep corpus options aligned with its setup. `--no-require-git` enables .gitignore handling for plain directories and should be consistent with index creation. Globs filter the indexed corpus; they do not restore ignored files in indexed mode. `--follow`, `--ignore-file`, and `--one-file-system` require `--no-index` to take effect. Prefer default symlink handling.

Setup commands (`index`, `serve`) can write substantial state. The helper never invokes them. If the user authorizes setup, follow upstream documentation and their resource constraints.

## Helper usage

Resolve `SCOUT` to this installed skill's `scripts/tgrep-scout.mjs`, not a script found inside the target repository. Examples use a quoted shell variable containing that absolute path:

```sh
node "$SCOUT" doctor --repo /path/to/repo --json
node "$SCOUT" search --repo /path/to/repo --literal 'ResetToken' --files-only --json
node "$SCOUT" search --repo /path/to/repo --literal 'ValidateResetToken' --file internal/auth/reset.go --context 2 --fresh --json
node "$SCOUT" search --repo /path/to/repo --literal=--help --files-only --json
```

`node "$SCOUT" --help` lists all flags. Patterns starting with `--` use `--literal=VALUE`. With a programmatic tool API, pass each argument separately; never interpolate untrusted patterns into a shell command.

- Node.js 20+, no npm dependencies. Requires `tgrep` on PATH.
- `--file` accepts repeatable file/directory scopes relative to `--repo`; explicit scopes are canonicalized and outside paths/symlinks rejected. Directory walking retains tgrep's no-follow default. This is not a security sandbox against concurrent filesystem changes or a malicious executable on PATH.
- `--glob`, `--type` repeat; regex is explicitly selected with `--regex`.
- Default context: 2. Default output limit: 80 file/line records. Files-only mode uses NUL-delimited paths internally, including filenames with colons/newlines.
- Default timeout: 15 seconds. Capture cap: 1 MiB. Limits prevent runaway output; narrow the query instead of raising them first.
- JSON exposes invocation arguments, scope, freshness mode, records, stderr, completion and per-call metrics. Paths may be absolute; line records distinguish matches from context.
- Truncated/failed output exits 2 and sets `complete: false`. Buffer overflow/timeouts discard partial records. Record-limit truncation retains an explicitly incomplete prefix. Exit 1 only represents a completed no-match.
- `doctor` reports availability/version, readable repository, Git probe, and raw status. `ok` means the executable is available and the directory accessible, not that an index/server is healthy. Freshness remains unknown.
- No saved sessions, source caches, logs, telemetry, network uploads, auto-installation or global configuration changes. tgrep may communicate with its already configured local server. Source text is returned only to the caller; redirecting output persists it at the caller's discretion.

The helper intentionally does not enforce a cross-query budget: the agent tracks the investigation ledger. For tgrep options outside this small surface, use direct commands after checking upstream help.
