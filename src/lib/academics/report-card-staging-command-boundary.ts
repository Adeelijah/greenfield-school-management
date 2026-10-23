// Unused staging command transaction boundary; not authentication or a route.
import type { SqlDatabase, SqlClient } from './report-card-postgres-disposable-adapter';
import type { ReportCardActorAuthority } from './report-card-actor-authority';
import type { createStagingReportRuntime } from './report-card-staging-runtime';
// @ts-expect-error Explicit TS source extension for the offline Node runner.
import { decodeReportCardActorAuthority } from './report-card-actor-authority.ts';
// @ts-expect-error Explicit TS source extension for the offline Node runner.
import { isReportCardUuid } from './report-card-request-command.ts';
// @ts-expect-error Explicit TS source extension for the offline Node runner.
import { stagingReportSessionQuery } from './report-card-staging-runtime.ts';

export type StagingReportRequestBinding = Pick<ReportCardActorAuthority, 'authUserId' | 'schoolUserId' | 'membershipId' | 'schoolId'>;
type Failure = { ok: false; code: 'invalid' | 'forbidden' | 'transaction_failed' };
class StagingBoundaryAbort extends Error {
  readonly code: Failure['code'];
  constructor(code: Failure['code']) { super(code); this.code = code; }
}

/** Trusted server bootstrap supplies its original SDK-resolved binding. A body
 * cannot authenticate itself by constructing this shape. The supplied runtime
 * owns role selection/catalog checks; this boundary owns source/authority order,
 * principal stability and atomic callback outcomes. No default connection.
 */
export async function executeStagingReportBoundary<T extends { ok: boolean }>(
  runtime: ReturnType<typeof createStagingReportRuntime>, binding: StagingReportRequestBinding,
  work: (scoped: SqlDatabase, identity: () => Promise<{ authUserId: string }>, authority: ReportCardActorAuthority) => Promise<T>,
): Promise<T | Failure> {
  if (!runtime || runtime.scope?.schema !== 'public' || !isReportCardUuid(runtime.scope.schoolId) || !binding ||
    ![binding.authUserId, binding.schoolUserId, binding.membershipId, binding.schoolId].every(isReportCardUuid) ||
    binding.schoolId !== runtime.scope.schoolId || typeof work !== 'function') return { ok: false, code: 'invalid' };
  const expected = Object.freeze({ authUserId: binding.authUserId, schoolUserId: binding.schoolUserId, membershipId: binding.membershipId, schoolId: binding.schoolId });
  let rejected: T | undefined;
  try {
    return await runtime.begin(async tx => {
      const session = await tx.unsafe(stagingReportSessionQuery);
      if (session.length !== 1 || session[0]!.loginRole !== 'greenfield_app' || session[0]!.executionRole !== 'greenfield_report_card_runtime') throw new StagingBoundaryAbort('forbidden');
      if ((await tx.unsafe('SELECT id FROM public.assessment_source_write_gate WHERE id=1 FOR SHARE')).length !== 1) throw new StagingBoundaryAbort('transaction_failed');
      const rows = await tx.unsafe('SELECT * FROM public.lock_report_card_actor($1::uuid)', [expected.authUserId]);
      const authority = decodeReportCardActorAuthority(expected.authUserId, rows);
      if (!authority || authority.schoolId !== expected.schoolId || authority.schoolUserId !== expected.schoolUserId || authority.membershipId !== expected.membershipId) throw new StagingBoundaryAbort('forbidden');
      let active = true, innerActive = false, poisoned = false;
      const scoped: SqlDatabase = {
        unsafe(): never { poisoned = true; throw Error('Staging command SQL requires its transaction'); },
        async begin<U>(callback: (connection: SqlClient) => Promise<U>): Promise<U> {
          if (!active || innerActive) { poisoned = true; throw Error('Invalid staging command transaction reuse'); }
          innerActive = true; let leaseActive = true;
          const leased: SqlClient = { async unsafe(query, params) {
            if (!active || !leaseActive) { poisoned = true; throw Error('Expired staging command SQL lease'); }
            try { return await tx.unsafe(query, params); } catch (error) { poisoned = true; throw error; }
          } };
          try { return await callback(leased); } catch (error) { poisoned = true; throw error; }
          finally { leaseActive = false; innerActive = false; }
        },
      };
      try {
        const result = await work(scoped, async () => ({ authUserId: expected.authUserId }), authority);
        if (!result || typeof result.ok !== 'boolean') throw new StagingBoundaryAbort('transaction_failed');
        if (!result.ok) { rejected = result; throw new StagingBoundaryAbort('transaction_failed'); }
        if (poisoned) throw new StagingBoundaryAbort('transaction_failed');
        return result;
      } finally { active = false; }
    });
  } catch (error) {
    return rejected ?? { ok: false, code: error instanceof StagingBoundaryAbort ? error.code : 'transaction_failed' };
  }
}
