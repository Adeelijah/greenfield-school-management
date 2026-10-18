import type { AcademicClassRef, AcademicSessionRef, SchoolMembership, TeacherClassAssignment } from '@/lib/academics/assignments';
import type { AttendanceEnrollment, AttendanceStudentRecord } from '@/lib/attendance/attendance';

export const fictionalSchoolId = 'fictional-greenfield';
export const attendanceClassOptions: AcademicClassRef[] = [
  { id: 'class-creche-a', schoolId: fictionalSchoolId, levelId: 'level-creche', sectionId: 'section-green', active: true },
  { id: 'class-primary-5-a', schoolId: fictionalSchoolId, levelId: 'level-primary-5', sectionId: 'section-cedar', active: true },
];
export const attendanceSessionOptions: AcademicSessionRef[] = [
  { id: 'session-2026', schoolId: fictionalSchoolId, active: true },
  { id: 'session-2025', schoolId: fictionalSchoolId, active: false },
];

// These are display adapters over existing school memberships, not new teacher identities.
export const attendanceTeacherMemberships: SchoolMembership[] = [
  { id: 'membership-teacher-amara', schoolId: fictionalSchoolId, role: 'teacher', status: 'active' },
  { id: 'membership-teacher-daniel', schoolId: fictionalSchoolId, role: 'teacher', status: 'active' },
];
export const attendanceTeacherNames: Record<string, string> = {
  'membership-teacher-amara': 'Amara Nwosu',
  'membership-teacher-daniel': 'Daniel Mensah',
};

export const attendanceFixtureStudents: AttendanceStudentRecord[] = [
  { id: 'student-amina', schoolId: fictionalSchoolId, admissionNumber: 'GF/26/011', firstName: 'Amina', lastName: 'Bello', status: 'active' },
  { id: 'student-kofi', schoolId: fictionalSchoolId, admissionNumber: 'GF/26/012', firstName: 'Kofi', lastName: 'Mensah', status: 'active' },
  { id: 'student-nia', schoolId: fictionalSchoolId, admissionNumber: 'GF/26/013', firstName: 'Nia', lastName: 'Okafor', status: 'active' },
  { id: 'student-tomi', schoolId: fictionalSchoolId, admissionNumber: 'GF/26/014', firstName: 'Tomi', lastName: 'Adeyemi', status: 'active' },
  { id: 'student-sade', schoolId: fictionalSchoolId, admissionNumber: 'GF/26/015', firstName: 'Sade', lastName: 'Eze', status: 'active' },
  { id: 'student-former', schoolId: fictionalSchoolId, admissionNumber: 'GF/25/008', firstName: 'Former', lastName: 'Pupil', status: 'active' },
];
export const attendanceFixtureEnrollments: AttendanceEnrollment[] = [
  ...['student-amina', 'student-kofi', 'student-nia', 'student-tomi'].map((studentId, index) => ({
    id: `enrollment-primary-${index + 1}`, schoolId: fictionalSchoolId, studentId,
    classId: 'class-primary-5-a', sessionId: 'session-2026', status: 'active' as const,
  })),
  { id: 'enrollment-creche-1', schoolId: fictionalSchoolId, studentId: 'student-sade', classId: 'class-creche-a', sessionId: 'session-2026', status: 'active' },
  { id: 'enrollment-former', schoolId: fictionalSchoolId, studentId: 'student-former', classId: 'class-primary-5-a', sessionId: 'session-2026', status: 'completed' },
];
export const attendanceFixtureTeacherAssignments: TeacherClassAssignment[] = [
  { id: 'assignment-amara-p5', schoolId: fictionalSchoolId, membershipId: 'membership-teacher-amara', classId: 'class-primary-5-a', sessionId: 'session-2026', status: 'active' },
  { id: 'assignment-daniel-creche', schoolId: fictionalSchoolId, membershipId: 'membership-teacher-daniel', classId: 'class-creche-a', sessionId: 'session-2026', status: 'active' },
];
