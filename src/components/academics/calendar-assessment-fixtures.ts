import type { AcademicClass, AcademicSubject, AssessmentConfig, AssessmentSnapshot, CalendarSnapshot, Enrollment, Session, Term, TeacherAssignment } from '@/lib/academics/calendar-assessments';

export const previewSchoolId = 'fictional-greenfield';
export const calendarSessions: Session[] = [
  { id:'session-2026-27',schoolId:previewSchoolId,name:'2026 / 2027',startDate:'2026-08-24',endDate:'2027-07-16',status:'active',version:1 },
  { id:'session-2027-28',schoolId:previewSchoolId,name:'2027 / 2028',startDate:'2027-08-23',endDate:'2028-07-14',status:'upcoming',version:1 },
];
export const calendarTerms: Term[] = [
  { id:'term-26-1',schoolId:previewSchoolId,sessionId:'session-2026-27',number:1,name:'First Term',startDate:'2026-08-24',endDate:'2026-12-18',version:1 },
  { id:'term-26-2',schoolId:previewSchoolId,sessionId:'session-2026-27',number:2,name:'Second Term',startDate:'2027-01-11',endDate:'2027-04-02',version:1 },
  { id:'term-26-3',schoolId:previewSchoolId,sessionId:'session-2026-27',number:3,name:'Third Term',startDate:'2027-04-19',endDate:'2027-07-16',version:1 },
  { id:'term-27-1',schoolId:previewSchoolId,sessionId:'session-2027-28',number:1,name:'First Term',startDate:'2027-08-23',endDate:'2027-12-17',version:1 },
  { id:'term-27-2',schoolId:previewSchoolId,sessionId:'session-2027-28',number:2,name:'Second Term',startDate:'2028-01-10',endDate:'2028-03-31',version:1 },
  { id:'term-27-3',schoolId:previewSchoolId,sessionId:'session-2027-28',number:3,name:'Third Term',startDate:'2028-04-17',endDate:'2028-07-14',version:1 },
];
export const initialCalendar: CalendarSnapshot = { schoolId:previewSchoolId,sessions:calendarSessions,terms:calendarTerms,version:1,events:[
  {id:'event-reopening',schoolId:previewSchoolId,sessionId:'session-2026-27',termId:'term-26-1',kind:'resumption',title:'School resumes',startDate:'2026-08-24',endDate:'2026-08-24',description:'Welcome back for the new academic year.',status:'scheduled',version:1},
  {id:'event-midterm',schoolId:previewSchoolId,sessionId:'session-2026-27',termId:'term-26-1',kind:'holiday',title:'Mid-term break',startDate:'2026-10-19',endDate:'2026-10-23',description:'School holiday.',status:'scheduled',version:1},
  {id:'event-exams',schoolId:previewSchoolId,sessionId:'session-2026-27',termId:'term-26-1',kind:'examination',title:'First term assessment week',startDate:'2026-12-07',endDate:'2026-12-11',description:'Class assessments and examinations.',status:'scheduled',version:1},
]};

export const assessmentClasses: AcademicClass[] = [
  {id:'class-primary-5-cedar',schoolId:previewSchoolId,levelId:'primary-5',sectionId:'section-cedar',active:true},
  {id:'class-primary-5-maple',schoolId:previewSchoolId,levelId:'primary-5',sectionId:'section-maple',active:true},
  {id:'class-nursery-2-sunbird',schoolId:previewSchoolId,levelId:'nursery-2',sectionId:'section-sunbird',active:true},
  {id:'class-creche-green',schoolId:previewSchoolId,levelId:'creche',sectionId:'section-green',active:true},
];
export const assessmentLevels = [
  {id:'primary-5',schoolId:previewSchoolId,stage:'primary' as const,primaryYear:5,active:true},
  {id:'nursery-2',schoolId:previewSchoolId,stage:'nursery' as const,primaryYear:null,active:true},
  {id:'creche',schoolId:previewSchoolId,stage:'creche' as const,primaryYear:null,active:true},
];
export const assessmentSubjects: AcademicSubject[] = [
  {id:'subject-math',schoolId:previewSchoolId,levelId:'primary-5',classIds:['class-primary-5-cedar','class-primary-5-maple'],active:true},
  {id:'subject-literacy',schoolId:previewSchoolId,levelId:'primary-5',classIds:['class-primary-5-cedar','class-primary-5-maple'],active:true},
  {id:'subject-discovery',schoolId:previewSchoolId,levelId:'creche',classIds:['class-creche-green'],active:true},
];
export const assessmentStudents = [
  {id:'student-amina',schoolId:previewSchoolId,name:'Amina Bello',admissionNumber:'GF-2401'},
  {id:'student-kofi',schoolId:previewSchoolId,name:'Kofi Mensah',admissionNumber:'GF-2402'},
  {id:'student-nia',schoolId:previewSchoolId,name:'Nia Okafor',admissionNumber:'GF-2403'},
  {id:'student-tomi',schoolId:previewSchoolId,name:'Tomi Adeyemi',admissionNumber:'GF-2404'},
  {id:'student-early-years',schoolId:previewSchoolId,name:'Fictional early-years learner',admissionNumber:'GF-EY-01'},
];
export const assessmentEnrollments: Enrollment[] = [
  ...assessmentStudents.map(student=>({schoolId:previewSchoolId,studentId:student.id,classId:'class-primary-5-cedar',sessionId:'session-2026-27',status:'active' as const})),
  {schoolId:previewSchoolId,studentId:'student-early-years',classId:'class-creche-green',sessionId:'session-2026-27',status:'active'},
];
export const assessmentAssignments: TeacherAssignment[] = [
  {schoolId:previewSchoolId,membershipId:'membership-teacher',classId:'class-primary-5-cedar',sessionId:'session-2026-27',subjectIds:['subject-math','subject-literacy'],status:'active'},
];
const bands=[{min:0,max:40,label:'Needs support',remark:'Work with a teacher.'},{min:40,max:55,label:'Developing'},{min:55,max:70,label:'Secure'},{min:70,max:85,label:'Strong'},{min:85,max:100,label:'Excellent'}];
export const assessmentConfigs: AssessmentConfig[] = [
  {id:'config-primary-math',schoolId:previewSchoolId,levelId:'primary-5',subjectId:'subject-math',termId:'term-26-1',components:[{id:'math-ca',label:'Continuous assessment',category:'ca',weight:30,maximumScore:30,required:true},{id:'math-project',label:'Class task',category:'other',weight:20,maximumScore:20,required:true},{id:'math-exam',label:'Examination',category:'exam',weight:50,maximumScore:100,required:true}],grading:{mode:'numeric',bands},status:'finalized',version:2},
  {id:'config-creche-observation',schoolId:previewSchoolId,levelId:'creche',subjectId:'subject-discovery',termId:'term-26-1',components:[{id:'creche-curiosity',label:'Curiosity',category:'other',weight:50,maximumScore:3,required:true},{id:'creche-sharing',label:'Sharing with others',category:'other',weight:50,maximumScore:3,required:true}],grading:{mode:'observational',levels:[{id:'1',label:'Beginning'},{id:'2',label:'Growing'},{id:'3',label:'Consistent'}]},status:'finalized',version:1},
];
export const initialAssessment: AssessmentSnapshot = {
  schoolId:previewSchoolId,sessions:calendarSessions,terms:calendarTerms,levels:assessmentLevels,classes:assessmentClasses,subjects:assessmentSubjects,enrollments:assessmentEnrollments,assignments:assessmentAssignments,configs:assessmentConfigs,
  scores:[
    {schoolId:previewSchoolId,studentId:'student-amina',classId:'class-primary-5-cedar',sessionId:'session-2026-27',termId:'term-26-1',subjectId:'subject-math',componentId:'math-ca',value:26},
    {schoolId:previewSchoolId,studentId:'student-amina',classId:'class-primary-5-cedar',sessionId:'session-2026-27',termId:'term-26-1',subjectId:'subject-math',componentId:'math-project',value:18},
    {schoolId:previewSchoolId,studentId:'student-amina',classId:'class-primary-5-cedar',sessionId:'session-2026-27',termId:'term-26-1',subjectId:'subject-math',componentId:'math-exam',value:84},
    {schoolId:previewSchoolId,studentId:'student-kofi',classId:'class-primary-5-cedar',sessionId:'session-2026-27',termId:'term-26-1',subjectId:'subject-math',componentId:'math-ca',value:21},
    {schoolId:previewSchoolId,studentId:'student-kofi',classId:'class-primary-5-cedar',sessionId:'session-2026-27',termId:'term-26-1',subjectId:'subject-math',componentId:'math-project',value:16},
    {schoolId:previewSchoolId,studentId:'student-kofi',classId:'class-primary-5-cedar',sessionId:'session-2026-27',termId:'term-26-1',subjectId:'subject-math',componentId:'math-exam',value:72},
    {schoolId:previewSchoolId,studentId:'student-early-years',classId:'class-creche-green',sessionId:'session-2026-27',termId:'term-26-1',subjectId:'subject-discovery',componentId:'creche-curiosity',value:3},
    {schoolId:previewSchoolId,studentId:'student-early-years',classId:'class-creche-green',sessionId:'session-2026-27',termId:'term-26-1',subjectId:'subject-discovery',componentId:'creche-sharing',value:2},
  ],reviews:[],version:1,finalizedKeys:[],
};
