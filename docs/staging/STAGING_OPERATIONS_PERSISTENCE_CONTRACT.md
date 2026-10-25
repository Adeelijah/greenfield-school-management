# Attendance / assessment persistence extension — review checkpoint

## Confirmed current boundary

The installed public schema contains assessment source/configuration/score/review/finalization tables and source/authority invalidation guards, but the application runtime is intentionally denied academic mutation. There is no attendance relation in the current journal/schema. Existing attendance rules and calendar/assessment commands are pure policies and preview implementations, not durable adapters. The new attendance/assessment account pages therefore expose verified read data and browser-only draft validation; Save/Review/Finalize are disabled. This is not completion of Batch 2's persistent workflows.

## Attendance storage contract to implement

Four school-scoped relations are needed: a class/session/date register anchor with optimistic version; student/enrollment marks; append-only audit; and actor/operation-key receipts. Register uniqueness is `(school, class, session, date)`. A mark binds exact register, school, student, enrollment, class, session and date; `(school, student, date)` is unique across classes. An attendance correction updates the same register with expected version rather than creating duplicate daily marks. Historical enrollment identity and correction-reason policy must be enforced by the durable writer before it is enabled.

Every operation must derive the current actor from the verified server boundary, acquire the discovery/authority barrier before discovering roster rows, validate current class assignment, and lock the daily register anchor before examining an idempotency receipt. New operations require an exact roster and valid session-contained calendar date, one mark per pupil and one of present/absent/late/excused. Server time is trusted; browser validation is advisory. The owning transaction must atomically apply mark/register changes, increment version, append audit and store receipt. Any failure must roll back all four. Receipt uniqueness must be school/actor scoped. Existing actors lose replay access after suspension/assignment loss. Complete identical requests replay their stored outcome; key reuse with a different fingerprint fails. No caller role/school claim is accepted.

`src/lib/attendance/staging-attendance-command.ts` defines the closed command and transaction port. Its fake transaction tests demonstrate policy sequencing, rollback expectation and replay behavior, not PostgreSQL enforcement. No server save route or memory-backed live persistence is exposed. Before connecting this port, a durable implementation needs exact metadata/FKs, statement-before-row locks, immutable audit/receipt guards, restricted role/RLS, managed ownership-transfer cleanup, and concurrency/rollback tests under distinct restricted SQL sessions.

## Assessment writer contract to implement

Use a separate reviewed academic writer boundary; do not grant UPDATE on source tables to the existing report runtime. It must acquire the exclusive source discovery gate before any read, resolve complete current actor authority and class/subject assignment, lock pinned roster/config/enrollment/score versions and use expected scope/score/config versions. Numeric scores must respect per-component maxima and weights; observational keys must belong to configured levels. School/session/term/enrollment relationships must be exact.

Teacher review is a separate immutable, version-bound event. Admin finalization requires a current complete source and that review; it must reconstruct the canonical source and pupil calculations inside the owning transaction rather than trust client totals, hashes or a review checkbox. Configurations referenced by finalizations remain immutable; correction uses new versions. Assessment mutation invalidates exactly the affected source scopes once per owning transaction. It must never rewrite or delete approved report snapshots/releases. Source materialization/review/finalization, audit and receipt must roll back together. Live academic edit cannot be declared safe from the existing owner/disposable SQL tests alone.

## Required proof before installation / enablement

Prepare one additive managed staging SQL package with catalog/ACL preflight, narrow new roles, RLS, operation guards and cleanup. Rehearse rollback on generated disposable schema first, then exercise actual restricted-login save/replay, stale concurrent edits, membership/assignment loss, grade boundaries, Creche observations, source invalidation and immutable publication history. Preserve the operator's current published fixture. No schema/grants were changed for the read/draft pages, and there is no approved executable installer in this milestone. Do not run older empty-baseline report harnesses or grant broad DML to make the Save buttons work.

## Durable attendance candidate prepared

`ATTENDANCE_DURABLE_FIXTURE_REVIEW.md` now documents the four-table SQL save candidate, fixture-only transaction adapter, isolated-role/RLS guards and opt-in distinct-session rehearsal. The pure command bounds now match PostgreSQL integer storage; first saves have no correction reason, later saves require one. Historical replay checks current authority before returning the immutable receipt, while changed/new requests still require the exact current roster. This candidate has no public-schema installer or live save route; the managed staging and assessment requirements above still apply.

## Base attendance SQL proof passed; upgrade/LOGIN integration prepared

The operator has now passed all 665 offline checks and the full original attendance PostgreSQL rehearsal, including final effective privilege/history probes and exact cleanup. The next coordinated candidate is documented in `ATTENDANCE_UPGRADED_LOGIN_REVIEW.md`: actual foundation composite keys, the existing coordinated source gate, separate attendance ownership/execution, saved history and a generated unprivileged LOGIN with distinct backends. The new upgraded rehearsal is not yet database-proven. It supplies no public-schema installer and does not enable Save; real managed auth/service-role and UI integration remain pending.

## Upgraded attendance LOGIN proof passed; managed target review next

The operator passed all 675 offline checks and the upgraded attendance PostgreSQL rehearsal, including real independent unprivileged LOGINs, saved correction history, source/parent coordination and cleanup. `ATTENDANCE_MANAGED_INSTALLATION_PLAN.md` selects a separate attendance LOGIN/runtime/private owner so the existing report LOGIN memberships remain unchanged. `ATTENDANCE_STAGING_TARGET_READ_ONLY.sql` collects the focused current staging catalog/role/report baseline needed before preparing an additive managed installer. It changes nothing and does not enable Save; real identity/managed installation and persisted UI remain outstanding.
