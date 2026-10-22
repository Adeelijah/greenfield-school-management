# Report Card server identity and membership contract

Date: 2026-10-20. Status: isolated source bridge and SQL review draft prepared; not installed, route-wired, or verified against a database or deployed auth/RLS configuration.

## Verified starting point

The user supplied a verified baseline of 393 offline tests and all 59 disposable PostgreSQL groups passing, including generated LOGIN isolation, independent-session submission/approval/publication/revocation, history/replay and exact cleanup. Those results do not authorize a new database connection or SQL execution and do not verify the new authority draft.

The local `report-cards-foundation` working tree was inspected before edits. Existing modified and untracked work was preserved, no environment secrets were read, and no database or SQL was accessed. The current offline gate passed TypeScript, ESLint and 405 tests; its only lint findings are two existing warnings documented in the verification report.

## Existing boundaries found in source

| Source | What it establishes | Limit |
| --- | --- | --- |
| src/server/auth/identity.ts | getVerifiedAuthUser uses Supabase auth.getUser server-side and returns null on returned auth errors | Establishes identity only; does not authorize a school; thrown SDK errors need handling at the future boundary |
| src/server/auth/authorization.ts | getSchoolAccess verifies the user, finds school_users, requires exactly one active membership among up to two visible matches, and resolves its school | Depends on deployed self-only RLS exposing every relevant membership; separate requests are not one locked report transaction |
| src/server/auth/require-school-access.ts | Login/access-pending redirects and allowed-role navigation guard | Useful for page entry; cannot replace transactional command authorization |
| src/lib/academics/report-card-persisted-model-map.ts | Pure mapping requires one matching school user, one active membership, academic role and matching school; placement checks teacher assignment | Requires complete trusted rows; cannot establish authentication or detect rows omitted by RLS |
| src/lib/academics/report-card-postgres-command-context.ts | Fixture command locks discovery gate, exclusive actor anchor, membership and school, then uses the mapper | Accepts a test identity callback; fixed-school RLS does not establish complete actor-wide membership evidence |
| src/lib/academics/report-card-actor-authority.ts | Rejects missing/ambiguous rows, count mismatches, cross-actor results, bursars, inactive status and invalid final Primary year | Pure decoder; cannot establish that SQL returned complete, RLS-unfiltered evidence |
| src/server/auth/report-card-identity.ts | Server-only `getUser()` plus no-argument `resolve_report_card_actor` RPC; branded request identity and a transaction-bound `lock_report_card_actor` recheck | New, not route-wired; requires the unexecuted SQL/grant/RLS proposal and runtime role mapping |

The live school helper permits bursar navigation; the report mapper rejects bursars for academic operations. Preserve this deliberate difference. Authentication user ID, school-user ID and membership ID are distinct and must not be substituted.

## Membership completeness gap

The documented application policy rejects more than one active membership, even when the second belongs to another school. The fixture security plan instead grants a trusted service visibility to one fixed school. Under that role, a query for all memberships of the actor can return only one visible row while another active membership exists outside the service school.

Consequently, exactly one visible row is not proof of exactly one global active membership. The pure decoder now requires explicit complete-scope counts, and a new SQL review draft defines a no-argument RPC deriving identity from `auth.uid()` plus a transaction lock function. Static offline tests check that contract. This closes the source-design gap only: no PostgreSQL function, owner role, policy, grant, trigger, or route has been installed or exercised. Separate-database-per-school deployment is proposed, not verified; it cannot be assumed to make foreign memberships impossible.

Do not solve this by disabling RLS, using the owner/superuser for application commands, trusting a body/cookie school ID, changing the policy to first membership wins, or carrying an earlier getSchoolAccess result as permanent authority.

## Proposed boundary for the next implementation

1. Verify authentication once at the request boundary using the established server SDK helper. Missing identity or verification errors deny before any report data lookup. Accept only command selectors/version/key/reason fields from the client; school, role, assignments and user IDs remain server-derived.
2. Keep page navigation checks separate from command authority. A server-only closure may capture the verified auth ID for the adapter callback; never expose a route accepting a caller-created verifiedIdentity function.
3. Resolve the completeness gap before enabling routes. Preserve the exactly-one-active-membership policy unless an explicit product decision changes it. The review draft at `docs/security/REPORT_CARD_ACTOR_AUTHORITY_REVIEW.sql` proposes an `auth.uid()`-bound no-argument RPC for request verification and a transaction-only lock function. Its non-login function owner has only the narrow table privileges/policies required to count memberships across schools. Review owner-role RLS applicability, grants, search path, lock order, mutation serialization and actual role ownership in an isolated fixture before any execution. Do not grant the school service unrestricted cross-school reads as a shortcut.
4. Bind the resulting active membership to the configured school-service connection; refuse a mismatch before loading a report or academic data. Recheck current role/status and class/session assignment inside the same transaction used for writes and replay. Historical replay still requires current authority.
5. Use the existing gate and actor-anchor ordering for mutations, retaining authority locks through commit. Membership insert/delete/update and assignment changes must coordinate before discovery. Do not upgrade a shared read transaction into a mutation.
6. Preserve optimistic versions, global actor-key serialization across command families, immutable snapshot/release/audit provenance and atomic receipts. Public responses must not expose SQL, credentials, role names or foreign resource existence.

This is a proposal for a narrowly scoped authority mechanism, not approval to install a SECURITY DEFINER function, change live auth, apply production grants or connect to a database. Its implementation must avoid accepting an unverified caller-set session variable as identity.

## Required evidence before server route integration

| Case | Required outcome |
| --- | --- |
| Missing, invalid, expired or throwing auth verification | Deny before report/source reads; safe error response |
| Forged body school, user, membership, role or assignment | Reject unsupported input; no authority derived from it |
| One active academic membership plus suspended historical membership | Resolve the active membership only |
| Two active memberships, including one hidden by school RLS | Deny; demonstrate complete authority evidence rather than one visible row |
| Missing/duplicate school user or mismatched auth linkage | Deny without report reads or writes |
| Bursar, suspended admin, ended/duplicate teacher assignment | Deny inside the command transaction |
| Concurrent membership insertion/suspension or assignment removal | Ordered before discovery or after commit; subsequent command and replay recheck authority |
| Foreign-school report selector | No data disclosure or writes |
| Service login role reset, foreign read or attempted authority-helper misuse | Deny without privilege escalation |
| Same-key retry after rollback and historical replay after correction | Preserve existing exactly-once and current-authority behavior |

A mocked auth callback or successful local PostgreSQL login does not verify real Supabase cookie/JWT handling. That requires a separately isolated integration environment and actual server request tests. No route, UI persistence, guardian portal, production migration or deployment is complete from this review.

## Next work

## Next work

The prior baseline of 393 offline tests and 59 disposable PostgreSQL groups was user-verified. This continuation's offline gate passed TypeScript, ESLint and 405 tests; the isolated PostgreSQL authority harness is syntax-checked but has not run. No database or SQL was accessed.

The pure decoder, server-only identity bridge, review SQL and 12 offline tests are prepared. Before route integration, a separately authorized local disposable PostgreSQL run must verify hidden second memberships and authority changes racing the actor lock. Assignment removal and historical replay after authority loss also require isolated verification. Review the function-owner policies, runtime role mapping, RLS behavior and lock order. Do not wire report routes or claim runtime authority until these gates pass and the proposed security objects are separately reviewed for installation.


## Disposable verification update — 2026-10-22

The user verified the standalone authority harness: hidden second active membership rejection, suspended-history allowance, insertion/suspension serialization and exact cleanup all passed (five groups). The user also verified the full 413-test offline gate. Earlier pending-result notes are historical; live Supabase request authentication, role/policy installation and route wiring remain unverified.

REPORT_CARD_ACCESS_LOSS_REPLAY_REVIEW.md prepares two main harness groups using the actual fixture report writers under the generated LOGIN. They test assignment-removal serialization and denial of historical teacher/admin receipts after authority loss, with no history mutation. Main harness expectation is now 61, pending execution of these additions. These fixture writers still use their original fixture identity context, so this is not proof of the new complete resolver and full writer running together. Writer-first ordering and runtime mapping must be resolved before that integration.


## Verified access-loss gates and statement ordering proposal — 2026-10-22

User verified all 61 main fixture groups, alongside offline 413 and the five standalone authority groups. Historical receipt access-loss behavior is now tested through the restricted full fixture writers, while complete cross-school authority resolution is tested separately.

The SQL review draft adds a shared transaction advisory gate before both authority resolvers read rows and an exclusive BEFORE STATEMENT gate for school_users, memberships, schools and teacher_class_assignments. The previous row-anchor trigger alone could invert actor/membership lock order when an update started first. REPORT_CARD_AUTHORITY_STATEMENT_GATE_REVIEW.md documents the correction, truncate prohibition, conservative contention scope and limitations. Three additional static tests prepare offline 416 and three standalone groups prepare eight PASS groups; these expanded gates remain pending local verification. No SQL was executed here.

Do not wire this to full writers until source-gate/authority-gate ordering and runtime privileges are reviewed together. Explicit row-locking owner transactions, cascades and authority writes inside a shared-gate report transaction require separate handling. No route or real Supabase request integration is enabled by this source proposal.


## Verified statement gates and request principal stability — 2026-10-22

The user verified all eight standalone PostgreSQL groups, including writer-first membership/parent operations, rollback and reader-first assignment guards, plus exact cleanup. Main fixture replay/access-loss coverage remains verified at 61 groups. These remain separate from actual Supabase request integration.

The unused server bridge now requires transaction-refreshed schoolId, schoolUserId and membershipId to match the branded request identity. Role/status/configuration are still re-read under locks. A changed principal requires a new verified request and cannot silently switch a command to another school or membership. Eleven new tests execute actual bridge source with offline dependency stubs, including a reproduced/fixed cross-school rebind. See REPORT_CARD_IDENTITY_BRIDGE_BEHAVIOR_REVIEW.md. Expected offline count is 427, pending full local verification; latest explicitly confirmed full gate is 413. No SQL, routes or live auth settings changed in this batch.
