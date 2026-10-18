# Greenfield project instructions

## Project and scope

Greenfield is a Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4 school-management application. Supabase SSR provides authentication; Drizzle describes PostgreSQL tables. The shared design system lives in `src/app/globals.css` and `src/components`. The academic scope is **Creche, Nursery, and Primary only**. A school chooses Primary 5 or Primary 6 as its final level; levels and sections are independent.

The proposed deployment model is a separate PostgreSQL database per school installation. This is **pending verification**, not evidence that any deployment enforces it. Keep `school_id` on records, validate school-scoped relationships, and use tenant isolation even under a separate-database model.

## Working in this repository

- Inspect Git status before editing. Modified and untracked files may predate the current task. Preserve them; never clean, reset, delete, overwrite, commit, or move unrelated work to make a task easier.
- Reuse approved `AppShell`, dropdown, date picker, academic/student components, tokens, and CSS patterns. Keep fictional fixtures confined to development previews. Do not treat a rendered UI as persistent functionality.
- Keep pure business rules separate from server adapters and UI. Use explicit types, small focused functions, stable IDs, and meaningful boundary tests. Follow existing TypeScript and ESLint conventions; avoid new dependencies unless approved.
- Derive identity and school from verified server-side authentication and active membership. Never trust request-body school IDs, roles, assignment flags, or client-side checks as authority. Admin finalizes lifecycle decisions; teachers may view assigned students and propose decisions after assignment verification; bursars have finance-only access. Recheck authorization and tenant ownership inside transactions. Use school-consistent FKs, least-privilege grants, and reviewed RLS. Never weaken auth, proxy, authorization, or RLS to make a preview work.
- `src/db/client.ts` is a direct database adapter; its URL guard does not prove RLS or grants. Step 494 schema and security SQL are **unexecuted review drafts**. Do not infer applied policy state from source files.

## Offline-first delivery

For an authorized feature milestone, inspect requirements and existing implementation, write a scoped plan, implement a coordinated batch, add meaningful pure/unit tests, run safe checks, fix failures, and return one consolidated report. Ordinary source edits and offline tests within scope need no intermediate approval. Use `scripts/verify-offline.mjs` or the commands in `docs/DEVELOPMENT_WORKFLOW.md`. Never run a script merely because its name includes `test`; inspect scripts that may load credentials or connect to services.

Definition of done: behavior matches the milestone acceptance criteria, existing design is preserved, relevant failure and authorization paths are tested, TypeScript and scoped ESLint pass, allowlisted offline tests pass, `git diff --check` passes, and the report states precisely what is implemented, preview-only, unverified, or blocked. Browser QA is claimed only after pages are rendered and inspected in a safe isolated environment. A development server is not an offline test by default.

## Approval gates

Obtain explicit user approval **before** connecting to any database; executing SQL or migrations; applying schema, grant, or RLS changes; changing live authentication/authorization/security behavior; installing dependencies; deploying; committing; or pushing. Prepare reviewable code and plans first. No environment-secret inspection or real student data. Keep generated migration and security artifacts intact unless the user explicitly authorizes a specific change. The current workflow stops at review drafts for all persistence and security deployment work.

See `docs/DEVELOPMENT_WORKFLOW.md` for milestones, parallel ownership, quality gates, and the current roadmap.
