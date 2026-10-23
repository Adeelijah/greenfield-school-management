# Isolated staging runtime and authentication contract

Date: 2026-10-23. The user supplied full verification of **505 offline tests and all 31 upgraded PostgreSQL groups**, including controlled server-entry integration and exact cleanup. This milestone prepares the next runtime contract; it does not install roles, security SQL or a connection.

## Role mapping selected for source review

Keep the existing `src/db/connection-guard.ts` contract unchanged: `DATABASE_URL` authenticates as `greenfield_app` (or its supported pooler username spelling), remains separate from migration credentials, and requires the existing operator acknowledgement. That configuration guard is not effective-privilege evidence.

| Principal | Required purpose | Membership contract |
| --- | --- | --- |
| `greenfield_app` | Restricted LOGIN, NOINHERIT, no object ownership or privileged flags | Exactly one outgoing membership to `greenfield_report_card_runtime`, with SET true / INHERIT false / ADMIN false; no incoming memberships |
| `greenfield_report_card_runtime` | NOLOGIN, NOINHERIT report execution role, no ownership or privileged flags | No outgoing memberships; exactly one incoming membership from `greenfield_app` with the same options |
| `greenfield_report_card_authority_owner` | NOLOGIN, NOINHERIT private function owner, no privileged flags | No incoming or outgoing memberships; owns only reviewed authority functions, with narrow table privileges/policies |
| Supabase `authenticated` | Verified request RPC execution under the actual request JWT | Only the zero-argument `resolve_report_card_actor()` entry; no direct private lock-helper access |
| Migration/operator principal | Separately approved schema/security installation | Never used as the report application login or command role |

All three application/security roles must be NOSUPERUSER/NOBYPASSRLS/NOCREATEROLE/NOCREATEDB/NOREPLICATION. The authority owner's ownership is deliberately different from runtime ownership: the adapter allows owner-role ownership but cannot prove which objects it owns. Installation review must inventory its owned functions, narrow policies/grants and default EXECUTE state. The adapter rejects runtime/login ownership using the same `pg_shdepend` ownership evidence as the existing fixture role plans.

The source-review grant shape, after all target prerequisites are separately reviewed, is:

```sql
GRANT greenfield_report_card_runtime TO greenfield_app WITH SET TRUE;
GRANT greenfield_report_card_runtime TO greenfield_app WITH INHERIT FALSE;
GRANT greenfield_report_card_runtime TO greenfield_app WITH ADMIN FALSE;
```

These statements are review text, not an installation command or permission to execute them. PostgreSQL 16+ membership options are required; the user's existing disposable evidence is PostgreSQL 18. Existing role flags, memberships and other module access must be reconciled before any alteration. Do not revoke or replace unrelated application privileges automatically, or apply the older standalone authority SQL independently: its source-gate coordination still needs the combined non-fixture installation package.

## Unused staging adapter

`src/lib/academics/report-card-staging-runtime.ts` accepts only explicit `isolated-staging-review` mode, public schema, fixed server-configured school UUID and the exact login/command names above. It receives a supplied `SqlDatabase`; it imports no driver, application client, SDK, environment loader or connection factory. It is not imported by a route or the application client.

Each transaction checks `session_user` and `current_user` are initially `greenfield_app`, inspects role flags, both membership directions and ownership, issues only the fixed `SET LOCAL ROLE "greenfield_report_card_runtime"`, then verifies exact execution role before work and again before commit. It never RESETs an unexpectedly preselected connection into apparent compliance. A callback exception, denied SET ROLE, caught SQL failure or unexpected final role propagates out of the underlying transaction. Captured SQL leases expire when work ends; direct SQL through the adapter is refused. Standard transaction-local role reset remains the driver's/PostgreSQL's responsibility and needs actual pooled integration proof.

This is a generic transaction adapter, not a report command handler. A returned business failure must still be converted to an abort by the command boundary; the adapter does not interpret arbitrary `{ok:false}` values. The fixed school metadata is captured/frozen for future boundary binding. It does not itself apply a school predicate or install fixed-school RLS. Table/function grants, effective PUBLIC privileges, policy applicability, helper definitions, source/history guards and actual authentication remain independent installation checks.

The existing fixture writers and complete boundary still accept only generated `rc_it_...` schemas and their exact generated writer role. This adapter does not relax those guards, make them accept public, connect the unused SDK transaction runner, or select a default connection. A scoped non-fixture boundary/source/writer adaptation is still required before it can run report commands.

## Installation and real-authentication gate

Before a connection or SQL execution, identify one explicitly authorized isolated Supabase target, its operator and fictional school/auth accounts. Record source SHA, catalog/SQL hashes, exact role mapping, baseline/restore evidence and endpoint-disabled state. The ordinary local PostgreSQL disposable database is not itself a Supabase Auth service; its successful LOGIN does not prove real SDK/JWT handling.

The next installation package must combine academic dependencies and schema, source/authority discovery gates in the verified order, immutable history/release guards, forced fixed-school RLS, narrow grants and complete actor functions. Preserve existing modules, policies and legacy rows; no inferred class/final-year mapping. Rehearse rollback before granting runtime use. The existing public authority review file remains intact and uninstalled.

Only after that isolated installation is approved and verified should a real request test use the existing server SDK and actual fictional sessions: missing/invalid/expired JWT, cross-actor RPC evidence, anonymous/private-helper denial, hidden membership ambiguity, request-to-command authority changes, ended assignment, safe responses, retry/replay and role reset across reused connections. No external auth transport substitutes may be counted as this gate. Avoid real pupil data and production endpoints. A production apply/deploy request remains separate.

## Validation and next action

Eight new pure/recorder tests passed, together with the existing selected tests: **92 checks passed here**. They exercise exact mapping, dangerous flags, both membership directions/ownership, transaction ordering, owner/preselected role denial, caught-error rollback, role reset failure, retry and expired leases. No SQL was parsed or executed, no database was contacted, and no connection settings or live authentication changed.

Expected installed offline gate is **513 tests across 68 files**, pending full TypeScript/ESLint verification. The previously verified **31 upgrade groups** are unchanged and need no rerun solely for this batch; they do not validate this adapter's new catalog query or public runtime mapping. After the offline gate, prepare the coordinated non-fixture installation/boundary package, then obtain target-specific installation/auth-test authorization. No report route or launch readiness is implied.
