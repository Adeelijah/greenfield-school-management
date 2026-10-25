export type StagingStaffRole = 'admin' | 'teacher' | 'bursar';
export function decodeStagingStaffAccount(authUserId: string, schoolId: string, rows: unknown): StagingStaffRole | null {
  if (!authUserId || !schoolId || !Array.isArray(rows) || rows.length !== 1) return null;
  const row: unknown = rows[0];
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const r = row as Record<string, unknown>;
  if (r.auth_user_id !== authUserId || r.school_id !== schoolId || r.status !== 'active' || r.school_user_count !== 1 || r.active_membership_count !== 1 ||
    typeof r.school_user_id !== 'string' || !r.school_user_id.trim() || typeof r.membership_id !== 'string' || !r.membership_id.trim()) return null;
  return r.role === 'admin' || r.role === 'teacher' || r.role === 'bursar' ? r.role : null;
}
