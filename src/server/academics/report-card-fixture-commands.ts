import 'server-only';
import { resolveVerifiedReportCardIdentity } from '@/server/auth/report-card-identity';
import { parseReportCardRequestCommand, isReportCardUuid } from '@/lib/academics/report-card-request-command';
import { executeCompleteFixtureReport } from '@/lib/academics/report-card-complete-fixture-boundary';
import { executeFixtureReportWorkflow } from '@/lib/academics/report-card-postgres-workflow-writer';
import { executeFixtureCanonicalReportCommand } from '@/lib/academics/report-card-postgres-canonical-writer';
import { executeFixtureReportRevocation } from '@/lib/academics/report-card-postgres-revoke-writer';
import type { SqlDatabase } from '@/lib/academics/report-card-postgres-disposable-adapter';
import type { ReportCardRequestCommand } from '@/lib/academics/report-card-request-command';

type Failure = { ok: false; code: 'invalid' | 'forbidden' | 'conflict' | 'unavailable' };
export type ReportCardCommandResponse = Failure | {
  ok: true; kind: 'applied' | 'replay'; action: ReportCardRequestCommand['action'];
  reportId: string; version: number; stage: 'draft' | 'submitted' | 'returned' | 'approved' | 'published';
};
export type ReportCardFixtureRuntime = {
  mode: 'disposable-fixture'; schema: string; schoolId: string; writerRole: string;
};

function response(command: ReportCardRequestCommand, outcome: unknown): ReportCardCommandResponse {
  if (!outcome || typeof outcome !== 'object') return { ok: false, code: 'unavailable' };
  const row = outcome as Record<string, unknown>;
  if (row.ok === false) {
    const code = row.code === 'invalid' ? 'invalid'
      : ['forbidden', 'not_found'].includes(row.code as string) ? 'forbidden'
      : ['conflict', 'stale_version', 'idempotency_conflict', 'duplicate_report'].includes(row.code as string) ? 'conflict' : 'unavailable';
    return { ok: false, code };
  }
  const stages = { create: 'draft', submit: 'submitted', return: 'returned', reopen: 'draft', approve: 'approved', publish: 'published', revoke: 'draft' } as const;
  const reportId = command.action === 'create' ? row.reportId : command.reportId;
  if (row.ok !== true || !['applied', 'replay'].includes(row.kind as string) || !isReportCardUuid(reportId) ||
    !Number.isSafeInteger(row.version) || (row.version as number) < 1 || row.stage !== stages[command.action] ||
    (row.reportId !== undefined && row.reportId !== reportId) || (row.action !== undefined && row.action !== command.action)) return { ok: false, code: 'unavailable' };
  return { ok: true, kind: row.kind as 'applied' | 'replay', action: command.action, reportId, version: row.version as number, stage: stages[command.action] };
}

/** Server bootstrap only: explicit disposable connection and fixed school config.
 * No default application/owner connection, environment discovery, route or caller
 * identity callback. The boundary checks the actual execution role in every tx.
 * Real SDK authentication still needs separately authorized request integration.
 */
export function createVerifiedFixtureReportCommands(db: SqlDatabase, config: ReportCardFixtureRuntime) {
  if (!config || config.mode !== 'disposable-fixture' || !/^rc_it_[a-f0-9]{16}$/.test(config.schema) ||
    !isReportCardUuid(config.schoolId) || config.writerRole !== config.schema + '_writer') throw Error('Invalid report command runtime');
  const runtime = Object.freeze({ ...config, schoolId: config.schoolId.toLowerCase() });
  return async function execute(raw: unknown): Promise<ReportCardCommandResponse> {
    const command = parseReportCardRequestCommand(raw);
    if (!command) return { ok: false, code: 'invalid' };
    try {
      // This function owns verification; clients cannot provide an auth callback.
      const identity = await resolveVerifiedReportCardIdentity();
      if (!identity || identity.schoolId !== runtime.schoolId) return { ok: false, code: 'forbidden' };
      const result = await executeCompleteFixtureReport(db, runtime.schema, identity, async (scoped, verified) => {
        let outcome: unknown;
        if (command.action === 'approve' || command.action === 'publish') outcome = await executeFixtureCanonicalReportCommand(scoped, runtime.schema, command, verified);
        else if (command.action === 'revoke') outcome = await executeFixtureReportRevocation(scoped, runtime.schema, command, verified);
        else outcome = await executeFixtureReportWorkflow(scoped, runtime.schema, command, verified);
        // Convert failures before returning so the outer transaction rolls back.
        return response(command, outcome);
      });
      return response(command, result);
    } catch {
      return { ok: false, code: 'unavailable' };
    }
  };
}
