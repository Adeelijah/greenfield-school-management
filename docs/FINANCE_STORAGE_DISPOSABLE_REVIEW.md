# Finance storage constraint rehearsal

The operator supplied all 865 offline checks passing for the finance policy foundation. This batch prepares ten finance relations plus eight minimal fictional parent relations in an exact generated `fi_it_<16 hex>` namespace. It does not install public/staging SQL, create roles, implement a verified finance command writer, or enable bursar saving.

## Storage candidate

| Relations | Enforced storage facts |
| --- | --- |
| finance_schedules / finance_schedule_versions / finance_schedule_items | One class/session/term schedule anchor, monotonically newer active version, immutable complete version/items, bounded exact integer-kobo total |
| finance_invoices / finance_invoice_lines | One initial invoice per school/enrollment/term, exact student/enrollment/class/session/term binding, pinned fee version/labels/amounts and complete line total |
| finance_payments / finance_receipts | Positive bounded NGN amount, same-school invoice/actor, valid received date, one matching original receipt, permanently reserved bank/POS reference |
| finance_reversals | One full reasoned ledger reversal per original payment, exact original receipt/amount, later posting version; original payment and receipt remain immutable |
| finance_audit / finance_operation_receipts | Exact actor/invoice/version/event links, contiguous invoice versions, required operation receipt and exact bounded JSONB outcome |

Deferred integrity checks permit one atomic coherent issuance/posting transaction, then reject missing items, invoice lines, receipts, audit or operation rows before commit. Each historical running payment balance must remain between zero and the pinned invoice total, including before later reversals. Eight history families deny UPDATE/DELETE/TRUNCATE at statement level, including zero-row mutations. Invoice facts stay frozen while the version advances by one; a schedule head may point only to a newer existing version. A new fee version cannot rewrite an issued invoice.

The SQL types store kobo as bigint; no floating-point money is used. Composite foreign keys enforce school/identity/amount/reference bindings. Human-readable receipt numbering, fee administration and live invoice issuance remain future workflows. The fixture uses owner-run direct statements to exercise constraints, not a client API.

## Explicit proof boundary

This is a generated, **minimal-parent storage fixture**, not the actual upgraded managed schema. It contains no SDK, role creation, grants, RLS, complete finance membership lookup, discovery gate or private posting API. An owner can insert actor-linked rows without proving current role; the harness's reversal actor is fictional and does not establish admin authorization. The pure finance kernel separately requires an admin for reversal. Those checks must later be enforced inside the complete authenticated transaction before any live use.

Historical retry behavior, version planning and role checks from the pure kernel are not PostgreSQL concurrency or restricted-role proof. A duplicate operation-key constraint and rollback test do not establish application replay. The next batch needs a complete admin/bursar authority boundary, real atomic command writer with copied closed requests and normalized fingerprints, parent/source coordination, exact-role/RLS/LOGIN privileges, independent-session races, authority loss before replay and an upgraded-schema rehearsal. Do not widen the existing academic helper to admit bursars or give finance access to academic/report history.

## Operator rehearsal

```powershell
git pull --ff-only origin report-cards-foundation
if ($LASTEXITCODE -ne 0) { throw "Git update failed" }
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-finance-storage-disposable.ps1
```

The wrapper runs the full offline verifier before asking for **local disposable** PostgreSQL credentials, sets only the explicit local disposable URL/confirmation and restores their previous values. It accepts localhost/127.0.0.1/IPv6 loopback and the named disposable database family without URL options. The harness refuses missing confirmation or a managed host before driver import. The local superuser is used only in the acknowledged generated schema; no roles are created and no existing table is modified.

The PostgreSQL workload creates a coherent fictional fee version/invoice with exact lines and issuance history; rejects substituted enrollment/changed totals/incomplete invoices; injects five outer transaction failures; rejects missing receipt/audit/operation rows and duplicate keys; checks overpayment and immutable history, full reversal/reference retention and a newer fee version preserving the old invoice. It compares snapshots after failed writes and original payment/receipt facts after reversal. Cleanup requires the exact generated schema and random acknowledgement, including installation-failure cleanup; it never adopts or removes an unacknowledged object.

Send bounded PASS/FAIL lines only. This command does not use any staging password or change Greenfield staging, its published report, attendance, scores or review history. No old empty-baseline staging harness should be rerun against populated staging.

## Authoring checks

Ten new pure composition/safety checks plus sixteen finance policy and 33 review regressions pass: **59 focused checks**. Expected full offline count: **875**. JavaScript syntax/import and whitespace checks are offline. No SQL parser, database connection, PostgreSQL execution, full compiler/lint run, managed installation, finance UI or browser result is claimed. The owner-run PostgreSQL groups above are prepared and require the operator command before claiming the storage candidate passed.
