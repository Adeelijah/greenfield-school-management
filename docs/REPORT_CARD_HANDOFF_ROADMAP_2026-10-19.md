# Greenfield Report Cards — continuation roadmap and new-chat handoff

**Updated:** 2026-10-19. **Repository:** `Adeelijah/greenfield-school-management`. **Working branch:** `report-cards-foundation`. Do not merge or deploy without explicit approval. This document records what the user actually ran and what remains unverified; it is not a claim of production readiness.

## Read this first in a new chat

1. Read `AGENTS.md` and `docs/DEVELOPMENT_WORKFLOW.md`; honor approval gates, no secret inspection, no Supabase/production DB changes.
2. Review `docs/REPORT_CARD_DISPOSABLE_ADAPTER_REVIEW.md`, `docs/REPORT_CARD_DISPOSABLE_POSTGRES_TESTS.md`, `docs/REPORT_CARD_MIGRATION_READINESS_REVIEW.md`, `docs/REPORT_CARD_RLS_REVIEW.md`, and `docs/REPORT_CARD_TRANSACTION_PORT_REVIEW.md`.
3. Inspect the latest `report-cards-foundation` commit and working tree before edits. Do not assume local uncommitted changes are safe to overwrite.
4. Continue with the failing JSONB fixture round-trip assertion described below, then rerun the full disposable adapter integration harness.

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
- The adapter integration harness **has NOT passed**. Earlier it failed `not_found`; a subsequent fix enabled fixture lookup but the most recent run failed:

```
AssertionError [ERR_ASSERTION]: report JSONB was not decoded to an object
'string' !== 'object'
at scripts/report-card-postgres-adapter-integration.mjs:71
```

The failure was observed **after** pulling updated code (at least through commit `955db51`). Current script includes `textParameters`, `$4::text::jsonb` fixture inserts, and `assert.equal(typeof reportCheck[0].record,'object')`. Diagnose JSONB encoding/decoding of the `postgres` driver and any double-serialization; do not remove the assertion or silently coerce the result without checking DB `jsonb_typeof` and read behavior. `ExperimentalWarning` and `MODULE_TYPELESS_PACKAGE_JSON` are informational, not test failures. `SKIPPED` means the opt-in environment variables were absent.

**Important distinction:** `jsonb_typeof(record)='object'` can pass while the JavaScript driver still returns a string. Confirm the actual type and encoding path; use parameterized queries, test round trips of report, audit, membership, assignment and projection.

## Immediate next task: unblock real transaction-port integration

1. Fetch current `scripts/report-card-postgres-adapter-integration.mjs`, `src/lib/academics/report-card-postgres-disposable-adapter.ts`, `src/lib/academics/report-card-transaction-port.ts` and `AGENTS.md`.
2. Fix PostgreSQL JSONB decoding/serialization at the appropriate boundary without changing production behavior. Test fixture JSONB and updated report/audit JSONB round trips. Prefer minimal, explicit, tested decoding at the test adapter boundary if necessary; never trust client data as authoritative.
3. Run safe offline checks (TypeScript, ESLint, offline tests and `git diff --check`); report which were actually executed. Commit/push only within the user's authorization and repository approval rules.
4. User pulls `report-cards-foundation` and runs the adapter integration harness on the **disposable local DB only**.
5. Target integration assertions: fixture source lookups; competing submissions (one applied, one stale); duplicate key (applied/replay); cross-school actor rejection; injected receipt failure rolls back record and audit; approval/publish requires proper stage and only one release.
6. Once these pass, update `docs/REPORT_CARD_DISPOSABLE_ADAPTER_REVIEW.md` to distinguish confirmed results from remaining production blockers.

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

### Phase A — Complete isolated adapter tests (CURRENT, BLOCKED)
- Resolve JSONB fixture read failure.
- Confirm full end-to-end `executeReportTransaction` integration suite against disposable PostgreSQL.
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
- **First action in the next chat:** inspect the latest integration script and resolve the JSONB decoding assertion; then run the disposable test and proceed through phases above.
