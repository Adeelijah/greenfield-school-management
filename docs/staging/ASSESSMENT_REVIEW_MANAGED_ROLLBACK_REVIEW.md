# Fixed managed review rollback rehearsal

The operator returned the actual Greenfield staging review target inspection with no issues. It records nine installed roles, two absent review role names, the existing protected score API, all 33 selected relation layouts/ACLs and an ADMIN-only path to the complete-helper owner. The operator currently cannot SET that owner. Existing SELECT on all selected tables, including private attendance tables, is explicitly observed. No new owner privilege or attendance grant is inferred.

## Package

`ASSESSMENT_REVIEW_MANAGED_ROLLBACK_REHEARSAL.sql` is fixed to project `hweoqkbgmzycyznrbvng`, school `0c594571-74c5-46fe-a835-a9b217a3a199`, the reviewed PostgreSQL 17 managed operator and accepted catalog/data markers. Its pure composer takes no runtime environment, driver, connection or arbitrary target input. The metadata module contains catalog descriptions and count/change markers, not account/pupil rows or credentials.

The package rejects adoption, changed existing roles/edges, helper definitions/settings/ACLs, columns/defaults/column ACLs, source/review/finalization keys, constraints, triggers/policies and populated source/report/parent data. Catalog formatting is checked in the captured inspection search path, then restored to pg_catalog. The exclusive source discovery gate precedes the authority barrier and data preservation snapshot. All 33 selected relation data sets, including attendance and the singleton gate, are checked unchanged; the attendance read uses the operator's already observed SELECT, without granting access or taking its owner role.

It creates only two new roles, a private invoker statement guard, 74 bounded policies and 23 statement triggers. The guard body and policy/grant structure derive from the locally PostgreSQL-proven restricted planner. Only the runtime gets fixed-school restrictive read/locking permissions and INSERT on the five immutable source/review/finalization/audit/receipt tables. UPDATE(id) grants support locking SELECT, while the statement guard denies actual mutations, including zero-row UPDATE. New roles receive no score changes, revision claims/helper execution, report data, table ownership or Auth access. Existing score, report and attendance role memberships and function definitions stay intact.

The new guard is owned by postgres, not a new service owner. Its provider-default ACL is reset so no nonowner caller receives execution. The narrow EXECUTE addition on the existing complete actor helper is issued only while explicitly SET LOCAL ROLE to `greenfield_report_card_authority_owner`. Temporary operator-owned SET memberships to that owner and the new runtime use `GRANTED BY postgres`; cleanup removes exactly those grantor-specific edges and preserves provider bootstrap ADMIN-only grants. There is no provider Auth grant, RPC rewrite or owner-connection fallback.

Switched-role probes resolve the existing fictional teacher/admin through the real complete helper, reject NULL and bursar authority, deny zero-row UPDATE across all 23 targets, and deny report/revision-claim reads. Permission-denial probes use exception subtransactions. This SQL rehearsal performs no source/review/finalization workload inserts and cannot execute the TypeScript canonical materializer. The managed writer, dedicated LOGIN transport, SDK and browser behavior remain later checks. The roles retain a NULL LOGIN password, and no application flag is enabled.

Before rollback, effective table/column/sequence/helper grants, role graph, new guard definition/ACL, policy roles/count and trigger events are checked. Existing data/roles/owners/layout/ACLs/helpers/guards/policies/indexes/default grants are compared with the captured baseline, excluding only the exact intended new role grants and new policy/trigger names. Empty ACLs are guarded by cardinality before decoding. The final ROLLBACK removes new objects/grants, and postrollback checks verify new objects absent plus old role/helper ACL restoration.

## Run once on Greenfield staging

```powershell
git pull --ff-only origin report-cards-foundation
if ($LASTEXITCODE -ne 0) { throw 'Git update failed' }
node .\scripts\verify-offline.mjs
if ($LASTEXITCODE -ne 0) { throw 'Offline checks failed' }
Get-Content .\docs\staging\ASSESSMENT_REVIEW_MANAGED_ROLLBACK_REHEARSAL.sql -Raw | Set-Clipboard
```

Confirm the Greenfield staging project in the SQL Editor. Paste and run the complete batch as the same postgres operator. Do not execute fragments or substitute COMMIT. If it errors, run `ROLLBACK;` in that same SQL session and share the error; do not repair guards or grants to bypass a check. Concurrent staging source or attendance work can cause the bounded lock timeout; let that work finish before retrying the complete unchanged batch. A changed inspected data marker requires fresh evidence, not editing an expected hash.

Expected final JSON:

```json
{"assessment_review_managed_rollback":"PASS","new_review_objects_absent":true,"existing_report_source_score_attendance_state_checked":true,"login_password_configured":false,"review_finalization_enabled":false}
```

A successful rehearsal precedes a separate committed installer. Then dedicated LOGIN setup/TLS checks, the managed fixed execution mapping, SDK-owned server actions and the shared teacher/admin UI can follow. Seeded current reviews/finalizations must not be deleted to permit browser tests; begin that later test with a reasoned fictional score change and complete the new revision's reviews/finalizations while retaining old documents. Existing published snapshots must remain unchanged.

## Authoring validation

Ten new composition/parity/privilege/preservation checks and 27 existing target/restricted-writer/probe checks pass (37 focused). The full offline allowlist is updated (expected 804 tests). MJS syntax checks pass. No TypeScript or UI source changed. No PostgreSQL connection or managed SQL execution occurred in authoring; the pure checks do not prove PostgreSQL parsing or target execution. The operator checkout runs the full compiler/lint/offline gate before this rehearsal.
