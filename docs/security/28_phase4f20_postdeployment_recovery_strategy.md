# Phase 4F.20 — Post-deployment recovery strategy (design only)

**Status: DRAFT / NO REMOTE WRITES.** Target context: `greenfield-staging` (`hweoqkbgmzycyznrbvng`). This document does not approve migrations, resets, destructive operations or backup restoration.

## Recovery assumptions requiring confirmation

- **Proposed staging policy, not yet accepted:** staging is disposable *only while it contains no real school/student/financial records and no irreplaceable test or Auth/Storage state*. A conversational “let's go” is permission to plan, **not** acceptance of wiping staging.
- Operator must explicitly confirm the staging data classification, dependencies, recovery owner, maximum tolerable data loss (RPO), and recovery time (RTO) before any destructive recovery option is even considered.
- The current encrypted archive is an **empty predeployment public-schema baseline**, not a postdeployment snapshot, not PITR, and not a backup of Supabase Auth/Storage/Realtime/project settings.
- There are no operator-reported managed backups or PITR. Do not promise full recovery or a specific RPO/RTO.

## Recovery tiers

| Situation | Preferred response | Preconditions |
| --- | --- | --- |
| SQL or assertion error **before commit** | Roll back the complete transaction on the same connection; verify read-only that no partial Greenfield objects/journal persisted | Runner uses one transaction and fails closed; separately reviewed and authorized |
| Defect **after commit**, no user traffic/data | Stop rollout, preserve evidence, analyze journal and privileges, prepare reviewed forward-fix | Do not assume auto-reset or delete objects; obtain separate approval for any change |
| Test data exists but is disposable | Consider a controlled rebuild only after inventory and explicit approval for the exact target and data loss | Confirm no real records, shared dependencies, Auth/Storage requirements or needed test evidence |
| Real or irreplaceable data exists | Stop writes if safe, preserve evidence, assess recoverable snapshots, coordinate provider-supported options and reviewed forward-fix | No baseline-only restore; no automatic destructive reset |
| Auth/Storage/platform corruption | Escalate to supported Supabase recovery mechanisms; separately reconstruct configuration only with verified procedures | A public-schema dump cannot recover managed Supabase schemas or project state |

## Proposed postdeployment backup layers (not yet implemented)

1. **Versioned application schema and migration journal:** pin exact Git revision, ordered SQL fingerprints, Drizzle metadata and journal. Git source is *not* a substitute for the database journal or state.
2. **Application-data logical backup:** once data exists, define a read-only, scoped, versioned dump of Greenfield-owned tables and their data, with ACL/ownership limitations documented. Ensure consistent snapshot and restore to an isolated compatible environment; never infer it covers Auth or Storage.
3. **Supabase-managed state:** independently evaluate available Auth, Storage, roles, secrets, policies, configuration and provider-managed backup/export/recovery options. Do not casually dump and restore managed schemas into local PostgreSQL.
4. **Protection and retention:** encrypt before off-device transfer, store recovery password separately, verify archive integrity and periodic sample restores, and record timestamp, scope, hash, recovery owner, retention and storage access.
5. **Recovery exercises:** rehearse restore of application-owned schema/data/journal into a disposable isolated environment with synthetic records, including foreign keys, RLS, effective grants and representative tenant access checks. This must be designed before relying on a postdeployment recovery claim.

## Safe acceptance test plan (local only)

- Prepare a synthetic two-school fixture, including students, guardians, enrollments, invoices/receipts and migration journal. No real personal data.
- Snapshot a disposable local database with a **reviewed local-only** command, restore to a distinct disposable database and compare record counts, foreign-key integrity, journal and security invariants.
- Inject a precommit failure and verify transaction rollback; simulate a postcommit application defect and validate that the runbook does **not** auto-drop the database.
- Time the exercise to obtain an observed *local* restore duration; do not treat it as a guaranteed Supabase RTO.
- Keep existing `greenfield_disposable_validation` and `greenfield_disposable_restore_test` intact unless a separately reviewed local operation explicitly names another disposable target.

## Outstanding authorization gates

- [ ] Operator confirms staging is empty of real/irreplaceable data and states whether rebuilding it would be acceptable **in principle**.
- [ ] Operator defines provisional RPO/RTO and recovery owner; records explicit acceptance of no managed backups, or chooses stronger recovery coverage.
- [ ] Local synthetic-data backup/restore exercise passes and evidence is recorded.
- [ ] Recheck remote staging identity, object inventory, journal and broad future default ACLs read-only.
- [ ] Review exact runner revision, SQL hashes, transactional assertions and independent security acceptance tests.
- [ ] Obtain separate explicit approval for exact staging write or recovery operation; no approval implied here.

**Decision: BLOCKED FOR REMOTE WRITES.** Do not run `npm run db:migrate` against Supabase or implicitly use project `.env.local` credentials.
