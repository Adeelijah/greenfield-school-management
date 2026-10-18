# Student lifecycle schema and transaction reconciliation (review only)

This document and [`12_lifecycle_transaction_reconciliation_review.sql`](security/12_lifecycle_transaction_reconciliation_review.sql) are proposals only. No SQL, migration, database query, grant, or policy was executed or applied. The actual deployed schema, PostgreSQL version, runtime role attributes, and RLS state remain unknown.

## Contract-to-schema reconciliation

The in-memory adapter is the behavioral reference for this review: it serializes fictional transactions, validates an expected student version, applies a plan to a private copy, and publishes only after all effects, idempotency data, and audit data succeed.

| Verified command/adapter behavior | Step 494 draft gap | Review proposal |
| --- | --- | --- |
| Closing a superseded enrollment preserves it as `completed` | Enum allows `active`, `graduated`, `withdrawn` only | Add `completed` forward-only, in a separate enum stage if required by target PostgreSQL/Drizzle behavior. Never reinterpret `withdrawn`. |
| Every lifecycle plan carries `expectedStudentVersion` | No student version column | Add positive `students.row_version`; compare and increment within the same locked transaction for every finalized mutation. |
| All lifecycle commands share a school-scoped idempotency list | Draft has operation keys on selected lifecycle tables, not initial enrollment or one shared namespace | Add one `(school_id, idempotency_key)` operation ledger with server-computed fingerprint, kind, student, actor membership, and result reference. Same key/same fingerprint replays; same key/different fingerprint conflicts. |
| Final audit entries link to a generated operation ID | Existing audit proposal lacks a lifecycle operation link and append-only enforcement | Link audit to operation ID; record verified actor membership/role snapshot, request ID, action, and minimal before/after status. Runtime lifecycle role may insert/read, never mutate/delete. Define correction and retention procedures. |
| Every final effect, ledger record, and audit entry is atomic | SQL draft is conceptual and cannot prove transaction execution | One server-side transaction performs scoped reload, validation, effects, version bump, idempotency and audit. Any error rolls back all. Unique/FK constraints backstop races. |
| Authority derives from server-verified membership/assignment | DB connection role, owner/BYPASSRLS, and trustworthy RLS context are unverified | Runtime role must be non-owner and `NOBYPASSRLS`; no browser lifecycle grants. Server derives school/role/assignment. RLS context must not rely only on caller-settable GUC or request school ID. |

## Forward-only sequencing

1. In an authorized isolated target, first inventory actual migration state, PostgreSQL version, enum state, audit table definition, role memberships/attributes, grants, and applied policies. No such inventory has been performed here.
2. Approve status semantics and a per-installation history mapping. Do not backfill `completed` from `withdrawn` automatically.
3. Review a staged migration for enum addition, row version, operation ledger, audit linkage and constraints. Check enum-use transaction compatibility against the actual server and migration runner before deciding whether it needs a separate migration boundary.
4. Define a non-owner runtime role and trusted school context, then reconcile RLS and grants as a single reviewed policy set. Existing permissive policies may broaden access when combined; additive policies are not sufficient proof of least privilege.
5. In a separately authorized isolated database, validate two-school access denial, assigned-teacher proposal-only behavior, admin finalization, bursar denial, rollback on audit failure, duplicate-key replay/conflict, and competing stale-version writes. No live adapter begins before these decisions and checks pass.

## Transaction and concurrency contract

For a finalized command, the future adapter must derive actor, role, school, and any teacher assignment from trusted server/database records. Inside one transaction it locks in the documented order: school structure/configuration, student, source enrollment, then lifecycle operation/departure/decision rows. It must re-read all IDs with school predicates; verify the current enrollment/status, configured progression and section, duplicate destination, unresolved departure, idempotency fingerprint, and expected row version; apply the exact pure plan; increment the student version; write operation ledger and linked audit; and commit. Any failure—including audit insertion—rolls everything back.

The unique `(school_id, idempotency_key)` ledger key arbitrates retries across operation types. A key with matching canonical fingerprint returns the prior operation/result without effects; a different fingerprint is a conflict. The student version compare-and-swap plus row lock prevents two conflicting outcomes from finalizing against one version. Database uniqueness and composite school/student FKs remain necessary race and tenant-consistency guards.

The in-memory adapter's global queue is only deterministic simulation; it is not evidence about PostgreSQL lock scheduling or transaction isolation. These proposals do not authorize a database adapter or persistence.

## Decisions still unresolved

- Actual DB owner, runtime role, `BYPASSRLS`, inherited/default grants, applied policies, and mechanism for trusted school context.
- PostgreSQL and Drizzle migration behavior for enum changes and transactional migration boundaries.
- Existing audit schema, operation ID shape, append-only enforcement, retention, and privileged correction procedure.
- Mapping of existing enrollment/student status history, including what qualifies as completed.
- Whether multiple schools are possible in one database despite the proposed deployment model, and how provisioning enforces one school per installation.
- Re-admission and subsequent departure semantics, actor membership retention, proposal lifecycle, and operation result references.

No Track B attendance work may modify lifecycle schema, migration, security, or this review artifact.
