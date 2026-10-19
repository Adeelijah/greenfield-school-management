# Schema-faithful disposable assessment tests — prepared, not run

`scripts/assessment-postgres-schema-integration.mjs` is an opt-in local-only PostgreSQL harness. It creates 11 selected existing-model fixture tables and all 11 assessment proposal tables inside one generated `rc_it_<16 hex>` schema. It does not create application migrations, load environment files, import Drizzle Kit/config, connect to Supabase, alter public/application schemas, create roles, or change live grants/RLS.

## DDL source and isolation

`scripts/lib/assessment-disposable-schema.mjs` reads Drizzle metadata from the current schema declarations and the isolated assessment proposal. It assembles DDL **in memory**, carrying column types/defaults, primary/column uniqueness, checks, indexes/partial predicates and foreign keys into the generated schema. It rejects unsupported metadata rather than silently dropping table-level primary/unique constraints, generated columns, expression/operator indexes, non-btree indexes or parameterized expressions. The helper never opens a connection or writes a SQL/migration file.

The two reviewed prerequisite composite unique targets are added only to fixture `terms` and `teacher_class_assignments`, before FKs are installed. Enum types are created inside the fixture schema. Every FK must target another selected fixture table in that same schema. No shadow production table declaration is migrated. The helper is deliberately limited to the inspected model subset and must be reviewed if those declarations change.

Three offline tests compare emitted metadata coverage, schema isolation, complete proposal-table inclusion and prerequisite/FK ordering. They do not execute SQL. They require existing `drizzle-orm` dependencies and have not run in the assistant checkout, where those packages are absent.

## PostgreSQL coverage prepared

1. Create all 22 fixture relations from current metadata and verify the table count.
2. Reject foreign-school subject links, wrong-session terms and duplicate null-subject default configs.
3. Reject duplicate component scores, mismatched enrollment/student identities, a roster/config mismatch and invalid score modes/negative values.
4. Enforce exact source/roster/scope binding for teacher review and finalization, plus unique finalization per source/subject.
5. Retain inactive roster history while allowing only one active version per scope/subject.
6. Install **fixture-only candidate triggers**, then reject updates/deletes/truncates on source versions, reviews, finalizations, audits and receipts. Reject mutation of finalized config rows. This tests a candidate enforcement mechanism, not an applied production policy.
7. Exercise a guarded source mutation that locks the scope, updates a score/version, conditionally advances the revision, and appends audit/receipt atomically. A receipt collision must roll everything back; competing writers must produce one applied and one stale result.

UUIDs, schools, users, students and academic data are fictional. Config/source/result payloads are intentionally minimal fixture data; this suite verifies relational/transaction constraints, not complete canonical manifest construction, result calculation, hashes or real auth.

## Limits that remain explicit

- No RLS roles, grants, JWT sessions, guardian access or production routes are exercised.
- The fixture owner can disable/drop triggers. Trigger tests do not establish least privilege, ownership separation or privileged bypass resistance.
- Direct writes to score/roster/enrollment children are not globally restricted by this fixture. The tested guarded mutation is a caller-controlled transaction, not proof every import/admin/background path follows it. Phantom insertion and complete multi-scope invalidation still need independently enforced writer routines and tests.
- Same-class/session config/teacher/enrollment joins not captured by the current proposal remain transaction-policy requirements. Tests must not claim those equality checks are DB-enforced merely because tenant FKs pass.
- Numeric storage may round inputs to scale four; application validation must reject excessive precision before persistence. This harness does not replace `assessment-persistence-policy.ts`.
- The production schema lacks the two required composite targets. Creating them in the fixture is not permission to modify the real tables.

## Local verification after approval

First run the inspected offline gate with installed project dependencies:

```powershell
node .\scripts\verify-offline.mjs
```

Then, only after confirming the same separate local disposable PostgreSQL database and configuring the existing opt-in variables, run:

```powershell
node --experimental-strip-types .\scripts\assessment-postgres-schema-integration.mjs
```

The harness requires both the explicit confirmation token and a loopback URL for `greenfield_report_cards_disposable` (optionally suffixed). Database name/host guards do not prove the account has no access to application data. Use the existing dedicated disposable login; never paste its URL/password into chat. The harness drops only its generated schema in `finally` and closes the client. No database was accessed by the assistant while preparing this batch.

## Status

The user confirmed the preceding source-policy milestone passed the full offline gate with 236 tests. New helper/harness scripts pass JavaScript syntax checks; 90 existing scoped domain tests pass locally. The three new dependency-backed emitter tests and all seven PostgreSQL groups remain unverified until run with the user's installed dependencies and disposable database. Production schema, migration configuration and generated migrations are unchanged.


## Verified baseline and write-guard follow-up

The user ran the baseline: all 239 offline tests and seven PostgreSQL groups passed on 2026-10-19. `ASSESSMENT_DISPOSABLE_WRITE_GUARDS.md` describes a subsequent fixture-only source invalidation protocol with four offline tests and five additional pending PostgreSQL groups (twelve groups total). The protocol adds BEFORE STATEMENT gating, transaction/scope revision deduplication, enrollment transfer fan-out and shared-gate phantom checks. It remains a candidate fixture design, not production permissions or full report-adapter phantom safety.
