# Exact relational assessment recalculation — review boundary

The preceding source reader passed the user's full offline gate (251 tests) and all fifteen disposable PostgreSQL groups. The next pure module recalculates one subject from its pinned configuration and selected student's component scores. It imports relational types only; it does not query a database, authorize an actor or trust persisted totals/grades.

## Numeric policy v1

Each input decimal has at most four fractional digits, consistent with the proposed numeric(12,4) score representation and persistence validation. Primary uses numeric grading. Compute score / maximum × configured weight as exact BigInt rational values, reduce fractions while accumulating, and round the final sum once to two decimal places using half-up rounding. Return the total as a fixed two-decimal string; no binary float conversion is used for score calculations.

Choose grades using the rounded total. Sort bands by their lower bounds without mutating the configuration; lower bounds are inclusive and upper bounds exclusive, except 100 is included in the final band. Band bounds must also be exactly representable at four decimal places. For example, 69.9950 becomes 70.00 and enters a band beginning at 70. A missing optional component contributes zero; its weight is retained rather than redistributed. A missing required component rejects calculation. These choices are explicit review policy, not proof that every school has approved that grading convention.

Creche and Nursery retain configured observation keys, labels and remarks, in configuration component order. They have no numeric total or grade. Unknown keys, numeric values in observations, duplicates, unknown components, invalid versions and scores beyond maxima reject calculation.

## Validation and boundaries

Eight new pure tests cover decimal ties, grade endpoints, exact rational accumulation (two 1/3 contributions must produce 33.33 rather than separately rounded 33.34), optional absence, malformed scores/configurations, observational keys and row order. All 31 selected pure tests (including eight new recalculation tests) and tracked whitespace checks passed here. Full TypeScript/ESLint could not run here because project dependencies are absent. The expected full offline count is 259. Run `node scripts/verify-offline.mjs` in the installed environment; no new database run is necessary for this pure batch.

This module does not replace the existing number-based preview engine, authenticate its inputs, prove relational joins or compare immutable finalized payloads. The selected-student reader does not yet expose a complete scope-wide canonical manifest. Before report snapshots use these results, the next boundary must load and bind complete source identities/config revisions/placement, validate the actual canonical manifest and digest, and compare immutable finalized content. Do not hash this per-student result and mistake it for the existing scope-wide source version. Report publication and production wiring remain disabled.
