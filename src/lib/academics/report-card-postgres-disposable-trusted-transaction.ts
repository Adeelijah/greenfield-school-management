// Disposable composition only. No live auth, routes, schema or database client.
import { createHash } from 'node:crypto';
import type { SqlDatabase } from './report-card-postgres-disposable-adapter';
import type { ReportCommand } from './report-card-workflow';
import type { TransactionOutcome } from './report-card-transaction-port';
// @ts-expect-error Node type stripping requires explicit source extension.
import { disposableReportTransactionRunner } from './report-card-postgres-disposable-adapter.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { disposableAuthoritativeReadPort } from './report-card-postgres-disposable-read-adapter.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { readAuthoritativeReport } from './report-card-authoritative-read.ts';
// @ts-expect-error Node type stripping requires explicit source extension.
import { executeReportTransaction } from './report-card-transaction-port.ts';

class RollbackOutcome extends Error {
  readonly outcome: TransactionOutcome;
  constructor(outcome: TransactionOutcome) { super('Disposable transaction rejected'); this.outcome = outcome; }
}
export type TrustedDisposableCommand = { reportId: string; command: ReportCommand };
/** Exactly one real begin owns all reads/writes. Identity and clock callbacks
 * are server-owned capabilities, fictional in tests, never request fields.
 */
export async function executeTrustedDisposableReport(
  db: SqlDatabase, schema: string, input: TrustedDisposableCommand,
  identity: () => Promise<{ authUserId: string } | null>,
  now: () => string,
): Promise<TransactionOutcome> {
  // Snapshot the narrow command before awaiting; discard forged actor/school or
  // fingerprint fields and do not let later caller mutation change the intent.
  const command = input?.command;
  if (!input?.reportId?.trim() || !command) return { ok: false, code: 'invalid', message: 'Report and command required.' };
  const reportId = input.reportId;
  const frozenCommand: ReportCommand = { action: command.action, expectedVersion: command.expectedVersion,
    assessmentVersion: command.assessmentVersion, idempotencyKey: command.idempotencyKey,
    ...(command.reason === undefined ? {} : { reason: command.reason }) };
  const fingerprint = createHash('sha256').update(JSON.stringify({ format: 1, reportId, ...frozenCommand })).digest('hex');
  try {
    return await db.begin(async connection => {
      const trusted = await readAuthoritativeReport(disposableAuthoritativeReadPort(connection, schema, identity), reportId);
      if (!trusted.ok) throw new RollbackOutcome({ ok: false, code: trusted.code, message: 'Trusted report source unavailable.' });
      const membership = trusted.locked.context.membership;
      if (!membership) throw new RollbackOutcome({ ok: false, code: 'forbidden', message: 'Trusted membership unavailable.' });
      // This bridge reuses the existing open connection. It never issues BEGIN
      // or commits. Re-locking our report is safe; identity/source locks remain.
      const bound: SqlDatabase = {
        unsafe: (query, parameters) => connection.unsafe(query, parameters),
        begin: callback => callback(connection),
      };
      const runner = disposableReportTransactionRunner(bound, schema, async (_tx, schoolId, id, actorId) => {
        if (schoolId !== membership.schoolId || id !== reportId || actorId !== membership.id) return null;
        return { projection: trusted.locked.projection, context: trusted.locked.context };
      }, 'read_reports');
      const outcome = await executeReportTransaction(runner, {
        schoolId: membership.schoolId, actorMembershipId: membership.id, reportId,
        command: frozenCommand, fingerprint, occurredAt: now(),
      });
      // The orchestrator catches errors. Rethrow every denied outcome at the
      // OUTER transaction so a partially completed write can never commit.
      if (!outcome.ok) throw new RollbackOutcome(outcome);
      return outcome;
    });
  } catch (error) {
    if (error instanceof RollbackOutcome) return error.outcome;
    return { ok: false, code: 'transaction_failed', message: 'Disposable transaction rolled back.' };
  }
}
