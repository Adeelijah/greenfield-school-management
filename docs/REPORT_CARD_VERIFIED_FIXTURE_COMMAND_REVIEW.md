# Verified fixture command entry review

Date: 2026-10-22. Status: server-only source prepared and offline composition tested; no route, connection, SQL installation or live authentication change.

## Verified baseline

The user confirmed the 442-test full offline gate and all 64 main PostgreSQL groups. Those groups include the complete membership resolver and actual restricted report writers in one physical transaction, rollback after a successful inner writer and both source/authority gate arrival orders. The eight standalone authority groups remain verified.

## This change

- `src/lib/academics/report-card-request-command.ts` accepts exactly create, submit, return, reopen, approve, publish and revoke with action-specific fields. It rejects school/user/membership/role/assignment fields, extra selectors, accessors, symbols, inherited shapes and malformed UUIDs. It copies and freezes values before authentication awaits. UUIDs become lowercase, reasons are trimmed, and operation keys retain exact spelling. Keys are limited to 128 characters, reasons to 2,000; existing commands require a positive safe version below the maximum safe integer.
- `src/server/academics/report-card-fixture-commands.ts` exports a bootstrap factory, not a server action or HTTP endpoint. Its only request argument is unknown command input. It verifies through the existing SDK bridge on every invocation, checks the configured school, and calls the complete outer boundary before dispatching to the existing writer family.
- Trusted bootstrap must supply a SqlDatabase adapter and explicit disposable-fixture mode, generated schema, school UUID and exact writer role. Configuration is captured at factory creation. There is no environment lookup, connection creation, application getDatabase fallback or owner fallback. Configuration alone is not proof of privileges: the complete boundary checks current_user on every real transaction.
- Request and transaction identity remain distinct: the real bridge provides the branded request result; the complete boundary counts/locks current authority and checks the same school, school-user and membership. Existing writers still recheck role/assignment, versions, complete source and historical receipts.
- Public results contain only action, report ID, version, stage and applied/replay kind. Internal SQL/provider details, snapshots and arbitrary fields are omitted. Missing resources map to forbidden, stale/key conflicts to conflict, and unknown/internal failures to unavailable. This is not a guarantee against all timing side channels.
- Domain failures and malformed successful results are mapped inside the outer callback, ensuring they reject that transaction. Successful responses are sanitized again after boundary completion. No raw writer outcome escapes.

## Validation and limits

Seven pure parser tests and twelve server composition tests were added. The latter load the actual entry, SDK bridge, parser, decoder and complete boundary, intercepting server-only/SDK/driver/domain-writer imports. Unexpected runtime dependencies reject. The injected transaction recorder exercises commit/rollback decisions; it is not PostgreSQL. Writer stubs intentionally do not prove domain calculations, permissions or replay idempotency; those remain covered by the existing actual-writer unit/SQL suites.

All 68 selected authority/parser/entry/boundary/DDL/lifecycle tests passed here. Scoped whitespace and script syntax checks passed. Expected full offline count is 461 across 60 files, pending the installed TypeScript/ESLint/full allowlist run in the user's checkout. No dependencies were installed and no database connection or SQL execution occurred here. PostgreSQL harnesses and SQL drafts are unchanged, so no additional SQL run is required solely for this change.

## Remaining staging boundary

This entry is deliberately tied to generated fixture names and is unused by routes. The real SDK bridge requires its public no-argument RPC and private authority function to be installed in a separately approved environment. The isolated SQL harness uses trusted fictional auth UUIDs; it does not authenticate a cookie/JWT. An actual request-to-database test remains required.

Before adapting to application routes, prepare a coordinated staging package reconciling current base tables with assessment/report proposals, shared source/authority locking, function owners/policies/grants, fixed-school runtime role mapping, restricted connection bootstrap, migration order, recovery and fictional seed/UAT steps. Do not rename the fixture schema to public or select the existing application database as a shortcut. Do not enable an endpoint until that package and isolated request authentication are verified. No merge, deployment, live security configuration or production database change is authorized by this source milestone.
