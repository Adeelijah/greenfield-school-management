# Managed staging assessment score installation plan

## Confirmed prerequisite

The operator passed all 726 offline checks and then the complete schema-faithful assessment score PostgreSQL rehearsal. The successful run covered numeric and observational values; optional empty/fill/clear; history reasons despite absent optional rows; scope/config/roster/cell stale versions; exact enrollment grids; hidden second membership and subject/assignment loss before receipt replay; all persistence/outer rollback; restricted independent LOGIN races; both gate arrival orders including zero-row writes; denied direct data/helper/owner access; unchanged protected document tables; and exact nonce-acknowledged cleanup. The first password failure occurred before setup and was resolved on the later successful run.

These results prove the generated local SQL candidate, not managed installation or SDK authentication. Its protected report/source document baseline was empty, as documented in `ASSESSMENT_SCORE_DISPOSABLE_REVIEW.md`. Actual populated staging history and the now-working attendance application must be preserved during the managed phase. Assessment Save/Review/Finalize remain disabled.

## Current next step: read-only target evidence

`ASSESSMENT_SCORE_STAGING_TARGET_READ_ONLY.sql` is one SELECT for the confirmed Greenfield staging project `hweoqkbgmzycyznrbvng`, school `0c594571-74c5-46fe-a835-a9b217a3a199`. Run it as the existing staging inspection operator in the Supabase SQL editor after confirming the project. It executes no project helper, row/advisory lock, DDL, DML, role switch or grant. It does not inspect Auth records or passwords and returns no pupil/account rows.

It captures:

- Existing report and attendance role flags and both membership directions, retaining their separate SET-only execution memberships and observed managed bootstrap ADMIN-only operator edges.
- Three proposed assessment roles that must be absent: `greenfield_assessment_app`, `greenfield_assessment_runtime`, `greenfield_assessment_owner`. The proposed private `save_assessment_subject_scores` entry name must also be absent across overloads; no adoption is planned.
- Selected relation owners, forced RLS and ACLs; exact usable score/enrollment/receipt/revision-protocol keys; compact score-write column types/nullability; full selected FK/check definitions; partial index definitions and index markers.
- Existing source/report/attendance function owners, settings, ACLs and definition markers; selected trigger event/function inventory, complete selected trigger/policy baseline markers, PUBLIC restrictive policies and operator default function/table grants.
- Fixed-school counts/change markers for populated report history, academic scores/configs/rosters/subjects/assignments, existing source documents/reviews/finalizations, audits/receipts and source revision claims. These MD5 markers detect change; they are not canonical academic hashes, signatures or independent integrity proof. The inspection search path is returned because formatted catalog definitions can be context dependent; later verification must normalize or recapture catalogs consistently.

Attendance tables are now owned by the private attendance owner. BYPASSRLS alone does not confer their SELECT privilege to the inspection operator. This query therefore inspects their ownership, ACLs, function definitions, triggers, policies and role graph only; it does **not** query their rows, invent zero counts, call the UUID-taking attendance API or temporarily take over its owner. A managed score package must leave that existing private boundary intact, perform no attendance DML, take no attendance owner membership and give the new score owner no attendance privileges. Existing attendance runtime reads/save/refresh should be rechecked after the later managed installation. If stronger attendance row-baseline evidence is required, it must use a separately reviewed existing authorized boundary rather than an inferred owner bypass.

Return the JSON evidence. `inspection_issues` should be reviewed, not bypassed. Missing functions, unexpected ownership/role edges, unvalidated FKs, missing exact keys, existing proposed roles/API names and PUBLIC restrictive policies produce issues. A missing baseline table may instead stop the SELECT during planning; share that error rather than repairing it from this inspection. The query's success does not authorize installation. No installation or role provisioning is in this batch.

## Managed package to prepare after evidence

Prepare a rollback-only, fixed-project score package with no new foundation or score tables, preserving existing data and column/index/FK layout. Reuse the proven complete-authority/source-gate and once-per-transaction revision protocol; scope expected helper execution additions to the new private owner only. Existing report/attendance LOGIN memberships and API grants must remain unchanged. The three source helper grants needed by the score owner are an explicit reviewed ACL addition, not permission to reset or widen unrelated helper ACLs.

The package must account for non-superuser CREATEROLE/bootstrap grants, limited provider schema/role ownership, exact removal of temporary operator-owned SET/schema CREATE access, and provider default ACL reset on the new function before ownership transfer. No provider Auth grants or alternate JWT parser are needed: the eventual server entry supplies only SDK-verified identity and the installed private function re-derives current complete membership/assignment under locks. New LOGIN password stays unconfigured and the application remains disabled during SQL rehearsals.

Capture current report/source row baselines and existing security state under the discovery gate before mutation of metadata, then assert all protected data unchanged and only exact intended role/policy/helper-ACL additions. A successful managed rollback rehearsal precedes a separate committed installer. Do not run old empty-baseline scripts against staging, replace existing guards wholesale, or grant source DML to report/attendance runtime roles. The current test-only score candidate must not be mechanically renamed to public and executed.

After managed installation: dedicated secure password setup/TLS runtime preflight, SDK-owned request entry and exact role checks, editable score/config/roster/scope version projection, saved-score correction UI with pending/retry/history behavior, and one combined browser verification. Teacher review and independent admin canonical finalization remain separate subsequent actions.

## Operator command

```powershell
git pull --ff-only origin report-cards-foundation
if ($LASTEXITCODE -ne 0) { throw 'Git update failed' }
Get-Content .\docs\staging\ASSESSMENT_SCORE_STAGING_TARGET_READ_ONLY.sql -Raw | Set-Clipboard
```

Paste the complete query into a new **Greenfield staging** SQL Editor query and run once. Send the JSON result, or export/attach it if the catalog evidence exceeds the chat size limit. No database password is needed for this dashboard inspection.

Authoring validation: four new read-only/scope/privilege-boundary tests plus the fifteen score candidate tests passed. The full verifier is updated; no TypeScript or UI source changed in this target-review batch. No database connection or managed SQL execution occurred in authoring. The next managed rollback composer remains to be prepared after the actual target evidence.

## Accepted target and rollback package

The operator subsequently returned the actual fixed-target inspection with no inspection issues. It records existing SELECT access on the private attendance tables, so the rollback package captures their row markers with that existing access, without grants or owner takeover. The fixed composer, sanitized catalog metadata and checked-in `ASSESSMENT_SCORE_MANAGED_ROLLBACK_REHEARSAL.sql` are now prepared. See `ASSESSMENT_SCORE_MANAGED_ROLLBACK_REVIEW.md` for scope, operator steps and validation limits. The earlier inspection-only instructions above remain historical context; the current next gate is the whole rollback rehearsal, not committed installation.
