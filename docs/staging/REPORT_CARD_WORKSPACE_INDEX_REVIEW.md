# Lightweight workflow index and measured actor-lock contention

## Evidence

Operator logs at f574a9a show successful workspace transactions with 59–64
queries, 29–40 seconds total and 23–30 seconds SQL time. One failure has SQLSTATE
55P03 at lock_report_card_actor. This identifies a lock timeout, not the holder
or a proven deadlock. The approved-result reader has 18 queries and 7.8–12 second
transactions. The printed result was inspected: one A4 page, correct 80/A and
90/A marks, no clipping and clear fictional test marking. Chrome's optional
headers/footers account for the date/title/localhost URL on that supplied print.

## Separate navigation data from result readiness

The workflow index no longer calls the full canonical academic reader. Its job
is to list active class pupils and existing report status, not certify that
results are complete. The summary now explicitly says subjects in roster and
states where result verification occurs. An empty/incomplete subject roster is
not silently promoted to ready; actual commands still reject invalid sources.

Current SDK verification, exact app LOGIN/runtime catalog checks, complete actor
resolution, school pin, source gate and exclusive actor anchor remain unchanged.
Teacher assignment must be exactly one active class/session assignment before
scope or pupil discovery. Admins need no teacher assignment; bursars still have
no academic authority. No authority cache or stale-auth reuse is introduced.

A single locked metadata join binds scope/class/level/section/session/term to
the fixed school and verifies active structure, configured Primary progression,
valid dates and term/session containment. The roster query reads only IDs/counts.
All active session enrollments for the discovered pupils are loaded, including
conflicting other-class placements; duplicate/foreign/inactive data fails closed.
Labels and active report releases remain complete school-scoped batches, with
exact pupil/report binding and active-release uniqueness checks.

For a three-pupil/three-report teacher fixture the index issues seven data queries
after authority resolution. The test asserts this bound and proves there are no
assessment-score/source/finalization queries. The full runtime adds its original
login/catalog/role/source/actor/session checks (roughly 14–15 measured-port calls
with an existing report; actual operator timing is authoritative). The purpose
is fewer network round trips while holding the actor anchor, not a longer timeout.
Class navigation links also disable prefetch to avoid unsolicited locking reads.

Submit/approve/publish writers, their canonical academic verification and audit/
receipt/release rules are not modified. The approved/printed result reader still
reconstructs and verifies immutable original content. Readiness and result
verification have not been replaced by the index's lighter metadata checks.
Historical published results can now remain navigable even if current academic
content becomes incomplete; they still require the original immutable evidence
and current requester authorization in the dedicated result reader.

## Validation and operator check

64 focused offline tests pass. New negative cases cover inactive/ambiguous
assignment, 15 malformed/foreign scope variants, session/class duplicate placement,
inactive/foreign pupil labels and invalid rosters. The existing command, runtime,
approved-result, correction and content-forgery tests remain in the focused run.
The expected full verifier total is 610 tests; the installed run is authoritative.
Full TypeScript, ESLint, Next/browser and live SQL validation are not run here.
No database connection, SQL execution, new dependencies, schema/security changes
or deployment occurred during preparation. Existing dirty checkout is preserved.

Pull, run verify-offline, then restart the existing read-only local launcher.
Load Primary 5 as teacher and admin, then open the existing published pupil result.
Capture Greenfield staging timing lines and any 55P03/read failure. Compare query
counts before claiming a measured latency or contention improvement. Existing
report history remains intact; do not rerun the empty-baseline rollback harness.

If contention persists, docs/staging/REPORT_CARD_LOCK_OBSERVATION.review.sql is a
read-only operator observation while a request is waiting. It returns backend
IDs, login roles, wait states, transaction age and blocking backend IDs, never
query text or parameters. It does not terminate sessions, grant privileges or
change locks/timeouts. Provider visibility restrictions must remain unchanged.
