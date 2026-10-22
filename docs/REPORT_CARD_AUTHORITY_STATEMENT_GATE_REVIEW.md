# Report authority statement gate review

Date: 2026-10-22. Status: unexecuted SQL review draft and prepared disposable tests. No production, Supabase or live authorization changes.

## Verified baseline

The user supplied 413 offline tests, all five standalone authority PostgreSQL groups, and all 61 main assessment/report PostgreSQL groups passing. Assignment-loss and suspended-membership historical receipt tests are verified in the main fixture. The complete authority draft and the full fixture writers remain separate implementations.

## Ordering problem and proposed correction

A BEFORE ROW membership trigger can acquire the actor anchor after PostgreSQL has already locked the target membership row. An authority reader acquires the actor anchor before membership locks. Opposite arrival orders can therefore deadlock even though reader-first timeout tests pass.

The draft now reserves the database-wide advisory namespace greenfield.report-card.authority-gate.v1. Both authority functions acquire a shared transaction-level gate before reading school-user, membership or school rows. A SECURITY DEFINER trigger function acquires its exclusive counterpart in BEFORE STATEMENT triggers on school_users, memberships, schools and teacher_class_assignments. The existing actor anchor and membership/school row locks remain. Truncation is rejected on all four authority families.

The conservative gate serializes authority writes across actors/schools while concurrent report transactions share it. It contains no user identity or authentication claims. Its owner stays NOLOGIN/NOBYPASSRLS with no client SET ROLE membership. Search path is pg_catalog, row_security remains on, all relation references stay schema-qualified, and direct helper execution is revoked from PUBLIC/anon/authenticated. Before installation, audit advisory-function privileges and existing policies/triggers; a schema draft is not deployed enforcement.

Do not mutate authority within a report transaction holding the shared gate. Existing application operations must follow the agreed order, including transactions that explicitly lock rows before DML and foreign-key/cascade paths. This change does not prove safety for arbitrary owner SQL or source-write/authority combinations. The main assessment fixture has a separate source discovery gate; their common acquisition order must be reviewed before wiring both adapters into one transaction. Performance and contention need isolated staging evaluation.

## Prepared evidence

Three additional offline contract tests cover shared acquisition before discovery, matching BEFORE STATEMENT coverage and safe trigger/revoke/truncate definitions. Full offline expectation rises from 413 to 416. All 23 selected authority/static/lifecycle tests passed here, including a CRLF SQL checkout; script syntax and scoped whitespace passed. Full installed TypeScript/ESLint/offline gate remains pending for this batch.

Three new standalone PostgreSQL groups prepare:

- Writer-first membership suspension blocks discovery before the actor anchor; later resolution sees committed suspension and reactivation.
- Writer-first auth-link update blocks discovery and rolls back without changing identity; a school configuration update commits and is seen by the next authority lookup.
- Reader-first authority plus assignment locks block assignment mutation and parent writes, including zero-row updates/deletes; later ending becomes visible, while all four table families reject truncate without losing rows.

Readiness is bounded, query statement/lock timeouts remain, holders are released/drained before exact cleanup, and intentional rollback is expected rather than counted as a workload error. Standalone expectation rises from five to eight PASS groups. No new SQL has been run by the assistant. Use the existing complete secure local disposable role-admin block with scripts/report-card-actor-authority-postgres-integration.mjs; the main 61-group harness needs no rerun solely for this draft change.

## Next gates

After both new gates pass: review combined source/authority order and runtime role mapping, then test actual verified request identity, the complete resolver and report writes together in isolation. Do not enable routes or claim real Supabase authentication from static checks or the private-runtime fixture's supplied auth ID. The no-argument auth.uid()-bound RPC is still not exercised by these local lock-function tests.

References: [PostgreSQL 18 trigger behavior](https://www.postgresql.org/docs/18/trigger-definition.html), [transaction advisory locks](https://www.postgresql.org/docs/18/explicit-locking.html), and [advisory lock functions](https://www.postgresql.org/docs/18/functions-admin.html).
