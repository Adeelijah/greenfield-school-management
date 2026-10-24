# Local staging report interface — review and browser gate

The operator's live rollback harness passed all seven staging commands, bounded
role denials, failure injection/retry/replay, immutable correction history and
complete outer rollback. Source documents and reviews/finalizations are still
operator-seeded fictional records, not evidence of staff academic review.
TLS verification and the dedicated app LOGIN were separately verified by the
operator. These are supplied execution results; this change performed no SQL.

## Implemented

- `/staging/login`: existing Supabase SSR cookie adapter with verified getUser,
  fixed redirect, local sign-out and no role switcher.
- `/staging/report-cards`: separate current-authority read and report controls,
  never the in-memory preview or ordinary dashboard/direct database adapter.
- The proxy refreshes request and response cookies, preserves those cookies on
  its fixed redirects and sends private/no-store responses. Page/command identity
  is independently checked on the server; browser visibility is not authority.
- Every read uses the exact restricted LOGIN/runtime role, complete actor lock,
  assignment check and full canonical source verification in one transaction.
  Conflicting enrollments, missing sources, substituted reports and duplicate live
  releases fail closed. Safe page data excludes credentials and actor identifiers.
- Commands use the existing real server entry and transaction boundary. Closed
  FormData decoding rejects authority injection, duplicate fields, files and
  invalid versions. One server-issued intent key per form survives safe retries.
  Successful actions refresh current state; failures expose bounded messages.
- All seven actions have appropriate role/stage controls. Return/withdraw require
  reasons; publish/withdraw also have browser confirmation checkboxes. Authorization
  remains in the existing transaction writers, independent of those UI checks.
- No new dependencies, schema/grant/RLS changes, normal-login changes, hosted
  deployment or production enablement. The old memory preview is untouched.

The local UI requires development mode, the exact staging URL, a public API key
and `GREENFIELD_STAGING_UI=LOCAL_STAGING_REPORTS_ONLY`. Missing/foreign/production
configuration returns 404. A second flag, `GREENFIELD_STAGING_COMMANDS=
FICTIONAL_STAGING_WRITES_ONLY`, enables browser writes. The database URL must name
the exact dedicated app LOGIN/session pooler/database, with no URL overrides.
The CA file is supplied explicitly and certificate verification remains enabled.
There is no fallback to DATABASE_URL or operator credentials.

## Verification and limits

48 focused offline tests passed, including 15 new policy/framework/entry tests.
The new tests execute the actual actions, proxy and workspace functions with
controlled framework/SDK/SQL transports; they do not claim a real browser or
network request. Local runtime lacks installed project dependencies, so full
TypeScript, ESLint, Next build and rendered/browser QA remain unverified.
PowerShell launcher execution also remains unverified here.

The installed offline allowlist adds these 15 checks to the previous expected
579, for expected total 594 (the next actual full run is authoritative).
The launcher is opt-in and is never part of verify-offline.

## Read-only browser gate

After reviewing this source and passing verify-offline, the already restricted
LOGIN may be used to run the local read-only server:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-report-card-local-staging.ps1
```

It prompts only for a staging publishable/anon key and the existing app LOGIN
password, uses the downloaded CA file, binds to 127.0.0.1:3000 and writes no env
file. Normal database/owner credential variables get nonempty disabled sentinels in the child process
and restored on exit. Ordinary matched application paths redirect to staging.
Visit `/staging/login` on that local address. Nothing is hosted by this command.

Check in separate browser sessions:

1. Anonymous report request redirects to staging login; no report data appears.
2. Teacher login survives refresh and can see only assigned fixture scopes.
3. Admin sees both fixture scopes; bursar gets academic access unavailable.
4. Sign-out returns to login; refresh/back cannot expose a usable staff session.
5. Commands are visibly disabled without the write flag; forged action POSTs also
   fail. Confirm private/no-store and refreshed cookies on redirects.
6. Inspect keyboard labels/focus/pending states and 320/375/390/768px/desktop
   layouts. No visual sign-off is claimed until rendered and inspected.

## Separate persistent browser-write gate

`-EnableTestWrites` permits persistent fictional report actions. Unlike the prior
integration harness, these browser actions do NOT automatically roll back.
Obtain explicit approval for that mode after read-only SSR/cookie checks pass.
Keep the same local fixture installation, do not modify assessment source data,
and record actual create/submit/return/approve/reopen/publish/revoke and correction
outcomes, including denied requests, stale tabs and safe retries. Do not rerun the
old empty-baseline rollback harness after browser reports have been persisted.
No destructive cleanup is provided. Historical reports/releases remain immutable.

Printed result rendering, guardian delivery, real academic entry/finalization,
performance work, hosted staging configuration and launch checks remain separate
milestones. This page reports workflow state, not a parent-visible result sheet.
