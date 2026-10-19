# Report Cards trusted enrollment/source gate — review only

The pure `verifyReportSnapshotSource` checks a candidate snapshot binding against **caller-supplied trusted rows**: exactly one active enrollment for the student/session, matching enrollment and class IDs, one complete finalized subject roster, matching assessment revision, exact source-version set, and school/term/class/session consistency.

This function does **not** query PostgreSQL, verify that the rows are actually trusted, authenticate users, lock source rows, or protect against omitted records. The server adapter must retrieve the **complete** active enrollment set and authoritative finalized subject set in the same transaction and prove their completeness. The caller must run the existing source-readiness check and typed academic payload validation before canonicalization. The source version keys here are opaque: an adapter must derive them from persisted revision identifiers and verify their provenance.

## Next integration gate

- Resolve actor and school from verified server authentication, never request body.
- Lock the report, enrollment identity and source revisions as needed to prevent concurrent edits.
- Bind report identity to an enrollment record using school-scoped relational constraints, not just in-memory checks.
- Query the full finalized subject assignment roster and enforce version consistency.
- Recompute grades using the approved assessment engine before snapshot creation.
- Persist immutable snapshot, workflow transition, audit, idempotency receipt and optional release atomically.
- Test tenant isolation, rollback and concurrent requests against disposable PostgreSQL with separate approval.

No live database, migration, deployment, API route or production schema was changed.
