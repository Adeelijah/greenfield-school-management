import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireSchoolRole } from '@/server/auth/require-school-access';

export async function listAuthenticatedSchoolStudents() {
  const access = await requireSchoolRole(['admin', 'teacher']);
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('students')
    .select('id, admission_number, first_name, last_name, status')
    .eq('school_id', access.schoolId)
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true });

  if (error) {
    throw new Error('Student directory is unavailable');
  }

  return data ?? [];
}