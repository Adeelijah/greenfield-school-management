# Disposable parent and authority lock ordering

Scope: generated rc_it fixture schemas only, installed after the existing source-write guard functions. No database connection is made by the builder. The opt-in integration harness installs it after the first 33 groups to preserve their original revision assertions.

Covered relations: schools, school_users, memberships, teacher_class_assignments, assessment_teacher_subjects, students, classes, academic_levels, academic_sections, academic_sessions and terms.

Every INSERT/UPDATE/DELETE statement takes the exclusive source discovery gate before discovering or locking rows. Readers take the shared gate first. This covers inserts and zero-row statements as well as changes to already-read rows, and coordinates with score/enrollment/source mutations using the same gate. TRUNCATE is rejected. Transactions that previously acquired shared reads must not upgrade into mutation transactions; use the documented exclusive gate first for a mixed writer.

The prepared PostgreSQL checks hold only the shared gate and attempt all 33 table/operation combinations with bounded lock timeouts. Each must fail with 55P03. After the reader ends, a membership suspension succeeds and a new workflow command is forbidden; restoration follows in finally. All eleven truncate attempts must fail. These tests have not been executed here.

This is ordering, not database authorization. Functions remain invoker functions; owner-run tests prove neither least privilege nor RLS. Parent academic content revision fan-out is still pending. Authority changes do not themselves alter academic source content; current role and assignment checks remain required inside each transaction. Canonical reconstruction detects changed parent content, but automatic revision advancement and re-finalization recovery need the next batch. Global gate serialization is intentionally conservative for a disposable fixture and is not a production scalability design.

Expected full offline count: 326. Expected PostgreSQL groups: 35. No production schema, migration, live auth, release policy or application route changed.
