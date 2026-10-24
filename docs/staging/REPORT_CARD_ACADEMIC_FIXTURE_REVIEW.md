# Fictional staging academics — prepared for approval

Target only: hweoqkbgmzycyznrbvng, school 0c594571-74c5-46fe-a835-a9b217a3a199. The operator reports the school row and all three account links created, followed by four passing live Supabase JS sign-in/getUser/actor-RPC checks: admin/teacher resolve exact memberships, bursar receives no academic authority and anonymous RPC is permission-denied. Each test session closed. This is real operator-run SDK evidence, not a browser/Next SSR cookie proof. Application remains disabled. Credentials and real Auth IDs are not committed to this repository.

## Proposed test data

These defaults are **fictional fixtures**, not this school's real calendar, curriculum, grading policy or student data. They require explicit staging-data approval before SQL execution.

| Calendar | Starts | Ends |
| --- | --- | --- |
| TEST 2026/27 | 2026-09-01 | 2027-07-31 |
| TEST Term 1 | 2026-09-01 | 2026-12-18 |
| TEST Term 2 | 2027-01-11 | 2027-04-09 |
| TEST Term 3 | 2027-05-03 | 2027-07-23 |

The session and Term 1 are marked current for testing; these flags do not follow the real clock. Eight ordered levels: Creche, Nursery 1, Nursery 2, Primary 1–5. Each gets its own independent section A and a class named TEST <level> A. The school structure version changes once from 0 to 1.

The existing fictional teacher receives **two** active class/session assignments: TEST Primary 5 A and TEST Creche A. Subject permissions are limited to Mathematics/English in Primary 5 and Early Development in Creche. The other six classes have no teacher assignment or assessment roster. Admin/teacher/bursar memberships are verified against the supplied Auth and school-user IDs before writes; bursar academic access remains denied.

| Item | Count |
| --- | ---: |
| Academic session / terms | 1 / 3 |
| Levels / independent sections / classes | 8 / 8 / 8 |
| Teacher class assignments | 2 |
| Test subject catalog records | 3 |
| Frozen test configuration versions | 2 |
| Fictional pupils / active enrollments | 4 / 4 |
| Term-1 assessment scopes / subject rosters | 2 / 3 |
| Teacher-subject links / sample score rows | 3 / 13 |

Three pupils belong to Primary 5 A; one belongs to Creche A. Their names/admission numbers are explicitly Fixture/Test labels, dates of birth are NULL and there are no guardian/contact records.

Primary 5 has CA maximum/weight 40 and Exam maximum/weight 60. Test bands are D [0,50), C [50,60), B [60,70), A [70,100], using the existing exact arithmetic policy. The shared default config covers the two test subjects. Creche has one descriptive development component and three rubric keys: emerging, developing, consistent. Both configuration rows are finalized/frozen; this does **not** finalize pupil assessment results.

| Primary pupil | Mathematics | English |
| --- | --- | --- |
| TEST-P5-001 | 90.00 / A | 80.00 / A |
| TEST-P5-002 | 66.00 / B | 55.00 / C |
| TEST-P5-003 | 40.00 / D | 44.00 / D |

The Creche result is Developing, without a numeric total. Sample score rows reference the fictional teacher as their fixture author; they are operator-seeded examples, not evidence of real teacher score entry. The bootstrap audit has NULL school-user actor rather than impersonating an admin. No teacher reviews, assessment source versions/finalizations, reports, snapshots or releases are inserted. Those workflows remain separate checks.

## Generator and transaction

scripts/lib/report-card-staging-academic-fixture-review.mjs is a pure planner using the existing calendar validation, assessment persistence validation and complete canonical source materializer. It has no driver, environment or connection. It rejects foreign targets, malformed/overlapping actor identifiers, and unknown configuration options. Stable school-namespaced UUIDs and deterministic SQL/hashes allow exact comparison. Private actor IDs are supplied only when producing the operator's artifact.

One transaction acquires the installed exclusive source gate then authority advisory lock before discovery. It requires empty academic/report tables for this school, verifies all three active principal bindings, advances structure_version before creating scopes, and creates parents/enrollments before scope/roster/score writes. All existing source/history/RLS guards remain active. Scope creation and later writes share the existing transaction claim, so both scopes are expected to finish at revision 2; a different revision fails the transaction. The seed inserts 64 academic rows and one bootstrap audit event.

A repeat uses the audit marker and compares every planned field, exact configuration JSON, scoped row counts and structure version. It performs no UPDATE or INSERT on an exact retry. Conflicting, partially seeded or later edited fixtures are rejected, never adopted, repaired or overwritten. No schema, role, grant, policy, Auth identity, password, connection file or route changes occur.

Five new tests cover actual numeric/observational source materialization, deterministic identities and target/actor rejection, lock/insertion/retry protocol, domain rejection of missing/out-of-range/unknown observations, and rollback-before-identical-apply ordering. Text/domain checks do not prove PostgreSQL execution, live source discovery or a real command endpoint. The complete private SQL is prepared for review, not applied by the assistant.

## One approved rehearsal-and-apply batch

The delivered SQL uses prepareStagingAcademicRehearsalAndApply(plan). Inside one outer transaction it runs the exact fixture body beneath a savepoint, rolls back to that savepoint, verifies that fresh academic tables/structure version were restored and that no revision claim for either scope remains in this transaction, then runs the identical fixture body and commits. On an exact retry of an already present fixture, both runs only verify the immutable planned rows and counts; no setup rows are written. A failure aborts the SQL Editor batch before outer COMMIT. Run the file as one batch; if SQL Editor reports any error, explicitly run ROLLBACK and preserve the error. Approval is requested for this combined rehearsal and staging fixture load, rather than separate confirmation after the savepoint rehearsal.

Validation: five new fixture checks and 65 related controlled/pure checks passed (70 distinct checks). No SQL connection/execution, dependency install or TypeScript edits occurred. The expanded installed offline allowlist has 78 files and an expected 579 tests; the complete installed TypeScript/ESLint/metadata gate is not claimed locally. The actual savepoint restoration and PostgreSQL constraints will be tested only by the approved operator-run batch.
