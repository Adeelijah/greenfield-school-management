# Greenfield Academy — database foundation

## Scope
This is a **schema draft**, not a live database integration. No migrations have been generated or applied.

Initial entities: schools, users, memberships, academic sessions, terms, classes, students, guardians, student-guardian relationships, enrollments, admissions, and audit events.

## Setup
1. Provision a dedicated PostgreSQL database for a development school.
2. Copy `.env.example` to `.env.local` and replace placeholders with your own credentials.
3. Run `npm install`, `npm run typecheck`, and `npm run db:generate` to inspect generated SQL.
4. **Do not run `db:migrate` yet.** Review the schema, cross-school integrity constraints, auth integration, role enforcement, and migration SQL first.

## Security blockers before real data
- Authenticate requests server-side with verified Supabase Auth sessions.
- Resolve active school membership on the server for every request.
- Enforce authorization and tenant isolation at the database level, including RLS if applicable.
- Enforce school-consistent references: a school cannot link its pupil to another school's class, guardian, term, or enrollment.
- Create a safe first-admin provisioning process, audit mutation events, backups and restore tests.
- Protect PII and limit access to pupil/guardian details.
- The current schema is **not sufficient for production data**.
- Keep separate databases and deployments for each school; `schoolId` columns provide additional scoping but are not a substitute for database isolation.

## Design choices
- Academic sessions and terms are stored explicitly rather than hard-coded in the header.
- Enrollment is tied to student + session, preserving historic class assignments.
- Guardians and students have a many-to-many relationship.
- Audit events are append-only by application convention; database enforcement is still pending.


## Integrity hardening (October 2026)
- Composite foreign keys bind enrollments to a student, class, and session **in the same school**.
- Student/guardian links must share a school, and requested admission classes must belong to that school.
- Terms must reference a session in the same school.
- Session/term date ranges must be non-reversed.
- Partial unique indexes permit at most one current academic session and one current term per school.
- A term falling *within* the session dates is **not yet enforced**; this needs a database trigger or transaction-level validation.
- The current administrator/teacher/bursar enum is only a data model, **not** enforced authorization.
- Row Level Security, database grants, user provisioning, school-scoped authorization, and a safe bootstrap flow are **not implemented**. No school records should be entered until these are in place.

### Regenerating the unapplied initial migration
Only if the original migration has **never been applied** to any database:
1. Keep the generated `drizzle/` directory out of commits until review.
2. After pulling the updated schema, run `npm run typecheck`.
3. Delete the local `drizzle/` directory (only the generated initial migration and metadata) and run `npm run db:generate`.
4. Inspect the new SQL for composite foreign keys, partial unique indexes and date checks.
5. **Do not execute `npm run db:migrate` or paste the SQL into Supabase** until RLS and privileges have been designed and reviewed.
