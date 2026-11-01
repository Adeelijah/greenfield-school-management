# Teacher review and independent finalization candidate

The operator reports the staging app working after correcting the separate report LOGIN credential. Managed score installation and dedicated score runtime work remain distinct from teacher review/finalization. No new staging database work is in this batch; existing browser buttons stay disabled.

## Implemented candidate

The closed `review_subject` request contains only class/session/term/roster IDs, expected scope revision and an actor-scoped operation key. `finalize_subject` additionally selects the exact teacher review ID. Caller identities, school, review claims, canonical manifests, results and hashes are rejected. Input is copied and fingerprinted before asynchronous work.

The generated-schema-only PostgreSQL writer takes the EXCLUSIVE source discovery gate before the existing complete actor resolver, actor lock, current active class/calendar/roster, assignment and receipt discovery. Teacher review requires a current teacher/class/subject assignment; finalization requires a current admin. Historical receipts are considered only after current actor and target access checks, and exact changed fingerprints or cross-scope keys reject. A valid historical replay returns the original scalar IDs/revision without rematerializing a now-changed or incomplete source. It never restores a historical source as current.

New operations call the actual complete relational source loader and canonical materializer under that transaction. The current reader requires complete class data and the teacher's permission for the complete subject set; subset-only teacher loading is not implemented. The writer creates at most one immutable source document for the current revision or verifies existing JSON/hash against current relational content. It refuses to repair forged/mismatched stored sources. A teacher review binds its exact subject/source/actor. Admin finalization recalculates the canonical subject results server-side and requires the selected review on that exact current source, from a distinct currently active and uniquely scoped teacher with current class/subject permission. Equality of both membership and Auth principal is checked for independence.

Review and finalization append canonical history/audit/receipt records but do not change source revision or score values. Different keys cannot overwrite an existing teacher review or finalized subject. Repeated same-key operations replay the original record. Every source/review/finalization/audit/receipt write belongs to the outer transaction; denial, storage failure or thrown post-write rejection rolls everything back. Existing published snapshots are not mutated.

## Combined disposable rehearsal

The existing upgraded local report workload now calls this actual writer to create its canonical source/review/finalization instead of inserting those documents directly as seed data. Existing restricted report-reader/command tests then consume the produced source. The new probe checks wrong actor roles, stale keys, exact apply/replay, all source/review/finalization/audit/receipt failure points and an outer failure. After the existing report workload changes a score and demonstrates stale-source behavior, the probe re-reviews/finalizes the new revision and checks canonical read recovery with old documents/snapshots preserved. The helper uses revision-specific operation keys.

The candidate review calls themselves run on the disposable fixture operator transport, with identity callbacks. This is **not** proof of a restricted review LOGIN/RLS design, real SDK identity, public API or browser review/finalization. Review-specific independent-session race tests remain part of the restricted-role rehearsal to follow. Existing downstream report reads/writes still use their independently restricted fixture LOGIN. No public namespace is accepted by the new writer, and no grants, roles, policies or installed function definitions are added or widened. The existing upgraded harness retains its exact generated-schema/role cleanup and local URL/confirmation gates.

From the repository root:

```powershell
git pull --ff-only origin report-cards-foundation
if ($LASTEXITCODE -ne 0) { throw 'Git update failed' }
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-assessment-review-disposable.ps1
```

The wrapper runs the complete offline gate before credentials. It requests the authorized **LOCAL** disposable PostgreSQL superuser/password, usually `postgres`, for `localhost/greenfield_report_cards_disposable`. Do not supply staging passwords. It restores prior process test environment on exit. Share the final PASS groups or error lines without credentials. No staging URL is accepted.

New SQL PASS groups describe actual upgraded review/finalization apply/replay, rollback/retry and changed-source recovery. A fixture failure must be corrected before preparing any managed restricted-role package. This is a single combined rehearsal, not separate manual SQL fragments.

## Authoring validation and remaining gates

Ten request/writer tests run the real transaction writer and actual canonical materializer with controlled actor/source-loader/SQL transports. Four probe/scope/wrapper checks verify safe integration. The UI/score/projection regression suites bring focused authoring checks to 68 passes. Expected full offline count is 781. Syntax/type stripping occurs through actual test imports; no full TypeScript/ESLint/Next or PostgreSQL execution is claimed from this dependency-limited source snapshot.

Next after operator SQL PASS: design/rehearse least-privilege review/finalization execution roles with complete-authority source reads, then target-specific managed rollback/install, SDK-owned server actions and pending/retry UI. Existing report and attendance service privileges must remain unchanged. Current score private-owner privileges must not be broadened into a generic raw canonical-document writer. Authenticated browser review/finalization and performance remain launch gates.
