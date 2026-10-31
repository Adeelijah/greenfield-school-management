# Greenfield milestone workflow

This workflow accelerates offline development without treating a preview or a schema draft as production-ready. `AGENTS.md` supplies the standing project rules. The current completion priorities are in `ROADMAP.md`.

## UI design consistency gate

Before editing UI, read `docs/DESIGN_SYSTEM.md` and `docs/UI_CONSISTENCY_AUDIT.md`. Start from the original AppShell/dashboard and existing shared dropdown/date-picker. Avoid new module-specific button, panel, tab or color systems without documenting the reason. Do not claim visual approval from source inspection alone. Compare desktop and 320/375/390/768px in isolated previews using actual components; capture and review differences before broad CSS consolidation.

## Execute one milestone

1. State the user-visible outcome, acceptance examples, boundaries and security impact. Inspect `git status --short`, relevant source, tests and docs. Record pre-existing modified/untracked paths without assigning ownership by assumption.
2. Divide the milestone into related UI, pure domain logic, adapters and tests. Name files to touch and identify shared dependencies. Choose a reviewable batch; ordinary scoped edits and offline tests proceed without intermediate approval.
3. Implement against actual Greenfield components. Keep fictional fixtures in previews, make authorization fail closed, and distinguish proposed operations from persisted operations. Do not wire a database or service merely to demonstrate a UI.
4. Test pure validation and authorization branches, including both Primary 5 and Primary 6 where relevant, cross-school IDs, stale state, duplicate actions and role boundaries. Fix failures and rerun the relevant checks.
5. Run the offline gate and inspect the diff/status. For UI work, review desktop/mobile layout in a genuinely isolated preview; if isolation is unavailable, mark browser QA unverified and provide a manual plan.
6. Deliver one report: behavior changed, files changed, test commands/results, preview versus integrated status, remaining risks and approvals needed for the next stage. Do not mark a milestone complete from component presence alone.

Stop at a review artifact when a task reaches a database, migration, grant/RLS, live security change, deployment, commit or push approval gate. Prepare the concrete diff and validation before asking for that approval.

## Parallel worktree plan (planning only; no worktrees or agents launched)

Separate worktrees can take independent modules after a milestone owner freezes interfaces. Each branch owns a narrow file set; shared files are changed by the integration owner only.

| Stream | Primary ownership | Allowed shared contract |
| --- | --- | --- |
| Academic structure and calendar | `src/components/academics/`, future calendar domain, own tests | Read-only types exported from a reviewed domain contract |
| Student records and lifecycle | `src/components/students/`, `src/lib/students/`, own tests | Consume academic contract; no direct edits to academic structure during parallel work |
| Attendance and assessments | Future `src/components/attendance/`, `src/components/assessments/`, own domain/tests | Consume student/class identifiers only |
| Finance | Future `src/components/finance/`, own domain/tests | Consume school/student reference types; no guardian/academic internals |
| Reporting | Future `src/components/reports/`, own pure aggregations/tests | Consume versioned read models; no direct mutation contracts |

Integration owner retains `src/app/`, `src/components/app-shell.tsx`, shared controls/styles, `src/lib/modules.ts`, `src/server/auth/`, `src/db/`, `drizzle/`, `docs/security/`, lockfiles, package config and `AGENTS.md`. Streams must not independently modify these or introduce dependencies. If two streams need a shared type/control, submit a small contract change to the integration owner first; do not duplicate or silently diverge. Database, auth and security code stays serial and review-gated.

Before integration, each stream records its base revision, owned files, acceptance examples and local offline results. The integration owner inspects diffs, resolves conflicts deliberately, reruns TypeScript, ESLint and allowlisted tests on the combined tree, checks `git diff --check`, and performs relevant isolated UI QA. No automated merge is implied. Preserve existing untracked/modified work in the original workspace; only create worktrees with a later explicit user instruction.

## Reusable offline quality gate

With existing installed dependencies, run from PowerShell:

```powershell
node .\scripts\verify-offline.mjs
```

The allowlist runs TypeScript, ESLint over `src`, 71 inspected offline test files, and `git diff --check`. It does not invoke Next.js, Drizzle Kit, Supabase, PostgreSQL, SQL, staging scripts, or `.env*` files. It does not install packages. `git diff --check` covers tracked diffs only; inspect new text files separately for trailing whitespace and review every untracked path you changed. Add new unit tests to the allowlist only after confirming their imports are offline-safe. Some `scripts/*.test.mjs` exercise database or backup code through mocks, but they are deliberately excluded from the default gate until separately reviewed. The student registration, calendar/assessment and report-card tests use explicit TypeScript source extensions for Node's offline type-stripping runner.

For a small milestone, run scoped ESLint and relevant allowlisted tests while iterating; finish with the full offline gate. Avoid `npm run build` or `npm run dev` as an offline gate: the app can load environment configuration or initialize services. Avoid `drizzle-kit` commands because `drizzle.config.ts` loads `.env.local`.

Offline UI QA: run `node .\scripts\build-academic-operations-preview.mjs` for Academic Operations, `node .\scripts\build-admissions-guardians-preview.mjs` for Admissions and Guardians, or `node .\scripts\build-calendar-assessments-preview.mjs` for Calendar and Assessments. Each script bundles actual React components and local CSS with fictional fixtures into a unique OS-temp folder containing a single `index.html`. Open with `file://`; the preview CSP denies network connections, and the builder rejects external asset references and network-capable APIs in the bundle. It uses existing local esbuild and does not run Next.js, Supabase, authentication, or a server. Inspect desktop and 320/375/390/768px mobile widths, keyboard focus, dropdowns, overflow and workflow states. Do not reuse the prior browser automation helper that failed, and do not claim QA passed until pages are rendered and visually inspected. A running Next.js server is outside this default process and needs separately proven process/browser network isolation before use.

Security-sensitive review: diff auth/proxy/server handlers, tenant predicates, role/assignment checks, input schemas, audit behavior, grants, RLS and migrations against the permission matrix. Verify denied paths and cross-school cases with pure tests. Treat Step 494 SQL as unexecuted proposals. Review actual DB role attributes and policies only in a separately authorized isolated environment; no offline source check proves deployed RLS, grants or transaction safety.

The report-card identity behavior test uses Node module hooks (Node 22.15+; the current Windows runtime is 22.16) to load the actual bridge and decoder while replacing SDK/driver/server-only imports with offline stubs. Unexpected runtime dependencies reject. It never loads the application database or Supabase client modules, reads credentials, creates a connection or executes SQL. These behavioral tests do not establish live SDK authentication, RLS, driver serialization or database rollback.

The complete-fixture boundary tests use an in-memory transaction recorder and trusted fictional request bindings. The complete-authority DDL tests only inspect generated SQL strings from the review draft. Neither test opens a connection or executes SQL. The main PostgreSQL harness remains explicitly opt-in and outside the offline allowlist.

The verified fixture command entry test loads the actual server entry, identity bridge, request parser and complete transaction boundary with module hooks. SDK, driver and domain writers are offline stubs; unexpected dependencies fail. It tests command dispatch, fixed-school/runtime guards, safe responses and outer rollback decisions, without loading the application database or opening a connection. It does not verify real SDK cookies/JWTs, the domain writers or PostgreSQL rollback; retain the separate verified SQL suite for the latter.

The staging assembly source test reads only the explicit review assembly, dependency SQL draft and Drizzle configuration text. It never imports configuration. The separate staging metadata test imports only Drizzle and schema/proposal metadata, not environment/driver/auth modules. Neither script connects to a database, runs SQL or generates a migration. The review assembly is partial and must never become a Drizzle Kit schema entrypoint.

The upgrade-plan tests read only the baseline/dependency SQL text and pure namespace planner. Two staging metadata tests inspect selection from the existing in-memory metadata emitter. They neither connect nor execute SQL. The new PostgreSQL upgrade integration harness is explicitly opted in, local-disposable only and excluded from the offline verifier. Its semantic baseline reorders historical index/FK definitions and is not evidence that the unchanged raw journal file replays.

The upgrade-guard composition test imports only pure source/parent/release DDL builders and the bounded namespace planner. It inspects SQL strings without executing SQL, opening connections, loading credentials or creating roles. The separately opted-in upgrade harness now prepares 13 groups including guard installation/rollback and bounded source-gate contention; it remains outside the offline allowlist.

The upgrade-security plan tests compose only pure generated-fixture DDL builders and read the authority SQL review as text. They verify layout presence/input contracts and SQL grant/role ordering without execution. The upgrade harness's four new security groups additionally require the role-admin confirmation and use a rollback transaction with SET LOCAL role probes; they do not authenticate a generated LOGIN or SDK request. Expected full upgrade count with both confirmations is 17.

The upgrade LOGIN planner tests use fictional static secrets and inspect generated setup/cleanup strings only. They do not create a connection, role or password. The opt-in PostgreSQL upgrade harness now adds a real generated LOGIN, two restricted sessions and acknowledged schema/role cleanup only with the role-admin token; expected upgraded total is 22. Generated live fixture secrets stay in memory and must not be logged or persisted.


The upgraded workflow probe adds five opt-in SQL groups using the existing real generated LOGIN pool and complete transaction boundary with actual workflow/canonical/revoke adapters. It seeds and verifies complete fictional academic documents, requires distinct backend apply/replay pairs and exact write counts, injects exceptions after actual writes to verify rollback/retry, and checks stale-source withdrawal/current authority without changing snapshots. It is outside the offline allowlist; no SDK authentication is claimed. Full offline count stays 499 across 66 files. Expected upgrade total with both confirmations is now 27; absent role-admin confirmation explicitly skips 14 security/LOGIN/workflow groups. See staging/REPORT_CARD_UPGRADE_WORKFLOW_REVIEW.md.


The upgraded request-loader test imports the actual bounded server/bridge/domain graph with external SDK transport and unused application imports intercepted. Its recorder does not execute SQL or open connections; no writers are replaced. AsyncLocalStorage separates overlapping fixture requests and teardown refuses active requests. Six added tests prepare full offline 505 across 67 files. Four opt-in upgrade groups run the actual entry and real writers against the generated restricted LOGIN with controlled external auth transport; expected SQL total is 31 with both confirmations (18 groups skip without role-admin opt-in). This does not verify real SDK cookies/JWTs or an installed public RPC. See staging/REPORT_CARD_UPGRADE_SERVER_ENTRY_REVIEW.md.


The staging-runtime tests import only the unused adapter and Node recorder utilities. Type-only SQL port imports are erased; there is no driver, SDK, environment or application connection. Eight added tests prepare full offline 513 across 68 files and verify explicit public role mapping, membership/ownership evidence and transactional role/lease failures. No catalog SQL is executed by these tests. The verified 31 upgrade groups remain unchanged and are not evidence for the new public runtime adapter. See staging/REPORT_CARD_STAGING_RUNTIME_CONTRACT_REVIEW.md; actual installation and real SDK auth remain target-specific gates.


The coordinated-guard review test reads only the new SQL review text, unchanged standalone authority draft and pure fixture builders. It checks the bounded public protocol table/transaction surface, function-body parity, source/authority ordering, immutable history/release rules, protocol RLS/revocations and LF/CRLF handling. It neither PostgreSQL-parses nor executes SQL. Eight new tests prepare full offline 521 across 69 files. Existing SQL harnesses are unchanged; no rerun is needed solely for this review artifact. It is not a complete installation bundle; see staging/REPORT_CARD_COORDINATED_GUARDS_REVIEW.md.


The staging-security-plan checks inspect pure SQL review strings only; the new staging command-boundary tests use SQL recorders and the actual dormant role adapter, without a driver, SDK, credentials or database. Eight plus eleven added tests prepare full offline 540 across 71 files. Public domain writers, real policy installation and real SDK auth are not exercised. Existing SQL harnesses remain unchanged. See staging/REPORT_CARD_STAGING_POLICY_BOUNDARY_REVIEW.md for fragment order, effective-privilege audit requirements and boundary limits.


The staging domain/install review milestone adds issued scope configuration and shared actual SQL cores while preserving fixture namespace rejection. Six pure/recorder domain tests cover complete source reads and all seven action implementations; four controlled request tests exercise the actual staging server entry, SDK bridge, role adapter and domain graph without connections. Four pure composition tests and two additional installed Drizzle metadata checks cover the fixed-input review builder. Expected full offline count is 556 across 74 files. The builder only returns review SQL/phase hashes and cannot apply it; it does not invoke fixture generation for installation output. Shared fixture cores and the controlled loader changed, so the existing 31-group opted-in upgrade rehearsal is relevant after the full offline gate. Real public installation, catalog/effective-privilege audits, recovery and SDK cookies/JWTs remain separately authorized isolated-target gates. See staging/REPORT_CARD_STAGING_DOMAIN_INSTALLATION_REVIEW.md.


The user verified the full 556-test offline gate. `staging/REPORT_CARD_STAGING_REHEARSAL_PLAN.md` consolidates target selection, catalog/effective-privilege review, baseline/restore coverage, phase and unknown-COMMIT recovery, real public domain/auth scenarios and evidence requirements. It adds no code, SQL execution or tests; no additional offline/SQL rerun is required solely for the documentation. The 31-group upgraded regression rerun requested for the preceding shared-domain milestone remains pending. Identify a specifically isolated Supabase project and operator before requesting its read-only inspection or installation; never collect credentials in the review record or infer production authorization.


The user identified isolated staging project hweoqkbgmzycyznrbvng, reported the PostgreSQL upgrade rerun passed and supplied catalog output showing zero public tables. The target-labelled `REPORT_CARD_FRESH_FOUNDATION_REVIEW.sql` is an unexecuted guarded source snapshot: twelve protected empty baseline tables/four enums, original definitions retained, indexes before FKs, API/app access withheld, no journal/role/account/seed changes. Six source/semantic tests compare every definition with prior semantic fixture evidence and inspect conflict/privilege/transaction safeguards; they open no connection and do not PostgreSQL-parse SQL. Expected full offline count is 562 across 75 files. The original journal, fixture namespace restrictions and runtime code are unchanged. Execution requires the concrete isolated-target schema/grant/RLS scope in staging/REPORT_CARD_FRESH_FOUNDATION_REVIEW.md; do not treat zero public tables as whole-database/Auth emptiness or point the app at this incomplete foundation.


The user approved and ran the fresh staging foundation and reported the expected 12 / 12 protected tables, then selected Primary 5. `GREENFIELD_STAGING_TARGET.review.json` records that installation-specific choice and a planned fictional school UUID without creating a row or enabling the app. A bounded catalog-only role-preflight draft reports actual operator flags, absent roles and both membership directions/grantor before selecting a supported bootstrap. PostgreSQL non-superuser CREATEROLE automatic admin edges must be reconciled with the unchanged strict role contract, not silently revoked/accepted. Four new source checks prepare full offline 566 across 76 files; 30 related checks passed locally. No new SQL workload rerun is needed solely for this source/configuration batch. See staging/REPORT_CARD_PRIMARY5_TARGET_REVIEW.md; the next manual operation is the read-only role inventory, not the academic/report apply.


### Installed attendance: dedicated local staging application batch

Managed installation PASS has been supplied by the operator. Follow `docs/staging/ATTENDANCE_STAGING_APPLICATION_REVIEW.md`: `scripts/verify-attendance-staging.ps1 -ProvisionLogin` first runs the complete offline verifier, then securely configures only the dedicated staging attendance LOGIN password and checks TLS/private-role/direct-access denials. Use the staging postgres password for this explicit provisioning step, never the local disposable password. The existing local launcher accepts independent `-EnableAttendance` (read-only history) and `-EnableAttendanceWrites` (fictional saved registers/corrections); omitting both disables attendance. No report credentials/roles are substituted. The new SDK/SQL boundary, pending/skeleton UI, reasoned history and safe retry flow have 70 focused attendance checks plus 54 report/account regressions; full project type/lint and live browser/connection checks remain operator gates. Never rerun the managed installation SQL to enable the application. No production change is authorized by this workflow.


### Assessment score persistence: one local disposable rehearsal

Attendance save/reload has operator browser confirmation. Run `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-assessment-scores-disposable.ps1` for the next assessment score milestone. It runs full offline checks before asking for the LOCAL disposable PostgreSQL superuser/password, then creates only a nonce-acknowledged generated upgraded schema and five temporary roles including a restricted LOGIN. No staging password, managed SQL or live attendance/report change is involved. `docs/staging/ASSESSMENT_SCORE_DISPOSABLE_REVIEW.md` describes full-grid version checks, numeric/observation/optional behavior, audited corrections, source revision protocol, authority-before-replay, races/rollback and exact cleanup. 139 focused authoring checks passed; full installed type/lint and actual SQL remain operator gates. The fixture is not SDK proof and its protected report baseline is empty. Assessment Save/Review/Finalize remain disabled pending managed and application proof.


### Assessment score SQL passed: inspect the current staging target

The operator passed the complete local score rehearsal after all 726 offline checks. Copy `docs/staging/ASSESSMENT_SCORE_STAGING_TARGET_READ_ONLY.sql` into the confirmed Greenfield staging SQL editor and return its JSON evidence; this batch is a single read-only SELECT, not a migration or role setup. `ASSESSMENT_SCORE_MANAGED_INSTALLATION_PLAN.md` explains the managed role/helper/default-ACL review and protection of current report/source history plus the private attendance boundary. Four new read-only target checks and fifteen score candidate checks passed; no TypeScript/UI or live security changes are made. Do not rerun an old empty-baseline report harness against staging or mechanically rename the disposable score SQL to public. Assessment Save/Review/Finalize stay disabled until managed and application proof.


The fixed-target assessment score managed rollback review adds ten pure composition checks (expected offline total 740 after the four target-review checks and the previously reported 726). The checked-in SQL must exactly match its pure composer. It checks managed default ACL reset, role cleanup, existing security/data preservation and rollback-only fictional score probes. Authoring ran 27 focused checks; no managed SQL was executed. See staging/ASSESSMENT_SCORE_MANAGED_ROLLBACK_REVIEW.md. Operator rollback success is required before preparing a separate committed installer.


The committed assessment score installer adds four pure parity/transaction/default tests; expected full offline total is 745 (741 after the ACL regression). Authoring passes 32 focused checks. Operator-provided corrected staging rollback PASS is recorded separately from these tests. All SQL through preservation verification must match that rehearsal exactly; only the final transaction outcome and success result change. See staging/ASSESSMENT_SCORE_MANAGED_INSTALLATION_REVIEW.md. Dedicated LOGIN and app saving remain disabled until separate runtime setup.


The dedicated assessment score staging runtime/UI adds 21 offline tests across five files; expected full offline total is 766. Actual SDK-owned server boundary and strict TLS transport are exercised through controlled recorders, not a real database/SDK session. New tests cover exact roles, request copying, denial/malformed-result rollback, lease/pool failures, dedicated LOGIN provisioning without workload writes, URL/env gates and independent scope/config/roster/cell versions. Existing attendance/projection/score regressions bring authoring validation to 78 passing focused checks. Full TypeScript/ESLint/Next/browser checks require the operator checkout. The new explicit setup script runs verify-offline before prompting, and the launcher restores independent score environment fields; no credentials are saved. See staging/ASSESSMENT_SCORE_LIVE_STAGING_REVIEW.md.
