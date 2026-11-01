# Finance foundation — offline policy candidate

The report/assessment staging browser milestone is operator-reported working after the dedicated review setup. The completion roadmap prioritizes fee management next. `src/lib/finance/finance.ts` prepares the first finance policy kernel; it is not a payment gateway, live bursar action, persistence adapter, database migration or completed finance module. No existing staging data/security or academic UI changes in this batch.

## Initial scope and money

Currency is NGN. All stored/calculated amounts are integer kobo, capped at 999,999,999,999 kobo per invoice/amount. Naira input must be decimal text with at most two decimal places. Parsing uses integer arithmetic rather than multiplying floating-point naira. Scientific notation, commas, negative values, fractional kobo, non-text values and amounts outside the bound are rejected. Formatting returns an exact two-decimal amount; presentation grouping/currency symbols remain UI concerns.

An invoice candidate copies the active fee schedule version and fee identifiers/labels/amounts for the exact active school/class/session enrollment and term. Stored invoice lines remain pinned when a schedule changes. Missing/duplicate fee items, invalid totals and cross-school/class/session substitutions reject. This helper does not issue an invoice to a database: unique invoice identity, issuance audit/idempotency, fee schedule administration and current academic structure checks are future transaction requirements.

Payments are manually recorded cash, bank transfer or POS entries against one invoice. Partial payment is allowed; overpayment is rejected. Bank/POS references are required, trimmed and reserved school-wide by method/reference even after reversal. Reference matching is case-sensitive; do not silently change provider reference semantics. Cash has no external reference requirement; independent legitimate cash entries remain distinct. The stable operation key prevents replay duplication, not semantic detection of two manually recorded cash payments under different keys. This initial one-invoice allocation policy excludes a single transfer split across siblings/invoices; allocation/credit balances, concessions, discounts, gateway confirmation, refunds, expenses and accounting exports are later work.

A payment plan binds one immutable payment and one receipt to the same invoice/school/amount, increments invoice version and includes audit and operation-receipt plans. Receipt identifiers are server-owned; human-readable sequential numbering is a future transactional concern. Receipts indicate a recorded payment, not independent bank settlement confirmation. Future UI must retain that distinction.

## Authority and history

| Operation | Admin | Bursar | Teacher |
| --- | --- | --- | --- |
| Prepare invoice from an approved active schedule | Allowed | Allowed | Denied |
| Record payment / issue matching receipt | Allowed | Allowed | Denied |
| Reverse an incorrect payment entry with reason | Allowed | Denied | Denied |
| Configure fee schedules | Future admin-only workflow | No permission implied | Denied |

Current complete authority requires one school-user identity, exactly one active membership, the exact school and an active admin/bursar role. It precedes historical operation-receipt replay. These are checks on supplied trusted evidence in a pure policy, not verified SDK or database authority. The academic actor helper intentionally rejects bursars and must not be widened or reused as finance authority. A separate complete finance lookup/lock boundary and dedicated least-privilege roles are required before live use; the existing staff presentation RPC is not a transaction authorization substitute.

New posting commands are closed shapes: no caller school, role, auth identity, totals, receipt IDs or audit fields. Decimal input is normalized before canonical command comparison. Same actor/key/exact command returns its historical bounded result, including after invoice version changes; changed-key payload reuse conflicts. Ambiguous/forged receipts fail closed. New commands require exact current version, valid server-trusted local date and unused server event IDs. An invoice balance is derived from exact pinned lines and scoped immutable ledger rows; foreign/duplicate/mismatched rows do not become a fabricated zero balance.

Admin correction appends one full reversal event with reason, retaining the original payment and receipt. A second reversal is denied. This is a ledger correction only; it does not execute a bank refund. The original transfer reference remains reserved. Partial refunds/reversals and restoration are not included.

## Persistence batch next

Prepare a reviewed schema/transaction candidate, then a generated local disposable PostgreSQL rehearsal before managed target inspection or installation:

1. Inspect actual current foundation/schema and business identifiers. Define fee schedule/version/items, invoice/lines, payment/receipt, one-way reversal, audit and actor/operation receipts without silently reusing unrelated legacy entities. Pin exact school/enrollment/class/session/term relationships and money bounds.
2. Derive all authority from owned SDK verification plus a complete current finance helper; acquire shared academic discovery coordination before parent/identity discovery, then actor, invoice and school-reference anchors in deterministic order. Recheck authority before replay. Retain financial history after pupil departure while denying lost staff authority.
3. Derive invoice amounts from locked approved schedule rows; never accept request totals. Enforce one initial invoice per enrollment/term policy, one receipt per payment, exact school FKs, school/method/reference uniqueness (including reversed history), once-only reversal, optimistic versions and immutable records. Invoice amendments/voiding need a separate reviewed workflow.
4. Apply invoice version, payment or reversal, matching receipt, audit and operation receipt atomically. Inject failures after each real write, reject receipt collisions without orphan state and prove same-key retry under two genuinely independent restricted LOGIN sessions. Pure plans do not demonstrate rollback or concurrency.
5. Rehearse role/RLS/owner isolation, hidden second memberships, suspended staff, teacher denial, duplicate/stale keys, parent mutation blocking, exact cleanup and unchanged report/score/attendance state. Only afterward prepare fixed managed target review/rollback/install and SDK/UI controls.

Existing published snapshots and attendance/score/review histories are outside finance write privileges. No financial metrics should display invented zero values or in-memory saves as persisted records. Continue the approved admin/bursar design system, pending/skeleton states and mobile controls when real data boundaries are ready. Production migration, merge and deployment still require separate authorization.

## Verification evidence

Sixteen new pure finance checks pass alongside 33 selected managed review regressions (49 focused). Coverage includes exact amounts/bounds, pinned schedule/enrollment copies, actor denial, closed command shapes, partial/full settlement, dates/overpayment, immutable receipt plans, normalized replay/conflicts, current authority before replay, school reference reservation, version/event collision, admin-only reversal and forged balance/history rejection. No real transaction, SDK finance session, database connection, SQL, full TypeScript/ESLint, new UI render or finance browser workflow was executed. Expected next full offline count is 865; the user's latest explicit full log was 827, followed by a broad working report for the subsequent browser batch, not a supplied 849-test log.
