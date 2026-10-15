# Phase 4F.6 — Atomic deployment journal design (review only)

**Status: design and local implementation gate. No staging changes authorized.**

## Critical distinction

The successful Phase 4F.5 transaction rehearsed foundation + Auth FK + RLS/grants but did **not** create a Drizzle migration journal. The earlier migration-runner test exercised Drizzle's normal migrator and journal but did **not** atomically apply security. These two successes cannot be combined into a claim of one verified atomic deployment.

Running a 55-statement baseline with Drizzle, followed by a separate security migration, is **not** guaranteed atomic across both migrations. In an exposed Supabase `public` schema with broad default grants, this would risk an unsecured interval.

## Proposed mechanism

- Preserve the historical `drizzle/0000_broad_slayback.sql` and journal unchanged.
- Use a dedicated staging-only deployment transaction on one PostgreSQL connection. Within **one outer transaction**, apply the 55 ordered foundation statements, the approved `auth.users` FK, all 35 reviewed security statements, and the Drizzle-compatible journal entry **only after security checks pass**.
- The journal row must use the same migration SHA-256 and journal timestamp that Drizzle's migration reader expects, and the table structure/schema must be checked against the installed `drizzle-orm` version. Never fabricate an unverified journal row or silently mark unapplied migrations as complete.
- Failure injection must show that foundation objects, security objects **and the journal** all roll back.
- Verify committed behavior and rerun idempotence separately on a disposable local database, with no credentials in logs.
- Do not use the ordinary `npm run db:migrate` against staging; a reviewed staging-specific runner and explicit operator approval are required.

## Security and sequencing

Within the same transaction: foundation -> Auth FK -> ENABLE/FORCE RLS and revoke/grant/policies -> effective privilege assertions -> journal -> commit. The FK review document currently says to add the FK after security/bootstrap, while the consolidated RLS document assumes FK first. This order must be reconciled before staging execution; local rehearsals have used FK first. If any staging Auth/bootstrap constraint requires another sequence, rerun all tests against the revised order.

This design depends on real Supabase project privileges and transaction semantics. Review existing grants (including PUBLIC, default privileges and inherited roles), `auth.uid()`, Data API behavior, and server connection roles. Real JWT-backed and PostgREST tests remain required.

## Next acceptance gate

A new **local-only**, guard-railed rehearsal must demonstrate: (1) injected failure rolls back the journal as well as all 12 tables, (2) successful commit has 12 FORCE RLS tables, seven policies, Auth FK and exactly one matching Drizzle journal row, and (3) a subsequent Drizzle migrator run performs no baseline DDL. Until all three are observed, no remote deployment approval.
