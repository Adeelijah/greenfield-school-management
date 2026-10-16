# Phase 4F.25 - Staging Backup and Recovery Design

Status: DESIGN ONLY - REMOTE OPERATIONS BLOCKED

## Recovery objectives

RPO: 24 hours (provisional)
RTO: 4 hours (provisional)

Recovery owner: Project owner/operator
Data classification: Synthetic and replaceable only

Neither recovery objective has been demonstrated.

## Existing evidence

Phase 4F.21 successfully restored a custom-format PostgreSQL
backup into an isolated local database.

The rehearsal verified synthetic records, selected privileges,
RLS configuration and tested tenant-isolation scenarios.

The rehearsal did not prove Supabase Auth recovery,
migration-journal completeness or recovery duration.

## Proposed backup approach

1. Confirm the exact staging project and database identity.
2. Confirm all staging application data is disposable.
3. Obtain separate authorization before remote access.
4. Define application-owned schemas and backup scope.
5. Capture a consistent PostgreSQL custom-format snapshot.
6. Record backup creation time, scope and SHA-256 checksum.
7. Encrypt the archive before external storage.
8. Store recovery material in an access-controlled location.
9. Verify archive readability and stored-copy integrity.
10. Retain recovery points sufficient for the provisional RPO.

A daily backup schedule is a proposed minimum, not proof
that the 24-hour RPO is met.

A backup of public does not cover the complete Supabase
platform, including managed Auth and Storage state.

## Proposed restore approach

1. Classify the incident and preserve evidence.
2. Verify the exact target and expected data loss.
3. Confirm that all affected data is replaceable.
4. Prefer non-destructive recovery when practical.
5. Obtain explicit approval for the exact recovery action.
6. Rehearse the selected restore in an isolated environment.
7. Restore application-owned objects and synthetic records.
8. Validate migration history and schema consistency.
9. Revalidate grants, default privileges, RLS and isolation.
10. Validate application behavior and authentication.
11. Record elapsed recovery time and unresolved failures.

Do not reset Supabase-managed schemas or platform resources
using an application-only PostgreSQL archive.

## Acceptance evidence required

- Documented backup scope and exclusions.
- Proven backup integrity and secure storage.
- Verified recovery-point age within the RPO target.
- Timed restore within the RTO target.
- Verified migration journal and schema.
- Verified authorization and tenant isolation.
- Supabase Auth and application smoke-test results.
- Operator review and explicit approval.

## Open blockers

- No confirmed managed staging backup or PITR.
- No verified automated staging backup schedule.
- No timed four-hour staging recovery rehearsal.
- No established full Supabase platform recovery procedure.
- Remote staging inventory and identity require approval.
- Existing encrypted archive and offsite-copy safeguards
  require further verification.
- Suspended-user membership visibility needs policy review.

## Authorization boundary

This design does not authorize remote connections,
database writes, migrations, destructive rebuilds,
deployment or GitHub pushes.

Staging remote writes remain blocked.