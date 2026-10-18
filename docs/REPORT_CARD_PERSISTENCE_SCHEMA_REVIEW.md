# Report Cards — persistence schema and security proposal (NOT applied)

**Review artifact only.** This is not a Drizzle migration and must not be run against any database. No RLS policies, grants, tables or endpoints have been created.

## Relational model and required constraints

| Proposed table | Required columns | Constraints / purpose |
| --- | --- | --- |
| `report_cards` | id, school_id, student_id, class_id, session_id, term_id, stage, version, assessment_revision, snapshot_id, submitted_by, approved_by, published_at, return_reason | Unique (school_id, student_id, class_id, session_id, term_id); version > 0; stage enum; composite school-scoped FKs to student, class, session and term |
| `report_card_snapshots` | id, school_id, report_id, assessment_revision, source_versions, content_hash, canonical_payload, created_at | Immutable after insertion; content hash validated server-side; no client-authored grades; school-scoped FK to report |
| `report_card_audit` | id, school_id, report_id, actor_membership_id, action, before_stage, after_stage, before_version, after_version, snapshot_id, occurred_at | Append-only; composite FKs to report, membership and snapshot; after_version = before_version + 1 |
| `report_card_operation_receipts` | id, school_id, report_id, actor_membership_id, operation_key, fingerprint, resulting_version, outcome | Unique (school_id, actor_membership_id, operation_key); fingerprint is SHA-256 of canonical request; immutable receipts |
| `report_card_releases` | id, school_id, report_id, report_version, released_at, revoked_at | Unique (school_id, report_id, report_version); guardian read requires latest non-revoked release matching current published version |

### Existing schema dependencies to verify
- `students`, `classes`, `academic_sessions` and `memberships` expose composite (school_id, id) uniqueness.
- `terms` currently has session-name uniqueness but may need a dedicated unique (school_id, id) key for composite report FK. The report must additionally validate term.session_id equals report.session_id (prefer composite FK (school_id, session_id, term_id) backed by matching unique key).
- Guardian identity is not equivalent to a verified guardian login: `guardians` and `student_guardians` model relationships, but parent portal identity linking is not yet implemented. Do not enable guardian reads before secure login-to-guardian binding exists.
- A report's student must have a unique valid active enrollment in the specified class/session at creation and transition; ordinary FK columns alone do not establish this.
- Snapshot content must bind the complete subject roster, finalized assessments, attendance, remarks and grading configuration. Changing any source invalidates prior approval/release, following a reviewed correction policy.

## Proposed transaction algorithm (single school-scoped transaction)

1. Resolve authenticated user and active school membership on the server, outside client claims.
2. Resolve operation receipt by (school, actor, key). Identical canonical fingerprint returns the prior result; a different fingerprint fails.
3. Lock report row and source assessment revision. Verify school-scoped references and teacher assignment.
4. Rebuild canonical report projection from trusted source rows; validate `preflightReportTransition` and `planReportTransition`.
5. Conditional update with `WHERE version = expected_version`; if no row updated, reject as stale.
6. Atomically append audit row, immutable snapshot reference, operation receipt and (on publication) release row. Roll back the whole transaction if any step fails.
7. Never serve report data from the browser simulation; parent read checks verified guardian identity, current published stage/version, release status and student relationship on every request.

## Proposed RLS and privileges (design, not SQL)
- **Deny by default:** No direct anonymous or general authenticated reads/writes to snapshots, audits, receipts, or report state.
- **Teachers:** Only verified active assigned class/session teachers may submit and view eligible school-scoped reports; no direct UPDATE grants for publication.
- **Admins:** Verified active same-school admins may review, return, approve, reopen, and publish via trusted server operations only.
- **Bursars:** No report approval/publication access.
- **Guardians:** Only verified linked guardians can read released current report versions; no write access. RLS must not rely on user-supplied school or guardian IDs.
- **Service role:** Server-only; never expose service credentials in the client. Transaction code still enforces tenancy because privileged connections may bypass RLS.
- **Audit/snapshots/receipts:** Append-only at application layer, reinforced with database permissions/triggers as reviewed; retention and redaction policies needed.

## Pre-migration review gates
Confirm term composite keys; immutable snapshot storage and privacy; authenticated guardian binding; FK delete behavior; admin and teacher authorization sources; concurrent idempotency race handling; release revocation and correction policy; RLS integration tests on an isolated test database.

The pure `report-card-persistence-policy.ts` validates selected idempotency and guardian visibility invariants **only on trusted inputs**. It is not a durable transaction engine or RLS implementation. No database work is authorized by this draft.
