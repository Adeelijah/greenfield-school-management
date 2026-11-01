# Assessment review and independent finalization in local staging

The operator confirmed all 827 offline tests, dedicated review password provisioning, strict TLS LOGIN, exact managed role graph, school RLS, bounded locking/history privileges and transaction role reset. No canonical review workload was written by that diagnostic. This batch connects the existing installed privileges to the real canonical writer and SDK-owned application boundary; it makes no schema, grant, policy, password or production changes.

## Transaction and authentication

The existing canonical transaction core now accepts only an issued SQL scope. Generated fixture wrappers still reject public and retain their separate operator/restricted contracts. The new managed issuer fixes public, the fictional staging school, assessment source gate and exact dedicated review LOGIN/runtime; a structurally identical caller object cannot substitute for an issued scope. Old report scopes still require their original report LOGIN/runtime. The shared writer selects the scope's gate before complete actor discovery and receipt access. It never promotes a service connection to an owner.

The SDK entry parses and copies a closed review/finalization command before asynchronous identity verification, permits only the two fixed fictional class/session/term selections and owns `auth.getUser()`. Only its verified auth UUID reaches the transaction. Complete private-helper membership, actor class/subject permissions and selected teacher-reviewer authority remain inside the locked writer, including historical replay. Admin finalization requires an independently authorized active teacher review pinned to the exact current canonical source. Bursar, hidden second active school, suspended/ended access, stale versions, incomplete sources and substituted reviews fail closed.

No browser-supplied manifest, calculated results, hashes, school, membership or role is accepted. Source/review/finalization/audit/receipt writes remain atomic, append-only and revision-preserving. Historical replay returns historical facts without restoring stale source documents or published snapshots. A separate lazy strict-CA TLS review pool reuses only physical transport; actor/catalog/role checks are fresh per transaction. It reads no default/owner/report URL.

## Current status and controls

Inside the existing locked complete-source read, the editor loads only source documents at that exact scope revision. A pure projection compares the canonical manifest and every displayed finalization result/hash/reference with recalculated current content, rejects ambiguous/mismatched rows and exposes only review/finalization identifiers and status. Missing current source yields awaiting-review status; older documents never become current by fallback. These are stored content statuses, not proof that older operator-seeded history was SDK-authored. The command writer rechecks current authority independently of status.

Teachers can submit their current subject review; admins can independently finalize the selected current review. The approved dropdowns, mobile score cards, forest action styling and skeleton geometry are retained. Draft score edits block review until saved or discarded by reloading. Pending actions lock inputs/selectors, prevent duplicate clicks, show accessible live messages and retain an exact copied command/key for uncertain retry. Success or a definitive rejection requires current-state reload before another action. Unavailable status disables review controls without inventing a successful state. Report snapshots remain immutable.

## Local launcher and browser gate

The new independent `-EnableAssessmentReviewWrites` switch prompts for the already-configured review LOGIN password and sets only its dedicated URL/sentinel. It defaults disabled and restores prior environment values on exit. It does not imply score, report or attendance enablement; those retain independent switches and passwords. Do not provision the review password again after the confirmed setup PASS.

After pulling and running `node .\scripts\verify-offline.mjs`, stop the previous Next process and run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-report-card-local-staging.ps1 -EnableTestWrites -EnableAttendanceWrites -EnableAssessmentScoreWrites -EnableAssessmentReviewWrites
```

Use the existing staging publishable key and four distinct existing dedicated database passwords when prompted. The launcher never needs staging postgres or the local disposable password. Open `http://127.0.0.1:3000/staging/login`.

Perform this combined fictional-data browser check:

1. Teacher: open Assessments / Primary 5. If the source is already finalized from seeded history, make a small valid fictional score correction with a reason and save. Complete **all intended subject score saves before reviewing any subject**: every save advances the shared class scope revision and stales earlier reviews/finalizations. Reload after each save.
2. Teacher: submit English and Mathematics reviews at the same final revision, reloading current state after each. Check pending messages, disabled duplicate controls, status after reload/refresh and mobile layout. No additional score save should occur between those reviews.
3. Admin: sign in separately, open the same class and independently finalize both reviewed subjects, reloading after each. Refresh to confirm both statuses. Repeat the observational Creche path when needed using the configured observation values rather than numeric totals.
4. Bursar: academic actions remain inaccessible. Teacher must have no enabled admin finalization control; the server rejects unauthorized direct requests independently of the UI.
5. Confirm the already-published report and print view retain their original snapshot. Do not withdraw, republish or replace it merely to test review. Attendance history and saved score values should remain unchanged by review/finalization.

Send any bounded error/timing lines and the observed role/status results. Do not paste passwords. A completed managed SDK/browser flow remains an operator gate; source tests and prior local SQL do not prove that managed flow has run.

## Verification

Twenty-two added offline checks cover SDK ownership and request copying, actual managed-scope canonical writer orchestration with controlled actor/candidate/SQL transports, safe scalar outcomes, independent finalization, current authority before replay, all persistence/outer rollback paths, strict TLS pool lifecycle, separate URL/flag policy, current canonical status/forgery rejection, closed UI builders and the actual gated editor wrapper. Existing fixture/operator public refusal, managed installer parity, score and attendance regressions remain green: 135 focused tests passed. Expected full offline total: 849. Authoring syntax/whitespace checks are recorded separately; no database connection/SQL execution, full TypeScript/ESLint run, Next render or browser visual sign-off occurred here. No dependencies were installed.
