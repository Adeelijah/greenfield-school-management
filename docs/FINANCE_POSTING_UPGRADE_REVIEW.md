# Finance posting against the upgraded local schema

The operator passed all restricted finance posting PostgreSQL checks on `ef5bd60`, including two separate login sessions, current authority before replay, five injected write failures, stale competing payments, admin-only reversal and acknowledged cleanup. The upgraded candidate runs the same posting workload against the generated academic/report upgrade rather than the minimal finance parents.

- Uses the reviewed baseline, academic dependency, assessment/report and security plans. Ten finance tables bind to the existing term, enrollment, class, session and membership keys. It does not replace parent tables, existing triggers or report roles.
- Finance takes the existing source gate in share mode before its private finance lock and membership lookup. Existing parent statements already acquire the source gate exclusively, even when no rows match. The rehearsal checks both directions and verifies that a waiting replay sees suspension after the parent transaction commits.
- The finance owner receives narrowly scoped authority reads and gate-lock permission. Its gate update policy cannot write a row. The worker has only schema usage and private finance function execution. The report reader retains access to its academic fixture but cannot read finance invoices; the finance worker and owner cannot read or write assessment/report tables. The rehearsal compares assessment/report data and revision-claim snapshots before and after finance activity.
- The original minimal rehearsal remains available. Upgraded mode creates one generated schema and five generated roles (three finance roles plus the existing fixture's two report roles) and removes only exact nonce-acknowledged objects. It requires PostgreSQL 16 or newer and explicit local disposable credentials.

```powershell
git pull --ff-only origin report-cards-foundation
if ($LASTEXITCODE -ne 0) { throw "Git update failed" }
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-finance-posting-disposable.ps1 -Upgraded
```

Six new offline checks bring the expected total to 893; 77 focused checks passed in authoring. The upgraded PostgreSQL rehearsal is pending the operator run. The fixture seeds invoices as the local operator and uses a trusted test UUID callback. This does not enable live invoice issuance, SDK-authenticated finance posting, staging installation or finance UI.
