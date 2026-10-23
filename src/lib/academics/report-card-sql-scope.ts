// Explicit namespace configuration, never request authentication or a connection.
import type { SqlClient } from './report-card-postgres-disposable-adapter';
import type { StagingReportRuntimeConfig } from './report-card-staging-runtime';
import type { MappedReportIdentity } from './report-card-persisted-model-map';
import type { ReportCardActorAuthority } from './report-card-actor-authority';
// @ts-expect-error Explicit source extension for the offline Node runner.
import { decodeReportCardActorAuthority } from './report-card-actor-authority.ts';
// @ts-expect-error Explicit source extension for the offline Node runner.
import { isReportCardUuid } from './report-card-request-command.ts';

export type ReportSqlScope = Readonly<{
  schema: string; schoolId: string | null;
  sourceGate: 'fixture_source_write_gate' | 'assessment_source_write_gate';
}>;
const issued = new WeakSet<object>();
function issue(scope: ReportSqlScope): ReportSqlScope { issued.add(scope); return Object.freeze(scope); }
export function fixtureReportSqlScope(schema: string): ReportSqlScope | null {
  return typeof schema === 'string' && /^rc_it_[a-f0-9]{16}$/.test(schema)
    ? issue({ schema, schoolId: null, sourceGate: 'fixture_source_write_gate' }) : null;
}
export function stagingReportSqlScope(config: StagingReportRuntimeConfig): ReportSqlScope {
  if (!config || config.mode !== 'isolated-staging-review' || config.schema !== 'public' ||
    config.loginRole !== 'greenfield_app' || config.commandRole !== 'greenfield_report_card_runtime' ||
    !isReportCardUuid(config.schoolId)) throw Error('Invalid report SQL scope');
  return issue({ schema: 'public', schoolId: config.schoolId.toLowerCase(), sourceGate: 'assessment_source_write_gate' });
}
export function isReportSqlScope(value: unknown): value is ReportSqlScope {
  return !!value && typeof value === 'object' && issued.has(value);
}

/** Public reads/writes cannot substitute RLS-filtered rows for complete actor
 * evidence or run under an owner connection. Source gate precedes authority.
 * Fixture wrappers keep their existing SQL ordering and separate boundary.
 */
export async function lockReportSqlScopeAuthority(tx: SqlClient, scope: ReportSqlScope, authUserId: string): Promise<ReportCardActorAuthority | null | false> {
  if (!isReportSqlScope(scope)) return false;
  if (scope.schoolId === null) return null;
  const session = await tx.unsafe('SELECT session_user AS "loginRole",current_user AS "executionRole"');
  if (session.length !== 1 || session[0]!.loginRole !== 'greenfield_app' || session[0]!.executionRole !== 'greenfield_report_card_runtime') return false;
  if ((await tx.unsafe('SELECT id FROM public.assessment_source_write_gate WHERE id=1 FOR SHARE')).length !== 1) return false;
  const authority = decodeReportCardActorAuthority(authUserId, await tx.unsafe('SELECT * FROM public.lock_report_card_actor($1::uuid)', [authUserId]));
  return authority && authority.schoolId === scope.schoolId ? authority : false;
}
export function matchesReportSqlAuthority(authority: ReportCardActorAuthority | null | false, identity: MappedReportIdentity, schoolUserId: unknown): boolean {
  return authority === null || (!!authority && authority.schoolUserId === schoolUserId &&
    authority.membershipId === identity.membership.id && authority.schoolId === identity.school.id &&
    authority.authUserId === identity.membership.authUserId && authority.role === identity.membership.role &&
    authority.finalPrimaryYear === identity.school.finalPrimaryYear);
}
