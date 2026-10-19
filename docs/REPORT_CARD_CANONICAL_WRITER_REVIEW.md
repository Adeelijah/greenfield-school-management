# Canonical approval snapshot and PostgreSQL writer — fixture only

The user verified the preceding report-binding milestone: all 293 offline tests and all 23 schema-faithful PostgreSQL groups passed. This batch adds the actual fixture adapter for approving and publishing existing submitted reports. It does not wire application routes, call Supabase, read environment files, connect by itself or change production schema/security.

## Per-pupil approval artifact

`report-card-approved-snapshot.ts` verifies the complete canonical assessment documents again, validates the report's enrollment/student/class/session/term/scope/source/revision, and extracts only that pupil's scores and results. `greenfield.report-card.approved-snapshot.v1` binds the report's approved workflow version, independent submitter/approver IDs, canonical server approval time, real placement/calendar references, source hash, full subject/config details and exact finalization/review references. Numeric decimals remain exact; Creche/Nursery observations remain descriptive without numeric totals. No session version, term ordinal, student display name or attendance value is invented.

The payload does not embed other pupils' enrollment IDs/scores or the complete class source manifest. It references that manifest and subject finalizations by digest. This is an internal academic/provenance snapshot, not a finished branded report-card layout: trusted student/school display details, attendance/comments/signatures and printable output remain later work.

The complete canonical reader now returns its already-verified source/finalization/review documents alongside its existing bundle, allowing the builder to verify their content rather than trust a precomputed total. The pure builder cannot authenticate its caller or establish database locks. The approved version must be at least 3; the actual writer derives it from the locked report version.

## Actual transaction adapter

`executeFixtureCanonicalReportCommand` owns one outer `SqlDatabase.begin`. Input contains only report ID, approve/publish action, expected workflow version and operation key. School/membership come from the verified-identity callback and locked active membership reads; only an admin can execute these actions. The adapter takes the shared source discovery gate first, resolves identity, locks the school-scoped report, and checks a server-computed command fingerprint against actor-scoped receipts.

Existing identical receipts replay their historical outcome after checking the pinned snapshot exists, even after later workflow/source changes. Replay is not current release visibility. Different payloads/report IDs with the same actor operation key conflict. Inactive actors cannot replay. A simultaneous cross-report key collision may initially return a generic transaction failure after its unique-constraint rollback; retry resolves the durable conflict. No client fingerprint, actor, school, approval time or snapshot ID is accepted as authority.

For a new write, the adapter checks optimistic report version and stage, active assigned report submitter, independently approved identity for publication, the complete canonical source and exact pinned source version/revision. Approval builds/inserts the immutable snapshot, conditionally updates the report and appends audit/receipt. Publication reloads the snapshot for the approved version, reconstructs the expected canonical document using its stored approval time and trusted report/approver/source, verifies payload/hash/source list, then conditionally updates the report and atomically appends audit/release/receipt referencing that same snapshot.

All failures after a write throw through the outer transaction boundary before becoming generic outcomes. The shared discovery lock is never upgraded: report-only writes do not mutate assessment tables. Source writers taking the fixture's exclusive gate cannot interleave between source validation and report commit. Selected parent/authority locks remain held until transaction end. Append-only enforcement is still supplied by the schema-faithful harness, not installed by this adapter.

This adapter deliberately implements approval/publication of existing reports only. It does not create reports, submit teacher work, return/reopen reports, refresh a stale source pin, revoke releases, authorize guardians or replace the older synthetic transaction-port tests. Published corrections remain disallowed until a separate policy is designed. Report submission authority is currently conservative: the recorded submitter must remain an active teacher with one active matching class/session assignment.

## Test evidence and remaining gates

Eight snapshot tests and eight transactional fake tests cover per-pupil isolation, numeric/observational output, source/identity/version/time bindings, stable serialization, tampered payload/hash/source lists, roles, optimistic versions, replay, injected rollback and retry. The fixture helper is imported only by these tests. All 84 selected pure/unit tests (including previous workflow/port/persistence tests), JavaScript syntax and tracked whitespace checks passed here. Full TypeScript/ESLint remain pending in the installed environment. The expected full offline count is 309.

Five groups extend the opt-in PostgreSQL harness from 23 to 28:

- Actual writer concurrent approval/publication yields one application and one replay, with one selected-pupil snapshot and release.
- Teacher, suspended actor and stale report source are denied without writes.
- Actual snapshot/audit/receipt insertion failures roll back approval and allow same-key retry/replay.
- Actual release/receipt failures roll back publication and reuse its approved snapshot on retry.
- A forged stored snapshot with an attacker-recomputed hash is denied; an advisory audit barrier proves an assessment edit cannot interleave after report update; later edits block fresh publication while historical approval replay remains valid.

These five PostgreSQL groups are prepared, not assistant-executed. The advisory barrier is bounded and fixture-only. Existing scripted binding tests remain distinct from the new actual writer tests.

After both verification gates pass, implement persisted creation/teacher submission and admin return/approved-reopen/source-refresh commands using the same provenance, lock ordering, optimistic versions and atomic idempotency. Then address restricted roles, grants/RLS, parent/authority insertion/mutation protocols and independent security review before real server routes. No production migration, publication endpoint, deployment or merge is authorized by this batch.

## Subsequent verification and companion workflow

The user confirmed all 309 offline tests and all 28 PostgreSQL groups passed. The next companion adapter now prepares creation, teacher submission, admin return and approved reopen; see `REPORT_CARD_PERSISTED_WORKFLOW_REVIEW.md`. Both mutation adapters share an exclusive school-user actor anchor acquired after the shared discovery gate and before report locks. This strengthens actor-scoped operation-key serialization across command families; the previous standalone approval/publication behavior remains under regression tests.
