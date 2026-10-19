# Report Cards: typed payload and migration package — review only

No database connection, generated migration, SQL execution, schema entrypoint change, merge or deployment is authorized by this document.

## Academic payload v1

`src/lib/academics/report-card-academic-payload.ts` defines a strict review-stage shape:
- Stage: creche, nursery or primary.
- Primary: finalized numeric subject results with total (0–100), grade, remark and weighted components (weights sum to 100).
- Creche/nursery: finalized descriptive observations and levels, without numeric grades.
- Optional attendance (present/possible), teacher and principal remarks.
- Exact subject roster must match the server-supplied expected subject identifiers.

**Integration requirement:** Call `validateAcademicSnapshotPayload(payload, binding.subjectIds)` before `canonicalizeReportSnapshot({ binding, assessment: payload })`. Both values must originate from authoritative school-scoped server queries. The current canonicalization function accepts generic JSON; it does not invoke the typed validator itself. The typed validator does not prove a calculated total matches the component scores or that grading rules were applied correctly; the finalized assessment engine must supply and verify those facts. Attendance and remarks must also be sourced from trusted school records.

## Proposed migration sequencing

1. Review and apply prerequisite composite unique key on `terms(school_id, session_id, id)` in a separately authorized migration.
2. Replace the proposal's shadow `terms` declaration with a reference to the actual updated production schema. Never include the shadow declaration in a Drizzle migration schema glob.
3. Introduce report cards, snapshots, audit, idempotency receipts and releases with school-scoped foreign keys and constraints.
4. Define report-to-enrollment identity binding, canonical payload format/hash and assessment revision ownership.
5. Add least-privilege grants, default-deny RLS, append-only enforcement and guarded server transaction routines. Independently enforce scope in any privileged server connection.
6. Verify rollback, concurrency, idempotency, tenant isolation and guardian release access in a disposable PostgreSQL instance, with separate approval before DB use.
7. Obtain explicit authorization before production schema changes, migration generation, deployment or merge.

## Unresolved review blockers

- Exact database binding for student enrollment, including historical enrollments and duplicate-active-enrollment prevention.
- Source version rows and locking strategy, assessment total/grade recalculation and snapshot correction lineage.
- Canonical decimal rounding and Unicode normalization, attendance provenance, approved remarks workflow.
- Guardian authentication-to-guardian mapping and RLS policy implementation.
- DB-enforced immutability for snapshots/audit/receipts, versioned releases and revocation.
- SQL-level test coverage for all constraints and RLS roles.

The new pure tests validate payload shape only; passing offline checks do not prove migration safety or production authorization.
