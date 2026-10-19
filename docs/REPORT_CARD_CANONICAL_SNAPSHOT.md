# Canonical report snapshot v1 — offline foundation

`canonicalizeReportSnapshot` produces a versioned canonical JSON string and SHA-256 hex digest from a source binding and assessment payload. It sorts object keys, sorts roster/source-version identifier sets, preserves meaningful assessment array order, and rejects unsupported values (including undefined, non-finite numbers, sparse arrays, cyclic structures, non-plain objects and getters). The function does not mutate input.

**Trust boundary:** The caller must obtain the source binding and full assessment payload from verified, school-scoped, finalized server data. This module does not authenticate, verify database ownership, validate individual grades, establish complete subject roster against authoritative assignments, or persist a snapshot. It cannot prevent a malicious caller from fabricating a plausible source binding.

**Format:** `greenfield.report-card.snapshot.v1`. A future format change requires an explicit version bump and compatibility tests. JSON number formatting follows JavaScript's `JSON.stringify` semantics; cross-language canonicalization is not guaranteed. Snapshot hashes are content-integrity identifiers, not digital signatures or proof of authorization.

**Outstanding production gates:** define the full typed academic payload and exact source-version schema; ensure source version identifiers encode the underlying revisions rather than arbitrary strings; validate source completeness and lock revision reads transactionally; decide decimal/rounding policy and Unicode normalization; bind stored snapshots to audit and releases; enforce append-only writes and RLS at PostgreSQL level. No database connection, migration, API route, parent access or publication is implemented.

Run `node .\\scripts\\verify-offline.mjs` locally to verify the added offline tests.
