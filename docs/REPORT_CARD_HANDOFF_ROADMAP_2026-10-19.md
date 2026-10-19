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

Phase A passed in the user’s local disposable database. Phase B now has an isolated, offline-tested read coordinator (`report-card-authoritative-read.ts`) and a transaction-bound read port. It derives school/actor scope from verified-identity and membership methods, recomputes the projection, validates enrollment/finalized source bindings and checks revision drift. This is **not a live SQL/auth adapter** and is not wired to routes or the transaction writer. The user confirmed this coordinator passed the full offline gate with 199 tests. The user subsequently confirmed the separate disposable SQL reader passed 204 offline tests, TypeScript/ESLint/whitespace and all five PostgreSQL read/locking groups. The user subsequently verified the combined transaction wrapper: all 208 offline tests and all ten PostgreSQL read/combined groups passed. The user confirmed the selected-column mapping milestone passed the full offline gate with 218 tests. Assessment storage and source-revision models are absent from the production schema source; session/term domain fields are incomplete. An isolated 11-table Drizzle assessment proposal, eight metadata tests and `ASSESSMENT_PERSISTENCE_PROPOSAL_REVIEW.md` are now prepared. The user confirmed the schema proposal passed the full offline gate with 226 tests; no SQL has been generated or executed. A pure assessment persistence policy and ten tests now address source/workflow revision separation, complete scope plans, exact decimal/component validation and observational keys. `ASSESSMENT_SOURCE_POLICY_REVIEW.md` documents exact prerequisite names and remaining DB enforcement work. The user confirmed the source-policy milestone passed the full offline gate with 236 tests. A metadata-derived schema-faithful fixture builder, three offline emitter tests and `scripts/assessment-postgres-schema-integration.mjs` are now prepared; dependency-backed emitter tests and PostgreSQL execution remain unverified. See `ASSESSMENT_DISPOSABLE_SCHEMA_TESTS.md`. Next: validate this harness in the separate local disposable database, then address remaining enforced writer/role/multi-scope gates; production authentication, immutable snapshots, RLS and guardian authorization remain pending.

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
