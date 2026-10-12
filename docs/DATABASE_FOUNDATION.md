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
