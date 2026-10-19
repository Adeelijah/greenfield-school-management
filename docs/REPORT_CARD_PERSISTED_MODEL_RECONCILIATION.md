# Report Cards: persisted model reconciliation — review only

This review compares source declarations in `src/db/schema.ts`, `src/server/auth/identity.ts`, `src/server/auth/authorization.ts` and the tested synthetic adapters. It does not establish what is applied to a database. No SQL, migration, auth changes or live data access are included.

## Confirmed test evidence

The user ran the combined milestone locally on 2026-10-19: the full offline gate passed with 208 tests; all ten authoritative-read/combined PostgreSQL groups passed. This verifies the synthetic guard/transaction behavior only. The combined reader still uses a JSONB academic fixture and fictional identity callback.

## Existing relational mapping

| Trusted contract | Current source model | Mapping and constraint |
| --- | --- | --- |
| Verified auth identity | Supabase `auth.getUser()` | Server verification capability, never a body/URL user ID. Requires deployment/JWT testing later. |
| Auth user → school user | `school_users.auth_user_id` → `school_users.id` | These IDs are different. Require exactly one match. |
| School user → membership | `memberships.user_id`, `school_id`, `id`, `role`, `status` | Resolve exactly one active school; only admin/teacher for Report Cards. `getSchoolAccess()` currently returns role/school, not membership ID. The transactional lookup must resolve and recheck membership ID. |
| Membership → school | `schools.id`, `final_primary_year` | Confirm school ownership and configured Primary 5/6; do not infer configuration. |
| Student identity | `students.id`, `school_id`, `status` | Require actual joined student ownership; enrollment IDs alone are insufficient. Current mapping deliberately supports active-student reports only. |
| Enrollment | `enrollments.id`, `school_id`, `student_id`, `class_id`, `session_id`, `status` | Read the full student/session enrollment set, including other classes. Require one active row matching the report's pinned enrollment ID. |
| Class mapping | `classes.level_id`, `section_id` | Nullable legacy mappings must fail closed. Never infer level/section from display names. |
| Active class | `academic_levels.is_active`, `academic_sections.is_active` | Validate school, level/section relationship and Primary 5/6 configuration before deriving active=true. |
| Session/term | `academic_sessions` and `terms` date fields, school/session IDs | Validate exact term/session and date containment. `is_current` is retained as-is; it does not prove lifecycle status. |
| Teacher assignment | `teacher_class_assignments.teacher_membership_id`, `class_id`, `session_id`, `ended_at` | Domain membershipId comes from teacherMembershipId. Only endedAt=null is active. Require exactly one matching active assignment for a teacher. |

`report-card-persisted-model-map.ts` implements these pure selected-column mappings using type-only references to actual Drizzle models. It does not import the schema at runtime, query SQL, load secrets, authenticate a user, or invoke the writer. Inputs must be complete trusted rows loaded in one authorized transaction; no mapper can detect rows omitted by a faulty query. Mixed-school rows are rejected.

## Source gaps that block a real adapter

| Gap in current production schema source | Required decision/work before integration |
| --- | --- |
| No persistent subject catalog, class/level subject roster, teacher-subject links, assessment components/configs, scores, review/finalization or source-revision tables | Reconcile academic domain contracts into a separate reviewed persistence proposal. Bind every source row to school, class, session, term, student/subject and immutable configuration/source revisions. No JSONB fixture may stand in for real production reads. |
| No authoritative source guard/revision equivalent to synthetic `read_scopes` | Define persisted revision ownership, complete affected scopes and update protocol. Enforce atomic revision changes and lock order across every score/config/roster/enrollment mutation, including inserts/deletes. A read-time revision check alone cannot prevent phantom rows. |
| Session has no domain `status` or `version`; term has no domain ordinal `number` or `version` | Review explicit storage/mapping rules. Do not parse term names, derive a lifecycle state from isCurrent, or default versions to zero/one to satisfy an interface. The new mapping returns raw references without these invented fields. |
| Report tables exist only in the review proposal | Reconcile pinned enrollment and school/session/term keys, snapshot format/identity and immutability before a separately authorized migration. The proposal/shadow term definition remains excluded from production migrations. |
| Current enrollment/student enum lacks `completed` | Existing lifecycle proposals discuss this; do not modify generated migrations or widen the runtime mapper to accept an unapplied status. Historical/graduated reporting needs a separate reviewed eligibility policy. |
| Separate Supabase auth and direct PostgreSQL transaction boundaries | Preserve verified JWT identity; resolve membership in the transaction without treating a privileged DB connection as authentication. Review least privilege/RLS and identity propagation before any route wiring. |
| Synthetic identity guard has no direct live counterpart | Evaluate existing school_users as a lock anchor or an explicit guard design; verify every membership/assignment mutation participates. No protocol is globally enforced by the offline mapper. |

## Next implementation sequence

1. Review the missing academic persistence model and revision/lock protocol against the existing calendar/assessment command contract; prepare proposals only.
2. Reconcile term/session fields and historical report eligibility without fabricated defaults.
3. Review school-scoped constraints, source provenance, report snapshot bindings and security policies.
4. Obtain separate approval for isolated schema/SQL tests. Build schema-faithful fixtures using the reviewed relational shapes, then verify source reads, transactions, role changes and phantom insert behavior.
5. Only after those gates, implement the authenticated production read adapter and connect real workflows. Live auth changes, migrations, production database use and deployment require explicit approval.

## Offline tests

Ten new tests cover the auth→school-user→membership join, active-school ambiguity, suspended/bursar rejection, ended assignment mapping, student/enrollment ownership, duplicates across classes, legacy/inactive class mappings, Primary 5/6 and early-years handling, calendar validation, mixed-school rows and non-mutating output without invented version/term fields. These extend the offline allowlist; passing them is not evidence of applied SQL constraints, live JWT behavior or deployed authorization.
