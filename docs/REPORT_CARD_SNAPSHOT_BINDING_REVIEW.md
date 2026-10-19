# Report enrollment, source, snapshot and release bindings — review only

The user verified the complete canonical assessment reader: all 282 offline tests and nineteen PostgreSQL groups passed. This batch reconciles the report proposal with those real source shapes. No production schema exports, migration files, authentication routes, grants/RLS or deployed behavior are changed.

## Composite identities

| Relation | New binding |
| --- | --- |
| Report | Exact school/enrollment/student/class/session tuple; exact assessment scope for class/session/term; exact immutable source version and revision in that scope |
| Snapshot | Stable report/enrollment/scope identity; immutable source ID/revision independently retained when the report later refreshes its source; unique report workflow version |
| Audit | Snapshot ID must belong to this report at the specified approved version; action and stage/version transition checks |
| Release | Exact report/snapshot/approved version; publication version is approved version + 1; school-scoped publisher ID; only one non-revoked release per report |
| Receipt | Existing school/actor/key uniqueness retained; nonempty key, object outcome and lowercase SHA-256-shaped fingerprint |

The actual enrollment table needs a separately reviewed `enrollments_report_binding_unique (school_id,id,student_id,class_id,session_id)` target. The report proposal describes it with a **shadow declaration**, just as it already does for the term target. Neither shadow table may appear in a migration glob. The fixture creates actual base tables from schema metadata and adds the target index only inside its generated schema.

The academic assessment proposal adds redundant unique targets `as_scope_full_target_uq (school_id,id,class_id,session_id,term_id)` and `as_source_revision_target_uq (school_id,id,scope_id,revision)` so report/source FKs constrain the entire identity rather than independent matching IDs. These are review-source changes, not applied SQL.

## Workflow version policy

A report starts at version 1. Submit increments to version 2. Approval increments to version 3 and must create one immutable snapshot pinned to that approved version. Publish increments to version 4 and releases that exact version-3 snapshot. Approval audit references snapshot version 3 at afterVersion 3; publication audit references snapshot version 3 at afterVersion 4. The constraints generalize this arithmetic rather than hard-code those example numbers.

Snapshots are approval artifacts in this proposal. Source materialization/review/finalization precedes them; merely having a snapshot is not proof an approval transition actually ran. A report source pin may be refreshed later without rewriting old snapshots, which retain their own source references. The future writer must atomically create the approved snapshot and audit, and publish only the pinned approved snapshot after revalidating source freshness and role/assignment authority.

Persisted draft reports must now pin an existing positive-revision source version; score-entry drafts remain in the assessment layer. Do not invent a source ID or coerce a preview revision of zero to satisfy persistence. The future creation policy must make this prerequisite explicit.

Stage checks require the expected actor fields and timestamps, a nonempty return reason, and different submitter/approver IDs. They do not verify membership roles or legal transitions across successive UPDATE statements. Audit checks describe the existing workflow (including reopen only from approved); they do not add published corrections. A separately reviewed published-correction/revocation protocol remains necessary.

## What the database constraints do not establish

FKs prove identity relationships, not canonical JSON correctness, current source freshness, actual authenticated authority, current report stage/version at release insertion, or that a snapshot was captured during approval. JSONB shape/hash-pattern checks do not recompute hashes or validate a report payload's embedded identities. The future adapter must use the verified complete source loader, construct/verify a typed canonical per-pupil report snapshot, lock the report, enforce optimistic versions/idempotency and persist all effects atomically. Client or privileged direct writes must later be restricted with reviewed grants/RLS/procedures.

Snapshot/audit/receipt append-only triggers in the harness remain fixture-only. Report releases need a narrow revocation protocol that preserves snapshot/report/version/publisher fields; this batch does not implement owner-bypass resistance, immutable release triggers or guardian reads. The one-active-release index does not by itself perform revocation. No live publication is enabled.

## Checks prepared

Eight new report metadata tests inspect exact FK column tuples, non-null pins, audit/release versions, stage checks and receipt validation. Three emitter tests cover the extended 27-table fixture, report enum scoping, prerequisite ordering and omission of duplicate shadow tables. The default academic-only fixture remains 22 tables; the PostgreSQL harness explicitly opts into five additional report tables. The expected full offline count is 293.

Four new PostgreSQL groups extend the same harness from nineteen to 23:

- Reject substituted enrollment/class and mismatched source scope/revision.
- Reject mismatched snapshot enrollment/source, duplicate report snapshot version, invalid JSON/hash/stage fields.
- Reject another report's snapshot in audit/release, wrong approved versions and invalid transitions/revocation ordering.
- Roll back report/audit/release changes after a school/actor receipt collision, allow a successful fixture retry, and reject snapshot/audit/receipt update/delete/truncate.

Report snapshot JSON in this constraint fixture is explicitly `greenfield.report-card.binding-fixture.v1`; it is not the final report snapshot format or evidence of a usable printed report. The publication helper is scripted fixture DML, not the application transaction port or an authenticated writer.

JavaScript syntax and tracked whitespace checks passed here. The new Drizzle metadata assertions, full TypeScript/ESLint and all new PostgreSQL statements require execution in the user's installed environment/disposable database. No dependencies were installed and no SQL was executed here.

After both gates pass, implement the canonical per-pupil snapshot builder and schema-faithful transactional writer. Keep production migration generation/application, live authentication/security, guardian access, merges and deployment behind their separate roadmap gates.
