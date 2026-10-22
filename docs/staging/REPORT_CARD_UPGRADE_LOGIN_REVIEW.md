# Unprivileged generated LOGIN on the upgraded layout

Date: 2026-10-22. The user's latest all-tests-passed response is recorded as confirmation of the requested 493-test gate and 17 upgraded SQL groups. Earlier main 64 and standalone authority eight remain verified. New LOGIN groups below are prepared, not SQL-executed here.

## Connection and ownership boundary

The existing local-disposable URL and role-admin confirmation now opt into a genuinely generated LOGIN after the four transactional SET LOCAL probes. `report-card-upgrade-login-probe.mjs` commits the existing three-role security composition plus a fourth random-password LOGIN in the exact generated namespace's fixture lifecycle. It opens a separate postgres-js pool with the original administrator credentials replaced by that LOGIN. The generated secret stays in harness memory and PostgreSQL's temporary role-authentication state until cleanup; it is not written to a file, environment variable or report.

The LOGIN is NOINHERIT/NOSUPERUSER/NOBYPASSRLS/NOCREATEROLE/NOCREATEDB/NOREPLICATION and receives exactly reader/writer memberships with SET TRUE, INHERIT FALSE and ADMIN FALSE. An explicit database CONNECT grant is removed at cleanup. Catalog evidence must pass the existing login inspector, including no object ownership. Each selected-role transaction uses SET LOCAL; the pool has at most two connections and a fixed startup search path. No owner/default connection fallback is used for restricted work.

The administrator connection is retained only for fictional fixture setup, catalog inspection, deliberate competing membership writes and cleanup. No application role, configured connection, Supabase SDK, public schema, real school record, route or production deployment is changed.

## Five prepared PostgreSQL groups

1. Verify LOGIN attributes/membership options, no inherited table access, no switch to the setup administrator or private authority owner, and denial of granting membership administration.
2. Through actual LOGIN-selected reader/writer roles, verify fixed-school reads, foreign-row hiding, denial of legacy/claim tables and revision helpers, reader denial of complete helper access, inability to disable report RLS, and RESET ROLE returning to the unprivileged LOGIN.
3. Require two distinct backend PIDs through the LOGIN pool and exact writer role; both perform the complete locked authority lookup for the fictional actor. This is authority-read serialization, not submission/idempotency concurrency.
4. Commit a foreign active membership from setup; service RLS still exposes one active row, but the complete helper rejects ambiguity. Suspend the foreign historical row and recover one active authority result.
5. Hold complete authority from a LOGIN writer transaction; a separate setup transaction's membership suspension must time out before discovery. Release the holder, commit suspension, deny the next complete read, reactivate and resolve again.

Readiness/paired-session helpers are bounded, SQL statements have a five-second timeout and the competing suspension has a 200ms lock timeout. Held transactions are released/drained in finally; the LOGIN pool closes before outer cleanup. These tests do not yet run canonical report commands, authenticate cookie/JWT requests or prove an approved application runtime mapping. Those remain next.

## Cleanup and failure evidence

The outer harness records successful security commit acknowledgement. Its cleanup transaction drops only the exact generated schema first, revokes this LOGIN's database CONNECT and drops LOGIN/authority-owner/reader/writer roles. Catalog absence of both schema and all four role names is required before final PASS. Without commit evidence it does not drop roles; unexpected remaining names cause failure instead of a cleanup success. The initial schema creation also needs acknowledgement. Lost commit acknowledgement, process interruption or lost connectivity can still require manual review; crash-proof cleanup is not claimed.

No role names come from a request body. The pure login planner accepts only exact generated schema names, the disposable database naming pattern and a generated 64-hex-character secret. A separate cleanup planner requires an explicit boolean commit flag. The original three-role transactional probe remains useful and rolls its own installation back before the committed LOGIN setup.

## Verification and run

Six new pure login setup/cleanup tests pass. With existing source/guard/security checks, **37 selected tests** passed here; script syntax and scoped whitespace passed. Expected installed full gate is **499 tests across 66 files**, pending local TypeScript/ESLint/full verification. No dependency installation, database connection or SQL execution occurred here.

Run `git pull origin report-cards-foundation` and `node .\scripts\verify-offline.mjs`. Then rerun the same complete credential-cleaning PostgreSQL block with the role-admin confirmation enabled, using `node --experimental-strip-types .\scripts\report-card-postgres-upgrade-integration.mjs`. Expected upgraded total is **22 PASS groups**, ending in schema-and-role absence after intentional workload failure. Without the role-admin token the nine security/LOGIN groups are explicitly skipped, leaving only 13 ordinary groups. The unchanged main 64 and standalone eight suites need no rerun solely for this batch.

After both gates: construct a valid canonical fictional academic source on this upgraded restricted layout and run the real report workflow through it, then prepare actual verified server-request integration. No production SQL or deployment approval follows from passing fixture tests.
