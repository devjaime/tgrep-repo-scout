# Validation record

Validated on 2026-09-19 with macOS arm64, Node.js 22.22.3 and Microsoft tgrep 1.0.9.

The tgrep release binary was downloaded to an isolated temporary validation directory, with SHA-256 checked against the release's checksums.txt. It was added to PATH only for validation commands, not installed globally. Python validation dependencies were also isolated in a temporary virtual environment.

## Completed

| Check | Result |
|---|---|
| Node test suite, integration enabled | 16 passed, 0 failed, 0 skipped |
| Skill creator frontmatter/scaffold validator | Passed |
| skills.sh.json against live official JSON schema | Passed |
| Skills CLI local discovery | Exactly one skill, tgrep-repo-scout |
| Skills CLI installation for Codex in temporary project | Passed; helper and references copied |
| Installed helper against existing upstream repository | Located `scan_skill` at scripts/skillspector_scan.py:121 |
| Existing repository smoke search | Filename discovery and 41 bounded source/context records returned successfully |
| Optional local-model smoke (`gemma3:1b`) | Completed 3/3 inferences; **0/3** exact checks passed |

## Covered behavior

The unit cases cover missing tgrep, status without an index, literal argument safety, no-match versus backend errors, newline-containing filenames, truncation, scope/symlink escape rejection, invalid options, timeout, capture overflow and malformed JSON (some cases exercise multiple behaviors).

The real-engine integration case creates a disposable TypeScript fixture and checks filename discovery, a route-to-validator call with line evidence, test glob filtering, hidden files, ignore rules in a non-Git directory, invalid regex, clean no-match, output limits and absence of automatic index writes. It explicitly creates a temporary index, adds a new symbol, demonstrates the stale-index miss and confirms `--fresh` finds it.

Local-eval adapter tests refuse `--model auto`, refuse unconfirmed local-only config, prepare synthetic evidence without leaking expected answers into prompts, keep failed exact checks failed while remaining cases run, and stop without retries on runtime failure. They use a Pudu CLI test double and never perform real inference.

The installation smoke test uses a temporary project and disables Skills CLI telemetry. It does not alter global agent configuration. Search checks do not modify the existing upstream repository.

## Optional local-model pilot

`eval-local.mjs` plus [pudu-task-telemetry](https://github.com/devjaime/pudu-task-telemetry) ran three synthetic supplied-evidence cases against `gemma3:1b` (Ollama 0.30.11). The run completed and recorded telemetry, but exact-text checks failed: locate answered `line:2` instead of `auth.ts:2`; config did not return the default/value citations; abstain answered `dispatch` instead of `UNKNOWN`.

That result is a rejection signal for that configuration on this tiny suite. It does not rank models, measure autonomous tool use, or prove that this skill improves investigation quality.

## Reproduce

With Node.js 20+ and tgrep 1.0.9 on PATH, from this project:

```sh
npm test
npm run test:integration
npx skills add . --list
```

`npm test` intentionally skips the real-engine and prepare-with-tgrep cases unless `SCOUT_INTEGRATION=1` is set. The integration command above enables them and fails if tgrep is unavailable. Tests currently use POSIX executable fixtures; Windows execution has not been validated.

Local-model inference is optional and is not part of `npm test`. See [local-models.md](skills/tgrep-repo-scout/references/local-models.md).

## Limits and publication status

No comparative agent benchmark, token-saving measurement, independent agent behavior evaluation, live-server test or cross-platform certification was performed. The tests validate the helper and representative retrieval workflows, not universal reasoning quality. Search budgets across queries are maintained by the agent, not persisted/enforced by the helper.

Public GitHub repository: https://github.com/devjaime/tgrep-repo-scout

Remote Skills CLI discovery (`npx skills add devjaime/tgrep-repo-scout --list`) found exactly one skill. skills.sh catalog listing still depends on installation telemetry; it is not created by a separate upload command.
