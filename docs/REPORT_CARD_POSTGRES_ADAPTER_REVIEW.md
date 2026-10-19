# Report Cards — PostgreSQL adapter contract (review only)

The isolated Drizzle proposal lives at `src/db/report-cards-schema.proposal.ts`. **Do not add it to the configured Drizzle schema, generate migrations from it, or execute SQL yet.** It is not imported by the live database schema.

## Transaction repository contract (not implemented)
```ts
interface ReportCardTransactionRepository {
  execute(input: {
    verifiedAuthUserId: string;
    schoolId: string;
    reportId: string;
    command: ReportCommand;
  }): Promise<
    | { ok: true; kind: 'applied' | 'replay'; version: number }
    | { ok: false; code: string }
  >;
}
```
The implementation must not accept a client-provided actor role, membership, grade projection, fingerprint or assessment revision. It must derive those values from verified server state and compute a canonical request fingerprint.

## Atomic write ordering
1. Resolve auth identity and active school membership server-side.
2. Begin transaction; lock the report and assessment revision. Lock or insert idempotency key with a uniqueness constraint; conflicting fingerprints fail.
3. Reconstruct the school-scoped projection and validate student enrollment, term/session association, teacher assignment, complete subject roster and source revision.
4. Execute the pure preflight and workflow planners, then conditionally update `report_cards` with the expected version.
5. Insert canonical immutable snapshot when required, append audit, persist receipt and create/revoke publication release **within the same transaction**.
6. On any failure roll back everything. A duplicate matching receipt returns the committed original outcome; never run a second transition.

## Open schema and security blockers
- The proposal currently uses a simple `terms.id` foreign key because the base `terms` table lacks a composite unique (school_id, session_id, id). **This is not sufficient for tenant and session integrity.** A reviewed prerequisite migration must add that unique key and replace the simple FK with the composite FK.
- The report record does not yet bind enrollment with a composite key. Verify unique active enrollment for the student/class/session under the same lock, and decide whether a durable enrollment reference is needed.
- Snapshot payload and source-version format are placeholders; finalize canonical serialization, content hashing, sensitive-field retention, and immutable storage before migration.
- Audit/receipt append-only restrictions require SQL grants/triggers; the Drizzle proposal alone does not enforce immutability.
- Authenticated guardian identity binding, read-time release checks, and RLS policies are **not implemented**. No parent report endpoint should be enabled.
- Concurrency and rollback require PostgreSQL integration tests on an isolated disposable test database **after separate authorization**.
- A release for an older version must never be served after reopening or correction. Decide whether revocation is explicit or version invalidation is sufficient.
- Review migration order, backfill strategy, delete policies, RLS/grants and unique constraint names before generating any migration.

## Current test scope
`report-cards-schema.proposal.test.ts` inspects Drizzle metadata without connecting to a database. The memory adapter remains the only executable transactional simulation. These tests do **not** prove that a PostgreSQL migration or RLS policy is valid.

The approved report-card interface and existing database schema are unchanged. No migration, DB connection, deployment or merge is authorized by this document.
