# Report Cards — offline transaction simulator

`src/lib/academics/report-card-memory-adapter.ts` implements a memory-only transactional rehearsal for report submission, review and simulated publication. It does not read credentials, connect to a database, expose endpoints, or create actual parent visibility.

The store clones its internal state before every operation and publishes the clone only after the report transition, audit append, idempotency receipt and simulated release all succeed. Fault injection tests cover rollback after each phase. It reuses the existing trusted-context preflight, transition planner and idempotency policy. The constructor receives fictional stored memberships and assessments; callers select an actor ID but cannot supply arbitrary role or assignment objects to `apply`.

### Coverage
- Teacher submission, independent admin approval and simulated publication
- Atomic report version, audit, receipt and release changes
- Identical idempotency replay, conflicting payload denial and stale-version denial
- Cross-school and unauthorized actor denial
- Incomplete report denial and injected transaction rollback

### Limitations and review gates
- Synchronous in-process execution simulates serialization; it does not test real concurrent PostgreSQL transactions or multi-process locking.
- Supplied fingerprint is not computed or authenticated by this simulator. A production adapter must canonicalize the request and calculate its own digest.
- Stored contexts and projections are trusted fictional constructor inputs; no real Supabase session or source-grade retrieval exists.
- Snapshot hashing, approval invalidation, release revocation, RLS, guardian login binding and durable receipts are not implemented.
- A production adapter must acquire database locks, enforce uniqueness and school-scoped foreign keys, and commit all effects within one transaction.

The approved interface is unchanged. No migration was generated/applied, no database was accessed, and no branch was merged.
