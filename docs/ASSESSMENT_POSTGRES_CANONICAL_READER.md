# Complete canonical PostgreSQL reader — fixture only

The user confirmed all 272 offline tests passed for the canonical source policy. The preceding relational reader passed all fifteen disposable PostgreSQL groups. This batch connects those policies to complete schema-faithful SQL reads; the new database assertions have not yet run here.

## Two boundaries inside one caller-owned transaction

`loadFixtureCompleteAssessment` produces a validated **candidate** for materialization. It takes a generated `rc_it_` schema, class/session/term selectors and a server-owned verified identity callback. It does not accept school, actor, pupil lists, configs, revisions or score authority from the caller. It never connects by itself or loads application environment files.

The loader acquires the shared fixture discovery gate before reading identities/scopes, resolves the active membership/school, and requires the teacher's active class/session assignment before pupil data. It loads actual class/level/independent section/calendar rows, discovers all active class enrollments, then reads every active session enrollment for those students without hiding another-class conflicts. It locks the discovered students/enrollments, active subject roster, catalog and exact pinned config rows. Teacher-subject permission is checked before scores. It selects scores for every class student on every active roster without filtering away mismatched enrollment/config bindings. Typed field decoders reject scalar coercion; JSON configs are semantically checked by canonical materialization and the persistence/recalculation policies.

`readFixtureVerifiedCanonicalAssessment` adds the existing active reviewer/admin authority checks under the same transaction. It reuses the already-verified auth identity and the first discovered enrollment with the existing relational reader; that reader checks every active subject's exact source/review/finalization and locks the authority rows. This is deliberate reuse of the tested conservative authority policy, not fabricated identity or a new production auth integration. It then loads/decodes the complete current source, all finalizations for that source, and their exact referenced reviews; canonical content verification requires every subject and every enrolled pupil to match independent recalculation.

A candidate is not an approved result. The second boundary returns a verified fixture bundle and source version ID only after both content and authority pass. Neither function publishes reports, writes workflow state or changes the production schema. The existing reader remains unchanged except for exporting its selected-column decoder functions for reuse.

## Locking and limitations

Both APIs require an already-open transaction. Locks live until that caller's transaction ends. They are read-only and must not upgrade a shared discovery gate into an exclusive writer gate. The fixture harness's sealing helper takes the exclusive gate before any score mutation or candidate read, materializes the source, and inserts immutable source/review/finalization rows in one transaction.

The singleton gate serializes covered source writes and blocks enrollment/roster/scope phantoms. Row locks protect selected source, placement and authority records. Parent/authority insert ambiguity, complete parent mutation revision fan-out, owner bypass, restricted role privileges and production RLS are still pending. Changes to bound parent metadata can fail canonical comparison even where revision invalidation is not yet comprehensive. Do not use this fixture policy as guardian/public access or infer production security from it.

The complete reader requires a teacher's permission for every active subject in the scope. A teacher with only one subject assignment cannot obtain a complete class assessment bundle through this API. Historical staff suspension/assignment removal conservatively denies old finalized sources, as documented for the previous reader.

## Checks prepared

Ten new offline tests cover complete two-pupil loading, pre-finalization candidate reads, server-derived authority, visible enrollment conflicts, missing second-pupil scores, permission-before-score ordering, raw scalar decoding, JSONB payload/hash tampering, exact source/review identity and generic errors. All 54 selected pure tests, JavaScript syntax and tracked whitespace checks passed here. Full TypeScript/ESLint are pending in the installed environment; no dependencies were installed.

Four PostgreSQL groups extend `assessment-postgres-schema-integration.mjs` from fifteen to nineteen:

- Complete two-pupil scope materializes and round-trips source/finalization JSONB, including 69.9950 becoming 70.00.
- Minimal source manifests and forged results with recomputed attacker hashes fail; a later correct immutable version succeeds.
- Actual enrollment uniqueness remains enforced; removing a required second-pupil score fails, and transaction rollback restores the score/revision without poisoning the committed version.
- A verified read blocks second-pupil score edits, enrollment inserts and finalizer suspension; a later score edit invalidates the old source/finalization.

Run the full offline gate (expected 282 tests), then the opt-in disposable PostgreSQL harness (expected nineteen PASS groups). These new PostgreSQL groups are prepared, not assistant-executed. Existing minimal fixture manifests intentionally remain invalid for the new verifier; only newly sealed complete documents pass.

After both gates pass, reconcile the real report proposal's enrollment/source/snapshot references and immutable release bindings, then build the schema-faithful report writer on top of this complete provenance boundary. Keep grants/RLS, real server auth, routes and publication disconnected until their separate roadmap stages.
