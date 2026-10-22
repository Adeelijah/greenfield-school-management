# Complete authority and report fixture transaction boundary

Date: 2026-10-22. Prepared fixture integration; no application route, live authentication, production schema or database change.

## Verified starting point

The user confirmed the current 427-test offline gate passed, alongside eight standalone authority PostgreSQL groups and 61 main assessment/report fixture groups. Those previously verified suites exercised the complete authority helper and full report writers separately. This batch prepares their use together in the generated fixture.

## Shared transaction boundary

report-card-complete-fixture-boundary.ts checks current_user is the exact generated writer role, takes the source gate FOR SHARE, calls the complete actor lock function, decodes its explicit counts and matches school-user/membership/school/auth binding. Trusted fixture/server code supplies that binding; the helper does not authenticate it and must never consume client authority fields.

The existing workflow/canonical/revoke adapters receive a scoped database whose begin callback reuses the same outer connection. There is no second physical transaction or commit. A failed command outcome aborts the outer transaction even if an inner writer caught its persistence error. Errors on leased SQL poison the outer transaction even if caught again by a callback. Expired/concurrent/nested lease use rejects. Work must await its SQL; callbacks are trusted server implementations, not user-provided code. Tests use a fake transaction recorder and do not prove actual rollback alone.

## Function permissions and common order

report-card-complete-fixture-ddl.mjs derives only the reviewed lock/gate functions into the generated schema and adds source locking before the advisory authority gate in both. Order is source gate, authority gate, actor, memberships/school, then existing report/source locks. The fixture's existing authority/source triggers remain. The complete gate's BEFORE STATEMENT function explicitly takes source first regardless of trigger-name order. No authority/source writes or lock upgrades are permitted from a report transaction.

One generated NOLOGIN/NOBYPASSRLS authority-owner role has SELECT and UPDATE(id) solely on school_users, memberships, schools and the source gate, with role-specific read/locking RLS policies. It owns the two helper functions and is not granted to the LOGIN, reader or writer. Only the exact writer gets EXECUTE on the complete resolver. Existing fixed-school restrictive clamps for service roles remain, and the function owner gets no academic/report row privileges. The generated LOGIN retains only its two SET-only service memberships. Cleanup drops the extra exact owner after its schema dependencies and verifies role absence.

This is a fixture runtime mapping, not application connection configuration. The main app's getDatabase connection has not been remapped. The bridge's real Supabase identity and SQL/RLS deployment remain separate gates.

## Prepared verification

Eleven boundary tests cover acquisition order, role refusal, complete counts/binding, failed outcomes, caught persistence failures, expired leases and current locked authority. Four DDL tests cover generated names, LF/CRLF source adaptation, source-before-authority order, narrow owner grants, private helpers and four statement triggers. All 49 selected authority/bridge/boundary/DDL tests passed locally. Script syntax and scoped whitespace passed. TypeScript/ESLint/full allowlist require the installed local toolchain; expected full offline count rises to 442 with 58 files. No new dependencies or database access occurred here.

Three new main PostgreSQL groups prepare:

- Actual historical workflow/canonical/revoke adapters through the complete boundary; hidden second active membership rejected despite one service-visible row, with reader helper access, owner SET ROLE and privileged fallback denied.
- Actual return writes rolled back when the outer callback returns failure, then same-key retry applied once and historical replay preserved without new history.
- Source and membership mutation blocked while a complete report transaction holds locks, plus writer-first authority mutation blocking the boundary before work. Safe lock-timeout outcomes permit retry and preserve exact report history.

Main expectation rises from 61 to 64 groups with the existing role-admin opt-in; these new groups have not been executed here. Standalone authority remains eight verified groups with unchanged SQL/harness; no separate rerun needed solely for this batch. Existing 61 earlier main groups should continue passing before the three additions.

Use the complete secure local disposable admin setup/test/cleanup block with node --experimental-strip-types .\\scripts\\assessment-postgres-schema-integration.mjs. The fixture setup is temporarily committed for independent backends and now includes four exact generated roles. Forced termination/server loss can leave generated objects; marker-controlled normal cleanup is not crash recovery. Never run review SQL directly or use a production database.

## Next gate

After full offline and new SQL checks pass, prepare the actual server request command entry point with explicit runtime configuration, the verified SDK bridge and the complete transaction adapter. Fixture trusted bindings and stubs do not verify cookies/JWT or a deployed school installation. Review migration/runtime-role mapping in explicitly authorized staging before wiring persistent routes. No merge, deployment or production/live-auth change is implied.
