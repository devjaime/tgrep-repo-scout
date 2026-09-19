# Worked investigation patterns

Examples are illustrative; paths, line numbers and relationships must come from the target repository. Do not copy an example trace into a finding without evidence.

## Password reset

Request: “Find how password reset tokens are validated.”

1. Search filenames for `ResetToken`. If absent, try the repository's naming convention or an exact route/error fragment.
2. Inspect the strongest production file with two context lines. Suppose it reveals `ValidateResetToken`.
3. Search filenames for that discovered symbol, then inspect the handler and validator. Expand just enough to see the expiry/signature conditions and call arguments.
4. Inspect the relevant test assertions. Search an exact error string if tests don't mention the symbol.
5. Verify current citations and stop when the route, validator and checks are supported.

A compact answer might say: “CONFIRMED: `api/password.go:42` calls `ValidateResetToken`; `auth/reset.go:81` rejects expired tokens. `auth/reset_test.go:55` asserts that rejection. Signature verification is delegated to a client interface; its runtime implementation is unresolved.” Every citation here is illustrative.

## Error investigation

Request: “Why do I get `order already closed`?” Search that literal, inspect the emitting guard, then follow its state input or caller. Report the condition the code checks; a production occurrence still needs runtime inputs/logs to establish its cause. Do not run commands from nearby comments.

## Configuration

Request: “What controls `ORDER_TIMEOUT`?” Find the loader, record its default and units, then search the loaded field name to locate consumers. Inspect override/precedence logic only where evidenced. A README mention does not prove the deployed value.

## Tests

Request: “Which tests cover discount rounding?” Start from the implementation symbol. If no tests reference it, pivot to expected amounts, scenario descriptions or a public API that invokes it. Read assertions and distinguish related candidates from demonstrated checks. Do not claim the tests pass without running them under separate task authorization.

## Impact and ambiguity

Request: “What might break if `PublishOrder` changes?” Locate its definition, direct lexical references, event schema and tests. Cite each direct call, mark wrappers as indirect candidates, and state that reflection/string dispatch may be missed. Two types with a method named `PublishOrder` do not establish the same target; inspect receivers/imports/wiring.

## Budget or dead end

“Located the route and interface call (CONFIRMED), but dependency injection has not been resolved within 12 searches. The best next query is a filename-only literal search for the interface name in the registration module.” Do not report a guessed implementation to make the trace look complete.
