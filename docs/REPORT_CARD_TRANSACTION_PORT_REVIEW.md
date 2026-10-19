# Report-card PostgreSQL transaction port — review only

`src/lib/academics/report-card-transaction-port.ts` defines a driver-agnostic async transaction contract and an orchestrator using existing optimistic version, idempotency, trusted membership preflight and workflow planning. The fake runner in the offline tests uses a cloned state and commits only after a successful callback. It is **not** a PostgreSQL adapter.

## Mandatory adapter responsibilities

1. Verify session identity and active membership server-side. Never trust actor/school from client input; the current port accepts request identifiers only as a contract, not proof of authorization.
2. Run the callback inside a genuine PostgreSQL transaction with deterministic lock order and safe concurrency semantics. Roll back when any callback throws.
3. Read exactly one tenant-scoped report and complete authoritative membership, assignment, enrollment, finalized assessment and revision records under appropriate locks. The current port does **not** invoke the trusted enrollment/source gate or typed snapshot validator; an adapter must integrate those gates before production use.
4. Query receipts by tenant, actor and operation key under a uniqueness constraint. Handle concurrent duplicate inserts and conflicts safely, including when the report row changes.
5. Update the report with a conditional `WHERE version = expectedVersion AND school_id = verifiedSchool` and check exactly one affected row.
6. Persist immutable audit and receipt records in the same transaction. Publish requires a pinned immutable snapshot and guardian-release security checks; the port's `appendRelease` is only a proposed interface and **must not** be wired to live publication yet.
7. Restrict direct writes, implement RLS/privilege boundaries and append-only enforcement at SQL level; a privileged backend must enforce the same scopes.
8. Test concurrent submissions, idempotency collisions, tenant isolation, rollback, guardian visibility and authorization against disposable PostgreSQL before deployment.

## Explicit limitations

The orchestrator does not create snapshots, check snapshot hashes, prove the source is complete, perform authentication, implement SQL, guarantee atomicity, or enforce RLS. Its rollback tests verify only the fake runner's contract. No migrations, database connections, live publication, merges or deployments were performed.
