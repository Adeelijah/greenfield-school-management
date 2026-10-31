# Dedicated staging score runtime and correction UI

The operator reported managed installation PASS: three assessment roles installed, existing report/source/attendance state checked, LOGIN password unconfigured and application score saving disabled. This batch connects that installed API to the existing local staging application. No database connection, password provisioning or score writes occurred in authoring.

## Runtime and authority

`assessment-score-staging-entry.ts` parses and copies the closed command before any await, calls the request-owned Supabase SDK `auth.getUser()`, and passes only that verified UUID and command JSON to `public.save_assessment_subject_scores`. The installed SECURITY DEFINER function independently resolves current complete membership and class/subject assignment under coordinated locks, before old receipts. No routing role, cached authority result, caller school or totals are accepted as write authority.

A separate lazy TLS pool accepts only `greenfield_assessment_app.hweoqkbgmzycyznrbvng` on the fixed staging session pooler. It requires the existing CA file, strict certificate verification, local staging UI gates and the independent score-write flag. It never falls back to report/attendance/default/owner URLs. Every transaction verifies the exact LOGIN, three-role graph including observed managed bootstrap ADMIN-only edges, SET-only runtime edge and exact execution role before and after callback. SQL leases reject expired, poisoned and outstanding work. Malformed results, public denials and transport failures roll back the outer transaction. Public responses contain only bounded scalar outcomes. Timing logs do not log SQL parameters, credentials, pupil values or raw errors.

The new environment fields are `GREENFIELD_STAGING_ASSESSMENT_SCORES=FICTIONAL_STAGING_SCORE_WRITES_ONLY` and `GREENFIELD_STAGING_ASSESSMENT_SCORE_DATABASE_URL`. The launcher initializes them to disabled sentinels, requires `-EnableAssessmentScoreWrites`, prompts securely for the existing dedicated password and restores prior process environment on exit. Existing report and attendance flags remain independent.

## Provision and run

From the updated Windows repository root:

```powershell
git pull --ff-only origin report-cards-foundation
if ($LASTEXITCODE -ne 0) { throw 'Git update failed' }
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-assessment-scores-staging.ps1 -ProvisionLogin
if ($LASTEXITCODE -ne 0) { throw 'Score login setup failed' }
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-report-card-local-staging.ps1 -EnableTestWrites -EnableAttendanceWrites -EnableAssessmentScoreWrites
```

The setup script first runs the full offline verifier, before credentials. Use a **new dedicated assessment password** of at least 20 characters and retain it locally. Its operator prompt needs the **Greenfield staging postgres database password**, not the local disposable or report/attendance password. Provisioning changes only the fixed assessment LOGIN password after role-graph checks. It then checks actual dedicated TLS login, exact role graph, runtime execution privilege, denied direct table/column access, denied report/attendance/revision helper execution, NULL-actor rejection and transaction role reset. It performs no score workload save. Once provisioned, omit `-ProvisionLogin` to diagnose the existing password without changing it. Share only bounded FAIL lines, never passwords or URLs containing them.

The launcher needs the existing report and attendance passwords plus the new assessment password. It opens local development staging only at `http://127.0.0.1:3000/staging/login`. This is not public hosting or production deployment.

## UI and browser verification

The verified current relational projection now includes configuration ID/revision, roster version, scope revision, exact enrollment ID and cell versions. A fresh server read token remounts the editor after reload even when the scope revision did not change. Names come from the verified directory and are not used as write authority. The first reader still requires a complete current class source and teacher permission for the class subject set; starting incomplete/new rosters or teachers assigned only a subset remains outside this batch.

The shared numeric/observational editor uses approved dropdowns and responsive cards. Saving requires a reason (also for first saves), locks controls against duplicate/changed submissions, shows pending status and retains the exact operation key/body on ambiguous failure. Conflict/denial requires fresh current values. Successful saves require reload before further edits. Reloading after an uncertain save abandons confirmation; inspect persisted values before editing. Do not treat HTTP 200 or a browser message alone as persistence proof. Earlier values/reasons are stored by the installed audit/receipt SQL; an audit-history viewer is not added here.

The assessment route has a dedicated skeleton matching subject controls, pupil score fields, reason textarea and action buttons. Action labels announce saving/reloading. Review/finalization buttons remain disabled. Score saves invalidate canonical source revision; existing published reports must still print their original immutable snapshots. Existing operator-seeded finalizations do not prove authenticated teacher review.

Run one combined browser check:

1. Teacher: Primary 5, enter a small fictional numeric correction and a reason; save, reload current scores, refresh again and verify the value persists. Repeat for Mathematics so the new revision is loaded between subjects.
2. Teacher: Creche, change the configured observation with a reason, save and reload. Check custom dropdown, pending feedback, matching skeleton and narrow mobile layout.
3. Admin: verify the saved current values. Bursar: academic routes remain denied. Review/finalization stay disabled for all accounts.
4. If a second tab has an older grid, its save must reject stale versions without replacing current scores; reload before retrying a changed request. An uncertain save must retry the same key/body; do not invent a new key until current state is known.
5. Reopen the existing published report and print view; its approved snapshot remains unchanged. Reopen saved attendance and verify marks/history remain intact.

Changing scores intentionally makes earlier academic finalizations stale. Do not delete/reseed sources or use an old installer to recover them. Authenticated review and independent canonical finalization are the next implementation milestone after this score runtime is verified.

## Authoring validation and limits

Twenty-one new focused tests exercise the actual server entry/runtime via SDK/SQL recorders, dedicated URL/env gates, strict TLS pool lifecycle, controlled LOGIN provisioning/diagnostics and exact command projection. Existing projection checks now assert enrollment/config/roster/cell versions. These plus 25 existing attendance/projection regressions pass (46 total); adding the 32 prior score composition/parser/plan checks gives 78 passing focused checks. The full offline allowlist is updated (expected 766 tests). No installed dependencies are available in this source snapshot for full TypeScript/ESLint/Next/browser checks; the operator checkout runs those gates. Mock transport tests do not establish live SDK cookies, PostgreSQL behavior or performance. Previously operator-proven private SQL body and managed installer are unchanged.
