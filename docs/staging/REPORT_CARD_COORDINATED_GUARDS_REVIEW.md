# Coordinated public guard layer — review only

Date: 2026-10-23. The user confirmed the full **513-test offline gate** after the fixture typing repair. The existing 31 upgraded PostgreSQL groups, 64 main groups and eight standalone authority groups remain verified for their unchanged fixtures.

## Prepared artifact

`REPORT_CARD_COORDINATED_GUARDS_REVIEW.sql` ports the tested source/history protocols and existing standalone authority proposal into one reviewed public-schema transaction. It is not journaled, installed, PostgreSQL-parsed or executed here. The original SQL drafts, migration journal, fixture namespace guards and application code remain unchanged.

The artifact requires reconciled public academic/assessment/report relations, Supabase auth functions/roles, an existing reviewed greenfield_app login and a separately authorized operator/target. CREATE statements deliberately fail on name collisions; there is no IF NOT EXISTS repair, object dropping or role alteration. The two new non-login authority/runtime roles are part of this candidate transaction, not assumed installed. Do not apply this over an unknown partial installation.

| Layer | Concrete preparation | Remaining prerequisite |
| --- | --- | --- |
| Source protocol | `assessment_source_write_gate`, `assessment_source_write_claims`; exclusive statement gate before discovery, deterministic dependent-scope revision invalidation and once-per-transaction claims | Actual public catalog/SQL execution, trusted academic writer privileges and claim retention/maintenance plan |
| Parent and authority writes | Statement-before-row gates, zero-row/truncate protection; seven parent families invalidate old/new scopes and pass BEFORE rows through | All real write paths, cascades/imports/jobs and operator lock behavior must follow the order |
| Immutable history | Eight source/report history families reject update/delete/truncate, even zero-row statements; finalized config frozen | Actual public constraints, guards and privilege tests |
| Release history | Freeze original publication facts; allow one monotonic revocation; deny deletion/truncate | Actual immutable snapshot/release binding and runtime column grants |
| Complete authority | Existing auth.uid-bound zero-argument RPC, private locked actor lookup, statement authority gate and membership actor anchor | Real request/JWT verification and effective owner policies/grants |
| Protocol isolation | Revoke known API/application defaults on only the new protocol tables/functions; enable/force protocol RLS; exact setup-operator policy and narrow source-gate owner access | Inspect effective defaults/unknown role grants, ownership and policy applicability in the selected target |

All seven source/history function bodies preserve the tested fixture semantics under explicit public object names. No fixture schema generator is used as an assessment/report table migration generator. Only this guard layer is ported; no base, assessment or report table is recreated.

## One lock order

The request RPC and command actor helper first take a shared lock on the singleton source gate, then the shared authority advisory lock, then discover the actor and memberships. Authority statement writers first take the exclusive source gate and then the exclusive advisory lock, before PostgreSQL discovers/locks the affected rows. Existing academic/parent statement guards take the same source gate before invalidation. Missing gate rows raise rather than silently dropping lock coverage.

The authority owner receives only SELECT/UPDATE(id) on the source gate and the existing narrow identity tables, with read/locking policies. It is never made a login or granted as a membership target. Direct private helper EXECUTE remains denied to API/application roles; the request RPC alone is granted to authenticated. The future fixed-school runtime grants are intentionally absent until that layer is reviewed. No caller-set school/JWT/session GUC is treated as authentication.

## What this does not install

This artifact is **not a complete migration or ready-to-apply security bundle**. Academic dependency and proposal table DDL still require the reconciled explicit assembly; runtime fixed-school RLS, column/function grants and SET-only login membership remain separate uninstalled layers. Existing restrictive PUBLIC policies could still hide rows from the complete authority owner and must be checked. The protocol setup policy applies to the installation operator only; it is not an application owner fallback.

The invoker source invalidators need a separately reviewed trusted academic-write privilege path to gate/claims/scope revisions. Do not grant report runtime academic writes, or apply these triggers to active modules before that path is ready. Revision claim retention and maintenance are not automated here. The existing fixture-only command adapters still refuse public schemas. The new dormant staging role adapter and a future non-fixture command boundary must agree with the installed lock/table names.

Unknown default ACLs, effective transitive rights and policies require actual target inspection. Revoking the named PUBLIC/API/application defaults is not proof that no other principal has access. Real cookie/JWT requests and an authorized isolated Supabase installation are still outstanding; successful fixture authentication transport is not a substitute.

## Verification and next gate

Eight new offline source checks verify the single transaction/two-table scope, parity of all seven ported function bodies, source trigger coverage and once-per-tx claims, source-before-advisory ordering, parent pass-through, immutable/release guards, private EXECUTE/protocol RLS and LF/CRLF handling. These checks read SQL text and pure builders only. **100 selected offline tests passed here**; changed script syntax and scoped whitespace passed. No SQL or database connection occurred.

Expected installed offline total is now **521 tests across 69 files**, pending the full verifier. Existing PostgreSQL harnesses did not change, so no rerun is needed solely for this review artifact; their prior success does not validate this new public SQL. The next package layer is target-bound fixed-school runtime policy/grants plus non-fixture command adaptation and an isolated rehearsal of the actual combined artifacts. Keep routes disabled and preserve unrelated work; no merge, live-auth change, production SQL or deployment is authorized by this source preparation.
