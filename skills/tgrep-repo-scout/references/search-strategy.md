# Search decisions

| Intent | First anchor | Follow | Stop when |
|---|---|---|---|
| Locate | Exact symbol, route, domain phrase | Definition plus enclosing scope | Relevant implementation is cited |
| Trace | Route, event, public function | Handler → service → persistence/client | Requested path or an unresolved runtime boundary is cited |
| Impact | Definition | Call sites, contracts, config, tests | Direct candidates and coverage limits are explicit |
| Tests | Production symbol | Test assertions, route/error names | Related tests and what they actually assert are cited |
| Config | Environment/config key | Loader → field → consumer → override | Default, consumer and relevant precedence are evidenced |
| Error | Stable message fragment | Throw/log site → guard → callers | Emission condition is explained; runtime cause is not guessed |

## Query ladder

1. Try the strongest exact identifier with `-F` and filename-only output.
2. If absent, try a naming variant informed by repository conventions: `ResetToken`, `resetToken`, `reset_token`.
3. Pivot to an error fragment, route, event, or config key. Natural-language prose is rarely an identifier.
4. Only then broaden a domain term inside a likely directory or language.

After two unproductive variants, change the anchor instead of cycling through synonyms. If a query is noisy, identify a distinctive receiver/type or adjacent argument. Avoid searching generic words such as `Create` across the entire tree.

## Candidate ranking

Inspect a production definition, a caller and a relevant test before documentation copies. Prefer the module corresponding to the user's route or domain. Generated clients can identify a contract, but trace to authored registration/implementation before claiming ownership. Do not universally exclude vendor/generated code if the task concerns it.

## Edge ledger

Keep compact working notes: `caller → relation → target | file:line | evidence category`.
Record a call only when the caller text supports it. To connect an interface to an implementation, inspect imports, construction, registration or configuration. Name similarity alone remains POSSIBLE. Stop at reflection, plugins or external services if lexical evidence cannot resolve them.

## No results and partial results

Inspect exit code and stderr first. For a clean no-match, reconsider spelling/case, scope and eligibility; verify freshness before claiming absence. Hidden files, ignore rules and the default size cap limit the corpus. An error or timeout is not a no-match. Truncated output cannot prove the last matching file, total coverage, or lack of additional callers.

## Budget accounting

Count each query, including no-matches and freshness checks. Count unique files actually inspected separately from discovered filenames. Count returned source/context lines, not JSON formatting lines. Follow at most eight edges initially. A large candidate list is a signal to narrow, not permission to open it all. If extending the initial budget, name the unresolved edge and the small additional allowance. These are investigation checkpoints, not measured performance claims.
