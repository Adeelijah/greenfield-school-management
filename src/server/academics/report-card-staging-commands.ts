import 'server-only';
import { resolveVerifiedReportCardIdentity } from '@/server/auth/report-card-identity';
import { parseReportCardRequestCommand } from '@/lib/academics/report-card-request-command';
import { executeStagingReportBoundary } from '@/lib/academics/report-card-staging-command-boundary';
import { executeReportWorkflowInScope } from '@/lib/academics/report-card-postgres-workflow-writer';
import { executeCanonicalReportCommandInScope } from '@/lib/academics/report-card-postgres-canonical-writer';
import { executeReportRevocationInScope } from '@/lib/academics/report-card-postgres-revoke-writer';
import type { SqlDatabase } from '@/lib/academics/report-card-postgres-disposable-adapter';

import { reportCardCommandResponse as response } from '@/lib/academics/report-card-command-response';
import type { ReportCardCommandResponse } from '@/lib/academics/report-card-command-response';
export type { ReportCardCommandResponse } from '@/lib/academics/report-card-command-response';
import { createStagingReportRuntime } from '@/lib/academics/report-card-staging-runtime';
import type { StagingReportRuntimeConfig } from '@/lib/academics/report-card-staging-runtime';
import { stagingReportSqlScope } from '@/lib/academics/report-card-sql-scope';

/** Dormant server bootstrap, supplied isolated connection and fixed configuration.
 * Owns SDK verification; no route, environment or application connection fallback.
 */
export function createVerifiedStagingReportCommands(db: SqlDatabase, config: StagingReportRuntimeConfig) {
  const runtime = createStagingReportRuntime(db, config);
  const sqlScope = stagingReportSqlScope(config);
  return async function execute(raw: unknown): Promise<ReportCardCommandResponse> {
    const command = parseReportCardRequestCommand(raw);
    if (!command) return { ok: false, code: 'invalid' };
    try {
      // This function owns verification; clients cannot provide an auth callback.
      const identity = await resolveVerifiedReportCardIdentity();
      if (!identity || identity.schoolId !== runtime.scope.schoolId) return { ok: false, code: 'forbidden' };
      const result = await executeStagingReportBoundary(runtime, identity, async (scoped, verified) => {
        let outcome: unknown;
        if (command.action === 'approve' || command.action === 'publish') outcome = await executeCanonicalReportCommandInScope(scoped, sqlScope, command, verified);
        else if (command.action === 'revoke') outcome = await executeReportRevocationInScope(scoped, sqlScope, command, verified);
        else if (command.action === 'create' || command.action === 'submit' || command.action === 'return' || command.action === 'reopen') {
          outcome = await executeReportWorkflowInScope(scoped, sqlScope, command, verified);
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
