# Greenfield Report Cards — continuation roadmap and new-chat handoff

**Updated:** 2026-10-19. **Repository:** `Adeelijah/greenfield-school-management`. **Working branch:** `report-cards-foundation`. Do not merge or deploy without explicit approval. This document records what the user actually ran and what remains unverified; it is not a claim of production readiness.

## Read this first in a new chat

1. Read `AGENTS.md` and `docs/DEVELOPMENT_WORKFLOW.md`; honor approval gates, no secret inspection, no Supabase/production DB changes.
2. Review `docs/REPORT_CARD_DISPOSABLE_ADAPTER_REVIEW.md`, `docs/REPORT_CARD_DISPOSABLE_POSTGRES_TESTS.md`, `docs/REPORT_CARD_MIGRATION_READINESS_REVIEW.md`, `docs/REPORT_CARD_RLS_REVIEW.md`, and `docs/REPORT_CARD_TRANSACTION_PORT_REVIEW.md`.
3. Inspect the latest `report-cards-foundation` commit and working tree before edits. Do not assume local uncommitted changes are safe to overwrite.
4. The JSONB failure was resolved in commit `3d7f54c`; all 11 expanded integration groups subsequently passed in the user’s local run. Continue Phase B authoritative source-read integration.

## Project context

Greenfield is a Next.js 16 / React 19 / TypeScript / Tailwind 4 / Supabase SSR Auth / Drizzle PostgreSQL school management system. Academic scope: Creche, Nursery, Primary, with Primary 5/6 configurable. The school deployment model is still under review; tenant/school-scoped security is required regardless. Report Cards is an **isolated, unshipped foundation**; no production schema/migrations or guardian releases have been enabled.

## What is implemented

- Pure report projection: `src/lib/academics/report-cards.ts` (always `publishable:false`).
- In-memory teacher/admin/bursar report workflow and dev preview `/preview/report-cards`.
- Preflight and assignment validation, write policy, receipts/idempotency and in-memory atomic transaction simulator.
- Canonical snapshot hashing, academic payload/source-readiness policies, and trusted enrollment/finalized-source checks (pure logic; not yet integrated with live database reads).
- Review-only Drizzle proposal `src/db/report-cards-schema.proposal.ts` and review documents; **not imported into live `src/db/schema.ts` or migrations**. Proposal includes a shadow `terms` declaration; do not include it in migration glob.
- Driver-neutral transaction port `src/lib/academics/report-card-transaction-port.ts` with `executeReportTransaction`.
- Disposable PostgreSQL smoke test `scripts/report-card-postgres-disposable-smoke.mjs`.
- Disposable concurrency test `scripts/report-card-postgres-concurrency.mjs`.
- Disposable adapter `src/lib/academics/report-card-postgres-disposable-adapter.ts` and integration harness `scripts/report-card-postgres-adapter-integration.mjs`. These use synthetic fixture tables in a random `rc_it_...` schema, **not** the proposed real report-card tables.

## Confirmed local verification (user-reported)

- Prior offline test suite: **189 tests passed**; rerun before new completion claims.
- PostgreSQL 18 on Windows, database `greenfield_report_cards_disposable`, login `greenfield_test`.
- Smoke test: **2/2 passed** (optimistic version update; savepoint rollback).
- Simplified concurrency suite: **5/5 passed** (conflicting writers, duplicate idempotency, tenant-scoped lookup, rollback, publication stage).
- The user ran the adapter integration harness after commit `3d7f54c` and reported **all six original integration groups passing** on 2026-10-19. JSONB fixture/source round trips and report/audit writes, concurrent submissions, duplicate-key replay, cross-school membership rejection, receipt rollback, and approval/publication serialization passed.
- The user then cleared the disposable database environment and temporary password variables.
- The earlier `not_found` and JSONB string/object failures are historical, not current blockers. Preserve explicit text parameter binding and JSONB type/round-trip assertions.
- Expanded Phase A tests now cover denial without writes, receipt conflicts, audit/release failures, and retry/replay after rollback. The user subsequently confirmed **all 11 PostgreSQL groups passed**, along with the full offline gate: TypeScript, ESLint (one unrelated unused-import warning), 189 tests and whitespace.

## Current task: Phase B authoritative read coordinator

Phase A passed in the user’s local disposable database. Phase B now has an isolated, offline-tested read coordinator (`report-card-authoritative-read.ts`) and a transaction-bound read port. It derives school/actor scope from verified-identity and membership methods, recomputes the projection, validates enrollment/finalized source bindings and checks revision drift. This is **not a live SQL/auth adapter** and is not wired to routes or the transaction writer. The user confirmed this coordinator passed the full offline gate with 199 tests. The user subsequently confirmed the separate disposable SQL reader passed 204 offline tests, TypeScript/ESLint/whitespace and all five PostgreSQL read/locking groups. The user subsequently verified the combined transaction wrapper: all 208 offline tests and all ten PostgreSQL read/combined groups passed. The user confirmed the selected-column mapping milestone passed the full offline gate with 218 tests. Assessment storage and source-revision models are absent from the production schema source; session/term domain fields are incomplete. An isolated 11-table Drizzle assessment proposal, eight metadata tests and `ASSESSMENT_PERSISTENCE_PROPOSAL_REVIEW.md` are now prepared. The user confirmed the schema proposal passed the full offline gate with 226 tests; no SQL has been generated or executed. A pure assessment persistence policy and ten tests now address source/workflow revision separation, complete scope plans, exact decimal/component validation and observational keys. `ASSESSMENT_SOURCE_POLICY_REVIEW.md` documents exact prerequisite names and remaining DB enforcement work. The user confirmed the source-policy milestone passed the full offline gate with 236 tests. A metadata-derived schema-faithful fixture builder, three offline emitter tests and `scripts/assessment-postgres-schema-integration.mjs` are now prepared; the user confirmed all 239 offline tests and seven schema-faithful PostgreSQL groups passed. A fixture-only source-write guard builder, four offline tests and five new harness groups now cover statement-before-row locking, phantom enrollment/scope inserts, multi-term/class invalidation, rollback and unchanged review/finalization revisions; the user confirmed all 243 offline tests and twelve PostgreSQL groups passed. See `ASSESSMENT_DISPOSABLE_WRITE_GUARDS.md`. A schema-faithful joined source reader with typed selected-row decoders is user-verified: 251 offline tests and all fifteen PostgreSQL groups passed. See `ASSESSMENT_RELATIONAL_SOURCE_READER.md`. See `ASSESSMENT_DISPOSABLE_SCHEMA_TESTS.md`. Next: exact recalculation and complete canonical source provenance, then remaining enforced writer/role/multi-scope gates; production authentication, immutable snapshots, RLS and guardian authorization remain pending.

### Local run instructions (Windows PowerShell)

```powershell
cd C:\Dev\greenfield-school-management
git pull origin report-cards-foundation
$securePassword = Read-Host "Enter greenfield_test password" -AsSecureString
$credential = [System.Net.NetworkCredential]::new("", $securePassword)
$encodedPassword = [uri]::EscapeDataString($credential.Password)
$env:REPORT_CARD_TEST_DATABASE_URL = "postgresql://greenfield_test:${encodedPassword}@localhost:5432/greenfield_report_cards_disposable"
$env:REPORT_CARD_TEST_CONFIRM = "DISPOSABLE_REPORT_CARD_TEST_ONLY"
try {
  node --experimental-strip-types .\scripts\report-card-postgres-adapter-integration.mjs
} finally {
  Remove-Item Env:REPORT_CARD_TEST_DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:REPORT_CARD_TEST_CONFIRM -ErrorAction SilentlyContinue
  Remove-Variable securePassword, credential, encodedPassword -ErrorAction SilentlyContinue
}
```

Never paste the password or connection URL into chat. Scripts must enforce disposable DB name and explicit opt-in. A successful `DROP SCHEMA ... CASCADE` notice about its own `rc_it_...` fixture tables is normal.

## Roadmap to production-ready Report Cards

### Phase A — Complete isolated adapter tests (USER-VERIFIED COMPLETE)
- JSONB fixture read failure resolved; original six integration groups passed locally.
- Expanded `executeReportTransaction` integration suite confirmed: all 11 groups passed in the user’s disposable PostgreSQL run.
- Add negative tests for cross-school report IDs, invalid actor/assignment, stale assessment revision, invalid stage, failed audit/release insert and receipt conflict.
- Verify atomicity and idempotency after real transaction failures.
**Exit:** reproducible passing integration suite, no production DB changes.

### Phase B — Authoritative academic source reads
- Implement server-derived authenticated active membership and class assignment lookup, school/student enrollment/session/term/class validation, and finalized subject assessment reads.
- Use existing source-readiness and snapshot policies; enforce completeness, revision freshness and lock ordering in one transaction.
- Never accept role, school ID, assessment revision or assignment flags as client authority.
**Exit:** independent trusted-read tests with cross-school, missing/incomplete, stale and suspended-user cases.

### Phase C — Persistence schema and canonical snapshots
- Review proposal and reconcile with existing Drizzle models; correct composite school-scoped FKs, unique idempotency receipts, immutable versioned snapshots, audits and releases.
- Enforce canonical deterministic JSON/hash, stable assessment source revisions, and atomic snapshot writes.
- Produce reviewed migration SQL, rollback/recovery and data-retention plan; do not apply without explicit approval.
**Exit:** approved schema/security design and disposable-db migration tests.

### Phase D — Database authorization and release security
- Define and verify least-privilege database grants, tenant RLS, trusted server authentication boundary and transaction-scoped membership checks.
- Enforce separate submitter/admin approval, explicit publish/reopen semantics, immutable released snapshot and guardian visibility **only after authorized release**.
- Add adversarial tests for forged school IDs, other-school guardians, stale role changes and replay collisions.
**Exit:** security tests pass against isolated DB with documented threat model; independent review before deployment.

### Phase E — Real server routes and teacher/admin UX
- Replace preview-only operations with authenticated server actions/API and transactional adapter.
- Teacher draft/submit/return flow; admin review, reason, approval, publish/reopen; status history, error states, accessibility and mobile QA.
- No bursar academic approval; no guardian access to drafts.
**Exit:** authorized end-to-end workflows and UI/browser tests in safe staging.

### Phase F — School configuration and report output
- School-specific terms, class levels, grading scales, subjects, teacher comments, attendance, optional signatures, branding and printable/exportable report cards.
- Guard output against unapproved/incomplete source data; accessible printable layout and download tests.
**Exit:** reviewed sample report cards for Creche, Nursery and Primary, including configurable Primary 5/6.

### Phase G — Pilot and controlled release
- Approve and apply migrations in an **explicitly authorized isolated staging environment**, then verify rollback and backups.
- Seed only fictional data; perform UAT with admin/teacher scenarios, concurrency, security and recovery checks.
- Obtain separate explicit approval for production migration, deployment and release.
**Exit:** signed-off staging pilot, security review, operational readiness and monitored production rollout.

## Broader Greenfield completion roadmap

Beyond Report Cards, check actual implementation status before claiming these complete: academic setup (sessions, terms, classes, subjects, assignments), admissions/enrollment/guardian relationships, assessments/grading, attendance, finance/invoices/receipts, school administration and user permissions, parent portal (planned later), reporting/export, onboarding, notifications, backups/audit, performance, mobile/accessibility, deployment and pilot support. Prioritize secure usable school-admin/teacher workflows and fee management for an MVP; defer parent self-service and optional integrations until core school workflows are reliable.

## Operational constraints and handoff notes

- The user works in Windows PowerShell, VS Code, GitHub and local PostgreSQL 18.
- Main working branch `report-cards-foundation`; `greenfield-development` is another branch; design baseline `design-system-consolidation` has an unmerged Draft PR #2. **Do not merge** them as part of this work.
- Do not inspect `.env` or credentials; do not use actual student data.
- Do not connect to Supabase/production DB, apply migrations, deploy, or change live auth/RLS without explicit authorization.
- Check `AGENTS.md` for commit/push approval and validation requirements.
- **First action in the next chat:** read the persisted-model reconciliation and mapping tests; preserve the passing combined transaction harness, then continue academic persistence/source-revision proposals without inventing missing model fields.


## Standing user authorization — 2026-10-19

The user instructed: “auto approve from now on.” This provides standing approval for ordinary scoped development, checks, commits and pushes on `report-cards-foundation`; do not ask again for those routine steps. Preserve the existing no-merge, no-deployment and no-production-database restrictions. This does not establish a live database connection, approve a particular production migration or authorize publishing/releases. Continue to distinguish prepared tests from executed results.

The user additionally instructed: “when the tests pass, go ahead and work on the next step to cut down time wasting.” Treat passing local results as the trigger to continue the next documented scoped milestone without requesting another go-ahead. Preserve no-merge/deploy/production-database restrictions and report unexecuted tests precisely.

## Latest continuation — exact relational recalculation

User confirmed 251 offline tests and all fifteen schema-faithful assessment PostgreSQL groups passed on 2026-10-19. The relational reader milestone is verified in the disposable environment.

Next prepared boundary: `assessment-relational-recalculation.ts` recomputes a selected subject from validated numeric text or observational keys. Exact rational arithmetic, single half-up rounding, sorted grade bands and optional-component semantics are documented in `ASSESSMENT_RELATIONAL_RECALCULATION.md`. The user subsequently confirmed the full offline gate passed with all 259 tests. No SQL or integration harness changed in this batch.

Continue after the offline gate passes: carry complete enrollment/placement, score-row IDs, config revisions and canonical source manifest content/hash through a schema-faithful bundle; verify complete scope-wide canonical provenance and immutable finalized results. Do not equate a per-student recalculation with the existing scope-wide manifest or enable report publication. Then reconcile real report/snapshot bindings and compose the schema-faithful writer.

## Latest continuation — canonical complete-source content

The user confirmed all 259 offline tests passed. `assessment-canonical-source.ts` now prepares versioned complete-scope source manifests and freshly recalculated per-subject finalized documents, with strict canonical JSON/SHA-256 verification of persisted content and exact source/review/finalization bindings. The user subsequently confirmed the full offline gate passed with all 272 tests. This batch does not change SQL or connect to any database. See `ASSESSMENT_CANONICAL_SOURCE_REVIEW.md` for the completeness contract and remaining authority boundary.

Next after offline verification: implement the transaction-scoped schema-faithful complete SQL loader and round-trip real complete manifests/finalizations through JSONB in the disposable harness. The existing selected-student reader and synthetic minimal manifest data are not sufficient for this verifier. Continue into real report/snapshot bindings only after complete-loader provenance and lock tests pass.

## Latest continuation — complete PostgreSQL canonical reads

The user confirmed all 272 offline tests passed. `assessment-postgres-canonical-reader.ts` now prepares complete, transaction-scoped schema-faithful source discovery/materialization and content verification, reusing existing selected-column decoders and reviewer/admin authority checks. Ten new offline tests raise the expected full gate to 282 tests; four added PostgreSQL groups raise the disposable harness to nineteen. Locally, 54 selected tests, script syntax and tracked whitespace passed. The user subsequently confirmed the full offline gate passed with all 282 tests and all nineteen PostgreSQL groups passed. See `ASSESSMENT_POSTGRES_CANONICAL_READER.md`.

Next only after both gates pass: reconcile report proposal enrollment/source-version/snapshot references and immutable release bindings, then compose the schema-faithful report writer. Preserve source discovery gate ordering, rollback/idempotency behavior and the separate no-production/no-deployment boundary.

## Latest continuation — report enrollment/source/snapshot/release binding

User confirmed 282 offline tests and all nineteen schema-faithful PostgreSQL groups passed. The report proposal now pins exact enrollment/student/class/session, assessment scope and source revision; snapshots pin stable report enrollment/scope and immutable source version; audits/releases reference the exact snapshot/report/approved version. The optional fixture emitter includes five report relations (27 total tables) plus the isolated enrollment composite-key prerequisite. Eight new report metadata tests and three extended-emitter tests raise the expected offline count to 293. Four new binding/rollback/immutability groups raise the PostgreSQL harness to 23. The user subsequently confirmed all 293 offline tests and all 23 PostgreSQL groups passed. See `REPORT_CARD_SNAPSHOT_BINDING_REVIEW.md`.

Next after both gates pass: implement a typed canonical report snapshot builder from a selected pupil in the verified complete assessment bundle, then compose a schema-faithful transaction writer that pins the approved snapshot, revalidates source freshness and atomically persists audit/receipt/release. Preserve existing synthetic transaction tests and do not invent missing calendar versions. Production auth/grants/RLS, guardian release access, published-correction policy and deployment remain separate gates.

## Latest continuation — actual canonical approval/publication writer

The user confirmed 293 offline tests and all 23 PostgreSQL groups passed. `report-card-approved-snapshot.ts` now builds a canonical selected-pupil approval snapshot from verified complete documents. `report-card-postgres-canonical-writer.ts` owns an outer transaction for approval/publication of existing reports, derives admin/school authority, locks report/source/roles, computes command fingerprints, preserves historical replay and atomically persists snapshot/report/audit/receipt/release. The complete reader now returns its verified source/finalization/review documents. No app routes or production schema/auth changed.

Sixteen new tests raise the expected full offline count to 309; all 84 selected unit tests and syntax/whitespace checks passed here. Five new actual-writer PostgreSQL groups raise the harness to 28. The user subsequently confirmed all 309 offline tests and all 28 PostgreSQL groups passed. See `REPORT_CARD_CANONICAL_WRITER_REVIEW.md`.

Next after both gates pass: add persisted report creation/teacher submission and admin return/approved-reopen/source refresh with the same canonical provenance and idempotency guarantees. Published corrections/revocation, real auth, least privilege/RLS and guardian visibility remain separate gates before route/UI integration. Do not claim the partial approval/publication writer is a complete report workflow.

## Latest continuation — persisted creation and correction workflow

User confirmed 309 offline tests and all 28 PostgreSQL groups passed. `report-card-postgres-workflow-writer.ts` now implements creation, teacher submission/resubmission, admin return and approved-only reopen. Creation derives source/identity and server report IDs; submission refreshes a verified current source; return/reopen permit stale-source recovery while preserving historical snapshots. Return reasons are retained in immutable audit rows. The review-only audit proposal adds create (0 → 1) and a nullable reason with action-specific checks. No production schema or generated migration changed.

Both writer families now share `report-card-postgres-command-context.ts`: source gate first, exclusive school-user actor anchor, membership/school then report/creation identity locks. This serializes actor-wide receipt keys, including creation versus approval/publication. New creation identity advisory locks coordinate different actors. Twelve new workflow tests and two metadata tests raise the expected offline count to 323; all 96 selected unit tests and syntax/whitespace checks passed here. Five added PostgreSQL groups raise the harness to 33. The user subsequently confirmed all 323 offline tests and all 33 PostgreSQL groups passed. See `REPORT_CARD_PERSISTED_WORKFLOW_REVIEW.md`.

Next after both gates pass: review and close the remaining database authorization/authority-mutation boundary before route integration: restricted fixture writer/reader grants and RLS, parent/membership/assignment insert/update/delete protocol, immutable release/revocation policy and adversarial tests. Prepare concrete fixture-only security work first; do not infer production enforcement from owner-run tests or enable guardian/public routes. Published corrections, live auth integration, UI wiring/QA and deployment remain later gates.


## Latest continuation — parent and authority lock ordering

User verified 323 offline tests and all 33 PostgreSQL groups. The fixture-only authority guard builder adds BEFORE STATEMENT discovery-gate acquisition for inserts, updates and deletes on eleven parent/authority relations, and rejects truncate. This prevents absent-row/phantom mutations from bypassing the gate simply because existing readers did not lock their new row. It reuses the existing invoker trigger functions and creates no roles, grants, policies or production changes.

Three offline tests raise the expected gate to 326; two prepared PostgreSQL groups raise the harness to 35. The user subsequently verified all 326 offline tests and all 35 PostgreSQL groups passed. See `ASSESSMENT_AUTHORITY_LOCK_REVIEW.md`.

Continue with academic parent revision fan-out (including old/new placement scopes and rollback/deduplication), then restricted fixture roles/grants/RLS and release/revocation policy. Lock ordering alone does not enforce authorization or advance revisions for parent content edits. Existing canonical reconstruction still rejects changed content; no route/UI release is enabled.


## Latest continuation — academic parent revision fan-out

User verified 326 offline tests and all 35 PostgreSQL groups. Seven academic parent families now prepare fixture-only BEFORE UPDATE/DELETE invalidation of their dependent scopes, including complete class/session/term fan-out and pre-cascade enrollment discovery. The existing transaction/scope claim protocol deduplicates overlapping parent and score changes and rolls back revisions with failed receipts. Authority-only changes retain transaction gate locking without changing academic revisions.

Two added offline assertions raise the expected full count to 328; three prepared PostgreSQL groups raise the harness to 38. All 52 selected offline tests plus syntax/whitespace passed here. The user subsequently confirmed all 328 offline tests and all 38 PostgreSQL groups passed. See `ASSESSMENT_AUTHORITY_LOCK_REVIEW.md` for conservative no-op update behavior and boundaries.

Next after verification: restricted fixture reader/writer grants and RLS with adversarial role/tenant tests, then immutable release/revocation policy before routes. Owner-run tests still do not demonstrate deployed authorization. No production schema, migration, live auth or route changed.


## Latest continuation — restricted fixture role preflight

User verified 328 offline tests and all 38 PostgreSQL groups. A catalog-only query plan and strict offline role-evidence validator now prepare the restricted reader/writer prerequisites: generated role names, exact rows, no privileged flags, no object ownership and no outgoing role memberships. Nine tests raise the expected offline count to 337. No SQL was executed or added to the PostgreSQL harness; its 38 groups remain user-verified. The user subsequently confirmed all 337 offline tests passed.

See `ASSESSMENT_RESTRICTED_ROLE_PREFLIGHT.md`. This is a prerequisite, not implemented grants/RLS or a security certificate. Next: controlled role-admin fixture setup, explicit execution-role checks and the restricted privilege/function boundary. Resolve locking-reader UPDATE privilege requirements without broadening access blindly; do not use caller-controlled GUC values as identity. Keep direct client access denied. Release/revocation policy, live auth, route/UI integration and deployment remain later.


## Latest continuation — fixed-school fixture permissions and opt-in role tests

User verified 337 offline tests. A fixture-only security plan now prepares forced RLS, restrictive fixed-school service-role clamps, scoped SELECT/locking privileges, statement mutation guards and narrowly listed report transition columns. No role creation or SQL is executed by the builder. Eight offline tests raise the expected total to 345; all 26 related tests, syntax and whitespace passed here.

The disposable harness adds four opt-in restricted-role groups (42 total when enabled). They require a separate explicit disposable role-admin confirmation and a LOCAL role-admin test connection. Roles, policies, grants and workload writes are created inside an intentionally rolled-back transaction; current_user is checked for reader and writer execution. Ordinary mode remains 38 groups plus a clear restricted-groups skip. The user subsequently verified all 42 PostgreSQL groups passed, including all four restricted-role groups. No SQL was executed by the assistant. See `ASSESSMENT_DISPOSABLE_SECURITY_REVIEW.md` for the required privileges, role/session limits and pending gates.

Next after full offline and opt-in PostgreSQL verification: restricted failure/concurrency tests, release revocation/correction policy and the final live auth/login privilege contract, then route/UI integration. These are trusted school service roles, not end-user identities; do not claim school-scoped RLS replaces teacher/admin/guardian authorization or proves a production deployment.


## Latest continuation — restricted writer failure and recovery

User verified all 42 PostgreSQL groups. Three additional opt-in groups now prepare real restricted-role creation/submission, approval and publication failure injection, full report/source state rollback assertions, same-key retry/replay and single-snapshot/release checks. Role/policy/workload rollback remains automatic. All 46 related offline tests plus syntax/whitespace passed here. Offline count remains 345; latest explicitly confirmed offline count is 337. New expected opt-in PostgreSQL count: 45; ordinary mode remains 38 plus an explicit seven-group skip. The user subsequently verified all 45 PostgreSQL groups passed.

See `ASSESSMENT_DISPOSABLE_SECURITY_REVIEW.md`. Next: review and implement immutable published-release revocation/correction policy, and close restricted independent-session concurrency/login/authority gaps before routes. Do not claim savepoint tests establish concurrent-session behavior; uncommitted disposable roles cannot be used from another session. Preserve no-merge/deploy/production restrictions.


## Latest continuation — published correction policy

User verified all 45 PostgreSQL groups. `report-card-release-correction.ts` now prepares the pure withdrawal plan: active same-school admin, exact current release and approved snapshot, mandatory reason, optimistic report version, one-way release timestamp and published-to-draft correction. It preserves snapshots/publication provenance and permits stale-source withdrawal; subsequent submit must refresh a complete current source and repeat approval/publication. The module does not authenticate, persist or replay receipts.

Twelve new tests raise the expected full offline count from 345 to 357. All 38 selected tests plus syntax/whitespace passed here. The user subsequently confirmed all 357 offline tests passed. No SQL/harness changed; 45 PostgreSQL groups remain user-verified. See `REPORT_CARD_RELEASE_CORRECTION_REVIEW.md`.

Next: proposal audit/release binding and one-way revocation guards, then actual transactional revoke writer with actor-wide idempotency, restricted privileges and rollback/retry/history tests. Restricted independent-session concurrency and final login/live-auth contract still precede route/UI release. No merge, deployment, production schema or live authorization changes.


## Latest continuation — revocation audit binding and one-way history guards

User verified all 357 offline tests and the preceding 45 PostgreSQL groups. The isolated proposal adds revoke audit action/release ID, exact historical release/snapshot/publication-version FK, one revoke audit per release and action-specific reason/stage checks. A fixture-only guard builder freezes original release facts, allows one monotonic revoked_at transition and rejects restoration/deletion/truncation. No release privilege was broadened. Pure correction keys now match the receipt column's 128-character bound.

Three metadata tests and four guard tests raise expected offline count to 364. All 42 selected policy/guard/writer tests plus syntax/whitespace passed here. Full TypeScript/ESLint and new metadata assertions are pending local verification. Three new owner-run SQL groups prepare audit substitutions, one-way history and rollback/retry of manual atomic fixture withdrawal: expected 48 total with existing role-admin opt-in (41 owner-run plus seven restricted). The user subsequently verified all 48 PostgreSQL groups passed. No SQL was executed by the assistant. See `REPORT_CARD_REVOCATION_BINDING_REVIEW.md`.

Next after gates: actual canonical revoke transaction writer and narrowly controlled revoked_at access with restricted rollback/retry/history tests. This batch provides metadata/guards, not an authenticated revoke endpoint or a requirement that every owner update have an audit. Independent-session concurrency, final login/auth integration and UI remain later. Preserve no-merge/deploy/production changes.


## Latest continuation — actual revoke writer and restricted correction lifecycle

User verified all 48 PostgreSQL groups. `report-card-postgres-revoke-writer.ts` now owns withdrawal transactions with shared actor-key locking, active admin verification, exact locked release/snapshot, normalized fingerprint, historical receipt replay, pure correction planning and atomic report/release/audit/receipt writes. Revocation permits stale source withdrawal and does not mutate snapshots. Replay verifies the retained release and exact revoke audit after current report/source changes.

Fixture security now installs one-way history guards with grants and gives the writer only UPDATE(revoked_at), removing its release UPDATE(id). Reader and original-release mutation/deletion/restoration remain denied. Ten new adapter tests plus two privilege tests raise expected offline count to 376. All 62 selected offline tests, syntax and whitespace passed here; full TypeScript/ESLint remain pending. Latest explicitly confirmed offline count is 357.

Five prepared PostgreSQL groups raise expected opt-in total to 53 (43 owner groups plus ten restricted). They cover restricted failure/retry, complete republish/repeated correction history, outer concurrent same-key withdrawal and outer failure rollback/stale-source recovery. New SQL has not been executed here. See `REPORT_CARD_REVOKE_WRITER_REVIEW.md`.

Next after local gates: restricted independent-session concurrency, least-privilege login and final server identity/membership contract, then controlled server read/command integration and UI. Fixed-school trusted-service RLS is not end-user authorization; owner concurrency is not restricted-session concurrency. No merge, deployment, production migrations, live auth or real student data.


## Latest continuation — repair published timestamp in guard fixture

The user ran the 53-group harness: first 51 groups passed, then the owner concurrent revoke test failed with two invalid_release outcomes; the final group was not reached. An earlier active-release guard test restored published_at with now(), breaking equality with immutable release.released_at. The fixture now saves/restores its original timestamp and immediately asserts exact active-release equality. Revoke validation remains strict.

A new unit regression demonstrates mismatch rejection and successful exact restoration. All 63 selected tests, syntax and whitespace passed here. Expected offline count is 377; full local TypeScript/ESLint and complete 53-group PostgreSQL rerun are pending. Do not mark 53 groups verified or advance the roadmap past this repair until that run passes. Latest explicitly confirmed full offline count remains 357. See `REPORT_CARD_REVOKE_WRITER_REVIEW.md`.


## Latest repair — narrow decoded receipt outcome before replay validation

User's offline rerun stopped at TypeScript: ten TS18046 errors from accessing an unknown receipt outcome in the revoke adapter. An explicit runtime object predicate now narrows the value to Record<string, unknown> before field checks; malformed outcomes reject as invalid_receipt. No assertion cast, suppression, SQL or authorization relaxation was introduced. One new regression covers primitive/array/encoded/missing-field outcomes and no mutation.

All 64 selected tests plus syntax/whitespace passed here. Expected offline count is 378; full local TypeScript/ESLint and the complete 53 PostgreSQL groups are still pending. Do not advance beyond these repairs or mark the expanded suite verified before both local gates pass. Latest explicitly verified full offline count remains 357; first 51 groups of the prior expanded PostgreSQL run passed before the now-repaired fixture timestamp mismatch.


## Verified PostgreSQL repair result — 2026-10-19

User supplied the complete successful rerun: all 53 PostgreSQL groups passed, including exact timestamp restoration, outer concurrent same-key withdrawal, restricted correction/republication/repeated history and final outer failure rollback. PostgreSQL verification for this milestone is complete in the disposable environment. No additional SQL or production change was made for this status update.

The repaired full offline gate is still unconfirmed: its last supplied output stopped at TS18046 before the receipt-object narrowing fix. Run the current verify-offline.mjs and require TypeScript, ESLint, all 378 tests and whitespace to pass. No further database rerun is required solely for this documentation update. Once the offline gate passes, continue restricted independent-session concurrency and least-privilege login/authority work without another approval request. Preserve no-merge/deploy/production restrictions.


## Latest continuation — independent restricted-role sessions

User confirmed all 378 offline tests passed after the repair, alongside the complete 53-group PostgreSQL run. The next harness extension prepares a separately generated, briefly committed fictional schema and NOLOGIN roles so distinct backends can exercise the restricted workflow. Clone ordering respects audit/release FKs and schema-local enum casts; gates/claims are recreated without advancing copied source revisions. An owner-only per-run marker controls exact cleanup, including an intentional workload-error probe.

A bounded offline rendezvous verifies two distinct backend PIDs and the exact restricted role before paired workloads. Seven new tests raise expected offline count to 385; all 71 selected tests, syntax and whitespace passed here. Four prepared PostgreSQL groups raise opt-in expectation to 57 (43 owner, ten prior restricted, four independent-session groups). New SQL has not been executed here. Same existing local role-admin setup/test/cleanup block applies. See `REPORT_CARD_INDEPENDENT_ROLE_SESSIONS.md` for committed fixture cleanup and interruption limits.

Next after gates: actual least-privilege LOGIN/session credentials and final verified server identity/membership scope, then controlled server read/command and UI integration. Current workload role is restricted, but the session login is still the trusted admin harness. Preserve no-merge/deploy/production changes and do not claim live auth or login isolation from these tests alone.


## Latest continuation — actual disposable LOGIN boundary

User supplied all 57 PostgreSQL groups passed, including committed independent-session concurrency and exact cleanup after the intentional error. The next fixture extension provisions a third generated NOINHERIT LOGIN with an in-memory random password and exact SET-only reader/writer memberships. A separate pool authenticates as that login; every workload checks session_user as well as execution role/PID. Catalog preflight rejects privilege flags, ownership and unexpected or administrable/inherited memberships. Raw table access, administrator role switching, role/membership administration, fixture schema creation and RLS disabling must fail; RESET ROLE must return to the unprivileged login. Pool closure and exact login/CONNECT-grant cleanup join the existing marker-controlled cleanup.

Eight new offline tests prepare an expected full count of 393 (previous expected 385); latest explicitly confirmed full offline count remains 378. All 82 selected offline tests, script syntax and whitespace passed here. Two added SQL groups prepare an expected 59 with existing disposable role-admin opt-in. No new SQL was executed by the assistant; full local offline and expanded PostgreSQL gates remain pending. See REPORT_CARD_INDEPENDENT_ROLE_SESSIONS.md for authentication and interruption limits. Generated LOGIN state can remain after forced termination/server outage; no broad cleanup or production role changes are performed.

Next after these gates: final server identity/membership scope contract, then controlled server read/command integration and UI. Preserve no merge, deployment, production changes, live auth or real pupil data. Continue automatically after passing gates within standing authorization.


## Verified LOGIN result and server authority review — 2026-10-20

User supplied the complete 59-group PostgreSQL run: generated least-privilege LOGIN, independent restricted sessions, denial checks and exact role/schema cleanup all passed. The full 393-test offline gate remains unconfirmed; latest explicitly supplied full offline count is 378. No extra database rerun is needed for this documentation-only continuation.

Source review of server auth helpers, persisted identity mapping and fixture command context found a membership-completeness gap: the app requires exactly one active membership, while a fixed-school service role can hide an additional active membership in another school. Do not equate one visible membership with globally unambiguous authority or wire live report routes on that assumption. REPORT_CARD_SERVER_AUTHORITY_CONTRACT.md records the exact existing boundaries, proposed complete actor-only authority lookup and negative/concurrent acceptance cases. No auth code, RLS, grants or runtime behavior changed.

The execution environment is unavailable; this batch reviewed GitHub source and updates documentation only, with no new executed tests or SQL. Continue next with the outstanding offline gate, then isolated complete authority resolution and a server-only verified identity bridge. Preserve standing scoped development authorization and the no-merge/deployment/production-change constraints.

## Verified offline baseline - 2026-10-20

The user supplied the prior baseline: all 393 offline tests and all 59 disposable PostgreSQL groups passed. The current actor-authority source batch then passed the offline verifier with 405 tests. No new database connection or SQL execution has been authorized or performed.

## Report-card authority-resolution continuation - 2026-10-20

The source batch adds `report-card-actor-authority.ts`, requiring one actor-bound row with explicit complete-scope school-user and active-membership counts; `server/auth/report-card-identity.ts`, a server-only verified `getUser()` bridge calling a no-argument `resolve_report_card_actor` RPC and transaction-bound `lock_report_card_actor` recheck; and `docs/security/REPORT_CARD_ACTOR_AUTHORITY_REVIEW.sql`, which remains an unexecuted review draft. Twelve offline tests cover the decoder and static security contracts. The bridge is not referenced by any route, and neither SQL function nor its roles/policies/grants are installed. The opt-in PostgreSQL harness is syntax-checked but unrun.

Before report-card routes can be integrated, run a separately authorized isolated PostgreSQL test proving the helper sees a second active membership hidden by fixed-school RLS and serializes membership insertion/suspension against command execution. Assignment-removal and replay-after-authority-loss also require validation. Then review function-owner role policies, runtime role mapping, RLS interaction and lock order. These source and draft changes are not live authorization or production readiness.


## Authority harness lifecycle review — 2026-10-22

User committed and pushed actor-authority milestone 2e2d8d6210704efecd62e5f074597e1b91af751b, with the full offline gate passing 405 tests, TypeScript, ESLint (two existing warnings, zero errors) and tracked whitespace. The new authority PostgreSQL harness was syntax-checked but not run. Existing 59-group PostgreSQL results apply to the preceding fixture milestone only.

Review found swallowed cleanup errors could still produce a cleanup PASS, and lock-holder failure could leave readiness waiting indefinitely. A fixture-only lifecycle helper now bounds readiness, observes holder errors/early completion, releases and drains holders before cleanup, drops only acknowledged generated objects transactionally, and verifies catalog absence before cleanup success. Errors propagate, including both workload and cleanup failures. Eight offline lifecycle tests raise expected full count to 413; all 20 selected authority/static/lifecycle tests and script syntax passed here. The full expanded offline gate and five standalone authority PostgreSQL groups remain pending. No SQL or database connection was performed here. See REPORT_CARD_ACTOR_AUTHORITY_HARNESS_REVIEW.md.

Next: run the opted-in authority harness in the local disposable database. Review any failure before advancing. Assignment removal, replay after authority loss, writer-first lock ordering, runtime role mapping and actual request authentication still require evidence before routes are enabled. Preserve all unrelated local work and no merge, deployment or production/live auth changes.


## Windows checkout regression repair — 2026-10-22

User's expanded offline run reached 413 tests: 412 passed and one static actor-lock order check failed. Reproduced the same failure locally with the SQL fixture checked out as CRLF: the test searched for a literal LF between the actor predicate and FOR UPDATE. The check now normalizes line endings within its inspection and explicitly exercises both LF and CRLF copies, retaining required clauses and ordering. Only the static test changes; authority SQL and runtime authorization remain unchanged.

All 20 selected authority/static/lifecycle tests passed against CRLF fixture text here, and script syntax/whitespace passed. Expected full offline count remains 413; a complete Windows rerun is pending. The uploaded log contains no standalone authority PostgreSQL execution, so its five groups remain unverified. Continue with that isolated gate after the offline repair passes. No database connection or SQL execution occurred here.


## Verified authority gates and access-loss replay coverage — 2026-10-22

User verified all five standalone actor-authority PostgreSQL groups and then all 413 offline tests, TypeScript/ESLint and tracked whitespace. The Windows regression repair and standalone complete-membership fixture gates are now verified. This does not verify live Supabase RPC auth or installation of the SQL review draft.

Two prepared main assessment/report harness groups now exercise actual restricted writer historical replay during/after assignment removal, and teacher/admin membership suspension/reactivation. Report/snapshot/release/audit/receipt history must remain unchanged on denials and replays. Expected main PostgreSQL total rises from 59 to 61 with existing role-admin opt-in; its new groups remain pending. Full offline count stays 413. All 52 selected authority/static/lifecycle/writer tests, script syntax and scoped whitespace passed here. No database connection or SQL execution occurred here. See REPORT_CARD_ACCESS_LOSS_REPLAY_REVIEW.md.

Next after the expanded main harness: resolve writer-first lock ordering, runtime role mapping and actual server auth/transaction integration before report routes are enabled. The standalone complete authority resolver is not yet wired to the full report writers. Preserve no merge, deployment, production/live authorization changes and all unrelated local work.


## Verified access-loss replay and statement-gate continuation — 2026-10-22

User supplied all 61 main PostgreSQL groups passed, including restricted in-flight assignment removal and historical teacher/admin receipt denial after authority loss, with unchanged report history and exact cleanup. Full offline 413 and standalone authority five groups are also verified.

The standalone SQL review draft now prepares shared transaction advisory locking before authority discovery and exclusive BEFORE STATEMENT gates on school_users, memberships, schools and teacher_class_assignments, retaining actor/membership/school row locks and blocking authority truncate. This addresses the reverse arrival order left unproven by the prior row-only anchor trigger. Three new static tests raise expected offline count to 416; all 23 selected authority/static/lifecycle tests, CRLF regression, syntax and scoped whitespace passed here. Three prepared SQL groups raise standalone expectation to eight. No database connection or SQL execution occurred here. See REPORT_CARD_AUTHORITY_STATEMENT_GATE_REVIEW.md for conservative scope and integration limits.

Next: full 416-test gate and eight-group standalone disposable run; then common source/authority lock ordering, runtime role mapping and actual authenticated server/complete-authority/report transaction integration. The verified main 61 groups remain separate from the new complete resolver. No main harness rerun is required solely for this draft change. Preserve no merge, deployment, live auth or production changes.


## Verified eight authority groups and bridge behavior — 2026-10-22

User supplied all eight standalone authority PostgreSQL groups passed, alongside previously verified main 61 groups and offline 413. Latest requested offline 416 result is not separately supplied. Statement-before-row ordering is verified for the prepared standalone cases, not arbitrary combined source/authority transactions or actual SDK auth.

Eleven new offline tests execute the actual unused server bridge and decoder with SDK/driver/server-only imports intercepted. They cover auth and RPC errors, unbranded identity, locked authority refresh, assignment scope, callback ordering and transaction failure propagation. A failing regression exposed request principal drift: a transaction refresh could switch school, school-user or membership under the same auth ID. The bridge now rejects such rebinds before report work while honoring current locked role/configuration. No route or live auth configuration is changed.

All 34 selected authority/static/lifecycle/behavior tests, script syntax and scoped whitespace passed locally. Expected full offline count is now 427; full local TypeScript/ESLint remains pending. No SQL or DB connection occurred here. SQL draft/harnesses are unchanged, so no additional PostgreSQL rerun is needed solely for this batch. See REPORT_CARD_IDENTITY_BRIDGE_BEHAVIOR_REVIEW.md.

Next after offline verification: combined source/authority lock order, explicit runtime role mapping and real verified-request/complete-authority/report transaction integration in an isolated environment. Preserve all unrelated work and no merge/deploy/production/live-auth changes.


## Verified 427 offline tests and combined fixture continuation — 2026-10-22

User confirmed all current tests passed, verifying the requested 427-test offline gate. Standalone authority eight groups and main 61 groups remain verified. The next batch prepares one exact-writer transaction boundary combining source discovery, complete authority and existing workflow/canonical/revoke adapters. It rejects hidden membership ambiguity/principal drift and aborts on failed outcomes or caught SQL errors, preserving rollback across reused command callbacks.

A fixture-only DDL builder adapts the reviewed authority functions with source-before-advisory lock order, narrow non-login owner policies and writer-only EXECUTE. It leaves service school clamps intact and extends exact cleanup for the generated owner. Eleven boundary and four DDL tests raise expected full offline count to 442 across 58 files; all 49 selected tests, syntax and scoped whitespace passed here. Full installed TypeScript/ESLint gate remains pending. Three prepared SQL groups raise main expectation to 64; new SQL was not executed here. Standalone eight-group harness is unchanged. See REPORT_CARD_COMPLETE_FIXTURE_BOUNDARY_REVIEW.md.

Next after these gates: real verified-request command integration, explicit application runtime role/configuration and controlled staging migration/security preparation. The server SDK bridge is not wired into the fixture-only binding callback or routes. Preserve unrelated work and no merge, deployment, production database or live authorization changes.


## Verified complete boundary and server command continuation — 2026-10-22

The user confirmed the full 442-test offline gate and all 64 main PostgreSQL groups, including combined complete authority with actual restricted writers, outer rollback after a successful inner writer and both source/authority arrival orders. Standalone authority eight groups remain verified. Earlier pending notes describe historical milestones.

A server-only disposable command entry now calls the real request identity bridge, checks a fixed configured school, and dispatches all seven actions through the complete outer transaction. Its factory requires explicit disposable schema/school/writer configuration and a supplied restricted database adapter; it has no application connection fallback and is not wired to routes. A closed copied/frozen request parser rejects client authority fields and action-inappropriate fields. Safe scalar responses are prepared inside the outer transaction so invalid or failed outcomes roll back. Seven parser tests and twelve composition tests raise expected full offline count to 461 across 60 files; all 68 selected tests passed here. Full installed TypeScript/ESLint gate remains pending. No SQL or PostgreSQL harness changed, so the verified 64 main/eight authority groups need no rerun solely for this batch. See REPORT_CARD_VERIFIED_FIXTURE_COMMAND_REVIEW.md.

Next after the offline gate: reconcile production schema and runtime/security installation prerequisites into a controlled staging migration package. The SDK bridge's public RPC/private lock SQL remains review-only; no actual request cookie/JWT, configured staging connection, route, migration or deployed security behavior is verified. Preserve unrelated work and no merge/deploy/live auth/production database changes.


## Verified 461-test gate and staging package review — 2026-10-22

The user confirmed all tests passed after dispatch narrowing repair 03353b4, verifying TypeScript, ESLint, all 461 tests and tracked whitespace. Main 64 PostgreSQL and standalone eight authority groups remain verified; no rerun is needed for this documentation-only milestone.

The staging package at staging/REPORT_CARD_STAGING_PACKAGE_REVIEW.md reconciles the journal's 12-table foundation with current 18 base declarations, 16 proposed assessment/report relations and two shadow exclusions. It separates necessary academic structure/assignment changes from unrelated lifecycle changes, names the three extra FK targets, records the application/draft/fixture runtime mismatch and defines installation/recovery evidence. staging/REPORT_CARD_CATALOG_PREFLIGHT_REVIEW.sql contains only catalog-read queries for later separately authorized isolated review; it has not been executed or PostgreSQL-parsed. Source relation/count and read-only/whitespace checks passed. No source runtime, migrations, journal, SQL harness or deployed behavior changed; offline count remains 461.

Next implementation: prepare scoped academic dependency DDL and an isolated schema assembly with explicit export lists; review it before creating an executable migration or extending an authorized disposable baseline-upgrade rehearsal. Do not point Drizzle at a proposal glob, apply the whole Step 494 file, use an owner connection, wire routes, or infer a final school year/class mapping. Actual staging target selection, SQL installation and SDK request integration remain unverified. Standing source development/commit/push approval continues; production/live security/deployment restrictions remain.


## Academic dependency draft and explicit review assembly — 2026-10-22

The full 461-test gate remains user-verified. A qualified academic-only dependency SQL draft now selects levels/sections/assignments and base/prerequisite keys from the existing source, preserving the original Step 494 draft and omitting unrelated lifecycle/audit changes. An explicit review assembly reuses 27 actual table objects and eight used enums, excludes the two shadows, and is not a Drizzle Kit entrypoint. Production schema/config/journal, runtime routes and SQL harnesses remain unchanged.

Six source checks passed here. Four new installed-Drizzle metadata checks are prepared for FK closure, exact nonpartial unique targets/prerequisites, enum/table selection and actual base/shadow identity. Full expected offline count is 471 across 62 files, pending installed TypeScript/ESLint/metadata/full verification. New SQL is review-only and has not run or been PostgreSQL-parsed. See staging/REPORT_CARD_SCHEMA_ASSEMBLY_REVIEW.md. Main 64 and standalone eight groups remain verified for earlier fixtures; they do not verify this draft.

Next after the offline gate: prepare a guarded disposable baseline-to-target upgrade rehearsal with exact namespace adaptation, tables/unique targets before all FKs, incompatible-baseline rejection, catalog comparison and failure rollback. Do not install this qualified public delta into an unknown database, point Drizzle at the partial assembly, wire routes or change live security. Preserve no-merge/deploy/production restrictions and all unrelated work.
