# Phase 4F.19 — Staging recovery readiness checklist

**Status: REVIEW ONLY — REMOTE WRITES NOT AUTHORIZED.** Target context: `greenfield-staging`, Supabase project ref `hweoqkbgmzycyznrbvng`. This document is a decision checklist, not executable SQL or a deployment approval.

## Verified operator evidence (16 October 2026)

- The limited schema-only `public` archive `greenfield-staging-predeployment-retry.dump` (1,652 bytes; SHA-256 `369BA09F690E4DB99889843B4D9F006FFCAB8F31678D2EC383A01D585387FD2B`) was parsed and restored to an isolated local PostgreSQL database. It restored the empty `public` schema and comment, not a Greenfield application.
- A separate descriptive security inventory and recovery manifest were included with the dump in `greenfield-staging-encrypted.7z`. The archive was tested successfully with 7-Zip 26.04; method reported `7zAES`, with encrypted headers requested at creation. Three input files total 5,339 bytes; archive size 1,695 bytes.
- Local original and OneDrive-folder copies have identical SHA-256 `762B0F08F7BCC14750A7E47E5E47E467385BD4797E81AAF00CEDB2CAD2C3EDDE`.
- Operator screenshot shows an approximately 1.66 KB encrypted archive in OneDrive web My files. Cloud-side download/hash verification has **not** been performed.
- Windows C: BitLocker reported `FullyDecrypted / Off / 0%`. Original plaintext files remain on that unencrypted volume. Do not claim they are protected by the encrypted archive.

## Recovery scope and limitations

**Proven:** integrity of encrypted local archive, byte-identical local copies, visibility of a cloud archive, and narrow isolated restore of the predeployment empty `public` schema.

**Not proven:** full Supabase disaster recovery, Auth/Storage/Realtime restoration, application rows after deployment, Drizzle journal recovery, owner/ACL/default ACL restoration, point-in-time recovery, cloud-copy hash verification, secure handling of pre-existing plaintext, or post-deployment recovery time. The text security inventory is not executable restore material. Operator reports no managed backups/PITR.

## Pre-write checklist — every box must be independently satisfied

- [ ] Confirm recovery owner and escalation channel, maximum tolerable data loss (RPO) and recovery time (RTO); explicitly accept or mitigate absent managed backups.
- [ ] Determine a viable **post-deployment** recovery path for Greenfield schema, data and journal, without assuming the empty baseline dump can restore them.
- [ ] Confirm encrypted archive password is recoverable without storing it alongside the archive; verify destination account access, retention, and (optionally) download and hash cloud copy. Do not share passwords or dumps in Git/chat.
- [ ] Address plaintext copies on unencrypted C: with a deliberate storage/retention plan. Do not delete the only verified restore material prematurely; deletion alone may not securely erase SSD blocks.
- [ ] Re-run read-only staging identity, `public` object and migration-journal inventory; abort on unexpected state. Connection database/user alone do not prove project identity.
- [ ] Review `postgres` and `supabase_admin` future-object default ACLs in `public`, including functions, tables and sequences; no unreviewed global ACL changes.
- [ ] Pin exact runner commit and reviewed SQL SHA-256 fingerprints; verify all statements, target safeguards, one-connection transaction, precommit effective privileges and journal consistency.
- [ ] Complete isolated rehearsal of exact final runner and failure injection; preserve fail-closed assertions.
- [ ] Obtain separate explicit operator authorization naming target project and exact reviewed revision. **“Let's go” is not authorization for remote writes.**

## Forward-fix / failure decision tree (plan only)

1. **Before transaction commit:** any identity, catalog, SQL, privilege or journal assertion failure must abort and roll back the **entire transaction**. Confirm unchanged state via read-only checks.
2. **After commit, before user enablement:** disable rollout, capture non-secret catalog evidence, classify defect. Prefer separately reviewed additive/forward-fix migration. Do **not** auto-drop tables or assume a baseline-only dump reverses committed changes.
3. **After application data exists:** stop writes through application controls if safe, preserve evidence, assess actual available backups and restore point, coordinate with recovery owner. Never promise zero data loss or an untested RTO.
4. **If Supabase platform/Auth/Storage is affected:** the baseline `public` dump cannot recover managed schemas or platform configuration. Escalate to provider-supported recovery options; do not import platform schemas into local PostgreSQL as proof of recovery.

## Deployment acceptance (after separate approval, not in this phase)

- Verify actual Supabase JWT/PostgREST tenant isolation, cross-tenant denials, suspended/nonmember access, browser write denial, service-role authorization, owner protections and migration journal.
- Future migrations must address broad default grants on each newly created object within the same reviewed transaction until separately approved default-ACL hardening is tested.

## Decision

**BLOCKED FOR REMOTE WRITES.** Encrypted off-device baseline evidence is a useful safeguard but does not close post-deployment recovery or default-privilege gates. This file authorizes no connections, migrations, remote DDL, restore, or cleanup.
