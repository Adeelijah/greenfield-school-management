# Restricted assessment review fixture

## Evidence and scope

The operator passed all 781 offline checks and the previous real PostgreSQL upgrade workload, including source/review/finalization/audit/receipt and outer rollback, exact retry/replay, report consumption, changed-source recovery and cleanup. Those initial review commands used the local fixture operator transport. This batch prepares a separate restricted execution layer; no managed staging SQL, SDK or browser review enablement is included.

## Role and authority boundary

A new disposable-only planner creates exactly two nonce-scoped roles: an unprivileged NOINHERIT LOGIN and one NOLOGIN execution role. The LOGIN has only CONNECT and a SET-only membership. Neither role owns data/functions, bypasses RLS, creates roles/databases or switches to an owner/report role. The planner requires a local disposable superuser and generated schema, database and in-memory secret. It changes no existing report role membership, table layout, guard body or default privilege.

The execution role receives fixed-school, restrictive-clamped SELECT and UPDATE(id) only for the source/identity tables needed by the trusted writer. UPDATE(id) is needed for PostgreSQL row-locking SELECT, not permission to mutate data. A separate statement guard rejects actual UPDATE/DELETE/TRUNCATE, including zero-row statements. Only INSERT on the five immutable source/review/finalization/audit/receipt tables is permitted. Score mutations, source claims, revision helpers, report history and legacy modules receive no access. These are trusted server execution privileges, not a public end-user SQL API; closed commands and server-owned canonical materialization remain essential.

The execution role can invoke only the existing private complete actor-lock helper in addition to its reads/writes. An issued WeakSet-backed review scope fixes its generated schema, school, LOGIN, execution role and helper. It cannot select a public namespace, arbitrary role or RLS-filtered authority fallback. The helper sees the complete membership set, including a second school hidden by the service's school RLS. The writer also invokes complete authority for the selected teacher reviewer during a new admin finalization, so the admin's unique membership cannot conceal an ambiguous reviewer. Current assignment/role/class checks still precede old receipt access. The old operator-only review compatibility function now requires an actual unswitched disposable superuser; it cannot be used under filtered service RLS to bypass the complete helper.

A dedicated runtime checks fresh role attributes, ownership and both membership directions, then SET LOCAL ROLE and exact session evidence before/after the callback. It rejects expired, poisoned and outstanding SQL. Connections reuse no identity/authority result. Existing ordinary report public scopes keep their previous fixed role/helper behavior; no application route imports this fixture runtime.

## Upgraded PostgreSQL workload

The same local upgraded fixture now creates the separate review roles temporarily and opens two physical max-one-connection clients, asserting distinct backend PIDs and the exact LOGIN. Actual teacher review/admin finalization run through these restricted sessions and the real writer. Identical concurrent keys must apply once/replay once. Prior persistence-failure and outer-failure probes now run under this execution role rather than the fixture operator. The existing restricted report LOGIN continues to consume the canonical documents independently.

New probes verify direct LOGIN reads and owner/report switches denied; zero-row updates rejected across the selected tables; scores, revision claims/helpers, report and legacy access denied; hidden second active membership rejected for actor and finalization reviewer; suspended actor historical receipts denied; suspended history recovers; and an in-flight review replay versus a zero-row authority write blocks in both arrival orders. Source change/re-review/finalization recovery and immutable publication history remain in the combined workload.

Finally, connections close and only exact nonce-comment-acknowledged review objects are removed: new guard/triggers/policies, grants and two roles. The existing complete-helper definition/owner/settings/ACL are compared with the pre-install snapshot after revoking the added role's execution grant. The outer upgraded harness retains its own exact generated schema/report role cleanup. There is no broad role search/drop, DROP OWNED or staging cleanup.

## Operator command

```powershell
git pull --ff-only origin report-cards-foundation
if ($LASTEXITCODE -ne 0) { throw 'Git update failed' }
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-assessment-review-disposable.ps1
```

This reruns the full offline gate first (expected 790 tests), then requests the authorized **LOCAL disposable** PostgreSQL username/password, usually `postgres`, for `localhost/greenfield_report_cards_disposable`. No staging password or new assessment password is needed. Share final PASS groups or error lines without credentials. These new SQL probes have not been executed in authoring; a local failure must be corrected before managed target work.

## Authoring validation and next gate

Eight new planner/runtime/scope/lifecycle checks and one additional compatibility-fallback denial test accompany the changed fixture. Together with affected prior review, UI, score and upgrade-role suites, 82 focused tests pass. MJS files syntax-check. The operator checkout runs full TypeScript/ESLint and all offline tests; no dependency-based compiler/Next/browser or PostgreSQL pass is claimed here.

After restricted SQL PASS: inspect the actual managed target for a separate review execution mapping, preserve existing score/report/attendance graphs, prepare/rehearse/install the bounded managed package, then connect SDK-owned actions and the approved UI. Current staging review/finalization buttons remain disabled. No production, public hosting or launch approval is implied by fixture success.
