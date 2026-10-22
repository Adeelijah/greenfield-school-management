# Server report identity bridge behavior

Date: 2026-10-22. Isolated, not route-wired. No database connections or SQL execution occurred in this batch.

## Baseline

The user verified all eight standalone authority PostgreSQL groups, including reverse ordering, parent rollback, assignment changes, truncate denial and cleanup. The main fixture remains verified at 61 groups. Latest explicitly supplied full offline result is 413; the intervening 416-test gate was requested but its full output has not been supplied.

## Behavior tests on actual source

scripts/report-card-identity-behavior.test.mjs imports the actual server bridge and pure authority decoder, strips their TypeScript types, and intercepts only the server-only marker, Drizzle SQL tag, Supabase factory and database factory. These imports are replaced with offline stubs before application dependency evaluation. Unexpected bridge/decoder runtime dependencies reject. Hooks are deregistered and test state removed after the file completes. Existing workspace changes are preserved in the original checkout; an isolated source snapshot was used for local review.

Eleven tests cover verified getUser-before-RPC ordering and a zero-argument RPC, missing/throwing/rejected authentication, RPC errors and ambiguous/foreign identity, frozen branding, refusal of unbranded or JSON-round-tripped identities, locked current role/configuration, parameter intent, suspension/malformed results, teacher assignment scope and cardinality, admin role behavior, no report work after denied authority, and forwarding callback failures to the transaction abstraction. The driver and transaction are stubs: these assertions are not evidence of real SQL serialization or database rollback.

## Request binding correction

A regression test failed on the original bridge: a second transaction lookup could return a different school, school-user or membership under the same auth ID and then authorize work with that replacement. The request entry identity and its later transaction recheck must bind the same principal. resolveReportCardActorInTransaction now rejects schoolId, schoolUserId or membershipId drift. A fresh verified request is required after such a rebind. Current role/status and final Primary year still come from the locked transaction lookup, rather than being frozen to the earlier request snapshot.

The runner therefore refuses report work on a cross-school or principal rebind as well as suspension or missing authority. This improves the unused bridge only; no existing route calls it and no live authentication/authorization configuration changed.

## Verification and next step

All 34 selected authority/decoder/lifecycle/static/bridge tests passed locally; new script syntax and scoped whitespace passed. Eleven new tests raise expected full offline count from 416 to 427 and the allowlist from 55 to 56 files. The full installed TypeScript/ESLint gate remains pending. The tests use Node registerHooks and stripTypeScriptTypes APIs present in the user's Node 22.16 runtime; local execution here used Node 24.19. No runtime or dependency upgrade is proposed. Reference: [Node 22 module APIs](https://nodejs.org/download/release/v22.15.0/docs/api/module.html).

Pull the branch and run node .\\scripts\\verify-offline.mjs. Expected 427 passed. No PostgreSQL rerun is needed solely for this source/mock-test batch: the SQL draft and both database harnesses are unchanged.

Next remains combined source/authority lock ordering and explicit least-privilege runtime role mapping, followed by actual verified-request/complete-authority/report transaction integration in isolation. SDK/driver stubs do not validate real Supabase cookies/JWT/RPC context or applied RLS/grants. Do not enable routes, merge, deploy or touch production based on these offline results.
