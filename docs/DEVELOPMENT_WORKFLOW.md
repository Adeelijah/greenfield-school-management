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

The allowlist runs TypeScript, ESLint over `src`, 67 inspected offline test files, and `git diff --check`. It does not invoke Next.js, Drizzle Kit, Supabase, PostgreSQL, SQL, staging scripts, or `.env*` files. It does not install packages. `git diff --check` covers tracked diffs only; inspect new text files separately for trailing whitespace and review every untracked path you changed. Add new unit tests to the allowlist only after confirming their imports are offline-safe. Some `scripts/*.test.mjs` exercise database or backup code through mocks, but they are deliberately excluded from the default gate until separately reviewed. The student registration, calendar/assessment and report-card tests use explicit TypeScript source extensions for Node's offline type-stripping runner.

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
