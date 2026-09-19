# Optional local-model evaluation with Pudu

Use this only when the user asks to evaluate local models. Ordinary repository investigation needs neither Pudu nor Ollama.

## What the command measures

`eval-local.mjs` retrieves evidence from four bundled synthetic source files with the normal scout helper, then delegates three bounded text tasks to the installed [pudu-task-telemetry skill](https://www.skills.sh/devjaime/pudu-task-telemetry/pudu-task-telemetry). Pudu performs inference and exact-text verification and records runtime metrics. No Pudu implementation is copied into this skill.

| Case | Check |
|---|---|
| locate | Cite the actual expired-token rejection line |
| config | Extract the default and cite its definition and consumer |
| abstain | Return UNKNOWN when dynamic wiring is not present |

This measures **answering from supplied evidence**, not autonomous search planning, tool calling, whole-repository comprehension or the incremental benefit of loading SKILL.md. The local model receives a compact evidence prompt, not the full skill. Query choices are fixed by the fixture. Three tiny checks cannot certify a model; a fast incorrect response is still a failure.

## Prerequisites

- Node.js >=20.3, Microsoft tgrep on PATH.
- Install the optional companion explicitly: `npx skills add devjaime/pudu-task-telemetry`.
- Locate its installed `scripts/pudu-task.mjs`; pass the actual absolute path. Installation paths vary by agent.
- Pudu AI, a running Ollama server, and an explicitly selected locally installed model. Do not invent model IDs or download one automatically.
- Follow the companion's [setup contract](https://github.com/devjaime/pudu-task-telemetry/blob/main/skills/pudu-task-telemetry/references/setup.md). Confirm **server-side** `OLLAMA_NO_CLOUD=1` (or equivalent server configuration) before setting `localOnlyConfirmed: true`. A client variable or loopback address alone is insufficient. This is the operator's assertion; Pudu also checks local model provenance.

Start with a config stored outside version control:

```json
{
  "ollama": {
    "baseUrl": "http://127.0.0.1:11434",
    "localOnlyConfirmed": false
  }
}
```

After verifying the server setting, set the assertion to true. Use Pudu's `doctor` and `recommend` commands to inspect actual installed model names; hardware grades are not evidence of task accuracy. The adapter refuses `--model auto`.

## Commands

From this repository, prepare requests for inspection without inference:

```sh
npm run eval:local -- --prepare-only --out ./local-eval-preview
```

Run all three checks after configuring dependencies:

```sh
npm run eval:local -- \
  --out ./local-eval-run-01 \
  --pudu-script /absolute/path/to/pudu-task-telemetry/scripts/pudu-task.mjs \
  --config /absolute/path/to/local-config.json \
  --model INSTALLED_MODEL
```

For an installed skill, use `node /absolute/path/to/tgrep-repo-scout/scripts/eval-local.mjs` with the same flags. `INSTALLED_MODEL` is a placeholder. The output directory must not already exist and its parent must exist. Relative CLI paths resolve from the current directory. Run `--help` for the full surface.

The command does not accept a target repository: it reads bundled synthetic fixtures only. It copies them into `OUT/fixture`, retrieves fresh evidence, and stores requests under `OUT`. It does not install dependencies, start services, select models, change host-assistant settings, execute responses or retry failed inference. Preparation itself needs tgrep but not Pudu/Ollama.

## Outputs and failures

- `suite.json`: per-case search count, evidence records and prompt bytes (not tokens).
- `*.request.json`: the exact prompts, generation settings and verification answers. Pudu does not send the verification field as a chat message.
- `task-id.txt`: task identity for audit/recovery.
- `*.response.txt`: raw response, including incorrect outputs.
- `summary.json`: three case results with model digest, runtime version, attempt IDs and Pudu metric provenance.
- `pudu-report.json` and `.pudu-ai/task-telemetry/`: companion report and persisted telemetry.
- `failure.json`: task identity and completed cases when orchestration fails after preparation. Setup/preparation errors can leave an incomplete directory; preserve it for diagnosis and use a new destination for a new run.

Exit **0** means preparation succeeded or all three checks passed; exit **6** means inference completed but at least one exact check failed; exit **2** means setup/runtime/contract failure. Check errors are retained and the remaining cases run. Runtime errors stop the suite without retries or falsely marking it complete. Use Pudu `report`, and `recover` only after the original process has exited if a task remains interrupted; do not remove live locks.

Pudu's exact-text check trims surrounding whitespace; extra explanation, malformed citations, or invented targets fail. Inspect the raw response to distinguish formatting errors from wrong reasoning, without rewriting the recorded verdict. `completed` describes task lifecycle, not correctness.

All calls use temperature 0, seed 42, context 4096, output cap 128, timeout 60 seconds and uncontrolled model load state. End-to-end request latency can include loading; CPU/memory metrics are system-wide. Missing metrics stay unavailable. A `length` stop may explain failure.

For another model/run, use a new output directory and retain all outcomes. Compare identical case prompts, fixture hashes, model/runtime versions and settings. A single run, uncontrolled warm-up and different hardware cannot support a universal ranking, speedup or token-saving claim. Do not use this three-case smoke suite to authorize automatic model selection.

## Compatibility

Validated against companion commit `d7ceddc6e92dfaa300a291c3618630ab99e7f164`, its public CLI/JSON contract, Pudu AI 0.2.18 and Ollama 0.30.11. Unknown contract shapes fail explicitly. The integration calls the companion CLI through Node with argument arrays; no private imports or mandatory npm dependency.

Keep generated run directories and personal config out of Git. This repository ignores `local-eval-*`, `.pudu-ai/` and `*.local.json`; choose another output location deliberately if needed.
