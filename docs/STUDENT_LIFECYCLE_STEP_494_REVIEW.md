# Student lifecycle schema and security review (Step 494)

Review artifacts only. The TypeScript declarations describe a proposed future schema; `10_lifecycle_schema_review.sql` and `11_lifecycle_rls_grants_review.sql` are **not** in the Drizzle journal and must not be executed. The actual database, role attributes, applied policies, and migration history beyond the repository are unknown. The Step 493 plan remains the foundation; the architecture and role decisions below supersede its earlier teacher/bursar matrix.

## Proposed model and preserved foundation

Each installation has a separate PostgreSQL database for one school. Keep `school_id` on every lifecycle record and preserve the existing schools, users, memberships, students, guardians, sessions, terms, classes, enrollments, admissions, and audit events. Physical separation reduces blast radius but does not replace school-scoped authorization or composite FKs. A one-school-per-database invariant and provisioning process must be approved and enforced before deployment; the schema still permits multiple schools for isolation testing.

Add `schools.final_primary_year` (nullable during backfill, then 5 or 6), `structure_version`, ordered `academic_levels` (Creche/Nursery/Primary only), independent `academic_sections`, and nullable `classes.level_id/section_id`. Preserve legacy class strings and IDs. Levels and sections are archived with `is_active`; referenced records are not deleted. Check constraints limit Primary years to 1–6; a transaction must also verify a contiguous Primary 1 through the configured final year, valid stage ordering, one final Primary level, and no active level after it. Database checks alone cannot express that cross-row invariant. Configuration edits use `structure_version` compare-and-swap and cannot remove referenced levels or sections.

Add `teacher_class_assignments` with school-scoped membership, class and session FKs and one active assignment per teacher/class/session. The application must verify the membership is an active teacher; FK alone does not prove role. A teacher can view the limited roster and propose progression only for a student in an assigned class/session. Historical assignments remain with `ended_at`.

Add `student_lifecycle_decisions` with proposed/applied/rejected states, source enrollment, destination session/class for promotion/repetition, proposer/finalizer membership, structure version, idempotency key and fingerprint. Graduation has no destination. Add immutable `student_departures` and `student_readmissions`; a later re-admission uses the same student ID and a new enrollment, linking the departure instead of deleting history. Transfer destinations are descriptive text only; cross-installation identity or record transfer is not defined. Add minimal audit metadata to the existing audit table: request ID, actor membership/role snapshot, previous/next state. Do not store raw requests, contact details or free-text reasons in audit.

Composite `(school_id, foreign_id)` FKs protect tenant consistency. The source enrollment FKs include `student_id`, preventing a decision/departure from citing another student's enrollment. Existing `(student_id, session_id)` enrollment uniqueness remains. Partial unique indexes prevent two applied decisions for a destination session and two graduations from one source. A unique departure per source enrollment prevents duplicate exits; one active exit across sessions is a locked transaction invariant. Unique school/idempotency keys and a canonical payload fingerprint distinguish safe retries from altered requests. These constraints are race backstops, not replacements for server checks. Membership deletion is restricted once referenced; staff should be suspended, retaining attribution.

The draft deliberately does **not** alter the existing `enrollment_status` enum or add a `completed` value. Existing `students.status` and `enrollments.status` semantics need a historical-data review before re-admission transitions are implemented. The initial migration, RLS drafts and approved UI remain untouched.

## Legacy class backfill gate

Inventory each existing `classes` row with its school ID, class ID, name, section and referencing enrollment/admission count in an approved isolated database. Propose a level and section for each row using an explicit reviewed mapping file. Exact tokens such as `Primary 5` can seed a suggestion, but never auto-apply it. `P5 A`, `Primary Five`, duplicate section labels, combined names, empty/unknown stage, or rows outside Creche/Nursery/Primary are ambiguous and must be resolved by a school admin. A legacy class may map to one level and one section only; conflicts require a new class row or a deliberate admin correction, never a silent merge. Preserve old IDs and display strings so history retains meaning. Reject backfill if duplicate `(school_id, level_id, section_id)` mappings would result. Then compare every enrollment/admission class reference, obtain admin signoff, set final year, and only later propose `NOT NULL` constraints. No backfill or SQL is run in this step.

## Authorization and database connection

| Operation | Admin | Teacher | Bursar |
| --- | --- | --- | --- |
| Structure read/edit | Read/edit | Read | None |
| Limited student roster | School | Assigned class/session only | None |
| Propose promotion/repetition/graduation | Yes | Assigned student only | None |
| Finalize progression, transfer, exit, re-admission | Yes | No | No |
| Full profile, guardians, history, audit | Yes | No | No |
| Finance records | Separate finance policy | No | Finance policy only |

`src/lib/students/lifecycle-authorization.ts` is a pure precheck, not a route authorization boundary. For a teacher, the `assignedStudentVerified` input must come from a school-scoped server query using a verified identity, active membership, class and session; never from the client. Every server operation must re-check school, role, assignment where relevant, and resource ownership inside its transaction. The school ID in a request is never authority. Bursar finance grants must be separately reviewed and must not expose lifecycle tables or sensitive student columns.

`src/db/client.ts` creates a direct `postgres` connection lazily using `DATABASE_URL` and checks the configured username is `greenfield_app` and differs from migration credentials. This configuration check does **not** prove role attributes, grants, RLS, search path or actual tenant scope. The repository does not establish whether `greenfield_app` is a table owner or has `BYPASSRLS`; this must be verified in an explicitly authorized environment. Supabase `getUser()` authenticates a user on the server, but the direct Drizzle connection does not automatically carry that JWT into PostgreSQL. Therefore no application-role lifecycle grants or RLS-based write permission are proposed yet. `FORCE ROW LEVEL SECURITY` does not constrain a superuser or `BYPASSRLS` role. A caller-settable custom GUC alone is not a trusted tenant identity. Before persistence, choose and test a trusted per-school DB role/policy context or vetted transaction function approach, and independently enforce school/role/assignment in server code. Ensure runtime and migration roles are separate and that browser, anon, authenticated, PUBLIC, inherited and default grants are audited. The separate-database invariant should be verified per connection without reading credentials into logs.

`11_lifecycle_rls_grants_review.sql` enables/forces RLS and revokes access on new tables, with only candidate staff structure-read policies. It must be reconciled with deployed policies; PostgreSQL permissive policies OR together, so adding these alongside a broad policy would not narrow access. The existing `09` read-only proposal grants broader structure and roster access than this updated role matrix and must be replaced as a reviewed unit, not layered. New lifecycle records, assignments and audit have no direct browser grants. Any future write policy requires both `USING` and `WITH CHECK`, a role/grant test with real JWTs, and separate application authorization. Audit writes should be restricted to the same trusted transaction that finalizes a change; append-only database enforcement and retention remain decisions.

## Transaction contracts

Common precondition: resolve verified auth user and one active membership, derive school ID, authorize operation, begin a transaction, lock the student/current enrollment, reload every referenced row with school-scoped predicates, verify idempotency key/fingerprint and configuration version, and use existing unique/FK constraints as final race guards. On conflict, return a generic same-school conflict without cross-school existence leaks. An identical retry returns the original outcome. Any audit failure rolls back the entire finalization. Proposed decisions are not enrollment changes; teachers cannot supply a finalizer.

| Action | Authoritative checks and atomic result |
| --- | --- |
| Promote | Admin only at finalization; source active; next configured active level; later valid session; destination class belongs to next level and chosen section; no destination enrollment; apply decision, create enrollment, update source status only after status semantics are approved, append audit. |
| Repeat | Same checks, destination level equals source level; section is independently selected and may differ; apply decision, create enrollment, append audit. |
| Graduate | Source is configured final Primary 5 or 6; no destination class/session; no prior terminal outcome; apply decision, mark student/enrollment graduated under reviewed status semantics, append audit. |
| Transfer / early exit | Admin only; source active, no unresolved departure or conflicting final decision; guardian review and reason code required; write departure, update status under reviewed semantics, append audit. Destination text is optional and never a school ID authority. |
| Re-admit | Admin only; linked previous departure belongs to student/school and has no readmission; validate new session/class and guardian state; preserve old records, create a new enrollment and readmission link, restore student status under reviewed semantics, append audit. |

Teacher proposals must use an active assignment to the source enrollment's class/session and revalidate progression; admin finalization revalidates against current structure and enrollment because the proposal may be stale. Lock ordering should be school configuration, student, enrollment, then decision/departure; confirm ordering with concurrency tests. Use one school-scoped idempotency namespace across operations or operation-specific keys with an explicit uniqueness rule. The draft uses one key per table, so a global namespace is **not yet enforced**.

## Remaining security and product decisions

1. Verify deployed foundation migration, actual RLS policies/grants, database owner/inheritance/BYPASSRLS attributes, and whether one school per DB is enforced by provisioning.
2. Select the trusted direct-connection/RLS context and exact runtime grants; until then no lifecycle persistence can be enabled.
3. Decide whether teacher proposals are stored in the same table, whether they can be withdrawn, and whether teacher read access needs a scoped server endpoint rather than direct browser RLS.
4. Define student/enrollment status transitions, historical session closure, the re-admission placement rule, and whether a second departure after re-admission is permitted (the draft permits it from a new source enrollment).
5. Approve audit append-only enforcement, actor retention when memberships/users are removed, retention period, correction procedure, and minimal field set.
6. Resolve legacy class mappings, ambiguous labels, stage ordering and final Primary year per installation; approve the backfill before tightening nullability.
7. Review the existing broad `09` proposal, guardian/finance access, and real two-school/JWT tests before any RLS or grant migration.
