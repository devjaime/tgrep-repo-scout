# tgrep-repo-scout

**Search less. Understand more.**

An Agent Skill that teaches coding agents how to investigate large repositories with [Microsoft tgrep](https://github.com/microsoft/tgrep): choose useful queries, narrow the search, follow discovered symbols, and stop with file/line evidence.

tgrep gives agents fast indexed search. tgrep-repo-scout teaches them what to search, how to refine it, when to follow symbols, and when to stop.

Ask your coding agent:

> Use tgrep-repo-scout to find how password reset tokens are validated. Trace the entry point, validation checks, and relevant tests.

Instead of opening every authentication file, the agent discovers candidate filenames, inspects small windows, follows the validator into its caller and tests, then reports confirmed relationships and unresolved boundaries.

## Install (skills.sh)

```sh
npx skills add devjaime/tgrep-repo-scout
```

List without installing:

```sh
npx skills add devjaime/tgrep-repo-scout --list
```

From a local checkout:

```sh
npx skills add . --list
npx skills add . --skill tgrep-repo-scout
```

The installer controls agent-specific paths (Claude Code: `.claude/skills/tgrep-repo-scout/`).

Requires [Microsoft tgrep](https://github.com/microsoft/tgrep#installation). The optional helpers require Node.js 20.3+ and no npm dependencies. The skill remains usable with direct tgrep commands. No dependency installation or server startup happens automatically.

## What it does

- Locate implementations, callers, tests, errors and configuration consumers.
- Trace source-level paths with small context windows and explicit evidence categories.
- Identify likely change impact while acknowledging lexical-search limitations.
- Budget the investigation and distinguish stale, absent, failed and truncated results.

It does not supply AST/LSP analysis, prove runtime dispatch, edit target source, upload code, or guarantee complete dependency coverage. Reduced context use is a design goal, not a benchmark result.

## Optional helper

From this checkout (use the installed script's absolute path elsewhere):

```sh
node skills/tgrep-repo-scout/scripts/tgrep-scout.mjs doctor --repo /path/to/repo --json
node skills/tgrep-repo-scout/scripts/tgrep-scout.mjs search --repo /path/to/repo --literal 'ValidateResetToken' --files-only --json
node skills/tgrep-repo-scout/scripts/tgrep-scout.mjs search --repo /path/to/repo --literal 'ValidateResetToken' --file src/auth.ts --fresh --json
```

The search helper invokes tgrep without a shell, validates explicit search scopes, retains diagnostics and bounds output/time. The search helper saves no source snippets or session state; explicit evaluation writes its artifacts to the chosen new directory. The agent tracks the total search budget; the helper limits each invocation. [Full contract and flags](skills/tgrep-repo-scout/references/cli.md).

## Does it work with local models?

An optional command tests whether an installed model can answer three small questions from actual tgrep evidence, using [pudu-task-telemetry](https://www.skills.sh/devjaime/pudu-task-telemetry/pudu-task-telemetry) for inference, verification, latency and token counts. Normal search remains independent of Pudu/Ollama.

Preview the synthetic evidence and requests without running a model:

```sh
npm run eval:local -- --prepare-only --out ./local-eval-preview
```

For a real run, provide the companion script, confirmed local-only server config and installed model name:

```sh
npm run eval:local -- --out ./local-eval-run-01 \
  --pudu-script /absolute/path/to/pudu-task.mjs \
  --config /absolute/path/to/local-config.json \
  --model INSTALLED_MODEL
```

See the [setup, outputs, interpretation and failure guide](skills/tgrep-repo-scout/references/local-models.md). The command uses bundled synthetic code only; it does not read your project. It measures supplied-evidence answers, not autonomous tool use or the improvement caused by this skill. Incorrect responses fail even if inference is fast.

A first real pilot with `gemma3:1b` completed but passed **0/3** exact checks, including an invented runtime target. See [the validation record](VALIDATION.md). This is a useful rejection signal for that configuration, not a universal model ranking.

## Validate

```sh
npm test
npm run test:integration
```

Unit tests use disposable executable stubs. Integration tests require tgrep on PATH and create a temporary fixture/index that is removed afterward. They fail if the required binary is missing. Adapter orchestration tests use a Pudu test double and never perform real inference. Normal unit runs skip integration intentionally.

[Validation record](VALIDATION.md) documents the tested version, environment and limitations. No third-party packages are needed to run the helper or tests. Skills CLI discovery uses the separately maintained `skills` package.

## Publish to skills.sh

Public skills are discovered through installation telemetry after the GitHub repository exists; there is no separate package upload command.

```sh
npx skills add devjaime/tgrep-repo-scout --list
npx skills add devjaime/tgrep-repo-scout
```

`skills.sh.json` customizes the repository page; it does not register or publish the skill. No npm package publication is needed. Listing is not guaranteed by local validation. Packs are created in the [skills.sh UI](https://skills.sh/packs/create), not via GitHub PR.

## Layout

- `skills/tgrep-repo-scout/SKILL.md`: agent workflow and activation description.
- `skills/tgrep-repo-scout/references/`: conditional search guidance, examples, CLI contract and local-model evaluation.
- `skills/tgrep-repo-scout/scripts/tgrep-scout.mjs`: optional diagnostic/search helper.
- `skills/tgrep-repo-scout/scripts/eval-local.mjs`: optional Pudu integration.
- `skills/tgrep-repo-scout/assets/local-eval/`: synthetic evaluation fixtures.
- `tests/`: executable safety, failure, adapter orchestration and real-engine integration checks.

Independent community skill, not affiliated with or endorsed by Microsoft or Vercel. MIT licensed.
