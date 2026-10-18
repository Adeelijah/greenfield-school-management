# Report Cards — Offline approval workflow proposal

This milestone adds `src/lib/academics/report-card-workflow.ts` and its pure tests. The approved visual preview remains unchanged.

## Proposed transitions
- Draft / Returned → Submitted: active teacher assigned to the report class.
- Submitted → Returned: active school admin; correction reason required.
- Submitted → Approved: active school admin, with an existing teacher submission.
- Approved → Published: active school admin, with an existing approval.
- Approved → Draft: active school admin reopening for correction.

All transitions check school identity, report identity, current report version, assessment version and completeness. They return an updated in-memory record and an audit event *proposal*. They do not persist anything or expose an API. The `idempotencyKey` is carried into audit output but is **not** enforced for duplicate prevention until a transactional adapter is designed.

## Production blockers (not implemented)
- Verified server-side identity and active membership from Supabase, with independently resolved teacher-class assignment.
- Database schema, school-consistent foreign keys, access policies, transactional optimistic locking and atomic audit records.
- Durable idempotency receipts, replay detection, and collision handling.
- Immutable result/attendance/remark snapshot binding and revision invalidation; this proposal currently checks only supplied assessment version and subject completion.
- Approval and publication permissions, parent-specific read authorization, release visibility, withdrawal/correction policy and notification delivery.
- Comprehensive test matrix for all stages, role combinations, forgery, concurrency and retries.
- Print preview must not be treated as published evidence.

**Do not wire this state machine directly to client-supplied roles or school IDs.** It is a domain-level design artifact awaiting server adapter, security review, and explicit approval before migrations or deployment.
