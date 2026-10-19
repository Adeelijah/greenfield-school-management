# Revocation audit binding and release history guards

Status: review-only schema proposal and disposable fixture SQL; no production schema, migrations, live auth, grants or routes changed. The user verified all 357 offline tests and all preceding 45 PostgreSQL groups. No SQL was executed by the assistant.

## Proposal changes

The isolated report action enum adds revoke. Audit rows gain nullable release_id. For revoke, release_id, snapshot_id and snapshot_report_version are mandatory; the six-column FK binds school/report/release/snapshot/approved-version/before-version to the exact published release. A matching redundant unique release target supports this FK. A partial unique audit index permits one revoke event per release. Other actions cannot carry a release ID.

Revoke audit stages are published to draft with the normal positive one-step report version increase. Its approved snapshot version is one less than before_version. Return and revoke require trimmed reasons of 1–2000 characters; other actions require null reason. Earlier creation, submission, return, approval, publication and approved-reopen tests remain in the harness. The pure command key limit is corrected to 128 characters to match the existing receipt column, rejecting 129-character keys before a future write.

No new table or production export is introduced. Fixture count remains 27 metadata tables. The schema emitter creates all tables/indexes before adding foreign keys, so the audit-to-release metadata reference does not require executable migration changes. The shadow terms/enrollment proposal declarations remain isolated.

## Disposable history guards

`reportReleaseGuardDDL(schema)` accepts only generated rc_it identifiers. Its invoker function uses pg_catalog search_path and fully fixture-qualified trigger targets. An inserted release must be active. Updates compare all row properties except revoked_at; every original fact, including IDs, school/report/snapshot/version/publisher/publication time, must remain identical. Only NULL to a non-null timestamp at or after released_at is accepted. Once revoked, restoration, timestamp replacement and even no-op UPDATE are rejected. Separate statement triggers reject DELETE and TRUNCATE, including zero-row statements.

The builder does not connect or grant privileges. These guards are installed after the existing restricted-role transaction rolls back, preserving the previously verified security boundary. That writer role still cannot UPDATE releases; no permission is broadened here.

## Prepared PostgreSQL checks

Three added owner-run groups prepare:

- Missing/substituted release and snapshot audit bindings, invalid reason/stage/version and duplicate revoke event rejection.
- Original release-field immutability, prohibition of pre-revoked insertion, one-way revocation/restoration rejection, rollback and delete/truncate denial.
- Manual fixture withdrawal with report/release/audit/receipt in one transaction: an existing actor/key receipt collision rolls everything back; a fresh key retries successfully, leaves no active release and preserves the original snapshot.

The manual fixture transaction is not the actual application revoke adapter. Metadata and one-way triggers do not require a matching audit/receipt to accompany every owner UPDATE; the future controlled writer must provide that atomic relationship and server authorization. Do not claim the owner-run test alone implements the full correction workflow, replay protocol or restricted-role revocation.

## Verification and next step

Three added metadata tests and four guard-builder tests raise expected offline count to 364. All 42 selected policy/guard/writer tests, script syntax and whitespace passed here; new Drizzle metadata assertions and the full TypeScript/ESLint gate remain pending local verification. Three added PostgreSQL groups raise expected totals to 48 with role-admin opt-in, or 41 owner-run groups plus seven explicit restricted skips without it. No new SQL was executed here.

Next after both gates: actual transaction-owned revoke writer using verified actor/shared actor-key locks, exact locked report/release/snapshot, durable normalized fingerprint/receipt replay, pure correction plan, optimistic report and release updates, immutable audit and receipt. Prepare narrowly controlled revoked_at privileges/guards and restricted-role rollback/retry/history tests; retain denial of all other release mutations. Independent-session concurrency and the final live login/auth contract remain before route/UI release. No merge or deployment.
