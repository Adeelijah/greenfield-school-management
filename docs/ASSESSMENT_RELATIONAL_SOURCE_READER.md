# Schema-faithful relational assessment source reader — fixture only

The user confirmed the preceding write-guard milestone passed the full offline gate with 243 tests and all twelve PostgreSQL groups. This reader is the next isolated integration step, not a production endpoint.

`src/lib/academics/assessment-postgres-fixture-source-reader.ts` reads the actual selected base/assessment proposal relations inside an already-open transaction in a generated `rc_it_` schema. It does not read the earlier JSONB academic bundle, load app environment files, connect by itself or call a Supabase SDK. A server-owned verified-identity callback remains fictional in tests. Only student/enrollment/class/session/term selectors are copied from input; school, membership, configuration and score authority derive from trusted relational reads.

## Validated relational path

1. Verify callback identity, then acquire the shared fixture discovery gate before scope/roster/enrollment discovery. This is read-only; never upgrade the shared gate into a source write.
2. Join auth user → school_users → memberships → school using the existing active-school mapping policy. Lock selected identity/membership/school rows; do not conflate the three IDs.
3. Select one school/class/session/term source scope with a positive revision.
4. Load the actual student, full student/session enrollment set, mapped active class/level/section, exact session/term dates and current actor's class assignments. Invoke the tested persisted-placement mapper; no session version, term ordinal or lifecycle state is fabricated.
5. Load the active subject roster and exactly one source version for the current scope revision.
6. Require an active subject catalog row and the exact pinned finalized configuration. Verify level, session, term, subject/default applicability and stored mode/document consistency, then validate components and grading through the persistence policy.
7. Teachers need a matching active teacher-subject link AND matching active class/session assignment for each roster subject. Admins do not need a teaching assignment to read.
8. Load the selected student's score rows without hiding a mismatched enrollment/config. Require exact pinned identities, positive versions, unique component keys, every required component and valid numeric-text/observation-key values.
9. Require one finalization at the exact scope/source/roster, joined to its exact teacher review. The current finalizer must be an active admin; the reviewer must currently be an active teacher with matching active class/session/subject permission. All selected authority rows are locked for the read.

The current authority recheck is intentionally conservative: staff suspension or assignment removal can make an old finalized source unavailable through this loader. Historical approval authority and published report access need a separate immutable audit/release policy; this loader must not become a guardian/public report endpoint by accident.

## Returned data and deliberate boundaries

The result is a **relational source bundle**, not a ready/publishable report. It preserves bounded numeric strings and observational text keys without changing the existing number-based result engine. It returns pinned config, score versions and review/finalization/source IDs. It does not trust stored grade/result payloads as calculated truth, recompute grades, validate canonical manifest/hash contents, create report snapshots, append workflow writes or enable publication.

A current source-version row and matching finalization prove relational binding only. The existing fixture manifests/results are minimal synthetic data and their hashes are not checked here. Canonical complete manifest provenance, exact recomputation and snapshot persistence remain required before using the bundle for real Report Cards.

Parent rows already read are protected against concurrent changes by row locks; covered source phantom inserts are blocked by the shared discovery gate. Parent insert ambiguity, complete membership/assignment mutation protocols, restricted roles, RLS and owner bypass resistance remain pending. The fixture owner can bypass guards; no production security boundary is established.

## Tests prepared

Seven new offline tests exercise gate-first reads and preserved decimal strings; no-identity/schema refusal; config pin/level/session/mode/state validation; enrollment/config/component score validation; required subject permission/source/finalization; early-years text keys; generic database errors. These use mocked SQL and never connect to a database.

Three new groups extend the same schema-faithful PostgreSQL harness after its twelve prior groups:

- Actual joined identity, enrollment, pinned config, decimal scores and current finalization/review/source read succeeds.
- Forged enrollment, wrong term, inactive subject permission and suspended finalizer are rejected.
- The read transaction blocks phantom enrollment and authority mutation; a later score edit invalidates the old finalized source.

The full expected offline suite is 250 tests and the expanded PostgreSQL suite has fifteen PASS groups. Locally, seven new reader tests, four guard-builder tests, 90 existing scoped domain tests, JavaScript syntax and whitespace checks passed. Full TypeScript/ESLint and all new PostgreSQL assertions require the user's installed environment/disposable database. No dependencies were installed and no SQL was executed by the assistant.

## Continue after verification

Next, build a projection/recalculation boundary from this relational bundle, including observational text keys, complete canonical source manifests and comparison with immutable finalized data. Reconcile source/workflow versions and real report snapshot bindings before composing a schema-faithful report writer. Continue automatically on passing local results under the user's standing authorization; no production schema/auth/database/deployment changes are implied.
