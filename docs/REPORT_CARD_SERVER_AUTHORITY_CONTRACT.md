# Report Card server identity and membership contract

Date: 2026-10-20. Status: source review and proposed integration contract, not an enabled server adapter or verified live authorization change.

## Verified starting point

The user supplied all 59 disposable PostgreSQL groups passing, including generated LOGIN isolation, independent-session submission/approval/publication/revocation, history/replay and exact cleanup. Latest explicitly confirmed full offline count remains 378; the 393-test gate was requested but its result has not been supplied. No new SQL is needed solely for this document.

The execution environment is unavailable for this continuation. Source was read from report-cards-foundation through GitHub; no local working tree was reset or overwritten, no environment secrets were read and no tests were executed. This review changes documentation only.

## Existing boundaries found in source

| Source | What it establishes | Limit |
| --- | --- | --- |
| src/server/auth/identity.ts | getVerifiedAuthUser uses Supabase auth.getUser server-side and returns null on returned auth errors | Establishes identity only; does not authorize a school; thrown SDK errors need handling at the future boundary |
| src/server/auth/authorization.ts | getSchoolAccess verifies the user, finds school_users, requires exactly one active membership among up to two visible matches, and resolves its school | Depends on deployed self-only RLS exposing every relevant membership; separate requests are not one locked report transaction |
| src/server/auth/require-school-access.ts | Login/access-pending redirects and allowed-role navigation guard | Useful for page entry; cannot replace transactional command authorization |
| src/lib/academics/report-card-persisted-model-map.ts | Pure mapping requires one matching school user, one active membership, academic role and matching school; placement checks teacher assignment | Requires complete trusted rows; cannot establish authentication or detect rows omitted by RLS |
| src/lib/academics/report-card-postgres-command-context.ts | Fixture command locks discovery gate, exclusive actor anchor, membership and school, then uses the mapper | Accepts a trusted identity callback; does not itself verify Supabase identity; fixed-school RLS limits visible rows |

The live school helper permits bursar navigation; the report mapper rejects bursars for academic operations. Preserve this deliberate difference. Authentication user ID, school-user ID and membership ID are distinct and must not be substituted.

## Membership completeness gap

The documented application policy rejects more than one active membership, even when the second belongs to another school. The fixture security plan instead grants a trusted service visibility to one fixed school. Under that role, a query for all memberships of the actor can return only one visible row while another active membership exists outside the service school.

Consequently, exactly one visible row is not proof of exactly one global active membership. The mapper's pure ambiguity tests and fixed-school fixture RLS tests do not resolve this mismatch. Separate-database-per-school deployment is proposed, not verified; it cannot be assumed to make foreign memberships impossible.

Do not solve this by disabling RLS, using the owner/superuser for application commands, trusting a body/cookie school ID, changing the policy to first membership wins, or carrying an earlier getSchoolAccess result as permanent authority.

## Proposed boundary for the next implementation

1. Verify authentication once at the request boundary using the established server SDK helper. Missing identity or verification errors deny before any report data lookup. Accept only command selectors/version/key/reason fields from the client; school, role, assignments and user IDs remain server-derived.
2. Keep page navigation checks separate from command authority. A server-only closure may capture the verified auth ID for the adapter callback; never expose a route accepting a caller-created verifiedIdentity function.
3. Resolve the completeness gap before enabling routes. Preserve the exactly-one-active-membership policy unless an explicit product decision changes it. Prepare a narrow authority lookup that can inspect all memberships of only the verified actor, participates in the report transaction and cannot inspect arbitrary users. Review its identity provenance, grants, search path, lock order and mutation guards in an isolated fixture. Do not grant the school service unrestricted cross-school reads as a shortcut.
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

First obtain the outstanding full offline result on the current branch. Then implement and test the complete authority lookup and its server-only verified-identity bridge in isolation. Only after those gates pass should teacher/admin read and command routes be wired. Existing 59-group SQL results remain valid for their tested fixture scope; this document adds no test groups.
