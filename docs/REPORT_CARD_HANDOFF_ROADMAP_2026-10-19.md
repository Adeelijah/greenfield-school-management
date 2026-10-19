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

The disposable harness adds four opt-in restricted-role groups (42 total when enabled). They require a separate explicit disposable role-admin confirmation and a LOCAL role-admin test connection. Roles, policies, grants and workload writes are created inside an intentionally rolled-back transaction; current_user is checked for reader and writer execution. Ordinary mode remains 38 groups plus a clear restricted-groups skip. No new SQL was executed here. See `ASSESSMENT_DISPOSABLE_SECURITY_REVIEW.md` for the required privileges, role/session limits and pending gates.

Next after full offline and opt-in PostgreSQL verification: restricted failure/concurrency tests, release revocation/correction policy and the final live auth/login privilege contract, then route/UI integration. These are trusted school service roles, not end-user identities; do not claim school-scoped RLS replaces teacher/admin/guardian authorization or proves a production deployment.
