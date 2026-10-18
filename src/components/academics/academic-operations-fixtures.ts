import type { Subject, SubjectClassAssignment, SubjectLevelAssignment, TeacherSubjectAssignment } from '@/lib/academics/subjects';
import { attendanceFixtureTeacherAssignments, attendanceTeacherMemberships } from '@/components/attendance/attendance-fixtures';

export const academicOperationLevels = [
  { id: 'level-creche', schoolId: 'fictional-greenfield', name: 'Creche', active: true },
  { id: 'level-nursery', schoolId: 'fictional-greenfield', name: 'Nursery 2', active: true },
  { id: 'level-primary-5', schoolId: 'fictional-greenfield', name: 'Primary 5', active: true },
] as const;
export const academicOperationSubjects: Subject[] = [
  { id: 'subject-english', schoolId: 'fictional-greenfield', code: 'ENG', name: 'English Language', active: true },
  { id: 'subject-math', schoolId: 'fictional-greenfield', code: 'MATH', name: 'Mathematics', active: true },
  { id: 'subject-science', schoolId: 'fictional-greenfield', code: 'BASIC-SCI', name: 'Basic Science', active: true },
  { id: 'subject-civic', schoolId: 'fictional-greenfield', code: 'CIVIC', name: 'Civic Education', active: false },
];
export const academicOperationLevelSubjects: SubjectLevelAssignment[] = [
  { id: 'level-subject-eng', schoolId: 'fictional-greenfield', subjectId: 'subject-english', levelId: 'level-primary-5', status: 'active' },
  { id: 'level-subject-math', schoolId: 'fictional-greenfield', subjectId: 'subject-math', levelId: 'level-primary-5', status: 'active' },
  { id: 'level-subject-science', schoolId: 'fictional-greenfield', subjectId: 'subject-science', levelId: 'level-primary-5', status: 'active' },
];
export const academicOperationClassSubjects: SubjectClassAssignment[] = [
  { id: 'class-subject-creche-language', schoolId: 'fictional-greenfield', subjectId: 'subject-english', classId: 'class-creche-a', status: 'active' },
];
export const academicOperationTeacherSubjects: TeacherSubjectAssignment[] = [
  { id: 'teacher-subject-amara-math', schoolId: 'fictional-greenfield', membershipId: 'membership-teacher-amara', subjectId: 'subject-math', classId: 'class-primary-5-a', sessionId: 'session-2026', status: 'active' },
];
export const academicOperationTeacherAssignments = [...attendanceFixtureTeacherAssignments];
export const academicOperationTeacherMemberships = [...attendanceTeacherMemberships];
export const academicOperationTeacherNames: Record<string, string> = {
  'membership-teacher-amara': 'Amara Nwosu',
  'membership-teacher-daniel': 'Daniel Mensah',
};
