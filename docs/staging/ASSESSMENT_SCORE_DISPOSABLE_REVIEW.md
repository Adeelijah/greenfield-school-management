# Schema-faithful assessment score writer rehearsal

## Attendance evidence and next scope

The operator reported that the attendance workflow works after dedicated setup and browser testing. The supplied log shows successful attendance save actions followed by saved-register reads and a page refresh; warm private transactions use six queries, with saves around 2–3 seconds. This is operator browser evidence, not an authoring-side browser session. Account route loads are still materially slower because the page separately loads class indexes; those timings are not launch performance sign-off. Attendance save/correction/history remains connected in staging. Assessment Save/Review/Finalize is still disabled.

This next coordinated batch supplies a closed assessment score command, generated-upgrade-only transaction adapter, private SQL writer plan, actual-schema opt-in PostgreSQL rehearsal and one PowerShell command that runs offline checks before asking for the **local disposable** password. It supplies no public-schema installer, managed role changes, live SDK adapter, review/finalization writer or enabled UI action. Do not run this SQL against Greenfield staging or grant academic DML to the report/attendance runtime.

## Score command and transaction

A command saves the complete pupil/component grid for one active subject roster in one of the two fictional classes. It binds the exact roster/config IDs, config revision, roster version, source scope revision, enrollment/student/component identity and each existing score version. It accepts no caller actor, membership, school, grade, total, hash, configuration payload or review/finalization assertion. Numeric values are bounded decimal text with up to four decimal places, normalized without binary-number arithmetic; observational values are configured text keys. An explicit null/null cell clears an optional score; required scores cannot be cleared. Existing score edits require a correction reason; SQL also requires a reason when a subject already has saved history even if all its optional score rows have since been cleared.

The private function first takes the existing exclusive source discovery gate, then the shared authority advisory barrier. Complete current membership count, fixed school/class/session/term, active level/section/catalog/roster, exact teacher class assignment and subject link are checked before any historical receipt. Bursars, ambiguity, suspension and assignment loss cannot replay old results. Identical current-authorized keys replay the stored result before stale source/cell versions are checked; changed payloads or another family/key conflict. A retired/inactive selected roster is denied even for an old key; score replay does not imply report publication replay semantics.

New operations require the expected source/config/roster/cell versions, exact active enrollment grid, no another-class duplicate enrollment, and correctly pinned existing scores. Configuration component shape, category, labels, exact weights/maxima, numeric band coverage and observational levels are validated before mutations. All cells and versions are checked before the first insert/update/delete. Source rows use the installed statement-before-discovery and once-per-transaction revision-claim triggers. The final scope revision must be exactly before+1, including a save containing only empty optional cells. A command cannot silently share an already-claimed source scope in the same outer transaction.

Scores, revision claims, one assessment audit and one actor/key receipt commit atomically. The versioned receipt stores the canonical sorted request, correction reason, exact decimal-text before-score rows, audit ID and safe scalar result. The SHA-256 here is an idempotency fingerprint over PostgreSQL JSONB text, not a finalized academic source hash or signature. The function never creates source manifests, teacher reviews, finalizations, report snapshots or releases. Later review/finalization must use the existing canonical materializer and independent-authority contracts.

## Restricted role and fixture boundaries

The plan accepts only `rc_it_` plus sixteen hex digits and five distinct fictional UUID bindings; it refuses public. It reuses the journal-source baseline, reviewed dependency SQL, actual Drizzle proposal metadata and installed source/authority/history guards. It creates no replacement foundation/score tables or inferred migration/backfill. Forced RLS and immutable assessment audit/receipt triggers are execution preconditions. PUBLIC restrictive policies that could hide a second membership are rejected.

A new private NOLOGIN owner gets reviewed foundation/score metadata reads and only score DML, scope revision update, append-only audit/receipt inserts and private revision-protocol privileges. Its scope writes are constrained to the fictional school. A separate NOLOGIN execution role gets only schema USAGE and the one private score function. A temporary unprivileged LOGIN has only SET membership in that role; it cannot select source/history/report data, call revision helpers or switch to owner/report roles. Neither existing report fixture role is broadened. This generated fixture assumes normal local function default ACLs plus explicit PUBLIC revocation; a later managed package must separately inspect/reset provider default ACLs and ownership access, as attendance did.

The rehearsal creates a nonce-commented generated schema and tags each newly committed role with the same acknowledgement. Cleanup requires matching schema/role acknowledgements and removes only those exact objects; it will not adopt or drop a colliding/unacknowledged role. Existing objects elsewhere in the disposable database and all hosted staging objects remain untouched.

## One operator run

In a PowerShell terminal at the repository root:

```powershell
git pull --ff-only origin report-cards-foundation
if ($LASTEXITCODE -ne 0) { throw 'Git update failed' }
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-assessment-scores-disposable.ps1
```

After offline checks pass, enter the authorized **local disposable PostgreSQL superuser** (normally `postgres`) and its **local password**. Do not use the new attendance password or staging postgres password. The database is fixed to `localhost:5432/greenfield_report_cards_disposable`. The script restores the previous test environment after completion.

The SQL workload checks numeric/observational saves, exact replay and changed keys, maximum/precision boundaries, optional fill/clear, substituted/incomplete grids, stale config/roster/scope/score versions, stored correction history, current role/subject authority, hidden second membership, persistence and outer rollback, distinct-login same/stale-key races, both gate arrival orders including zero-row authority writes, role/privilege denial and exact cleanup. Share its final PASS lines or bounded FAIL line.

## Evidence and limits

139 focused offline checks passed: fifteen new command/adapter/DDL/startup-guard checks plus 124 attendance/report/account regressions. The two new TypeScript modules pass source stripping/JavaScript syntax parsing; MJS syntax and scoped whitespace checks pass. Full project TypeScript/ESLint is run by the operator launcher before credentials. No database, credentials or SQL execution was used in authoring; actual PostgreSQL results remain outstanding. The fixture uses synthetic identity callbacks and is not SDK authentication proof.

The protected source/review/finalization/report tables start empty in this new score fixture; unchanged snapshots therefore prove absence of writes, not preservation of a populated publication. The private score owner is also explicitly checked to have no mutation privileges on those protected tables. Existing populated managed report history must still be captured and preserved during the later staging target review, rollback rehearsal and installation. None of the older empty-baseline report runners should be run against staging. No live assessment save, canonical review/finalization or production readiness is claimed.
