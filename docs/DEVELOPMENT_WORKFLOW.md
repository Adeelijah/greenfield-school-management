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

The allowlist runs TypeScript, ESLint over `src`, seventeen inspected offline TypeScript test files, and `git diff --check`. It does not invoke Next.js, Drizzle Kit, Supabase, PostgreSQL, SQL, staging scripts, or `.env*` files. It does not install packages. `git diff --check` covers tracked diffs only; inspect new text files separately for trailing whitespace and review every untracked path you changed. Add new unit tests to the allowlist only after confirming their imports are offline-safe. Some `scripts/*.test.mjs` exercise database or backup code through mocks, but they are deliberately excluded from the default gate until separately reviewed. The student registration and calendar/assessment tests use explicit TypeScript source extensions for Node's offline type-stripping runner.

For a small milestone, run scoped ESLint and relevant allowlisted tests while iterating; finish with the full offline gate. Avoid `npm run build` or `npm run dev` as an offline gate: the app can load environment configuration or initialize services. Avoid `drizzle-kit` commands because `drizzle.config.ts` loads `.env.local`.

Offline UI QA: run `node .\scripts\build-academic-operations-preview.mjs` for Academic Operations, `node .\scripts\build-admissions-guardians-preview.mjs` for Admissions and Guardians, or `node .\scripts\build-calendar-assessments-preview.mjs` for Calendar and Assessments. Each script bundles actual React components and local CSS with fictional fixtures into a unique OS-temp folder containing a single `index.html`. Open with `file://`; the preview CSP denies network connections, and the builder rejects external asset references and network-capable APIs in the bundle. It uses existing local esbuild and does not run Next.js, Supabase, authentication, or a server. Inspect desktop and 320/375/390/768px mobile widths, keyboard focus, dropdowns, overflow and workflow states. Do not reuse the prior browser automation helper that failed, and do not claim QA passed until pages are rendered and visually inspected. A running Next.js server is outside this default process and needs separately proven process/browser network isolation before use.

Security-sensitive review: diff auth/proxy/server handlers, tenant predicates, role/assignment checks, input schemas, audit behavior, grants, RLS and migrations against the permission matrix. Verify denied paths and cross-school cases with pure tests. Treat Step 494 SQL as unexecuted proposals. Review actual DB role attributes and policies only in a separately authorized isolated environment; no offline source check proves deployed RLS, grants or transaction safety.
