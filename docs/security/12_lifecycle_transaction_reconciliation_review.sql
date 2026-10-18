-- REVIEW ONLY. Forward-only design notes; never execute this file.
-- Reconciles the Step 494 draft with the verified Step 496 in-memory contract.
-- PostgreSQL version, Drizzle migration transaction behavior, deployed schema,
-- role attributes and RLS policies remain unknown and require authorized review.

-- Stage 1: add the historical state required when an enrollment is superseded
-- by promotion, repetition, transfer, or exit. Confirm enum migration behavior
-- for the target PostgreSQL version before splitting/ordering migration files.
ALTER TYPE enrollment_status ADD VALUE 'completed';

-- Stage 2 (separate forward-only migration after the enum addition is usable):
-- student row_version is incremented for every lifecycle mutation and checked
-- against the command's expectedStudentVersion within the same transaction.
ALTER TABLE students
  ADD COLUMN row_version bigint NOT NULL DEFAULT 1 CHECK (row_version > 0);

-- One school-wide idempotency namespace covers enrollment, decisions,
-- departures and readmissions. Fingerprints are server-computed canonical
-- payload digests; do not accept them from clients. The result pointer is an
-- operation ID, not a client-supplied school or actor claim.
CREATE TABLE lifecycle_operations (
  id uuid PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES schools(id) ON DELETE RESTRICT,
  idempotency_key varchar(200) NOT NULL,
  operation_kind varchar(40) NOT NULL,
  payload_fingerprint varchar(128) NOT NULL,
  student_id uuid NOT NULL,
  actor_membership_id uuid NOT NULL,
  result_kind varchar(40) NOT NULL,
  result_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lifecycle_operations_school_key_uq UNIQUE (school_id, idempotency_key),
  CONSTRAINT lifecycle_operations_school_student_fk
    FOREIGN KEY (school_id, student_id) REFERENCES students(school_id, id) ON DELETE RESTRICT
);

-- Add an operation link to audit rows; the exact existing audit key/columns
-- must be reconciled against the approved Drizzle foundation before drafting
-- a concrete ALTER TABLE. Every finalized effect, operation row, and audit row
-- must commit or roll back together. Proposals are not finalized audit events.
-- Proposed invariant: UNIQUE (school_id, operation_id, action) where the
-- existing audit model permits it, plus a restrictive FK to lifecycle_operations.

-- Audit immutability proposal: application role receives INSERT/SELECT only
-- for lifecycle audit data, never UPDATE/DELETE/TRUNCATE. Add a database guard
-- against UPDATE/DELETE as defense in depth, owned by a non-runtime migration
-- role. Define retention, legal correction, and privileged-owner break-glass
-- procedures before approval. No claim of immutability against superusers.

-- Trusted role/context proposal (not executable grant instructions): a runtime
-- role must not own protected tables and must not have BYPASSRLS; browser roles
-- receive no lifecycle table grants. The trusted server resolves membership,
-- derives school_id, and calls a transaction adapter with verified context.
-- Do not treat a caller-settable GUC, request claim, or school_id parameter as
-- trusted tenant identity. RLS must bind to a database-verifiable context and
-- be tested with actual runtime roles before any application persistence.

-- Atomic lifecycle transaction proposal: begin; establish verified context;
-- lock school configuration, student, then source enrollment; check operation
-- key/fingerprint and expected row_version; load scoped rows and plan; apply
-- enrollment/decision/departure/readmission effects; increment row_version;
-- insert lifecycle_operations and linked immutable audit event; commit. Any
-- mismatch or failure rolls back all effects. Keep uniqueness/FKs as race
-- backstops. Replays return the recorded result; changed payload for a reused
-- school key is rejected. Cross-school references return a generic denial.

-- Do not add a completed-state backfill here. Review and map existing status
-- values per installation first; preserve unknown history and resolve legacy
-- withdrawals/graduations explicitly before any data migration is proposed.
