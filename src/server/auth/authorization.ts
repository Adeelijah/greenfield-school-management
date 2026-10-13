import 'server-only';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export type SchoolRole = 'admin' | 'teacher' | 'bursar';
export type SchoolAccess = { authUserId: string; schoolId: string; schoolName: string; role: SchoolRole };

/**
 * Resolve school membership through the signed-in user's Supabase JWT.
 * Never use the privileged direct PostgreSQL connection for authorization.
 *
 * The SQL RLS review requires:
 * - school_users: auth_user_id = auth.uid()
 * - memberships: self-only through school_users
 * - schools: active members only
 *
 * Fail closed on missing schema, missing policies, errors, or multiple schools.
 */
export async function getSchoolAccess(): Promise<SchoolAccess | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) return null;

    const { data: schoolUser, error: userError } = await supabase
      .from('school_users')
      .select('id')
      .eq('auth_user_id', auth.user.id)
      .maybeSingle();

    if (userError || !schoolUser) return null;

    const { data: memberships, error: membershipError } = await supabase
      .from('memberships')
      .select('school_id, role')
      .eq('user_id', schoolUser.id)
      .eq('status', 'active')
      .limit(2);

    if (membershipError || !memberships || memberships.length !== 1) return null;

    const membership = memberships[0];
    if (!['admin', 'teacher', 'bursar'].includes(membership.role)) return null;

    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('id, name')
      .eq('id', membership.school_id)
      .maybeSingle();

    if (schoolError || !school || school.id !== membership.school_id) return null;

    return {
      authUserId: auth.user.id,
      schoolId: school.id,
      schoolName: school.name,
      role: membership.role as SchoolRole,
    };
  } catch (error) {
    console.error('School authorization lookup failed', error instanceof Error ? error.name : 'unknown');
    return null;
  }
}
