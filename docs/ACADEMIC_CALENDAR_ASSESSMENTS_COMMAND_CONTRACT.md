# Academic calendar, assessment and results command contract

This document describes the offline-only application foundation in `src/lib/academics/calendar-assessments.ts`. It does not describe applied schema, database transactions, live authorization or persisted records. All current UI data is fictional and memory-only.

## Calendar operations

`planCalendarCommand` accepts a calendar snapshot, a trusted actor projection, a typed command, and a trusted operation timestamp. The actor must be an active school admin whose school matches the snapshot. The command does not carry an authoritative role or school claim. A future adapter must obtain membership and school from verified server context and load records under that school before invoking the planner.

Session creation requires unique school-scoped session and term identifiers, a valid non-overlapping session interval, exactly one of each term number (1–3), ordered dates inside the session, and no overlapping term intervals. Session updates use global and per-session expected versions and cannot move session boundaries past existing term dates. Calendar events are session and optionally term scoped; dates must fit their selected interval. Same-kind overlapping events are rejected. Event edits and cancellations use event versions. Successful changes return a new snapshot and audit contract; the caller is responsible for committing both atomically in a future adapter.

## Assessment and grading

Configurations are scoped to a school, level, term, and optionally subject. A numeric or observational grading method is selected by the school. Numeric component weights must sum to 100; maximum scores and weights must be positive. Numeric bands must cover 0–100 continuously with neither gaps nor overlaps. Boundaries are lower-inclusive and upper-exclusive, except the final band includes 100. Observational assessments produce descriptive component labels without a numeric total.

Eligible rosters derive from active enrollments in the selected school, session, and class and require an active related class, term, subject and session. Current enrollment collisions across classes in one session fail closed. Only Creche, Nursery and Primary levels are accepted. Teachers may enter or review only classes, sessions and subjects present in trusted active assignments. Admins may configure and finalize; bursars are excluded. Teacher review is required before admin finalization.

Scores are constrained to configured maximums (or configured observational levels), unique by student and component in a command, and bound to school/class/session/term/subject. Required missing scores block teacher review and finalization. An assigned teacher records review through a separate authorized command; the resulting school-scoped review record binds reviewer membership, scope, source snapshot version and configuration version. Admin finalization requires that current version-bound review record, so a client boolean cannot attest that review occurred. Numeric result totals use `score / maximum × weight`, summed and rounded to two decimals, then mapped through the configured grade bands. Finalization uses snapshot/config versions, prevents changes to finalized result scopes, and emits an audit contract with result count. No report card is published.

`commandFingerprint` provides a canonical object-key ordering for future idempotency records. The pure planner accepts a previously stored fingerprint and audit for replay detection; it does not itself store or durably enforce idempotency. Expected global/config/session/event versions are preconditions, not substitutes for transaction locks or database uniqueness.

## Adapter and persistence boundary

A future server adapter must:

1. Derive the actor and school from verified authentication and active membership; never accept client school or role claims as authority.
2. Load the school-scoped session, terms, assignments, subjects, class, active enrollments, configuration, and current score versions using a reviewed least-privilege DB role and RLS policies.
3. Invoke these pure planners and return typed failures without disclosing cross-school records.
4. In one transaction, recheck versions and assignment/enrollment scope, apply changes, store idempotency key plus fingerprint, append immutable teacher review records and the returned audit event. Use deterministic lock ordering by school, academic scope, class, subject and student IDs. Unique constraints should protect one active enrollment per student/session, one score per student/session/term/subject/component, and one accepted teacher review per score/config version.
5. Recalculate/finalize results from locked current state and refuse stale or partial writes. RLS/grants and authorization must be independently reviewed; this offline code is not a security boundary.

No production adapter, schema change, migration, SQL execution, authentication integration, result publication or browser QA is included in this milestone. Existing Drizzle session/term structures were not changed. A future projection maps `academic_sessions.label/startsOn/endsOn/isCurrent` to the planner's label/date/current fields; the planner's `upcoming/active/completed` display state must be derived by an explicitly approved calendar policy, because the table has no status column. `terms.name/startsOn/endsOn` maps to the term projection; the schema has no term number, so a trusted adapter must map accepted school term names/order to first, second and third and reject ambiguous names rather than infer from untrusted display text. Academic level IDs are opaque UUIDs: the adapter must include the trusted level `stage` and `primaryYear` projection and never infer stage from an ID string. Class `active` is derived from active level/section records because `classes` itself has no active flag. Subjects, classes, and enrollments remain school-scoped references. The final Primary 5/6 setting is orthogonal to calendar and assessment calculations.
