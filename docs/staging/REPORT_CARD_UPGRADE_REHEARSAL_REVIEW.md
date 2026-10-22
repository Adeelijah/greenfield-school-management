# Disposable baseline upgrade rehearsal

Date: 2026-10-22. Prepared, not PostgreSQL-executed. The user verified the preceding 471-test full offline gate; the existing 64 main and eight authority SQL groups remain verified for their earlier fixtures.

## Scope

`scripts/report-card-postgres-upgrade-integration.mjs` accepts only an explicitly confirmed local `greenfield_report_cards_disposable` database, optionally suffixed, with no URL query options or fragment. It never loads an environment file or Drizzle configuration, installs roles, writes migration files, updates a journal or connects to production. All test objects use a newly generated exact `rc_it_` namespace. No existing public objects or real student records are read or modified; catalog and fixture-row reads are limited to that generated schema.

The harness uses the baseline journal source, the academic dependency SQL draft and the existing in-memory metadata emitter. Its pure planner qualifies baseline enum/table/index/FK references and adapts the dependency draft to the generated schema. It selects only the 16 proposed tables, four new assessment/report enums and their indexes/FKs from the fixture emitter; it omits that emitter's schema/base-table/prerequisite recreation. This is isolated rehearsal code, not a production migration generator or installer.

The final surface is **31 relations**: 12 baseline tables, three academic tables and 16 assessment/report tables. That differs deliberately from the earlier 27-table selected fixture and the complete 34-table source inventory: four legacy module tables remain, while three unrelated lifecycle tables are omitted. The selected 27-table metadata surface is checked against the upgraded catalog; legacy module rows are checked separately.

## Historical baseline ordering limitation

The unchanged `0000_broad_slayback.sql` source lists composite foreign keys before some required unique indexes. The rehearsal therefore loads its types/tables/indexes/FKs in dependency order. It preserves those definitions, but **does not claim successful byte-for-byte/raw-file migration replay**. This is a semantic baseline upgrade test. The original journal and SQL remain unchanged, and no inference is made about the state of any installed database. Before an executable migration bundle is approved, reconcile actual deployment history and decide separately how to handle a clean journal replay. Do not rewrite an applied migration or silently mark this rehearsal as proof of it.

## Eight prepared SQL groups

1. Establish the 12-table semantic baseline with fictional school, class, pupil, guardian link, admission and general audit records.
2. Inject failure after academic dependencies; compare baseline columns/default definitions, enums, constraints and rows after rollback.
3. Inject failure partway through proposed tables; confirm no partial new table/type/key survives.
4. Inject failure after all proposed FKs; confirm the whole upgrade rolls back.
5. Commit an incompatible partial school column, reject the upgrade, and preserve that exact partial state and all fixture rows rather than silently repairing it. Remove only the deliberately added test column afterward.
6. Commit the upgrade to 31 relations; compare the selected metadata column counts/types/nullability/default presence, ordered enum labels, index columns/uniqueness/partial presence/validity, and exact validated FK source/target tuples/delete actions. This does not compare default expression semantics, check expressions or partial predicate text in full.
7. Preserve fictional legacy admissions, guardian links and audit data. School final year and class mappings remain NULL; no backfill or lifecycle table creation is inferred.
8. After an intentional workload error, remove only the acknowledged generated schema and verify its catalog absence before cleanup PASS. Cleanup failures propagate along with workload failures. No role cleanup is needed because no roles are created. Process crashes, lost CREATE acknowledgement or lost connectivity are not claimed to be automatically recoverable.

This rehearsal does not install or test RLS/grants, revision/immutable guards, complete authority functions, canonical report commands, SDK cookies/JWTs or application runtime connections. The separate verified fixtures cover some of those in isolation; staging integration still needs a coordinated installation and request test.

## Offline verification

Eight new pure planner tests cover namespace rejection, actual source adaptation, LF/CRLF, historical dependency reordering, unsupported forms, external references, selection completeness and cyclic FK ordering. They pass here alongside the six existing source checks (**14 selected tests**). Two additional installed-Drizzle metadata tests check actual emitter selection and retention of every proposal index/FK; these are prepared but not run here. Script syntax and scoped whitespace checks passed. Full expected offline count is **481 across 63 files**, pending the installed TypeScript/ESLint/full gate. No packages were installed and no SQL was executed here.

## Opt-in local run

Pull `report-cards-foundation` and run `node .\scripts\verify-offline.mjs` first. Then use an authorized local disposable database role that can create/drop its own schema; role-administration privileges and the role-admin confirmation token are not required.

```powershell
$pgUser = Read-Host "Local disposable PostgreSQL username"
$securePassword = Read-Host "Password" -AsSecureString
$credential = [System.Net.NetworkCredential]::new($pgUser, $securePassword)
$encodedUser = [uri]::EscapeDataString($credential.UserName)
$encodedPassword = [uri]::EscapeDataString($credential.Password)
$env:REPORT_CARD_TEST_DATABASE_URL = "postgresql://${encodedUser}:${encodedPassword}@localhost:5432/greenfield_report_cards_disposable"
$env:REPORT_CARD_TEST_CONFIRM = "DISPOSABLE_REPORT_CARD_TEST_ONLY"
try {
  node --experimental-strip-types .\scripts\report-card-postgres-upgrade-integration.mjs
  if ($LASTEXITCODE -ne 0) { throw "Upgrade rehearsal failed with exit code $LASTEXITCODE" }
} finally {
  Remove-Item Env:REPORT_CARD_TEST_DATABASE_URL -ErrorAction SilentlyContinue
  Remove-Item Env:REPORT_CARD_TEST_CONFIRM -ErrorAction SilentlyContinue
  Remove-Variable pgUser, securePassword, credential, encodedUser, encodedPassword -ErrorAction SilentlyContinue
}
```

Expected: eight PASS groups ending in exact generated schema cleanup. Never paste a password or connection URL into chat. A skipped invocation is not a test pass. Review a failure before proceeding to coordinated source/authority security installation preparation; do not enable application routes or apply the public dependency draft based on a prepared harness alone.

## Windows line-ending regression repair

The user's installed verifier passed TypeScript/ESLint and 480 of 481 tests; only the LF/CRLF planner test failed. Its fixture preparation replaced LF in text already checked out as CRLF, creating CRCRLF. The test now normalizes checkout text to LF before constructing the two input variants. The same failure was reproduced with an isolated CRLF checkout before the repair; afterward all eight planner tests passed in both LF and CRLF temporary checkouts. Planner/runtime SQL, harnesses and dependency draft are unchanged. Full 481-test verification still needs the user's rerun; no PostgreSQL upgrade results were supplied in this log.

## First PostgreSQL upgrade run — constraint naming repair

The user ran the opted-in harness and passed the first five groups: semantic baseline, three rollback stages and incompatible partial-baseline rejection. The committed-upgrade comparison then failed to find academic_levels_school_id_schools_id_fk. The dependency draft had left three inline school FKs unnamed, so PostgreSQL chose its own names instead of Drizzle's metadata names. Those three inline constraints now explicitly match Drizzle; referenced columns, schools target and RESTRICT actions are unchanged. The strict catalog comparison is retained.

Existing source and metadata tests now check the three declared names against their expected source/actual metadata without increasing the test count. All 14 selected source/planner tests and script syntax/whitespace passed here. The installed full gate remains expected at 481 and the complete eight-group PostgreSQL rerun is pending. The failed run did not print cleanup success; its finally path attempts exact generated-schema cleanup, but this log alone is not a cleanup verification claim. No SQL or database connection occurred here, and original migration/journal, production schema and live security remain unchanged.
