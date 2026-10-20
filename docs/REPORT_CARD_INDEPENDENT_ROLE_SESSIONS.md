# Independent restricted-role PostgreSQL sessions

Status: user verified all 57 preceding PostgreSQL groups, including independent restricted sessions and cleanup. The actual LOGIN extension below is prepared, not database-executed by the assistant. Latest explicitly confirmed full offline count is 378; the intervening 385-test gate was not separately supplied. No production database, live auth, migration, application route or deployment changed.

## Why a separate fixture is needed

The earlier restricted-role tests keep roles, policies and workloads inside a single rolled-back setup transaction. Independent PostgreSQL backends cannot see those uncommitted objects. They therefore establish restricted execution behavior, but cannot establish restricted independent-session concurrency.

The new opt-in extension creates a separate generated rc_it schema, clones only the 27 fictional metadata relations, installs gates/authority/history/append-only guards, and provisions two distinct generated NOLOGIN restricted roles. It applies the same preflight and fixed-school security plan and commits this test-only setup so other backends can see it. The current extension also creates one generated LOGIN with a fresh in-memory random password; existing application roles are not changed. The same explicit disposable URL and role-admin confirmation are required.

The clone copies report releases before report audit to satisfy the exact audit/release FK. Schema-local enums are copied through text into the new enum type; IDs, timestamps, numeric values and JSONB documents retain their contents. Assessment discovery gate/transaction claims are created fresh after data copy so cloned source versions are not spuriously advanced. Source manifests contain stable data IDs, not schema names, and normal canonical reconstruction still runs on every command that requires it. The source gate is held shared while cloning.

## Genuine independent transactions

Each adapter invocation receives a database boundary that starts a real pool transaction, SET LOCAL ROLE to the intended restricted role, sets row_security on and bounds lock/statement timeouts. SQL outside that boundary throws instead of falling back to owner privileges. The harness now connects a separate pool as the generated LOGIN and verifies session_user, current_user and pg_backend_pid for every transaction. The pool uses its own typed text parameters.

`disposableSessionRendezvous` waits for two different positive backend IDs under the exact generated writer role before either application workload begins. It rejects repeated PIDs, unexpected roles, invalid configuration, a third participant, timeout or cancellation. The pair drains both promises before cleanup; no assertion uses overlapping savepoints as a substitute for independent sessions.

Four prepared PostgreSQL groups cover:

- Same-key teacher submission in two distinct restricted backends: exactly one apply and one durable replay.
- Independent approval, publication and revocation pairs: apply/replay once per command with preserved old/new snapshots and release history.
- Different-key competing submissions: one apply and one stale-version rejection; fixed-school read, reader-write and teacher-approval denial; historical revoke replay after later state changes.
- Committed fixture cleanup after an intentional post-workload error: generated schema and both exact roles are absent afterward.

## Actual least-privilege login extension

The generated LOGIN is NOINHERIT, NOSUPERUSER, NOBYPASSRLS, NOCREATEROLE, NOCREATEDB and NOREPLICATION. It owns no objects. Its only outgoing memberships are the exact reader/writer roles with SET true, INHERIT false and ADMIN false. Catalog evidence checks all flags, ownership and each membership option before commit and after workloads. Service roles retain their separate NOLOGIN leaf-role preflight.

A fresh 32-byte random hexadecimal password exists only in the harness process. Connection construction replaces administrator credentials and removes URL query options; it accepts only localhost and the disposable database name. Provisioning/authentication errors are sanitized to avoid exposing the generated secret. The harness does not read any additional credentials or save its generated URL/password. PostgreSQL host authentication configuration still determines whether a password is checked; successful session identity does not by itself establish password authentication, TLS or production connection configuration.

Two additional PostgreSQL groups test raw-login table denial, administrator role-switch denial, role creation/membership administration denial, RESET ROLE returning to the unprivileged session login, fixture schema CREATE denial and RLS-disable denial. The four existing independent groups now execute through that actual login pool. Concurrent workflow, stale-version, school/actor checks and historical replay remain covered.

GRANT membership options are issued as separate statements, as required by the PostgreSQL 18 grammar: [GRANT](https://www.postgresql.org/docs/18/sql-grant.html). Role reset behavior is tested directly: [SET ROLE](https://www.postgresql.org/docs/18/sql-set-role.html). These are trusted school-service roles, not end-user SQL credentials. Final server-auth identity/membership scope and live integration remain pending.

## Cleanup ownership and limits

A private marker table stores a per-run random token. Finally closes the generated login pool, inspects that exact generated marker, drops the schema, revokes its explicit database CONNECT grant and drops the exact login plus reader/writer roles. Cleanup verifies all three roles and the schema are absent. It refuses to drop a fixture owned by a different run and never uses DROP OWNED, scans/deletes prefix matches or drops unrelated roles. The marker also permits cleanup if setup COMMIT succeeded but its acknowledgement was lost. Failed setup transactions normally roll back schema/roles together. The deliberate error probe exercises the cleanup error path on each successful test run.

Cleanup requires a functioning local connection and a running process. Forced termination or a server outage can leave the generated LOGIN, NOLOGIN roles and schema behind; this is temporary committed fixture state, unlike the earlier all-rollback groups. Inspect an interrupted run's exact marker/names before manual cleanup. No production objects or persistent privilege broadening are part of this harness.

## Verification

Eight new login planning/evidence/URL tests raise expected full offline count from 385 to 393. All 82 selected login, role, synchronization, history, correction and writer tests passed here, along with integration-script syntax and whitespace checks. Full local TypeScript/ESLint and the expanded SQL remain pending. PostgreSQL expectation is 59 groups with the existing role-admin opt-in, or 43 owner groups with explicit skips for ten earlier restricted and six independent-session/login groups. Use the same complete local postgres admin setup/test/cleanup block; no extra confirmation or dependency is introduced. Setup now explicitly grants/revokes database CONNECT, so use the existing local disposable database administrator.

Next after local gates: final verified server identity/membership scope, then controlled server read/command integration and route/UI QA. No merge, deployment or production schema/grants/RLS.

## User verification — 2026-10-20

The user supplied all 59 PostgreSQL groups passing, including the actual generated LOGIN, RESET ROLE and privilege-denial checks, concurrent restricted workloads and exact cleanup after the intentional error. These prepared SQL gates are now verified in the user's local disposable environment. The full 393-test offline gate is still unconfirmed. The assistant executed no SQL.

The next source review is REPORT_CARD_SERVER_AUTHORITY_CONTRACT.md. It identifies the unresolved difference between globally unambiguous active membership and one membership visible through fixed-school RLS. Login isolation does not resolve that server authorization gap; report routes remain unwired.
