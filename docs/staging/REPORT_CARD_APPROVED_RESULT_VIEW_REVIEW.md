# Approved test results and staging request work

## Observed staging progress

The operator confirmed teacher/admin reads, bursar denial, class switching,
session refresh and sign-out. They also confirmed persistent browser creation,
submission, approval/publication and withdrawal/resubmission/reapproval/
republication for Fixture Pupil 1. The existing test report history must remain;
do not rerun the old empty-baseline rollback harness or reset fixture data.
These are supplied operator observations, not assistant-run browser QA.

## Reduced work without removing validation

The server action already calls revalidatePath after success. The client also
called router.refresh after receiving success, repeating the expensive locking
read. The client refresh effect is removed; successful action invalidation stays.
Names and active releases are now read in complete school-scoped batches rather
than one query per pupil/report. A three-pupil/three-report test verifies exactly
three detail queries; duplicate/missing labels and foreign releases still fail.
Canonical source verification, role checks, locks, receipts and writer code are
unchanged. No authority cache, longer lock timeout or permissive fallback is added.

The database adapter reports bounded query counts, SQL elapsed time, connection/
setup elapsed time and total transaction time in the local server terminal.
Failed outer transactions also report a bounded code. No raw SQL, parameters,
credentials, pupil rows or actor IDs are printed. callback_completed means the
callback completed; it is not an independent assertion that COMMIT succeeded.

No live before/after timing was measured here. No root cause is asserted for the
intermittent transaction_failed read. Duplicate locking reads are a plausible
contributor, not proof. Slow network round trips and full canonical discovery
remain; further optimization must use measured evidence and preserve authority.

## Approved result and print route

Approved/published pupil rows link to `/staging/report-cards/[reportId]` with
prefetch disabled. The same local-only gate, SSR verification, restricted LOGIN,
complete current actor refresh and source gate precede report reads. Teachers
need exactly one current class/session assignment and complete pinned subject
permissions. Bursars, ambiguous/suspended principals, withdrawn/draft reports and
foreign scope fail closed. Read-only launcher mode can view an approved report;
no new write flag or credential is needed.

The reader selects the snapshot matching the current approval version. It reads
the immutable original source manifest/finalizations/reviews rather than current
assessment scores, reconstructs the complete source and recalculates exact pupil
results. It rebuilds the approved snapshot, compares canonical payload/hash/source
versions, checks school/pupil/enrollment/scope/revision/version pins, exact approval
audit actor/time/version and the unique current release for a published report.
Rehashed forged results, substituted pupils, revoked releases and wrong snapshots
are denied. Only the selected pupil result reaches the page.

Current directory names and fixed fixture class labels are explicitly identified
as current metadata, not frozen approval facts. The result contains no staff
identity IDs or classmates' results. Numeric scores/grades stay numeric; early
years observations stay descriptive. No attendance or narrative remarks are
invented. Approved-but-unpublished and published copies have distinct labels.
All screen/print copies say TEST COPY / NOT AN OFFICIAL RESULT; guardian delivery
and official certification remain absent.

## Validation and next operator gate

60 focused offline tests passed, including canonical snapshot projection,
substitution/rehashed-forgery denial, real new reader with controlled SQL/SDK
transport, revoked and ended-assignment denial, complete teacher subject denial,
batched read count/integrity and the existing staging runtime/command tests.
The full installed allowlist is expected to contain 606 tests. Full TypeScript,
ESLint, Next build, local PowerShell and rendered/printed layout have not been
run in this runtime because project dependencies are unavailable. No database
connection, SQL execution, dependency installation or deployment occurred.

After pull and full offline verification, restart the existing local launcher
without EnableTestWrites. Sign in as admin/teacher, open Fixture Pupil 1's approved
result and inspect Print test copy at A4 and narrow/desktop widths. The known
unchanged fixture has English 80/A and Mathematics 90/A. Compare against the
actual stored result; never substitute these expected marks into the reader.
Check that no unrequested action or extra GET follows a successful action in a
separately authorized future write check. Capture only bounded timing/error lines
for latency comparison. Existing history and write permissions remain unchanged.
