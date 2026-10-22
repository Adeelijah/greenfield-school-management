# Academic dependency draft and explicit schema assembly

Date: 2026-10-22. Review-only source milestone; no SQL, connection, migration generation, role/security installation or route wiring.

## Prepared artifacts

`REPORT_CARD_ACADEMIC_DEPENDENCIES_REVIEW.sql` is a qualified `public` delta for a separately reconciled `0000_broad_slayback` baseline. It adds the academic-stage enum, school configuration fields, academic levels/sections, nullable class mapping, teacher class/session assignments, base actor/enrollment composite keys and three additional assessment/report FK targets. It deliberately omits lifecycle decisions/departures/readmissions, general audit additions, guardian/admissions changes and existing table recreation. The original Step 494 draft is preserved.

This file is not an idempotent upgrade for an unknown installation. No IF NOT EXISTS conceals a conflicting definition. Before any separately authorized execution, compare actual catalog definitions and select an exact baseline; do not apply it to a database that already has some Step 494 changes. The future rehearsal must own an enclosing transaction and test rollback. New fields retain the reviewed nullable mapping behavior; no school year or class mapping is inferred, no historical rows are rewritten, and no NOT NULL tightening is performed. Existing enum/check semantics are preserved rather than strengthened silently.

`src/db/report-card-staging-schema.review.ts` explicitly re-exports the existing metadata objects for 11 base dependencies, 11 assessment proposals, five report proposals and eight used enums. It does not clone or replace base tables. It omits the two report shadow declarations and the unrelated base modules. Importing this metadata may evaluate the existing proposal modules; it does not import a driver, credential loader or application database factory.

The assembly is **not a Drizzle Kit entrypoint**. A partial assembly must not be diffed against the full existing schema: omitted guardians/admissions/lifecycle/audit tables could otherwise be treated as removals. The current `drizzle.config.ts`, production schema and journal remain unchanged. The existing real term/enrollment objects still lack the three extra targets in metadata; the separate SQL draft supplies those targets before downstream FKs. Shadow FK references identify the existing database relations by name; the shadows themselves are never installation objects.

Report audit references a historical release, while releases reference report snapshots. Therefore the future emitter must create all selected tables and unique targets before its FK pass, rather than assuming declaration order is a migration order. The metadata test verifies FK closure and exact target tuples, including this cycle.

## Checks and limits

Six offline source checks passed here: closed assembly surface/config exclusion, academic-only SQL scope, additive qualified statement shapes, exact three FK target tuples, dependency order and nullable/no-backfill behavior. These read text and do not parse SQL with PostgreSQL or prove database behavior.

Four additional Drizzle metadata tests are prepared for the installed checkout: distinct table/enum selection, actual relation reuse instead of shadows, every FK closing over the assembly with a nonpartial unique target or reviewed prerequisite, and prerequisite columns matching actual/shadow metadata. They have not run here because the workspace lacks the repository's installed dependencies. Syntax checking of both new test scripts and scoped whitespace checks passed. No dependencies were installed.

Expected full offline count becomes **471 across 62 files**. The user's last confirmed full gate is 461; main 64 and standalone eight PostgreSQL groups remain verified and unchanged. Existing PostgreSQL results do not validate this new draft. No PostgreSQL rerun is requested solely for the metadata/source milestone; a later opt-in baseline-upgrade harness must exercise the new DDL before any installation claim.

## Next rehearsal

After the installed metadata/full offline gate, prepare a separately guarded disposable baseline-upgrade harness. It must establish the journaled foundation in an exact generated namespace, adapt the reviewed dependency draft without modifying existing public objects, build only the 16 proposed tables, add all FKs after tables/targets, compare resulting catalog metadata and inject failure to demonstrate rollback. Keep independent schema/role cleanup and explicit local-disposable confirmations. Test both clean apply and an incompatible/partially installed baseline; do not turn errors into success with IF NOT EXISTS. No arbitrary schema name, production connection, existing school data or live security change belongs in that harness.

Source/authority guards, RLS/grants/runtime mapping and real SDK request tests remain separate staging gates in REPORT_CARD_STAGING_PACKAGE_REVIEW.md. Do not enable report routes after table creation alone.


## Rehearsal preparation update

The user verified the full 471-test gate, including the four assembly metadata checks. REPORT_CARD_UPGRADE_REHEARSAL_REVIEW.md now describes the separate eight-group opt-in harness and a pure bounded namespace planner. New expectation is 481 offline tests with two actual-emitter checks; installed full verification and the new PostgreSQL run are pending. The baseline is semantic/dependency-ordered because historical 0000 places some FKs before unique indexes; raw journal replay and installed deployment history remain unresolved. The original SQL, journal and dependency draft are unchanged. No SQL was executed here.
