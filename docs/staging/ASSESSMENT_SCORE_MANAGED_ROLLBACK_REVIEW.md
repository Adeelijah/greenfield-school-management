# Greenfield staging assessment score rollback rehearsal

The accepted target inspection has no inspection issues. This package is fixed to project `hweoqkbgmzycyznrbvng`, school `0c594571-74c5-46fe-a835-a9b217a3a199`, the existing fictional Primary 5 and Creche classes, and the reviewed PostgreSQL 17 layout. It is a rollback rehearsal, not the committed installer. Assessment saving remains disabled.

## What the batch does

`ASSESSMENT_SCORE_MANAGED_ROLLBACK_REHEARSAL.sql` creates three separate assessment roles, private owner policies and one `save_assessment_subject_scores(uuid,jsonb)` function inside a transaction. The LOGIN has no password. The function body retains the locally PostgreSQL-proven score writer's authority, version, roster, decimal-text, receipt, history and revision checks. The public entry name changes; the command and audit action stay `save_subject_scores`.

Preflight rejects changed existing roles, role edges, helpers, columns, keys, constraints, enums, indexes, guards, policies or reviewed source/report data. It takes the coordinated source gate before the authority barrier. Existing source/report data and the four attendance tables are captured for preservation using the operator's already observed SELECT access. It grants no attendance access, assumes no attendance owner membership and changes no existing table layout or function definition.

The new function's provider-default API grants are revoked before ownership transfer. Only the new runtime receives execution. Only the private assessment owner receives the necessary source reads, bounded score/revision writes and three revision-helper execution grants. Temporary operator-owned SET membership and schema CREATE access are removed, leaving provider bootstrap ADMIN-only memberships intact. Existing report and attendance execution graphs and grants are preserved.

Three fictional subject probes exercise numeric and observational saves, exact replay, changed-payload rejection and bursar denial. Each probe raises and catches one explicit rollback SQLSTATE in its own subtransaction, undoing its scores, revisions, claims, audit and receipt writes before preservation checks. These owner-executed SQL probes are not proof of SDK identity, LOGIN transport, browser behavior or performance. Those remain later gates.

The batch checks intended role/policy/privilege additions and compares protected row markers, old role edges, helper definitions, existing ACL entries, columns, constraints, indexes and guards. It ends with ROLLBACK and verifies that the three new roles, private function and policies are absent. No committed score or password changes are intended.

## Operator steps

Run the entire checked-in SQL file once in the confirmed **Greenfield staging** SQL Editor, as the existing `postgres` inspection operator. Do not execute individual fragments or replace ROLLBACK with COMMIT. If it stops with an error, issue `ROLLBACK;` in that same session and share the error; do not repair or bypass its checks.

Expected final JSON includes `assessment_score_managed_rollback: PASS`, `new_assessment_objects_absent: true`, `existing_report_source_attendance_state_checked: true`, `login_password_configured: false` and `assessment_save_enabled: false`.

A successful operator rehearsal precedes preparation of the separate committed installer. The subsequent batch will cover dedicated LOGIN provisioning/TLS checks, the SDK-owned server request boundary and editable score UI with versions, correction reasons, pending feedback and exact retry behavior. Teacher review and independent admin finalization remain separate work.

## Authoring validation

Ten new pure composition tests and seventeen existing score parser/target/upgrade-plan checks pass. They check generated text and actual adapter behavior with recorders; they do not parse or execute PostgreSQL. The verifier includes the new test file. No TypeScript/UI source changed in this batch. Full TypeScript/ESLint/offline verification is run in the operator checkout. The managed SQL has not been executed during authoring.

## Empty ACL correction

The first operator attempt stopped with SQLSTATE 22023, `ACL arrays must be one-dimensional`. The column snapshot had synthesized an ordinary empty `aclitem[]` for a missing column ACL; PostgreSQL's ACL decoder rejects that array representation. The snapshot now leaves absent column ACLs null and passes an ACL array to `aclexplode` only when its cardinality is positive. Relation, function and schema defaults remain the real `acldefault` values. Explicit grantees and grant options remain compared. No grant, policy, role or writer logic changes in this correction.

Eleven managed composition checks and seventeen existing focused score checks pass (28 total), including coverage that all four snapshot ACL sources guard empty arrays and preserve real object defaults. This is authoring validation, not a successful managed PostgreSQL run. Clear the failed transaction with `ROLLBACK;` in the same SQL session, then pull and rerun the complete corrected rehearsal.
