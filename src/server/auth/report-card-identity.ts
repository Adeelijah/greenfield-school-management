import 'server-only';
import { sql, type SQL } from 'drizzle-orm';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getDatabase } from '@/db/client';
import { decodeReportCardActorAuthority, type ReportCardActorAuthority } from '@/lib/academics/report-card-actor-authority';

const verifiedIdentityBrand: unique symbol = Symbol('verified-report-card-identity');
export type VerifiedReportCardIdentity = ReportCardActorAuthority & {
  readonly [verifiedIdentityBrand]: true;
};

export type ReportCardAuthorityTransaction = { execute(query: SQL): Promise<unknown> };

function transactionRows(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === 'object' && 'rows' in result && Array.isArray(result.rows)) return result.rows;
  return [];
}

/**
 * Request-boundary bridge. The zero-argument RPC derives its actor only from
 * auth.uid() in the verified Supabase request; no request field supplies an
 * identity, school, role, or assignment. Until its reviewed function/policies
 * are installed, this returns null and no report route should call it.
 */
export async function resolveVerifiedReportCardIdentity(): Promise<VerifiedReportCardIdentity | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user?.id) return null;

    const { data, error } = await supabase.rpc('resolve_report_card_actor');
    if (error) return null;
    const authority = decodeReportCardActorAuthority(auth.user.id, data);
    if (!authority) return null;
    const verified: VerifiedReportCardIdentity = { ...authority, [verifiedIdentityBrand]: true };
    return Object.freeze(verified);
  } catch {
    // Auth/RPC exceptions fail closed and do not expose provider or SQL errors.
    return null;
  }
}

/**
 * Transaction-bound authority refresh for future report reads/commands. The
 * caller must pass the original server-only bridge result and invoke this on
 * the already-open command transaction. The lock function re-counts all active
 * memberships, locks the actor anchor/membership/school, and returns no row if
 * authority changed or is ambiguous. Never use the earlier snapshot to
 * authorize a mutation or historical receipt replay.
 */
export async function resolveReportCardActorInTransaction(
  tx: ReportCardAuthorityTransaction,
  verifiedIdentity: VerifiedReportCardIdentity,
): Promise<ReportCardActorAuthority | null> {
  try {
    if (!verifiedIdentity?.[verifiedIdentityBrand] || !verifiedIdentity.authUserId) return null;
    const result = await tx.execute(sql`select * from public.lock_report_card_actor(${verifiedIdentity.authUserId}::uuid)`);
    const authority = decodeReportCardActorAuthority(verifiedIdentity.authUserId, transactionRows(result));
    // Refresh role/configuration, but never switch the request to another school
    // or principal. A changed binding requires a newly verified request.
    if (!authority || authority.schoolId !== verifiedIdentity.schoolId ||
      authority.schoolUserId !== verifiedIdentity.schoolUserId ||
      authority.membershipId !== verifiedIdentity.membershipId) return null;
    return authority;
  } catch {
    return null;
  }
}

/** Recheck a teacher's active class/session assignment on the same transaction
 * after loading the school-scoped report and before looking up/replaying a
 * receipt. Admin report decisions do not require a teacher assignment.
 */
export async function hasCurrentReportCardAssignment(
  tx: ReportCardAuthorityTransaction,
  authority: ReportCardActorAuthority,
  classId: string,
  sessionId: string,
): Promise<boolean> {
  if (!classId?.trim() || !sessionId?.trim()) return false;
  if (authority.role === 'admin') return authority.status === 'active';
  if (authority.role !== 'teacher' || authority.status !== 'active') return false;
  try {
    const result = await tx.execute(sql`select id from public.teacher_class_assignments
      where school_id = ${authority.schoolId}::uuid
        and teacher_membership_id = ${authority.membershipId}::uuid
        and class_id = ${classId}::uuid
        and session_id = ${sessionId}::uuid
        and ended_at is null
      for share`);
    return transactionRows(result).length === 1;
  } catch {
    return false;
  }
}

/** Server-only transaction runner entry point for callers that need one
 * authority lock and subsequent report/assignment reads in the same tx. */
export async function withVerifiedReportCardActorTransaction<T>(
  work: (tx: ReportCardAuthorityTransaction, authority: ReportCardActorAuthority) => Promise<T>,
): Promise<T | null> {
  const identity = await resolveVerifiedReportCardIdentity();
  if (!identity) return null;
  try {
    return await getDatabase().transaction(async tx => {
      const authority = await resolveReportCardActorInTransaction(tx, identity);
      if (!authority) return null;
      return work(tx, authority);
    });
  } catch {
    return null;
  }
}

