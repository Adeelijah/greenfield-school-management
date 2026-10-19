# Canonical assessment source and finalized-content policy — review only

The user verified the preceding exact recalculation batch: the full offline gate passed with 259 tests. The relational source reader had already passed fifteen disposable PostgreSQL groups.

`assessment-canonical-source.ts` defines versioned complete-scope source and subject-result documents. It performs pure validation and materialization; it does not query a database or enable publication. Inputs must be complete locked server-owned reads, never request data or the existing selected-student bundle.

## Source format

`greenfield.assessment.source.v1` binds the scope identity and revision; school final Primary year; class, independent level/section; actual session/term dates/current flags; complete active students and session enrollments; active subject catalog rows and versions; subject roster versions; pinned full configuration documents/revisions; and every score row ID, config, enrollment/student, component, value, version and updater membership ID.

Active session enrollments for the selected class students must be discovered before filtering by class so a second active enrollment in another class is rejected. The input contract excludes inactive enrollment history and inactive roster versions; their history remains in storage. It includes all active class students and subjects, even when the eventual report request concerns only one student. A caller that omits an entire student or subject can produce a different internally consistent document; this pure function cannot prove SQL discovery completeness. The next transaction-scoped SQL loader must supply and lock the complete sets and must not simply expand the current selected-student reader by trusting caller lists.

Sets sort by stable IDs, while meaningful arrays inside pinned configuration documents retain their order. Score decimals normalize to four-place database scale, so 86.12 and 86.1200 hash identically. Scope revisions, row IDs, catalog changes, config versions and score versions change the digest. Strict canonical JSON rejects nonfinite values, dates, unsupported values, sparse/decorated arrays and accessors. The shared snapshot serializer now also checks array element descriptors before reading values; ordinary existing snapshot JSON and hashes remain unchanged.

SHA-256 is computed over the canonical UTF-8 document. Source version IDs, review IDs and finalization IDs do not belong in this digest, avoiding circular dependence when materializing a source before review/finalization.

## Finalized format and comparison

For each active subject roster, `greenfield.assessment.results.v1` binds scope, source hash, roster/subject/config identity, calculation policy `exact-rational-half-up-2dp.v1`, and results freshly recalculated for every enrollment. The calculation policy is the preceding exact arithmetic module, including observational text without numeric totals.

Verification requires the stored source identity/revision, canonical document and hash to match fresh materialization. Every roster needs one finalization with an exact matching teacher review and source version. Finalizer/reviewer identities must be distinct. Stored result documents AND hashes must equal independently recomputed results; a forged total with an attacker-recomputed digest fails. JSONB object key order is immaterial; JSON strings containing encoded documents fail.

This is content verification, not authentication or an electronic signature. Current active reviewer/admin roles, teaching assignments and transaction locks remain a separate required authority check. The fixture owner's ability to alter/bypass guards is unchanged. Production RLS, least-privilege grants, immutable report snapshots and published/guardian access remain pending.

## Checks and continuation

Thirteen new pure tests cover complete two-student and multi-subject scopes, shared default config, canonical ordering, decimal scale, source/placement changes, incomplete scores, enrollment conflicts, forged hashes/results, review/finalization binding, observational output and getters. The expected full offline count is 272. All 44 selected pure tests and tracked whitespace checks passed here. Full TypeScript/ESLint require the installed project environment; no dependencies or SQL were installed/executed here.

After that gate passes, implement a schema-faithful transaction-scoped complete loader, decode all selected columns, and integrate content verification with actual immutable source/finalization JSONB in the disposable PostgreSQL harness. Existing synthetic minimal manifests must remain insufficient for the new verifier. No existing production data is to be backfilled or trusted automatically. Then reconcile enrollment and snapshot references for the schema-faithful report writer.
