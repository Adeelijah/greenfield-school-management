# Restricted role and complete-authority composition on the upgraded fixture

Date: 2026-10-22. The user explicitly clarified that full offline 487 passed before the supplied log verifying all 13 upgraded guard groups and 64 main groups. The baseline/trigger repair gates are confirmed. This new security composition and its four optional SQL groups remain prepared, not executed here.

## What is prepared

`report-card-upgrade-security-plan.mjs` composes the existing restricted fixture role/RLS plan and complete-authority DDL for a guarded upgraded namespace. It validates exact fixture/schema inputs, requires a school UUID and reviewed authority bodies, and exposes a catalog-presence gate for all 33 relations and seven prior helper functions. This gate checks presence/ambiguity only; it does not prove function bodies, privileges or deployed security.

The plan creates three generated non-login roles: reader, writer and narrow authority-function owner. It first revokes schema/table/function/sequence defaults, installs the existing forced school RLS and restricted mutation rules on 28 report/assessment/source-gate targets, then installs complete membership resolution with source-before-advisory ordering. It reuses the existing release-history function/triggers instead of recreating them. The current guarded layout is a prerequisite, not a reason to drop or replace those protections.

Four legacy modules (admissions, general audit, guardians and student-guardians) and the internal revision-claim table receive no report runtime privileges. The schema-wide table revocation covers them even though they are outside the 28 selected RLS targets. This does not install those modules' eventual application access policy. Row-lock UPDATE(id) privileges on selected tables remain deliberate: restrictive lock policies and statement/immutable guards must continue to prevent actual updates.

Only the exact writer receives EXECUTE on the complete actor helper. The reader and PUBLIC are explicitly denied. The narrow non-login authority owner can count and lock the four reviewed authority/gate tables across the fixed-school service visibility; it is not granted all academic or legacy data. Leaf-role preflight still rejects privileged flags, outgoing memberships and ownership.

No production schema, migration, journal, configured role name, connection URL, Supabase RPC installation, route or live auth setting is changed by this source plan. Existing `greenfield_app` versus draft runtime mapping remains a staging decision; the generated fixture roles do not resolve it automatically.

## Optional four-group probe

The existing upgrade harness calls `report-card-upgrade-security-probe.mjs` only when both its ordinary local-disposable guard and `REPORT_CARD_TEST_ROLE_ADMIN_CONFIRM=DISPOSABLE_ROLE_ADMIN_TEST_ONLY` are present. The probe owns one outer rollback transaction; three generated roles, policies, helper ownership/grants and fictional foreign-school rows all disappear before returning. A missing role-admin token skips these four groups explicitly; 13 ordinary groups alone do not verify the expanded security milestone.

1. Check guarded-layout presence, install the composition, inspect both leaf roles and all selected forced-RLS flags.
2. Select exact leaf roles in savepoints and verify foreign rows are hidden, fixed-school rows are visible, and legacy/claim tables, revision-helper execution, academic writes and snapshot mutation are denied.
3. Use the private complete resolver as writer; confirm one active actor, reject two active school memberships despite service RLS showing one, accept suspended history, and deny reader invocation.
4. Intentionally roll back and verify the generated roles, complete helper and policies are absent. Outer generated-schema cleanup remains the harness's final group.

These are effective SQL privilege and complete-membership tests using **SET LOCAL ROLE under an authorized fixture administrator session**, not an unprivileged generated LOGIN connection. The session administrator could switch roles; no inability-to-escalate claim follows from these probes. No arbitrary caller callback, SDK cookie/JWT or HTTP request is accepted. Complete helper inputs are trusted fictional auth IDs. The existing main 64-group suite supplies separate generated-LOGIN evidence; upgraded-layout LOGIN isolation, real request authentication, concurrency across independent restricted sessions and successful real command workflows are still separate gates.

Setup writes take the installed exclusive source/authority protocol before complete reads. The probe is a single setup/rollback transaction, not proof of report arrival ordering or suitability for mixing authority mutations into report transactions. The previously verified independent main tests remain distinct evidence.

## Validation and run

Six new pure tests check inputs/prerequisites, role flags, omitted legacy grants, forced-RLS ordering, release-guard reuse and private resolver execution. All **31 selected source/planner/guard/security checks** passed here; syntax/whitespace passed. Full installed expectation is **493 tests across 65 files**, pending local verification. No database connection, SQL execution or dependency installation occurred here.

Pull report-cards-foundation and run `node .\scripts\verify-offline.mjs`. Reuse the complete credential-cleaning PowerShell block from the preceding guard milestone with the role-admin confirmation set, running `report-card-postgres-upgrade-integration.mjs`. Expected upgrade output is **17 PASS groups**. The main 64 and standalone eight suites are unchanged and need no rerun solely for this composition. Review any failure before claiming installed upgraded-layout security.

Next after the full gate and expanded run: use a genuinely unprivileged generated LOGIN against the upgraded guarded schema, verify SET/INHERIT/ADMIN/reset boundaries and exact cleanup, and then join real canonical source/commands and verified server requests. Keep routes disabled and preserve the separate approval gates for staging installation, live security and deployment.
