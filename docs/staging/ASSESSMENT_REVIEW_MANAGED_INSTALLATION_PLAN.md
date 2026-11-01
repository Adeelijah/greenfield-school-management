# Managed review/finalization target inspection

The operator passed the full 790 offline gate and the real restricted review PostgreSQL workload: separate SET-only LOGIN, denied owner/report fallback and zero-row mutations, complete hidden actor/reviewer membership checks, suspension denial before historical receipts, two-backend apply/replay, both-order authority gates, all persistence/outer rollback/retry paths, current-source recovery, role reset and exact cleanup preserving the existing report helper. These are operator-provided local disposable observations, not a managed staging install or real SDK/browser review result.

## Read-only target evidence

Run `ASSESSMENT_REVIEW_STAGING_TARGET_READ_ONLY.sql` once in the confirmed **Greenfield staging** project `hweoqkbgmzycyznrbvng` SQL Editor, as the existing `postgres` inspection operator. It is a single SELECT: no project helper invocation, row/advisory locks, grants, role switches, writes or installation. It returns no pupil/account rows, Auth records, passwords or API keys.

It preserves the distinction between all nine installed roles (report three, attendance three, score three) and two proposed absent review names: `greenfield_assessment_review_app` and `greenfield_assessment_review_runtime`. Existing LOGINs must retain exactly their one SET-only runtime membership and expected managed operator bootstrap administration edges. The reserved new guard function, trigger and policy names must be absent. The installed private score API is inspected as an existing protected function owned by `greenfield_assessment_owner`, not mistaken for an uninstalled candidate.

The evidence includes all selected relation owners/forced RLS/ACLs, all selected column definitions/defaults/explicit ACLs, exact usable unique source/review/finalization keys, write-surface validated constraints/index/trigger inventory, complete selected policy markers, operator default grants and private helper owners/settings/ACL/body markers. MD5 count/change markers cover fixed-school source/report history and fixture identity/parent rows; they detect drift and are not academic canonical SHA-256 or signature proof. The inspection search path is retained so catalog definition markers can be compared in the same formatting context later.

Privately owned attendance tables are inventoried without reading their rows or acquiring owner membership. A later rollback package may capture row markers only if the actual existing operator privilege is explicitly observed, without broadening it. Existing attendance ownership/role/API boundaries must remain intact.

The result also records the operator's direct ADMIN option and SET capability for the existing `greenfield_report_card_authority_owner`, plus the public schema ACL. The eventual narrow EXECUTE grant on `lock_report_card_actor(uuid)` must be issued with that owner's authority. If an operator-owned temporary SET edge is necessary, the package must remove exactly that grant while retaining the provider bootstrap ADMIN-only edge. It must not assume BYPASSRLS grants ownership or helper grant options. No provider Auth schema/function grant or existing RPC rewrite is required by this design.

## Operator steps

```powershell
git pull --ff-only origin report-cards-foundation
if ($LASTEXITCODE -ne 0) { throw 'Git update failed' }
Get-Content .\docs\staging\ASSESSMENT_REVIEW_STAGING_TARGET_READ_ONLY.sql -Raw | Set-Clipboard
```

Paste the complete query into a new Greenfield staging SQL Editor query and run once. Return the full JSON (export/attach it if large), including `inspection_issues`. If it errors, share the error without repairing grants or existing objects. A database name alone cannot prove the project; confirm the dashboard project first. This catalog review requires no password prompt.

## Managed package after accepted evidence

Prepare one fixed-target rollback rehearsal, preserving current populated report/source/score/attendance data and existing security definitions. Reuse the locally proven restricted writer/role boundaries. Add only the separate LOGIN/runtime mapping, fixed-school restrictive SELECT/locking/append-only policies, private guard, and the one complete-helper EXECUTE grant. Existing score/report/attendance LOGIN memberships must not be expanded. The new LOGIN stays passwordless and application review/finalization stays disabled.

Account for PostgreSQL 17 managed bootstrap membership options and operator default function ACLs; reset only the new guard function ACL before exposure. Do not transfer existing tables/functions to the review runtime, grant it scores/revision claims/helper writes, make request-body documents authoritative, or mechanically execute the disposable schema planner against public. Source/review/finalization/history must remain append-only, with actual zero-row mutation denial despite UPDATE(id) locking grants. The managed role runtime must freshly inspect flags, ownership and membership edges; an owner/default connection fallback is forbidden.

Successful rollback verification precedes a separate committed installation. Dedicated secure LOGIN/TLS setup, SDK-owned requests, closed scalar responses and approved teacher/admin UI follow only after installed-target evidence. Real teacher review, independent admin finalization and stale-source report recovery must then be verified in the browser. Existing operator-seeded finalizations do not attest to that workflow. Performance/public hosting/production launch remain separate gates.

## Authoring validation

Four new read-only/role/key/privacy checks and 23 existing restricted-review/writer/probe checks pass (27 focused). The full offline allowlist is updated, expected 794 tests. No application TypeScript or UI source changed in this batch. No database connection or query execution occurred during authoring. The actual managed rollback composer remains pending the returned target evidence.
