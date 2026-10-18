import type { ClassStructure } from '../academics/class-structure';
import type { AdmissionApplicant, AdmissionClass, AdmissionGuardian, AdmissionMembership, AdmissionPreviewState, AdmissionStudent, GuardianLink } from '@/lib/admissions/admissions';

export const admissionsSchoolId = 'fictional-greenfield';
export const admissionsAdmin: AdmissionMembership = { membershipId: 'membership-admin', schoolId: admissionsSchoolId, role: 'admin', status: 'active' };
export const admissionsTeacher: AdmissionMembership = { membershipId: 'membership-teacher-amara', schoolId: admissionsSchoolId, role: 'teacher', status: 'active' };
export const admissionsBursar: AdmissionMembership = { membershipId: 'membership-bursar', schoolId: admissionsSchoolId, role: 'bursar', status: 'active' };

const levels = [
  { id: 'level-creche', name: 'Creche', stage: 'creche' as const },
  { id: 'level-nursery-1', name: 'Nursery 1', stage: 'nursery' as const },
  { id: 'level-nursery-2', name: 'Nursery 2', stage: 'nursery' as const },
  ...[1, 2, 3, 4, 5].map(year => ({ id: `level-primary-${year}`, name: `Primary ${year}`, stage: 'primary' as const })),
];
export const admissionsStructure: ClassStructure = {
  schoolId: admissionsSchoolId,
  finalLevelId: 'level-primary-5',
  levels: levels.map((level, index) => ({ ...level, order: index + 1, sections: [
    { id: `${level.id}-section-green`, name: 'Green' }, { id: `${level.id}-section-gold`, name: 'Gold' },
  ] })),
};

export const admissionsClasses: AdmissionClass[] = levels.flatMap(level => [
  { id: `class-${level.id}-green`, schoolId: admissionsSchoolId, levelId: level.id, name: `${level.name} · Green`, active: true },
  { id: `class-${level.id}-gold`, schoolId: admissionsSchoolId, levelId: level.id, name: `${level.name} · Gold`, active: true },
]);

const memberships: AdmissionMembership[] = [
  admissionsAdmin, admissionsTeacher, admissionsBursar,
  { membershipId: 'membership-suspended-admin', schoolId: admissionsSchoolId, role: 'admin', status: 'suspended' },
  { membershipId: 'membership-admin-other-school', schoolId: 'fictional-river-school', role: 'admin', status: 'active' },
];
const guardians: AdmissionGuardian[] = [
  { id: 'guardian-samira', schoolId: admissionsSchoolId, fullName: 'Samira Bello', phone: '+2348010001001', email: 'samira@example.test', version: 1 },
  { id: 'guardian-tunde', schoolId: admissionsSchoolId, fullName: 'Tunde Bello', phone: '+2348010001002', email: 'tunde@example.test', version: 1 },
  { id: 'guardian-adaeze', schoolId: admissionsSchoolId, fullName: 'Adaeze Nwosu', phone: '+2348010001003', email: 'adaeze@example.test', version: 1 },
  { id: 'guardian-kamal', schoolId: admissionsSchoolId, fullName: 'Kamal Eze', phone: '+2348010001004', email: 'kamal@example.test', version: 1 },
  { id: 'guardian-lina', schoolId: admissionsSchoolId, fullName: 'Lina Okafor', phone: '+2348010001005', email: 'lina@example.test', version: 1 },
];
const students: AdmissionStudent[] = [
  { id: 'student-amina', schoolId: admissionsSchoolId, admissionNumber: 'GF/26/011', firstName: 'Amina', lastName: 'Bello', dateOfBirth: '2018-05-12', version: 1 },
  { id: 'student-kofi', schoolId: admissionsSchoolId, admissionNumber: 'GF/26/012', firstName: 'Kofi', lastName: 'Bello', dateOfBirth: '2020-03-08', version: 1 },
  { id: 'student-nia', schoolId: admissionsSchoolId, admissionNumber: 'GF/26/013', firstName: 'Nia', lastName: 'Okafor', dateOfBirth: '2019-07-21', version: 1 },
];
const guardianLinks: GuardianLink[] = [
  { id: 'link-amina-samira', schoolId: admissionsSchoolId, studentId: 'student-amina', guardianId: 'guardian-samira', relationship: 'parent', isPrimary: true, isEmergency: true, active: true },
  { id: 'link-amina-tunde', schoolId: admissionsSchoolId, studentId: 'student-amina', guardianId: 'guardian-tunde', relationship: 'parent', isPrimary: false, isEmergency: true, active: true },
  { id: 'link-kofi-samira', schoolId: admissionsSchoolId, studentId: 'student-kofi', guardianId: 'guardian-samira', relationship: 'parent', isPrimary: true, isEmergency: true, active: true },
  { id: 'link-nia-adaeze', schoolId: admissionsSchoolId, studentId: 'student-nia', guardianId: 'guardian-adaeze', relationship: 'legal_guardian', isPrimary: true, isEmergency: true, active: true },
];
const applicants: AdmissionApplicant[] = [
  applicant('app-laila', 'Laila', 'Bello', '2021-09-04', 'submitted', 'level-nursery-1', 'class-level-nursery-1-green', 'guardian-samira', 'Samira Bello', '+2348010001001', 'samira@example.test', 'parent', ['New application received.']),
  applicant('app-ibrahim', 'Ibrahim', 'Danjuma', '2019-02-19', 'reviewing', 'level-primary-1', 'class-level-primary-1-green', 'guardian-adaeze', 'Adaeze Nwosu', '+2348010001003', 'adaeze@example.test', 'legal_guardian', ['Placement and documents are under review.']),
  applicant('app-zara', 'Zara', 'Eze', '2020-11-11', 'approved', 'level-nursery-2', 'class-level-nursery-2-gold', 'guardian-kamal', 'Kamal Eze', '+2348010001004', 'kamal@example.test', 'parent', ['Approved for the 2026 / 2027 session.']),
  applicant('app-eli', 'Eli', 'Mensah', '2018-01-25', 'waitlisted', 'level-primary-2', 'class-level-primary-2-green', 'guardian-lina', 'Lina Okafor', '+2348010001005', 'lina@example.test', 'legal_guardian', ['Waitlisted pending a section opening.']),
  applicant('app-nia-duplicate', 'Nia', 'Okafor', '2019-07-21', 'rejected', 'level-primary-1', 'class-level-primary-1-gold', 'guardian-adaeze', 'Adaeze Nwosu', '+2348010001003', 'adaeze@example.test', 'legal_guardian', ['Duplicate student record detected; no student was created.']),
  applicant('app-sade-draft', 'Sade', 'Adeyemi', '2022-04-16', 'draft', 'level-creche', 'class-level-creche-gold', 'guardian-tunde', 'Tunde Bello', '+2348010001002', 'tunde@example.test', 'parent', []),
];
const approvedApplicant = applicants.find(item => item.id === 'app-zara');
if (approvedApplicant) {
  approvedApplicant.guardianIds.push('guardian-lina');
  approvedApplicant.guardianRelationships.push({ guardianId: 'guardian-lina', relationship: 'legal_guardian', isPrimary: false, isEmergency: false });
}

export function newAdmissionsPreviewState(): AdmissionPreviewState {
  return {
    schoolId: admissionsSchoolId, finalPrimaryYear: 5, structure: admissionsStructure,
    classes: admissionsClasses.map(item => ({ ...item })),
    sessions: [{ id: 'session-2026', schoolId: admissionsSchoolId, label: '2026 / 2027', active: true }, { id: 'session-2025', schoolId: admissionsSchoolId, label: '2025 / 2026', active: false }],
    memberships: memberships.map(item => ({ ...item })), applicants: applicants.map(item => ({ ...item, guardianIds: [...item.guardianIds], guardianRelationships: item.guardianRelationships.map(link => ({ ...link })), notes: [...item.notes], decisionHistory: [...item.decisionHistory] })),
    guardians: guardians.map(item => ({ ...item })), guardianLinks: guardianLinks.map(item => ({ ...item })), relationshipHistory: [], students: students.map(item => ({ ...item })),
    enrollments: [
      { id: 'enrollment-amina', schoolId: admissionsSchoolId, studentId: 'student-amina', classId: 'class-level-primary-3-green', sessionId: 'session-2026', status: 'active' },
      { id: 'enrollment-kofi', schoolId: admissionsSchoolId, studentId: 'student-kofi', classId: 'class-level-nursery-2-gold', sessionId: 'session-2026', status: 'active' },
      { id: 'enrollment-nia', schoolId: admissionsSchoolId, studentId: 'student-nia', classId: 'class-level-primary-1-gold', sessionId: 'session-2026', status: 'active' },
    ], auditEvents: [], idempotency: [],
  };
}

function applicant(id: string, firstName: string, lastName: string, dateOfBirth: string, status: AdmissionApplicant['status'], requestedLevelId: string, proposedClassId: string, guardianId: string, guardianName: string, phone: string, email: string, relationship: AdmissionApplicant['guardian']['relationship'], notes: string[]): AdmissionApplicant {
  const history = status === 'draft'
    ? [{ from: null, to: 'draft' as const, note: '', actorMembershipId: admissionsAdmin.membershipId, createdAt: '2026-08-10T09:00:00.000Z' }]
    : [
      { from: null, to: 'submitted' as const, note: 'Application submitted.', actorMembershipId: admissionsAdmin.membershipId, createdAt: '2026-08-10T09:00:00.000Z' },
      ...(status === 'submitted' ? [] : [{ from: 'submitted' as const, to: 'reviewing' as const, note: 'Review started.', actorMembershipId: admissionsAdmin.membershipId, createdAt: '2026-08-11T09:00:00.000Z' }]),
      ...(['approved', 'rejected', 'waitlisted'].includes(status) ? [{ from: 'reviewing' as const, to: status as 'approved' | 'rejected' | 'waitlisted', note: notes.at(-1) ?? '', actorMembershipId: admissionsAdmin.membershipId, createdAt: '2026-08-12T09:00:00.000Z' }] : []),
    ];
  return {
    id, schoolId: admissionsSchoolId, firstName, lastName, dateOfBirth, requestedLevelId, proposedClassId,
    guardian: { fullName: guardianName, phone, email, relationship, isPrimary: true, isEmergency: true },
    status, version: history.length, submittedAt: '2026-08-10T09:00:00.000Z', guardianIds: [guardianId],
    guardianRelationships: [{ guardianId, relationship, isPrimary: true, isEmergency: true }], notes, decisionHistory: history,
  };
}
