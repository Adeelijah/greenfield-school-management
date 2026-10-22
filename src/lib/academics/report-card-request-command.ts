// Request syntax only. Authentication and current authorization belong to server transactions.
import type { PersistedReportWorkflowCommand } from './report-card-postgres-workflow-writer';
import type { CanonicalReportCommand } from './report-card-postgres-canonical-writer';
import type { ReleaseCorrectionCommand } from './report-card-release-correction';

export type ReportCardRequestCommand = PersistedReportWorkflowCommand | CanonicalReportCommand | ReleaseCorrectionCommand;
export const isReportCardUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** Closed, copied input prevents authority injection and mutation during auth awaits.
 * IDs normalize to PostgreSQL's UUID spelling; operation keys remain exact.
 */
export function parseReportCardRequestCommand(raw: unknown): ReportCardRequestCommand | null {
  try {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(raw))) return null;
    const descriptors = Object.getOwnPropertyDescriptors(raw);
    const row: Record<string, unknown> = Object.create(null);
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== 'string') return null;
      const field = descriptors[key]!;
      if (!('value' in field) || !field.enumerable) return null;
      row[key] = field.value;
    }
    const action = row.action;
    if (!['create', 'submit', 'return', 'reopen', 'approve', 'publish', 'revoke'].includes(action as string)) return null;
    const ids = action === 'create'
      ? ['studentId', 'enrollmentId', 'classId', 'sessionId', 'termId']
      : action === 'revoke' ? ['reportId', 'releaseId'] : ['reportId'];
    const reasonRequired = action === 'return' || action === 'revoke';
    const allowed = ['action', 'operationKey', ...ids, ...(action === 'create' ? [] : ['expectedVersion']), ...(reasonRequired ? ['reason'] : [])];
    if (Object.keys(row).length !== allowed.length || Object.keys(row).some(key => !allowed.includes(key))) return null;
    if (typeof row.operationKey !== 'string' || !row.operationKey.trim() || row.operationKey !== row.operationKey.trim() || row.operationKey.length > 128) return null;
    for (const key of ids) {
      if (!isReportCardUuid(row[key])) return null;
      row[key] = (row[key] as string).toLowerCase();
    }
    if (action !== 'create' && (!Number.isSafeInteger(row.expectedVersion) || (row.expectedVersion as number) < 1 || (row.expectedVersion as number) === Number.MAX_SAFE_INTEGER)) return null;
    if (reasonRequired) {
      if (typeof row.reason !== 'string' || !row.reason.trim() || row.reason.length > 2000) return null;
      row.reason = row.reason.trim();
    }
    const operationKey = row.operationKey;
    const uuid = (key: string) => row[key] as string; // Validated and normalized above.
    if (action === 'create') return Object.freeze({ action, operationKey, studentId: uuid('studentId'), enrollmentId: uuid('enrollmentId'), classId: uuid('classId'), sessionId: uuid('sessionId'), termId: uuid('termId') });
    const common = { operationKey, reportId: uuid('reportId'), expectedVersion: row.expectedVersion as number };
    switch (action) {
      case 'revoke': return Object.freeze({ ...common, action, releaseId: uuid('releaseId'), reason: row.reason as string });
      case 'return': return Object.freeze({ ...common, action, reason: row.reason as string });
      case 'submit': case 'reopen': return Object.freeze({ ...common, action });
      case 'approve': case 'publish': return Object.freeze({ ...common, action });
      default: return null;
    }
  } catch {
    return null;
  }
}
