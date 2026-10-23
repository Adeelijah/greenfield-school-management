# Fixed-school runtime policy and staging command boundary

Date: 2026-10-23. The user confirmed **all 521 offline tests passed**. Existing 31 upgrade groups, 64 main groups and eight standalone authority groups remain verified for their unchanged fixtures.

## Source preparation

`scripts/lib/report-card-staging-security-plan.mjs` returns an immutable SQL review fragment for explicit isolated-staging mode, public schema, one validated school UUID and a full source commit identifier. The school literal and all role/object names are bounded; no caller-set session GUC supplies tenancy. Source commit is recorded review metadata, not proof of source identity or installed state. The module imports no driver, credentials, environment or application code and never executes its statements.

| Surface | Prepared behavior |
| --- | --- |
| Selected relations | 27 existing base/assessment/report tables plus the singleton source gate; no lifecycle, admissions, guardian, general audit or source-claim grant |
| Tenant clamp | ENABLE/FORCE RLS and a restrictive school policy applying to both greenfield_app and greenfield_report_card_runtime; school-user visibility joins fixed-school memberships; the gate is limited to id=1 |
| Read and row locking | Runtime SELECT and UPDATE(id) where needed, scoped read/locking policies; locking policy WITH CHECK false |
| Mutation defense | Independent BEFORE STATEMENT DML and truncate guards on all 28 relations deny runtime academic/immutable changes, including zero-row statements and permissive-policy interactions |
| Report writes | INSERT on only five report relations; UPDATE on exactly the reviewed report transition columns and release revoked_at; direct application/API-role report DML is denied by the statement guard |
| Private authority | Exact private actor-lock EXECUTE granted only to the runtime role after public/API/login revocation; no authority-owner membership is granted |
| Role activation | SET-only runtime membership for greenfield_app is the final three statements: SET true, INHERIT false, ADMIN false |
| Existing modules | Reset direct privileges only for the dedicated report role on selected tables; preserve unrelated module ACLs/policies and use an explicit installation-operator policy |

The fragment contains no BEGIN/COMMIT, role creation, DROP/replacement, schema-wide revoke, migration or connection. Its intended composition point is **after all statements/revocations in REPORT_CARD_COORDINATED_GUARDS_REVIEW.sql and immediately before that artifact's COMMIT**. Do not append it after a committed guard installation or insert its helper GRANT before a later REVOKE. A complete assembler and actual combined-artifact rehearsal are still required. Policy/trigger name collisions must fail instead of silently replacing an existing school binding.

The role mapping and actual target must be reconciled first. Direct revocation is not proof of effective denial when PUBLIC or other grant paths remain; inspect actual table/column/function/default ACLs and policies. See the official [PostgreSQL REVOKE reference](https://www.postgresql.org/docs/18/sql-revoke.html). This candidate preserves unrelated privileges, so it cannot establish that unrelated SECURITY DEFINER functions or other role paths are harmless. Existing PUBLIC restrictive policies could still filter the authority owner's complete-membership relation and must be audited. The owner is outside the fixed-school role clamp by design, with its separately reviewed narrow policies.

Source/academic writer privileges, claim maintenance and other module write paths remain unresolved installation prerequisites. Do not apply source/authority triggers to active modules before those paths are mapped. Protocol claims remain unavailable to report runtime. No operator-owned table or owner connection is used for report work.

## Dormant public command boundary

`src/lib/academics/report-card-staging-command-boundary.ts` accepts a supplied staging runtime and the original trusted server-resolved actor binding. It rejects a foreign school/malformed principal before opening a transaction. Inside the runtime's transaction it verifies session_user and current_user, takes the public source SHARE gate, resolves complete locked authority, and refuses a changed school/user/membership. Current locked role/configuration is passed to command work rather than preserving old request decisions.

Inner command transactions reuse the same physical transaction with scoped SQL leases. Failed outcomes throw through the outer transaction before the original failure is returned. Caught SQL errors, direct/nested transaction misuse and expired leases cannot become a successful commit. Thrown private errors become a generic transaction failure. The command callback must prepare a safe response inside the boundary; it preserves provided failure outcomes and does not itself sanitize arbitrary fields.

The binding shape is not authentication. A future server entry must own the real SDK resolution and closed request parser and must never accept an identity callback/binding from a body. Assignment, action-specific role rules, version checks, idempotency and source validation still belong to the actual writer after scoped resource discovery.

Neither new module is imported by a route or application client. Existing fixture writers/readers still reject public schemas; they were not weakened or ported in this batch. The boundary is a staging transaction component, not a completed public report-command adapter. The next domain-writer adaptation must preserve their tested policies and use this reviewed public namespace/lock contract.

## Validation and next gate

Eight pure SQL-plan checks and eleven recorder boundary checks passed. They cover fixed scope/revision input, immutable plans, all 28 clamps and statement guards, bounded writes, helper/role activation order, exact session/principal checks, rollback/leases and composition with the actual staging role adapter in one recorded transaction. Combined selected validation: **119 checks passed here**; changed script syntax and scoped whitespace passed. Full installed TypeScript/ESLint remains pending.

Expected full offline total is **540 tests across 71 files**. No database connection, SQL execution, role/grant/RLS installation, live authentication, route enablement, merge or deployment occurred. PostgreSQL harnesses are unchanged and need no rerun solely for this source batch; their results do not verify the new public policy fragment or boundary.

Next: public domain writer/source adaptation, a complete installation assembler and an authorized isolated rehearsal of the actual combined artifacts. Real Supabase cookie/JWT tests still require a specifically selected and authorized isolated target with fictional accounts. Keep all live report endpoints disabled until those gates pass.
