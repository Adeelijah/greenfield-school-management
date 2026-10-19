# Persisted report creation and correction workflow — fixture only

The user verified the preceding canonical snapshot/approval/publication batch: all 309 offline tests and all 28 PostgreSQL groups passed. This companion adapter implements the remaining current workflow operations in isolated schema-faithful fixtures. No application routes, production schema exports, migrations, live identity provider, grants/RLS, guardian endpoint or deployment changed.

## Commands and authority

`executeFixtureReportWorkflow` owns one outer transaction. Creation input contains student/enrollment/class/session/term selectors and an operation key, never authoritative school, actor, source revision or report ID. The existing verified complete source reader validates the actual active placement, finalized assessments, canonical content and current reviewer/admin/teaching authority. The adapter generates a report ID and persists a draft at version 1, an explicit creation audit and durable receipt. Draft report persistence requires a complete existing finalized source; unfinished score-entry drafts stay in the assessment layer.

Both admins and fully assigned teachers can create. Only an active assigned teacher may submit/resubmit. Only an active admin may return a submitted report or reopen an approved report. Bursars and suspended/missing identities fail. Teacher replay also checks current class/session assignment. Submission uses the report's locked placement and requires the newest complete verified source, updating its source pin in the same transaction. It cannot silently move the report to a different enrollment/scope.

Admin return/reopen deliberately does not require fresh assessments, so an invalidated source cannot trap a report in review. A return requires a trimmed nonempty reason of at most 2,000 characters. Reopen requires an existing approved-version snapshot; it clears current approval/submission fields without mutating historical snapshots. Resubmission then requires fresh complete finalized source again. The old snapshot retains its own immutable source FK when the report pin advances.

Published reopen/corrections remain denied. Fresh correction commands also refuse a report with an active release, even if privileged fixture DML made its mutable stage inconsistent. Revocation and published correction lineage need their own reviewed policy.

## Atomicity, lock order and retry

`report-card-postgres-command-context.ts` is shared by both mutation adapters. It acquires the shared source gate, then an exclusive school-user row for the verified actor, then membership/school locks. The actor anchor serializes all operation keys for that actor across creation, submission and approval/publication families. Read adapters use shared school-user locks; never upgrade a previously opened read path into this mutation protocol.

Creation additionally acquires a transaction-scoped advisory lock on the verified school plus logical student/class/session/term identity before source/duplicate discovery. Different actors cannot both create that report. Advisory hash collisions only serialize unrelated identities; the real unique report constraint remains authoritative. Existing report mutations lock the school-scoped report and apply optimistic version/stage predicates. Source, report, audit and receipt effects stay inside the same transaction, with failures thrown across its boundary before becoming generic outcomes.

Fingerprints are computed server-side from a versioned intent and verified school/actor. Creation fingerprints omit its generated report ID, making retries stable. Transition fingerprints include the expected version and normalized return reason. A matching receipt replays the historical outcome even after later state/source changes; replay is not current publication visibility. Changed payloads or cross-family use of an actor key fail. A revoked teacher assignment denies access even to historical replay metadata. No caller fingerprint or actor flag is used as authority.

## Review-only schema additions

The proposed report action enum gains `create`; report stages remain unchanged. Audit creation is exactly draft → draft, version 0 → 1; all later actions still require positive beforeVersion and afterVersion = beforeVersion + 1. Audit rows gain nullable `reason`: return requires a nonempty reason, all other actions require null. This preserves return history after the report's current reason clears on submission. Existing fixture append-only audit triggers protect these new fields as well.

The proposal/emitter is still excluded from migration entrypoints. Existing deployed data has not been inspected or backfilled; a future migration requires explicit handling of historical return audits without reasons. Owner-run fixture checks do not establish production privileges or role security.

## Verification

Twelve new workflow unit tests cover role and assignment boundaries, server-generated creation, duplicate identity/key conflicts, retained return reasons, old snapshots, fresh-source resubmission, historical replay, all mutation rollback points and cross-family keys. Two metadata tests cover creation version arithmetic and durable audit reasons. Existing approval/publication fake infrastructure moved into the fictional test helper for reuse; its eight regression tests remain unchanged in behavior.

All 96 selected unit tests, JavaScript syntax and tracked whitespace checks passed here. The expected full offline count is 323. Full TypeScript/ESLint and the two new Drizzle metadata assertions require the installed environment.

Five groups extend the disposable PostgreSQL harness from 28 to 33:

- Same-actor creation retry and cross-actor duplicate identity races yield one report and a valid 0 → 1 audit.
- Concurrent submission, return/resubmission, approval and approved reopen preserve audit reasons and snapshots.
- Stale-source recovery cannot bypass finalization; later submission binds a freshly sealed source while prior snapshots and historical replay remain valid.
- Actual report/audit/receipt failures roll back creation and every correction transition, preserving state and allowing same-key retry.
- Role, assignment, foreign enrollment, cross-family receipt, active-release and audit-shape guards fail closed.

The new PostgreSQL groups are prepared, not executed here. The fixture grows to eleven fictional pupils to avoid colliding with prior report identity tests; its relation count remains 27. No dependencies were installed and no SQL was executed by the assistant.

After both gates pass, address restricted database roles/grants/RLS and the complete parent/authority mutation and release protocol before application routes. Do not infer production enforcement from fixture-owner connections or use the current internal snapshots as publicly accessible/printed school reports.
