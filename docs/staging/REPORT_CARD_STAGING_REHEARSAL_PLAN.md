# Isolated staging rehearsal and recovery plan

Status: prepared for target selection, not authorized or executed. Source review date: 2026-10-23. The user confirmed all **556 offline tests** passed after the metadata assertion repair. The **31-group upgraded PostgreSQL rerun for the shared-domain milestone remains pending**. Earlier generated-fixture results do not establish a public Supabase installation or real request authentication.

## Target record

Complete this record before any connection. A project name/reference or dashboard URL is sufficient for initial identification; do not paste passwords, database URLs containing credentials, service-role keys, JWTs or session cookies into the record or conversation.

| Required field | Current value / rule |
| --- | --- |
| Isolated Supabase project name and reference | Not supplied; must differ from the school's production project |
| Operator responsible for the target | Not supplied |
| Data classification | Fictional accounts and pupils only; no copy of real pupil/guardian data |
| Authorized first operation | Target identification and separately approved read-only catalog inspection; no installation implied |
| Fictional school UUID and final Primary year | Not supplied; explicitly choose 5 or 6 after catalog reconciliation |
| Source revision | Record the immutable reviewed branch SHA and installed SDK/driver versions |
| Candidate installation hash | Generate from `buildStagingReportInstallationReview` for that school and source; record the SQL hash and all four phase hashes |
| Inspection identity | Separately authorized catalog operator; never reuse its credentials for the report application |
| Application identity | `greenfield_app` LOGIN; SET-only access to `greenfield_report_card_runtime`; separate unreachable non-login authority owner |
| Endpoint state | Report and guardian endpoints disabled throughout installation and failure rehearsal |
| Restore evidence | Record a completed restoration into a separately named isolated destination before installation approval |

Do not assume the existing connected Supabase project is disposable or that the local PostgreSQL disposable database supplies Supabase Auth. Target identification, read-only inspection, schema/security installation, fictional writes, auth-account creation and deployment are distinct operations. Record the requested scope explicitly instead of inferring it from standing approval for source commits.

## Read-only reconciliation

After target-specific inspection authorization, use the existing `REPORT_CARD_CATALOG_PREFLIGHT_REVIEW.sql` as review material. Run catalog reads in a bounded read-only transaction through the approved operator; do not run a migration, call the actor-lock helper, switch roles, create temporary objects or read application rows as part of this first inspection. Capture database identity, server version and source/artifact hashes alongside the results. Missing or inaccessible results mean unknown, never passed.

The draft inspects columns/defaults, enum labels/order, indexes, validated constraints, triggers, policies, direct ACLs and both membership directions. It is not a complete effective-privilege audit. Review these additional surfaces before installation authorization:

| Surface | Evidence to retain | Decision |
| --- | --- | --- |
| Baseline | Actual catalog and deployed migration journal compared with the semantic 12-table baseline | Reject unknown partial layouts; the unchanged raw journal is not proven replayable |
| Additive schema | Three academic dependency tables, sixteen proposal tables and two protocol tables, with exact referenced column tuples | On the supported baseline, the public foundation grows from 12 to 33 selected/preserved relations; unrelated existing modules remain intact |
| Legacy data | Aggregate invariants and restoration plan reviewed separately | Never infer class mappings or final Primary year; do not export identities |
| Role graph | Flags, ownership and SET/INHERIT/ADMIN options in both directions, including reachable privileged roles | Login/runtime cannot own objects or reach an owner/admin role; existing incompatible roles require a separate reviewed resolution |
| Effective privileges | PUBLIC/default ACLs, column/table/schema/sequence privileges, function EXECUTE and transitive membership | Explicit narrow grants cannot cancel inherited/PUBLIC access; resolve leaks before runtime activation |
| Function owner | Exact owned-object inventory, search path, body parity and policies applying to the authority owner | Ownership must be limited to reviewed authority functions; complete lookup must see hidden second memberships |
| Dependencies | Auth schema/function signatures, PostgreSQL 16+ membership options, extension and external dependencies | Stop on unsupported signatures or versions; do not silently rewrite the package |
| Source writers | Every import, admin task and academic writer identified with its privilege and lock protocol | The report runtime does not receive academic-writing privileges; source writes require a separately reviewed mapping |
| Revision claims | Expected growth, transaction-ID representation and maintenance operator/schedule | No retention cleanup runs implicitly or under the report runtime; review concurrency-safe maintenance before sustained use |

A matching object name, source hash or successful SELECT is insufficient. Compare definitions, exact key tuples and policy applicability. The candidate is additive and intentionally fails on conflicting definitions; `IF NOT EXISTS`, dropping objects or weakening constraints is not reconciliation.

## Recovery evidence before installation

Record a target-specific backup/restore method and its coverage. Do not assume a database backup includes Supabase Auth configuration, external storage, role memberships, secrets or provider settings. List each separately, identify the operator responsible, and verify which supported restoration procedure covers it. Keep sensitive evidence outside Git; store only identifiers, timestamps, hashes, aggregate checks and operator attestations in the review record.

Restore the fictional baseline into a different explicitly approved isolated destination and verify schema definitions, legacy relationship/count invariants and the relevant auth/role configuration. A downloaded backup or successful backup command is not restoration evidence. Record elapsed time and any unrecovered dependencies. No production database may be dropped, overwritten or restored as part of this plan.

| Failure point | Required observation | Recovery action for review |
| --- | --- | --- |
| Before installation transaction | Source/hash/target mismatch or unknown catalog state | Do not execute the candidate; reconcile the record |
| Dependency, proposal, guard or policy phase before COMMIT | Injected failure escapes the transaction; catalog, roles/grants and fictional legacy invariants match baseline afterward | Keep endpoints disabled; preserve diagnostics and verify complete rollback before retry |
| Connection loss while COMMIT result is unknown | Determine committed catalog and role state from a fresh approved inspection | Do not blindly rerun the additive candidate; classify committed versus rolled-back state first |
| Failure after committed installation, before endpoint use | Installed state is captured and source/data history preserved | Prepare a reviewed forward repair or use the specifically approved isolated restoration procedure |
| Failure after report publication | Published snapshot and release history remain immutable | Use the authorized revoke/correct/independent-approve/republish workflow; schema rollback is not a report correction |

Do not create a generic down migration that deletes snapshots, releases, audit or receipts. The candidate currently uses one ordinary transaction; concurrent index creation and autocommit operations are outside this plan. Never grant runtime access early to test an incomplete installation.

## Authorized rehearsal sequence

1. Complete the existing 31-group local upgrade rerun and record its source SHA. Preserve its generated-fixture cleanup evidence. It remains a regression prerequisite, not proof for the target below.
2. Identify the isolated Supabase target, operator and fictional school. Obtain scope for catalog inspection, then reconcile the actual catalog/effective privileges and recovery evidence. No apply command is provided here.
3. Prepare the exact fixed-school candidate and hashes for the supported baseline. Review all phases together and obtain target-specific authorization for installation, failure injection, temporary fictional data and any account/configuration changes.
4. On that authorized target, rehearse failure after each phase and verify baseline restoration. Then install the same reviewed candidate and inspect actual catalog, helper ownership, forced RLS, effective privileges and exact role graph.
5. Exercise the actual public staging server factory with supplied restricted connections. Verify all seven actions, canonical pupil-specific snapshots, concurrent same-key apply/replay, competing keys, injected persistence rollback and historical replay after source changes. Check role reset and clean pooled reuse after every failure.
6. Test real Supabase server authentication with fictional accounts and real sessions. Cover missing/invalid/expired sessions, anonymous private-helper denial, RPC-to-transaction principal drift, a second active membership hidden by fixed-school RLS, ended assignments and suspended actors. Controlled SDK transports cannot substitute for this evidence.
7. Review aggregate results, restoration evidence and remaining gaps. Only then prepare route/UI/guardian integration and user acceptance work. Any endpoint enablement or deployment remains a separate concrete change request.

## Evidence ledger and exit condition

Retain source SHA; target/project reference; authorized operation scope; school/final-year configuration; candidate and phase hashes; catalog comparison; effective-privilege findings; baseline/restoration evidence; per-failure rollback observations; actual public domain/auth results; and cleanup ownership. Do not record credentials or pupil identities.

The rehearsal is complete only when the actual target's catalog/security and real authenticated requests are evidenced, every injected failure has a recorded recovery result, and unresolved findings have an explicit disposition. Current state: target absent, no catalog inspected, no SQL executed, no restoration performed and no real SDK/JWT result claimed. The offline 556-test result is verified; it is not launch readiness.
