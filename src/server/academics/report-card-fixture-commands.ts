import 'server-only';
import { resolveVerifiedReportCardIdentity } from '@/server/auth/report-card-identity';
import { parseReportCardRequestCommand, isReportCardUuid } from '@/lib/academics/report-card-request-command';
import { executeCompleteFixtureReport } from '@/lib/academics/report-card-complete-fixture-boundary';
import { executeFixtureReportWorkflow } from '@/lib/academics/report-card-postgres-workflow-writer';
import { executeFixtureCanonicalReportCommand } from '@/lib/academics/report-card-postgres-canonical-writer';
import { executeFixtureReportRevocation } from '@/lib/academics/report-card-postgres-revoke-writer';
import type { SqlDatabase } from '@/lib/academics/report-card-postgres-disposable-adapter';

import { reportCardCommandResponse as response } from '@/lib/academics/report-card-command-response';
import type { ReportCardCommandResponse } from '@/lib/academics/report-card-command-response';
export type { ReportCardCommandResponse } from '@/lib/academics/report-card-command-response';
export type ReportCardFixtureRuntime = {
  mode: 'disposable-fixture'; schema: string; schoolId: string; writerRole: string;
};

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
        else if (command.action === 'create' || command.action === 'submit' || command.action === 'return' || command.action === 'reopen') {
          outcome = await executeFixtureReportWorkflow(scoped, runtime.schema, command, verified);
        } else return { ok: false, code: 'invalid' } as const;
        // Convert failures before returning so the outer transaction rolls back.
        return response(command, outcome);
      });
      return response(command, result);
    } catch {
      return { ok: false, code: 'unavailable' };
    }
  };
}
