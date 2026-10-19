# Disposable parent and authority lock ordering

Scope: generated rc_it fixture schemas only, installed after the existing source-write guard functions. No database connection is made by the builder. The opt-in integration harness installs it after the first 33 groups to preserve their original revision assertions.

Covered relations: schools, school_users, memberships, teacher_class_assignments, assessment_teacher_subjects, students, classes, academic_levels, academic_sections, academic_sessions and terms.

Every INSERT/UPDATE/DELETE statement takes the exclusive source discovery gate before discovering or locking rows. Readers take the shared gate first. This covers inserts and zero-row statements as well as changes to already-read rows, and coordinates with score/enrollment/source mutations using the same gate. TRUNCATE is rejected. Transactions that previously acquired shared reads must not upgrade into mutation transactions; use the documented exclusive gate first for a mixed writer.

The prepared PostgreSQL checks hold only the shared gate and attempt all 33 table/operation combinations with bounded lock timeouts. Each must fail with 55P03. After the reader ends, a membership suspension succeeds and a new workflow command is forbidden; restoration follows in finally. All eleven truncate attempts must fail. These tests have not been executed here.

The user verified the initial 326-test offline gate and all 35 PostgreSQL groups.

This is ordering, not database authorization. Functions remain invoker functions; owner-run tests prove neither least privilege nor RLS. The continuation below prepares parent academic content revision fan-out. Authority changes do not themselves alter academic source content; current role and assignment checks remain required inside each transaction. Canonical reconstruction detects changed parent content, but automatic revision advancement and re-finalization recovery are prepared below. Global gate serialization is intentionally conservative for a disposable fixture and is not a production scalability design.

Expected full offline count: 326. Expected PostgreSQL groups: 35. No production schema, migration, live auth, release policy or application route changed.


## Parent revision continuation

Academic parent UPDATE/DELETE row triggers now discover affected scopes before parent changes or cascading deletes. Schools fan out to their scopes; classes include every session/term; sessions and terms target their exact dependent scopes; levels and sections follow their classes; students follow all retained enrollment class/session references. Old and new parent IDs participate. Inserts have no existing dependent scopes under the non-deferred fixture foreign keys; subsequent enrollment/scope insertion uses the existing invalidation guards. Parent key/school relocation remains constrained by the fixture foreign keys; this does not introduce a relocation API.

Targets are sorted by scope ID, then passed through the same transaction/scope claim table as enrollment, roster, config and score writes. Every UPDATE conservatively invalidates dependents, even unchanged values or fields currently absent from canonical content. This favors safe staleness over field-by-field assumptions. A failing statement or receipt rolls back parent changes, revisions and claims together. Pure authority tables (users, memberships, class assignments, subject permissions) retain gate locking but do not increment academic revisions; readers still recheck their authority.

Three additional prepared PostgreSQL groups check all seven parent families with exact expected scopes (including a second session), overlapping parent/score deduplication, receipt collision rollback, successful same-change retry, stale canonical-source rejection, re-finalization recovery and untouched historical report snapshots. Two new offline assertions bring expected full totals to 328 offline tests and 38 PostgreSQL groups. Here, 52 selected offline tests, script syntax and whitespace checks passed. Full TypeScript/ESLint and database execution remain pending local verification.

Restricted database roles/grants/RLS, release revocation and production rollout are still separate gates. No SQL was executed by the assistant.
