# Report-card migration readiness — review-only prerequisite and security gates

**No SQL in this document is authorized for execution.** The production Drizzle entrypoint remains `src/db/schema.ts`; `report-cards-schema.proposal.ts` is intentionally excluded.

## 1. Required term key prerequisite

The current `terms` table already has a composite FK `(school_id, session_id)` to academic sessions, but it does **not** expose the composite unique target `(school_id, session_id, id)` that the report table needs.

Proposed separately reviewed prerequisite (illustrative SQL only):

```sql
-- REVIEW ONLY — DO NOT EXECUTE
ALTER TABLE terms
  ADD CONSTRAINT terms_school_session_id_unique
  UNIQUE (school_id, session_id, id);
```

After that constraint exists, replace the report proposal's **temporary, insufficient** `term_id -> terms.id` FK with:

```sql
-- REVIEW ONLY — DO NOT EXECUTE
ALTER TABLE report_cards
  ADD CONSTRAINT report_cards_school_session_term_fk
  FOREIGN KEY (school_id, session_id, term_id)
  REFERENCES terms (school_id, session_id, id)
  ON DELETE RESTRICT;
```

**Migration sequencing:** (A) validate existing terms and add composite key, (B) introduce report enums and tables with composite term FK, (C) privileges/RLS and append-only enforcement, (D) isolated integration tests, (E) separately approved rollout. Do not generate a Drizzle migration until schema dependencies and privileges have been reviewed.

## 2. Snapshot canonicalization and source revision contract

Every snapshot must be derived on the server from trusted, finalized assessment source rows. The canonical payload needs a versioned format, fixed field ordering, stable serialization, and SHA-256 hash computed on the server; no browser-supplied grade, hash, or assessment revision is trusted.

Minimum source binding: school, student, enrollment, class, session, term, full assigned subject roster, each finalized subject result and its component/configuration versions, grading configuration, observations, attendance, remarks and any published correction lineage. Reject missing or duplicate active enrollment, incomplete subject roster, and any source revision drift.

Snapshot insertion is append-only; a transition's audit row references its snapshot; publication release binds the exact report version. Corrections must reopen, invalidate the prior release, rebuild from trusted sources and produce a new immutable snapshot. Retention/redaction policy requires privacy review.

## 3. Auth and row-level security gate

- Resolve authenticated user to an active membership and school **inside the trusted server boundary**; never accept membership/role/school authorization from the client.
- All report, snapshot, receipt, audit and release writes occur in one database transaction with row locks, optimistic version check and durable idempotency.
- Privileges: no direct client writes to report state; restrict report reads; no general authenticated reads of snapshots, audits or receipts; no bursar approval/publishing. Server privileged connections must enforce school scope independently of RLS.
- Add database-enforced append-only rules for snapshots, audit and receipts. Explicitly review grants, RLS `USING`/`WITH CHECK` policies, service-role bypass, and rollback semantics.
- Guardian access stays disabled until authenticated login-to-guardian binding is built, tested, and checked on each read against active student relationship, published version and non-revoked release.

## 4. Disposable PostgreSQL integration-test plan (not executed)

Provision an isolated database only after approval; apply reviewed migrations to that database only. Test cross-school FK rejection, wrong-session term rejection, duplicate report identity, optimistic version races, duplicate operation key conflict/replay, rollback after audit/receipt/release failure, immutable snapshot attempts, unauthorized role and guardian access, revoked/stale release reads, and migration rollback/reapply. Record PostgreSQL version, RLS roles and results.

## Decision before executable migration

The present Drizzle proposal still contains a **deliberately incomplete** single-column term FK. It must not be migrated in its current form. Decide the canonical snapshot schema and enrollment binding, then update the proposal to a fully school/session-scoped term FK before any SQL generation. The schema proposal tests only inspect metadata; they do not validate PostgreSQL behavior.
