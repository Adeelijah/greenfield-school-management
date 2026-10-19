# Report Cards RLS and migration gate — review only

**No migration, live RLS policy, DB connection or deployment is included.**

## Schema dependency

The isolated `report-cards-schema.proposal.ts` now models the required composite foreign key `report_cards(school_id, session_id, term_id) -> terms(school_id, session_id, id)`. Its `proposedTermsCompositeTarget` is a **shadow metadata declaration**, not a production schema change. Before any migration is generated, the actual `terms` table must gain a reviewed unique constraint on `(school_id, session_id, id)`, and the shadow declaration must be replaced by the real production table definition. Never run Drizzle Kit with the proposal file as an input: it contains a second declaration of `terms` for review purposes.

## Access policy decisions

| Relation | Teacher | Admin | Bursar | Guardian |
| --- | --- | --- | --- | --- |
| report_cards | Assigned-class read and controlled submit through server | School-scoped read and workflow transitions through server | No report-card workflow access | No direct table access |
| report_card_snapshots | No direct access | No direct write/update; controlled server reads | None | No direct access |
| report_card_audit | No direct access | Controlled school-scoped audit view | None | None |
| report_card_operation_receipts | None | None | None | None |
| report_card_releases | None | Controlled school-scoped server workflow | None | Read only through verified release endpoint, not direct table |

**Default deny** for all authenticated client roles on all five relations until explicit policies, privileges, and tests are reviewed. A service-role connection bypassing RLS must independently enforce school, actor, assignment and report identity. Never trust a client-supplied school ID as authorization.

## Required policy verification

1. Confirm the app's actual database role strategy (Supabase authenticated, service role, server pooler); inspect grants and RLS policies without altering production.
2. Design policies using a server-verified school membership and assigned teacher-class/session relationship, or keep direct table access denied and expose only vetted server functions.
3. Enforce append-only snapshots/audit/receipts at DB privilege or trigger layer. Release revocation must be controlled and audited.
4. Parent access must resolve auth user to guardian identity and active student relationship and require a current, non-revoked published release on **every** read.
5. Test two schools, role changes, suspended memberships, forged school IDs, revoked guardian links, stale versions, idempotency collision, transaction rollback and privileged-role bypass in a disposable database.

## Snapshot contract still open

`inspectSnapshotSource` validates roster completeness and basic source identifiers, **not** database ownership, source revision authenticity, deterministic canonical JSON, SHA-256 digest, or immutability. Those remain prerequisites to production writes.

## Approval gate

Do not merge or deploy. Obtain separate approval before adding production schema declarations, generating executable migrations, connecting to any database, or applying RLS. Offline metadata checks are not proof of PostgreSQL integrity or authorization.
