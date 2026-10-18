import 'server-only';

import { requireSchoolAccess } from '@/server/auth/require-school-access';
import { listSchoolStudents } from './repository';

export async function getStudentDirectory() {
  const access = await requireSchoolAccess();

  if (access.role !== 'admin' && access.role !== 'teacher') {
    throw new Error('Student directory access denied');
  }

  return listSchoolStudents({
    schoolId: access.schoolId,
    role: access.role,
  });
}