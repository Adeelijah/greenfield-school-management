# Restricted finance posting rehearsal

The operator passed the seven finance storage PostgreSQL checks on `20096d5`, including exact schedule and enrollment binding, rollback, overpayment, immutable history, one-way reversal and acknowledged cleanup. The next candidate executes payment and reversal through one private PostgreSQL function. Invoice issuance and fee setup are still performed only by the fictional fixture seeder.

The TypeScript adapter copies and normalizes a closed command before awaiting the trusted identity callback. It requires the exact generated login before switching to the exact worker using `SET LOCAL ROLE`. The worker receives schema usage and execution of the one finance function, with no table privileges. The owner is a distinct, non-login role under forced RLS and receives fixture reads, inserts to the five posting/history tables and only the invoice version column for updates. The scoped integrity trigger runs as that owner so deferred checks can still read the ledger when the outer caller commits.

The private routine independently checks input shape, dates and exact kobo amounts. In a read-committed transaction it acquires a generated transaction-level discovery lock before counting the complete active membership set. Parent and finance mutations take the same lock before touching rows. Only one active membership, a current admin/bursar role and a same-school invoice can reach the receipt lookup. Reversal requires admin authority even on replay. Identical normalized payloads return the original result; changed payloads, stale versions, overpayment and reused school-wide bank references are rejected. Payment or reversal, receipt where applicable, invoice version, audit and operation receipt commit together. The original receipt and bank reference survive reversal.

The local rehearsal is prepared to check two different backend sessions, direct-access denial, cross-school and ambiguous/suspended membership denial, a blocked replay across suspension, one applied result under a same-key race, a stale-version race, five injected write failures, an outer rollback and admin-only reversal. Cleanup checks the exact marker on the generated schema and all three generated roles before removing them. It requires PostgreSQL 16 or newer and the explicitly confirmed local disposable database.

```powershell
git pull --ff-only origin report-cards-foundation
if ($LASTEXITCODE -ne 0) { throw "Git update failed" }
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-finance-posting-disposable.ps1
```

The wrapper runs the full offline verifier before requesting local PostgreSQL credentials. Expected offline total: 887. Authoring passed 71 focused checks; this new PostgreSQL rehearsal has not yet been run. This is a minimal-parent fixture with a trusted UUID callback, no SDK session, no managed installation and no live finance UI. Its fixture-wide lock is intentionally coarse; integration with the upgraded schema and its existing parent locks, live issuance and SDK authority remain separate work.
