# Phase 4F.25 - Staging Recovery Policy

Status: PLANNING APPROVED - IMPLEMENTATION NOT AUTHORIZED
Target: greenfield-staging
Supabase project reference: hweoqkbgmzycyznrbvng

## Data classification

Staging is intended to contain synthetic, replaceable data only.

Before any rebuild, the operator must independently confirm
that no real, sensitive, or irreplaceable records or dependencies exist.

If that condition cannot be established, the rebuild must stop.

## Recovery ownership

Recovery owner: Project owner/operator

The recovery owner coordinates incident assessment, evidence
preservation, recovery approval, execution, and validation.

## Provisional recovery objectives

Recovery Point Objective (RPO): 24 hours
Recovery Time Objective (RTO): 4 hours

These are planning targets, not verified guarantees.

Meeting the RPO requires a tested snapshot or reproducible-state
process that limits loss of staging work to 24 hours.

Meeting the RTO requires a timed recovery exercise demonstrating
restoration of a usable staging environment within four hours.

## Proposed recovery approach

1. Stop affected application activity when safe.
2. Preserve incident evidence and current database state.
3. Verify exact Supabase project identity and data classification.
4. Determine whether a non-destructive forward-fix is preferable.
5. Review the recovery procedure and its expected data loss.
6. Obtain separate explicit authorization for the exact operation.
7. Restore or rebuild application-owned schema and migration state.
8. Restore approved synthetic fixtures or recoverable snapshots.
9. Validate authentication, tenant isolation, RLS and grants.
10. Complete application smoke tests before reopening staging.

## Restrictions

- No automatic database resets or destructive recovery.
- No use of production or real student data in staging.
- No restoration of Supabase-managed schemas using an
  application-only PostgreSQL dump.
- No assumption that the empty predeployment baseline can
  recover postdeployment application data.
- No remote database writes without separate explicit approval.
- No deployment authorization is granted by this document.

## Outstanding acceptance requirements

- Design and verify the 24-hour recovery-point mechanism.
- Establish secure backup storage and retention procedures.
- Rehearse recovery using synthetic data in an isolated environment.
- Measure recovery duration against the four-hour target.
- Verify migration journal, privileges, RLS and tenant isolation.
- Independently verify staging identity and current schema state.
- Review the exact deployment and recovery procedures.
- Obtain explicit authorization before any staging modification.

Decision: STAGING REMOTE WRITES REMAIN BLOCKED.