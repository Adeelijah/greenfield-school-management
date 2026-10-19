# Assessment persistence proposal — review only, not migration-ready

`src/db/academic-assessments-schema.proposal.ts` is an isolated Drizzle design for the missing academic persistence layer. It is not exported by `src/db/schema.ts`, referenced by `drizzle.config.ts`, migrated, applied, or wired to the application. Do not generate migrations from this file or include it in a schema glob. No SQL execution, live database connection or change to production auth/RLS is included.

## Proposed relations

| Relation | Purpose | Key invariant proposed |
| --- | --- | --- |
| assessment_subjects | School subject catalog | Unique school/code, school/id target, positive version; normalize code/name in server validation |
| assessment_config_versions | Versioned level/term/optional-subject configuration | Explicit config identity/revision; separate partial uniqueness for default and subject-specific versions; school/level and school/session/term references |
| assessment_scopes | Existing lock anchor per class/session/term | One school/class/session/term scope, positive monotonic source revision |
| assessment_subject_roster | Versioned assigned subjects and pinned config version | Retain old roster rows; one active row per scope/subject and unique version per subject |
| assessment_teacher_subjects | Subject teaching permission linked to class assignment | School-scoped roster and class-assignment references; runtime must also verify matching class/session and active membership/assignment |
| assessment_scores | Current component score or observation | Unique school/roster/enrollment/component; exact roster/config and enrollment/student references; exactly one numeric or observation value |
| assessment_source_versions | Immutable proposed source manifests | Unique scope/revision; full school-scoped roster/enrollment/config/component/score manifest, canonical SHA-256 hash |
| assessment_teacher_reviews | Teacher attestation of a particular source/subject | Exact source scope and roster scope, reviewer membership; current assignment and teacher role rechecked in transaction |
| assessment_finalizations | Admin-calculated finalized subject results | Exact same source/subject/scope as teacher review; unique finalization per source/subject; actor and result hash |
| assessment_audit | Academic scope operation lineage | Source revision unchanged or advanced by exactly one; actor/scope references |
| assessment_operation_receipts | Durable replay/conflict records | Unique school/actor/operation key across scopes; server fingerprint and outcome |

Only foreign-key/uniqueness/check metadata is proposed here. None of the table names prove storage exists in a deployed database. Append-only behavior, permissions, writer protocol and payload semantics are NOT enforced merely by these declarations.

## Prerequisites on existing schema — unresolved, do not apply

1. `terms` needs a separately reviewed unique target `(school_id, session_id, id)`. The proposal references actual `terms` columns, without declaring a shadow replacement. PostgreSQL cannot create these composite FKs until the target exists.
2. `teacher_class_assignments` needs a separately reviewed unique target `(school_id, id)` for the tenant-scoped assignment link. Its global ID primary key alone is not the proposed composite target.
3. Session/term lifecycle, version and ordinal storage/mapping remain unresolved. This proposal deliberately adds no fields to existing production tables and makes no inference from names or `is_current`.
4. Historical/completed enrollment and inactive/graduated student report eligibility remain under separate review. The selected-column mapper currently supports active students; this draft does not change that policy or enum.
5. The report-card proposal still needs a pinned enrollment identity and immutable snapshot/release binding. This assessment proposal does not fix that proposal implicitly.

## Source revision and lock protocol — candidate for review

Separate the **academic source revision** from workflow activity. A score/configuration/roster/enrollment change advances every affected scope once in the same transaction. Reviewing or finalizing unchanged academic data binds the existing source version and does not itself change its source revision. Academic audit permits unchanged revision for such workflow operations. The existing pure planner increments a general snapshot version for commands; an adapter/domain reconciliation must distinguish that command version from source revision before integration. Do not automatically equate them.

A scope row must exist before source writes. A candidate global order is: verified auth identity anchor; membership/class assignment authorization anchors; a report row when a report operation requires one; affected scope anchors in stable school/class/session/term order; then child rows in stable IDs. A pure academic writer must not take a report lock later after holding a scope lock. Provisioning missing scope anchors and locking membership/assignment inserts need an explicit protocol so absence does not bypass locking.

Enrollment/roster/config changes can affect multiple classes and terms. Resolve the complete affected scope set and lock all anchors before modifying any child row. All writers, including imports, admin tooling and background jobs, must use the same protocol. Row locks alone do not prevent phantom inserts; append-only triggers, restricted grants and reviewed server routines must enforce the design. A reader must validate the complete assigned subject set, exact enrollment identity, matching pinned configuration, current source revision and complete finalized results.

Build a canonical source manifest containing student/enrollment/class/session/term, all active subject roster IDs/versions, configuration IDs/revisions, component definitions, scores/observations and their versions. Store its hash server-side. At a given scope/revision, source content cannot change. A review/finalization uses a durable immutable source version, not a client boolean or hash.

Teacher review requires current teacher class AND subject assignment. Admin finalization recalculates from that exact source version through the validated assessment engine and validates completeness. Membership foreign keys prove identity/tenant references, not roles or assignment authorization. Subject-specific config override/default selection must be explicit and deterministic; the pinned roster config prevents silently selecting whichever config row happens to be first.

## Constraints needing further review/enforcement

- Configuration payloads remain JSONB component arrays and grading objects so numeric bands and early-years rubrics share a versioned document. The draft checks top-level shape only. Finalization must validate unique component keys, positive maxima/weights, weights totaling 100, grading coverage, mode/stage compatibility, and valid observational levels. Consider normalized components if stronger SQL references are required.
- Score checks reject missing/double value modes, blank observation keys, negative/NaN numeric values and nonpositive versions. They do not enforce configured maxima, selected mode or component existence in JSON. These need transactional validation or further normalized relational constraints.
- Numeric values use decimal storage (`numeric(12,4)`); Drizzle returns numeric text by default. Specify exact parsing, accepted precision, rounding and grade boundaries before mapping into the number-based engine. No permissive conversion is introduced here.
- `observation_key` is explicit text rather than disguised numeric score. The current engine represents observational IDs through numeric values converted to strings. Arbitrary text rubric IDs therefore require an explicit domain/adapter change; do not silently coerce them to numbers.
- Roster/config FKs prove same school and pinned version. They do not enforce that config level/session/term/subject matches the roster's class scope or that config is finalized. Validate the join, or strengthen the relational model in the next review.
- Teacher-subject links must match their class assignment to the roster scope; enrollment/student FKs must also match the scope's class/session. The proposed same-school references alone do not enforce these cross-relation equalities.
- To change a pinned config while retaining score/review/finalization history, deactivate the old roster row and create a new version under the scope lock; never rewrite a historical roster/config pointer. Decide carry-forward policy for old scores separately.
- Finalized config versions, source versions, teacher reviews, finalizations, audits and receipts require DB-enforced append-only privileges/triggers. Draft config edits need separate optimistic versions or immutable draft version creation. Such policies are not yet supplied.
- Global catalog/config operations may affect many scopes or no scope yet. Their audit/idempotency contract must be designed separately; the scope-bound audit/receipt tables here cannot cover unscoped catalog commands by themselves.
- Correction/reopen lineage, result revocation, guardian access, report snapshots, retention and backup/recovery remain later gates.

## Security and rollout gates

Default deny direct client access; no bursar academic mutations or guardian draft reads. Authenticated actor/school must be verified server-side and rechecked in the transaction. Explicitly review the JWT/direct-PostgreSQL boundary, least-privilege grants, RLS and privileged-role bypass. No SQL generation until prerequisites, invariants and payload/revision contracts are reviewed.

After separate approval, build schema-faithful isolated PostgreSQL tests for wrong-school FKs, wrong-session terms, null-subject config uniqueness, roster history, duplicate component scores, forged enrollments, exact review/source binding, immutable writes, role changes, phantom inserts, concurrency, replay and rollback. Then reconcile the real read adapter, canonical report snapshots and authenticated routes. Deployment/production migration approval remains separate.

## Validation status

Eight metadata tests are prepared for tenant-scoped relations, term/session FKs, partial config uniqueness, retained roster history, enrollment/config score binding, exact teacher-review finalization binding, receipts/audit lineage, and migration-entrypoint exclusion. These inspect Drizzle metadata, not PostgreSQL constraint execution. They could not run locally because `drizzle-orm` is not installed in the assistant's checkout; no dependencies were installed. Existing Report Cards pure tests remain runnable independently. Full TypeScript/ESLint and the new metadata tests require the user's existing installed dependencies.


## Follow-up source/configuration policy

The user confirmed this schema proposal's full offline gate passed with 226 tests. `assessment-persistence-policy.ts` now defines a review-stage source/workflow revision distinction, complete scope/expected-version matching, stable lock ordering, teacher subject-assignment checks, exact bounded numeric text validation and text observational keys. See `ASSESSMENT_SOURCE_POLICY_REVIEW.md` for the exact prerequisite target names and remaining enforcement work. The original assessment planner is unchanged. New pure validation does not enforce database constraints, append-only behavior or lock acquisition and does not make the proposal migration-ready.
