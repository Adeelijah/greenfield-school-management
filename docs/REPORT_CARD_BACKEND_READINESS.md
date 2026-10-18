# Report cards — backend readiness design (review only)

This document is a proposed implementation plan. No database adapter, API route, migration, permission change or publication is implemented.

## Trusted execution boundary
1. Authenticate on the server and resolve the active membership from persisted session identity. Never accept the browser's role, membership, school, assignment list or assessment revision.
2. Begin a school-scoped transaction. Load and lock the report record and the source assessment revision, verifying the school, student, class, enrollment, term and session.
3. Load active teacher-class/session assignment from storage and construct the trusted context for `preflightReportTransition`. This helper rejects mixed-school rows, missing/duplicate teacher assignments and stale assessment revisions. It is not authentication.
4. Rebuild `prepareReportCard` from server-fetched finalized assessments, rather than accepting a client-supplied projection. Bind the report to a canonical snapshot/revision covering grades, subject roster, attendance and remarks. The current domain model **does not yet implement** this immutable binding.
5. Run `planReportTransition` against locked state; persist its state change and audit event atomically with optimistic version conditions.
6. Enforce durable idempotency receipts keyed by school, actor and request key; exact replays return the original result and conflicting payloads fail.
7. Release parent visibility only after an authorized publish transaction. Parent access must be linked to the enrolled student via verified guardian relationships, and publication must be checked again on read.

## Proposed persistence review entities
- `report_cards`: school, student, class, session, term, state, version, assessment_revision, immutable_snapshot_reference, submitted_by, approved_by, published_at, returned_reason; unique (school, student, class, session, term).
- `report_card_audit`: school, report, actor membership, action, prior/next states, prior/next versions, timestamp, immutable snapshot reference.
- `report_card_operation_receipts`: school, actor membership, operation key, request fingerprint, outcome, report version; unique scoped operation key.
- `report_card_snapshots`: immutable canonical subject grades, attendance and remarks with a content hash and source versions. Avoid unnecessary personal data in audit events.
- `report_card_releases`: report, version, visibility state and release/revocation timestamps, used for guardian-scoped reads.

All foreign keys should enforce school consistency. Define transactional locking, permission checks, RLS/grants and retention policy in a separately reviewed migration/security proposal.

## Failure scenarios to test before persistence
Cross-school and suspended actors; forged assignment claims; duplicate active teacher assignments; unfinalized subject; stale report or assessment revision; concurrent approve/return; changed grades after submission; idempotency replay/collision; audit write failure rollback; unauthorized guardian access; post-publication corrections and revocation.

## Current implementation boundary
`report-card-preflight.ts` is a **pure trusted-input validation contract** with offline tests. Its arguments are assumed to be server-resolved, but there is no server adapter providing that guarantee yet. The interactive UI uses fictional client-side actors and must never be connected directly to persistence.

Approval of this document does not authorize SQL execution, database access, authentication changes, branch merge or deployment.
