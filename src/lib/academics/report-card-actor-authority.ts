/** Decodes complete actor-scope evidence returned only by the reviewed
 * SECURITY DEFINER authority lookup. RLS-filtered membership rows are not a
 * valid substitute for this contract.
 */
export type ReportCardActorAuthority = {
  authUserId: string;
  schoolUserId: string;
  membershipId: string;
  schoolId: string;
  role: 'admin' | 'teacher';
  status: 'active';
  finalPrimaryYear: 5 | 6;
};

type AuthorityRow = Record<string, unknown>;
const nonempty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

/** The SQL function returns one row only when it has counted the complete
 * active membership set for the verified actor and found exactly one.
 */
export function decodeReportCardActorAuthority(
  verifiedAuthUserId: string | null | undefined,
  rows: unknown,
): ReportCardActorAuthority | null {
  if (!nonempty(verifiedAuthUserId) || !Array.isArray(rows) || rows.length !== 1) return null;
  const row = rows[0] as AuthorityRow;
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  if (
    row.auth_user_id !== verifiedAuthUserId ||
    row.school_user_count !== 1 ||
    row.active_membership_count !== 1 ||
    !nonempty(row.school_user_id) ||
    !nonempty(row.membership_id) ||
    !nonempty(row.school_id) ||
    row.status !== 'active' ||
    (row.role !== 'admin' && row.role !== 'teacher') ||
    (row.final_primary_year !== 5 && row.final_primary_year !== 6)
  ) return null;

  return {
    authUserId: verifiedAuthUserId,
    schoolUserId: row.school_user_id,
    membershipId: row.membership_id,
    schoolId: row.school_id,
    role: row.role,
    status: 'active',
    finalPrimaryYear: row.final_primary_year,
  };
}
