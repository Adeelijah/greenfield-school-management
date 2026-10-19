# Fixed-school restricted fixture permissions

Status: prepared, not executed by the assistant. User verified the preceding 337-test offline gate and all 38 owner-run PostgreSQL groups. No production policy, authentication, migration or deployment changed.

## Prepared boundary

`fixtureSecurityPlan(schema, fictionalSchoolId)` emits review-only DDL for a generated rc_it schema and the exact reader/writer roles from the preflight. It covers 27 actual metadata relations and the discovery gate. The schema owner creates policies; it remains a separate setup identity. All tables get ENABLE and FORCE RLS. An explicit owner policy permits setup; tested roles receive a restrictive fixed-school clamp and scoped read policy. Membership rows scope school_users; schools use their primary ID. No caller-controlled GUC, auth function or SECURITY DEFINER authority is introduced.

These are trusted server service roles, not teachers, admins, guardians or SQL client identities. Their RLS boundary is school isolation; the existing transaction writers still resolve verified identity and enforce membership/assignment/action permissions. The service writer can issue own-school report writes, so it must never be exposed to an end user. Global multi-school membership ambiguity semantics still need reconciliation with the eventual live deployment/auth strategy. This fixture is not live Supabase RLS.

PUBLIC and the two roles lose existing schema/table/function/sequence privileges in the fixture. Roles gain schema USAGE and SELECT on the listed targets; claims remain inaccessible. No schema CREATE, DELETE, TRUNCATE, broad UPDATE or function EXECUTE grants are introduced. Existing default enum type usage supports the metadata fixture; no production default privileges are changed.

## Locking-read privilege boundary

PostgreSQL locking SELECT requires UPDATE privilege and applicable UPDATE USING policies. The plan grants UPDATE(id) for locking reads, a school-scoped UPDATE USING policy and WITH CHECK(false). A BEFORE STATEMENT trigger named aaa_fixture_service_write_guard runs before the existing source/parent triggers and rejects actual reader mutation, including zero-row updates. Locking SELECT does not fire this mutation trigger or apply UPDATE WITH CHECK. Both policy behavior and real locking readers must pass the prepared PostgreSQL tests; generated SQL assertions alone are insufficient.

The writer gets no UPDATE(id) on report_cards. Instead, its UPDATE list is limited to stage, version, submitted_by, approved_by, published_at, return_reason, assessment_source_version_id and assessment_revision. Stable school/report/enrollment/student/class/session/term/scope keys cannot be updated. Its guard permits report INSERT/UPDATE and append-only INSERT into snapshots, audit, receipts and releases; all other mutations are rejected. Existing append-only triggers remain. Release UPDATE/revocation is not granted. Parent/source maintenance remains setup-only until a separate controlled boundary is reviewed.

## Optional role-admin PostgreSQL groups

The main disposable harness keeps the existing 38 groups and adds four opt-in groups. Set REPORT_CARD_TEST_ROLE_ADMIN_CONFIRM=DISPOSABLE_ROLE_ADMIN_TEST_ONLY in addition to the normal disposable URL/confirmation. A read-only capability check requires a LOCAL test connection with CREATEROLE or superuser; it fails before schema creation otherwise. Do not broaden greenfield_test privileges. Select a separately authorized local role-admin connection to the same disposable database.

Inside one intentionally rolled-back transaction, the harness creates two generated NOLOGIN/NOINHERIT roles with no elevated flags, grants the setup identity SET membership, checks catalog preflight, installs the plan, then SET LOCAL ROLE and asserts current_user. Writer calls additionally assert execution role inside each savepoint. The first groups test foreign-school rows, a forged app.school_id setting, locking canonical reads, zero-row mutations on every target, private helper execution, immutable/identity mutation rejection and actual create/submit/approve/publish/replay. The final group verifies rollback removed roles, grants/policies and workload writes. Existing objects/roles are never overwritten on name collision.

The role-admin session remains trusted and controls role switching. This tests privileges while current_user is restricted; it does not model hostile arbitrary SQL from an administrator session. Separate least-privilege login/session tests, restricted-role concurrent failures, grant/default-privilege inspection and the eventual production auth boundary remain future checks.

The new pupil/source fixture is fictional and dropped with its generated schema. Role/policy/workload DDL is transactional and rolled back on assertions, errors or intentional completion; the outer finally drops the generated schema. No persistent CREATEROLE grant is made. When the extra confirmation is absent, output explicitly marks these four groups SKIPPED; 38 owner-run passes must not be called 42 security passes.

## Verification and next gate

Eight new offline tests raise the expected full offline count to 345. All 26 related unit tests, script syntax and whitespace checks passed here. New SQL has not been executed. Expected opt-in PostgreSQL total is 42 groups; ordinary mode remains 38 plus an explicit restricted-group skip.

Next after actual restricted-role verification: add restricted failure/concurrency coverage, review append-only release revocation/correction policy and close the login/authority deployment contract before route integration. Do not merge, deploy or apply production grants/RLS.

References: https://www.postgresql.org/docs/18/sql-createpolicy.html (locking-read policy table), https://www.postgresql.org/docs/18/sql-grant.html and https://www.postgresql.org/docs/18/ddl-rowsecurity.html .
