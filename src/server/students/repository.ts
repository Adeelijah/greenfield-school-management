import 'server-only';

import { and, asc, eq } from 'drizzle-orm';
import { getDatabase } from '@/db/client';
import { students } from '@/db/schema';

export type StudentDirectoryAccess = {
  schoolId: string;
  role: 'admin' | 'teacher';
};

export async function listSchoolStudents(access: StudentDirectoryAccess) {
  if (!access.schoolId) {
    throw new Error('Verified school ID is required');
  }

  if (access.role !== 'admin' && access.role !== 'teacher') {
    throw new Error('Student directory access denied');
  }

  const db = getDatabase();

  return db
    .select({
      id: students.id,
      admissionNumber: students.admissionNumber,
      firstName: students.firstName,
      lastName: students.lastName,
      status: students.status,
    })
    .from(students)
    .where(eq(students.schoolId, access.schoolId))
    .orderBy(asc(students.lastName), asc(students.firstName));
}