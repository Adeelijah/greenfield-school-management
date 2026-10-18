# Student Academic Lifecycle: persistence preparation

Status: design and offline validation only. No migration, database connection, persistence handler, or UI write is enabled by this document. The repository proves what is defined in source; it does not prove what has been applied to any database.

## Repository audit

| Area | Found in repository | Gap for the lifecycle |
| --- | --- | --- |
| School and staff | `schools`, `school_users`, `memberships`; roles `admin`, `teacher`, `bursar`; active/suspended membership | No school-level final Primary year or structure version. `school_users.auth_user_id` has no FK to Supabase `auth.users` in the initial migration. |
| Students and guardians | `students`, `guardians`, `student_guardians`; school-scoped composite FKs for relationships; unique school/admission number | No database rule for one primary guardian per student. Student status reuses the enrollment-status enum. Registration UI is preview-only. |
| Academic calendar | `academic_sessions`, `terms`; school-scoped session FK for terms, date-order checks, one current session/term per school | Term containment within its session and current term/session consistency are not enforced. |
| Levels and sections | `classes` with `school_id`, `name`, and `section` | No separate academic levels, ordered school progression, stage restriction, stable section IDs, or final Primary 5/6 setting. The unique class name is not a substitute for a unique level/section pair. |
| Enrollment history | `enrollments` references a school-consistent student, class, and session; unique `(student_id, session_id)` | One row per student/session is supported, but completed historical status and lifecycle decision provenance are absent. No write service exists. |
| Lifecycle decisions | Pure preview validation and promotion/repetition/graduation workspaces | No decision record, applied transition, idempotency key, or transaction implementation. |
| Departures | Pure transfer/early-exit validation and fictional history | No persistent transfer/early-exit record or duplicate-departure database guard. |
| Audit | `audit_events` with school, actor, action, entity, timestamp | No request/correlation ID, immutable-write enforcement, tenant-bound actor constraint, lifecycle detail schema, or retention decision. |
| Authentication | Verified Supabase `getUser()`, active membership lookup, fail-closed multiple-membership behavior, `requireSchoolRole` | No lifecycle-specific server handlers. Existing Drizzle and Supabase directory reads are separate, currently unwired paths; neither implements lifecycle writes. |
| Migration/RLS | One journaled initial Drizzle migration, `0000_broad_slayback.sql`, defines foundation tables and constraints. Security SQL documents propose RLS/grants. | The initial migration contains no RLS or policy statements. `docs/security/09_consolidated_read_only_review.sql` is explicitly review-only and replaces broader `07`/`08` drafts; these must not be combined. No lifecycle RLS/write policy is a tracked migration. Deployment state is unknown without an authorized database audit. |

The untracked `drizzle/0000_broad_slayback.local.sql` and generated security artifacts are preserved as found. They are not evidence that a migration or policy was executed.

## Proposed incremental model

Preserve the existing school, identity, student, guardian, calendar, class, enrollment, admission, and audit tables. Prepare reviewed, forward-only migrations later; do not edit the initial migration in place until its deployment history is established.

1. Add `schools.final_primary_year` constrained to 5 or 6 and `schools.structure_version` for optimistic configuration changes. Add `academic_levels` with `id`, `school_id`, `name`, `stage` (`creche`, `nursery`, `primary` only), `primary_year` for Primary, `progression_order`, and an inactive/archive marker. Enforce unique `(school_id, id)`, school-scoped order, and appropriate Primary-year identity. A transaction-level validation must ensure stages are ordered, there is exactly one configured final level, and it is Primary 5 or 6 and last. Preserve referenced levels instead of deleting history.
2. Add `academic_sections` with stable `id`, `school_id`, `level_id`, name, order, and inactive/archive marker. Use a composite FK to its level; add unique `(school_id, id)` and a unique section name per level. Different levels may independently use the same section name. Rename by stable ID and prevent removal while referenced.
3. Keep `classes` as existing placement rows. Add nullable `level_id` and `section_id` initially, then school-consistent composite FKs and a unique `(school_id, level_id, section_id)` once existing rows are mapped and checked. Retain legacy `name`/`section` display fields during migration; do not silently reinterpret existing classes. Resolve each enrollment's level and section through its class. Backfill rules require an explicit review of any existing rows.
4. Keep one enrollment per student/session and its existing school-consistent FKs. Add unique `(school_id, id)` if lifecycle records use a composite FK to a source enrollment. Add a `completed` historical enrollment state only after reviewing enum migration and historical data. A preview's `planned` placement is a proposed decision, not a committed enrollment. Maintain a separate student lifecycle status from enrollment state in a later compatible change rather than repurposing the existing column without review.
5. Add `student_lifecycle_decisions`: school, student, source enrollment, destination session, action (`promote`, `repeat`, `graduate`), optional destination class, actor, structure version, idempotency key, payload fingerprint, applied timestamp, and created timestamp. School-consistent composite FKs must cover every reference. Unique school/student/destination-session and unique school/idempotency-key constraints prevent duplicate decisions. Promotion and repetition require a destination class; graduation forbids one. The source enrollment and target session must be validated under a transaction lock.
6. Add `student_departures`: school, student, source enrollment, kind (`transfer`, `early_exit`), reason, effective date, optional destination school, guardian-review flag, actor, idempotency key, created timestamp, and optional voided timestamp. Use school-consistent FKs and a reviewed uniqueness rule for one non-voided departure per student. Re-entry and correction rules need a product decision before final DDL.
7. Extend `audit_events` with a request/correlation ID and minimal structured transition metadata, or add a linked detail table if a migration review favors that. Record school, verified actor, role snapshot, entity IDs, action, old/new status codes, decision/departure ID, and timestamp in the same transaction. Exclude names, contact details, notes, credentials, and raw request bodies. Enforce append-only database permissions and decide retention and correction procedure.
8. Consider a partial unique index for one primary guardian relationship per student. Add the reviewed `auth.users` FK separately from Drizzle-managed Supabase objects, following the existing security sequence.

## Authorization and least privilege

`src/lib/students/lifecycle-authorization.ts` is a pure, deny-by-default policy for future server use. It does not establish identity or authorize any current route. The server must first obtain a verified Supabase user and exactly one active membership. It must derive school ID from that membership, then check the loaded resource's school ID. Request-body school IDs are data to reject or compare, never authority.

| Operation | Admin | Teacher | Bursar | Boundary |
| --- | --- | --- | --- | --- |
| Read school structure and calendar | Yes | Yes | Yes | Active membership in same school |
| Edit levels, sections, final year | Yes | No | No | Server transaction and structure version |
| Read limited student roster | Yes | Yes | No | Same school; no DOB or guardian contacts for teacher |
| Read full profile, guardians, enrollment history | Yes | No | No | Sensitive server endpoint; same school |
| Register student or manage guardian links | Yes | No | No | Server validation, tenant FKs, audit |
| Assign enrollment or decide promotion/repetition/graduation | Yes | No | No | Transaction, progression validation, audit |
| Record transfer/early exit | Yes | No | No | Transaction, duplicate guard, audit |
| Read lifecycle audit | Yes | No | No | Same-school, purpose-limited server endpoint |
| Append audit event | Trusted transaction only | No | No | Never a browser-issued independent write |

This conservative teacher/bursar model requires product approval before enabling persistence. It intentionally matches the restrictive `09` roster proposal rather than the broader `01`/`07` drafts. RLS must restrict rows by active school membership and role; grants must restrict columns and operations. PostgreSQL permissive policies combine with OR, so adding a narrow policy alongside a broad one does not narrow access. The current `09` proposal grants no direct browser SELECT for guardians, enrollments, admissions, or audit; full profile reads need a separately reviewed authenticated server path. A service-role or BYPASSRLS connection cannot use RLS as its authorization boundary. The existing `greenfield_app` URL/name guard is a configuration check, not proof of role privileges or RLS enforcement.

For any new table, plan `ENABLE` and `FORCE` RLS, explicit least-privilege grants, and reviewed `USING` plus `WITH CHECK` policies if browser access is intended. Prefer no direct browser writes for lifecycle tables. Verify actual policy/grant state and owner/BYPASSRLS behavior before any live integration. Do not change current auth or RLS behavior in this phase.

## Transaction and concurrency contract

- Resolve verified identity, active role, and school before opening a lifecycle operation. Recheck resource and all linked IDs with school-scoped predicates inside the transaction; composite FKs backstop those checks.
- Lock the student and current enrollment for a lifecycle change. Load the school structure version, ordered levels, destination class/section, destination session, and existing destination enrollment under the same transaction. Re-run the pure academic decision rules on these authoritative rows.
- Require a later, valid academic session. Promotion advances exactly one configured level; repetition keeps the level while allowing an independent destination section. Graduation requires the configured final Primary 5/6 level and no destination class. A transfer/early exit is a separate terminal action, not graduation.
- Insert the decision or departure, create/update enrollment and student status as appropriate, and append the audit event atomically. Any failed validation, unique constraint, or audit insert rolls back the entire change.
- Require a client-generated idempotency key scoped to school and operation. Store a canonical payload fingerprint; an identical retry returns the original result, while key reuse with different content fails. Unique student/session and departure constraints are the final race guards. Translate conflicts into a safe retry or conflict response without leaking another school's existence.
- Lock or version-check configuration edits and reject changes that would invalidate referenced history. Never infer a student's school from a submitted class or session ID alone.

## Preview-to-server mapping

| Existing preview code | Future operation |
| --- | --- |
| `ClassStructureEditor`, `class-structure.ts` | Admin read/update structure; server validates order, sections, final year and version. |
| `StudentWorkspace`, registration schema | Admin registration transaction; admin/teacher limited roster read. |
| `StudentProfile`, `StudentLifecycle`, `profile-enrollments.ts` | Admin profile read combining student, guardians, enrollments, decisions, departures, and permitted audit; teacher remains roster-only. |
| `EnrollmentManagement`, class assignment validation | Admin enrollment review and assignment transaction with duplicate-session guard. |
| `PromotionWorkspace`, `academic-progression.ts` | Admin decision review, then server-side revalidation and atomic apply. |
| `StudentExitWorkspace`, `student-exit-validation.ts` | Admin departure review, then server-side revalidation and atomic apply. |
| `lifecycle-fixtures.ts` | Development preview only; never passed to persistent handlers. |

## Staged sequence and gates

1. Confirm the deployment history of migration `0000` and actual database grants/RLS in an explicitly authorized disposable environment. Reconcile the untracked local SQL and security drafts without executing them here.
2. Approve the permissions matrix, school deployment model, class backfill rules, return-after-exit policy, audit retention, and restricted server connection architecture.
3. Review a forward-only schema migration and tenant/FK/index/RLS/grant package together. Test it only in an approved isolated database with two fictional schools and all three roles.
4. Add read-only school-scoped repositories and server endpoints; prove no cross-school or sensitive-column reads, including through privileged connections. Keep the preview UI disconnected until these checks pass.
5. Add registration/guardian and structure transactions with audit; then enrollment and lifecycle transactions with idempotency, locking, and rollback tests.
6. Connect approved UI actions only after real JWT-backed authorization, RLS/grant, cross-tenant, concurrency, and audit tests pass. Enable writes operation by operation, with rollback and monitoring prepared.

No step above authorizes a migration, database write, live connection, or deployment in the current phase.
