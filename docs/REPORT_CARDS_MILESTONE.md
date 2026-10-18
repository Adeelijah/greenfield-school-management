# Report Cards & Student Results — offline foundation

This milestone introduces `src/lib/academics/report-cards.ts`, a pure projection based on the existing `prepareResults` assessment engine.

## Implemented

- A request is bound to a matching school, active class, session, term and active enrollment.
- Subject rows derive from active, school-owned subjects assigned to the class.
- Missing configuration or scores remain explicitly incomplete; no grade is fabricated.
- Numeric and observational grades retain the assessment engine's existing interpretation.
- A card is `ready_for_review` only when every included subject is complete and finalized.
- `publishable` is always `false`; there is no approval/publication authorization.

## Deliberately excluded

No student names, teacher remarks, attendance summaries, printable template, parent portal, persisted reports, approval events, publication versions, Supabase calls, database schema changes or SQL execution. These require additional design and authorization decisions.

## Next steps

1. Add isolated pure tests for tenant mismatches, inactive enrollments, missing scores, finalized numeric results, and Creche observations.
2. Build a fictional, mobile-responsive report-card preview using the accepted Greenfield design baseline.
3. Define a separate, reviewable admin approval and immutable publication contract before any server integration.
4. Run `node .\\scripts\\verify-offline.mjs` and browser QA before declaring the milestone verified.

**Status:** Source committed on `report-cards-foundation`; offline tests and browser QA have not been run for this slice. The draft does not authorize publication.
