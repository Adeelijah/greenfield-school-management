# Assessment source policy and prerequisites — isolated review milestone

`src/lib/academics/assessment-persistence-policy.ts` defines pure policies for the proposed persistence layer. It does not execute SQL, authenticate actors, change the existing assessment planner, or connect to live routes. Selected membership, assignments, current source versions and affected scopes must come from complete trusted reads inside an authorized transaction.

## Decisions implemented offline

| Operation | Allowed actor at this policy boundary | Academic source revision |
| --- | --- | --- |
| Score edit | Active admin or teacher with exactly one matching class/session/subject assignment per affected scope | Advance every affected scope once |
| Roster, enrollment or configuration edit | Active admin | Advance every affected scope once |
| Teacher review | Active assigned teacher | Preserve revision; require exactly one current persisted source version per scope |
| Finalization | Active admin | Preserve revision; require exactly one current persisted source version per scope |

The expected revision list must match the complete server-resolved affected scope set exactly, without missing/extra/duplicate IDs. School mismatches, stale revisions, duplicate scope identities, role failures and source-revision overflow fail closed. Plans return a copied, deterministic lock order based on the full school/class/session/term/scope tuple. Every adapter must use this same order and hold locks through writes/audit/receipts. Sorting a plan is not a database lock.

This is a revision plan, not full operation authorization. Source manifest completeness, config/roster joins, current finalized state, teacher-review provenance, administrator finalization checks and correction/reopen rules remain additional required gates. In particular, a `score_change` plan does not authorize editing a finalized result without an approved correction workflow.

## Configuration and score persistence validation

`validateConfigForPersistence` reuses existing assessment configuration rules, then adds stage/mode consistency, supported categories, boolean required flags, positive config versions and supported four-decimal component maxima/weights. Component weights must total **exactly** 100 using integer decimal units; the existing rounded floating-point tolerance is not accepted at this persistence boundary.

`validatePersistedScore` requires a finalized valid configuration and an existing component. Numeric score input is bounded decimal text with at most eight whole digits and four decimal places, matching proposed `numeric(12,4)`. It rejects whitespace, signs, leading-zero aliases, exponents, NaN/Infinity, excessive precision, double/missing value modes and values above the component maximum. Maximum comparisons use integer decimal units without converting stored score text through floating point.

Early-years observational values retain their exact text rubric key and must match a configured level; they are never coerced to numbers. This does not make arbitrary text rubric IDs compatible with the old number-based result engine. That projection/result-calculation change remains pending. Persisted separate mode/state columns must be checked against the configuration document before constructing the validated domain projection.

The policy validates representability and component bounds, not result totals or canonical hashes. Existing numeric result rounding is unchanged; a full decimal calculation/grade-boundary policy still needs review before production finalization.

## Exact existing-table prerequisite proposals — DO NOT APPLY

| Existing relation | Candidate unique constraint/index name | Referenced columns |
| --- | --- | --- |
| terms | terms_school_session_id_unique | school_id, session_id, id |
| teacher_class_assignments | teacher_class_assignments_school_id_id_unique | school_id, id |

These targets are required by the isolated assessment proposal; neither is added to `src/db/schema.ts` by this batch. Before executable migration generation, an approved isolated environment must confirm deployed column types/nullability, current constraints/indexes, orphan/mixed-school relationships, name collisions and migration ownership. Source declarations and metadata tests do not establish the applied state. Existing global ID primary keys do not substitute for declaring the proposed composite PostgreSQL FK target.

The review-only report proposal also contains a shadow terms declaration; never include either proposal in a schema glob or import the shadow into production. Reconcile the real terms target once in a separately approved prerequisite migration. No executable SQL or migration is generated here.

## Required database enforcement work next

1. Make source guard creation and multi-scope discovery complete, including missing/new scopes and enrollment/config fan-out. Require every writer, import and background job to participate.
2. Enforce guard lock order, optimistic compare-and-swap, atomic revision/audit/receipt writes, operation fingerprints and rollback. Add genuine phantom insert/delete concurrency tests.
3. Make finalized config/source/review/finalization/audit/receipt relations append-only through restricted grants and reviewed server routines/triggers. The Drizzle draft alone does not do this.
4. Complete same-class/session config, roster, teacher assignment and enrollment checks that tenant FKs alone cannot prove.
5. Separate the general command/workflow version from academic source revision in the real projection. The existing `planAssessmentCommand` and its review `snapshot.version - 1` logic remain untouched; do not wire the new source policy into it without a reviewed reconciliation.
6. Prepare schema-faithful disposable fixtures from the reviewed design; obtain approval before connecting/executing SQL. Only then verify constraints, lock protocol and authorization independently of pure tests.

## Verification

Ten new offline tests cover exact config weight/precision rules, numeric text bounds, observational keys, all source mutations, unchanged review/finalization revisions, required current source versions, exact scope/revision sets, teacher subject assignment, role/tenant rejection and overflow/non-mutation. The preceding schema proposal passed the user's complete offline gate with 226 tests. These new policies are not imported by production handlers and do not alter auth/RLS or the production schema.
