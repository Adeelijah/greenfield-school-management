import type { ReportCardRequestCommand } from './report-card-request-command';
// @ts-expect-error Explicit source extension for the offline Node runner.
import { isReportCardUuid } from './report-card-request-command.ts';

type Failure = { ok: false; code: 'invalid' | 'forbidden' | 'conflict' | 'unavailable' };
export type ReportCardCommandResponse = Failure | {
  ok: true; kind: 'applied' | 'replay'; action: ReportCardRequestCommand['action'];
  reportId: string; version: number; stage: 'draft' | 'submitted' | 'returned' | 'approved' | 'published';
};
export function reportCardCommandResponse(command: ReportCardRequestCommand, outcome: unknown): ReportCardCommandResponse {
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

