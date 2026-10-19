# Independent restricted-role PostgreSQL sessions

Status: prepared, not database-executed by the assistant. The user verified all 378 offline tests and all preceding 53 PostgreSQL groups. No production database, live auth, migration, application route or deployment changed.

## Why a separate fixture is needed

The earlier restricted-role tests keep roles, policies and workloads inside a single rolled-back setup transaction. Independent PostgreSQL backends cannot see those uncommitted objects. They therefore establish restricted execution behavior, but cannot establish restricted independent-session concurrency.

The new opt-in extension creates a separate generated rc_it schema, clones only the 27 fictional metadata relations, installs gates/authority/history/append-only guards, and provisions two distinct generated NOLOGIN restricted roles. It applies the same preflight and fixed-school security plan and commits this test-only setup so other backends can see it. No existing role is modified and no login/password is created. The same explicit disposable URL and role-admin confirmation are required.

The clone copies report releases before report audit to satisfy the exact audit/release FK. Schema-local enums are copied through text into the new enum type; IDs, timestamps, numeric values and JSONB documents retain their contents. Assessment discovery gate/transaction claims are created fresh after data copy so cloned source versions are not spuriously advanced. Source manifests contain stable data IDs, not schema names, and normal canonical reconstruction still runs on every command that requires it. The source gate is held shared while cloning.

## Genuine independent transactions

Each adapter invocation receives a database boundary that starts a real pool transaction, SET LOCAL ROLE to the intended restricted role, sets row_security on and bounds lock/statement timeouts. SQL outside that boundary throws instead of falling back to owner privileges. The harness verifies current_user and pg_backend_pid for every transaction.

`disposableSessionRendezvous` waits for two different positive backend IDs under the exact generated writer role before either application workload begins. It rejects repeated PIDs, unexpected roles, invalid configuration, a third participant, timeout or cancellation. The pair drains both promises before cleanup; no assertion uses overlapping savepoints as a substitute for independent sessions.

Four prepared PostgreSQL groups cover:

- Same-key teacher submission in two distinct restricted backends: exactly one apply and one durable replay.
- Independent approval, publication and revocation pairs: apply/replay once per command with preserved old/new snapshots and release history.
- Different-key competing submissions: one apply and one stale-version rejection; fixed-school read, reader-write and teacher-approval denial; historical revoke replay after later state changes.
- Committed fixture cleanup after an intentional post-workload error: generated schema and both exact roles are absent afterward.

The login session is still the trusted role-admin test connection; current_user is restricted during each workload. This does not establish a least-privilege LOGIN connection or protect an administrator session from arbitrary hostile SET ROLE commands. The next separate gate must cover actual application login credentials/role switching, PUBLIC/default privileges and final server identity/membership scope. Do not claim these fixtures implement live Supabase authorization or end-user RLS.

## Cleanup ownership and limits

A private marker table stores a per-run random token. Finally inspects that exact generated marker before dropping the schema and then the two exact generated roles. It refuses to drop a fixture owned by a different run and never uses DROP OWNED, scans/deletes prefix matches or drops unrelated roles. The marker also permits cleanup if setup COMMIT succeeded but its acknowledgement was lost. Failed setup transactions normally roll back schema/roles together. The deliberate error probe exercises the cleanup error path on each successful test run.

Cleanup requires a functioning local connection and a running process. Forced termination or a server outage can leave these generated NOLOGIN roles/schema behind; this is temporary committed fixture state, unlike the earlier all-rollback groups. Inspect an interrupted run's exact marker/names before manual cleanup. No production objects or persistent privilege broadening are part of this harness.

## Verification

Seven new offline synchronization tests raise expected offline count to 385. All 71 selected offline tests, script syntax and whitespace checks passed here. The full local TypeScript/ESLint gate and new database groups remain pending. PostgreSQL expectations are 57 groups with the existing role-admin opt-in, or 43 owner groups with explicit skips for ten earlier restricted and four independent-session groups. Use the same complete local postgres admin setup/test/cleanup block; no extra environment confirmation or dependency is introduced.

Next after local gates: least-privilege LOGIN/session and final authority/membership contract, then controlled server read/command integration and route/UI QA. Do not merge, deploy or apply production schema/grants/RLS.
