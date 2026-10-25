import type { DashboardRecord, StagingDashboardData } from './staging-dashboard';
export type AcademicPage = 'students' | 'classes' | 'reports' | 'attendance' | 'assessments';
export function canOpenAcademicPage(role: string, page: AcademicPage): boolean {
  return page === 'students' ? role === 'admin' : page === 'classes' ? role === 'teacher' : ['reports','attendance','assessments'].includes(page) && (role === 'admin' || role === 'teacher');
}
export function academicPageHref(label: string, role: string): string | null {
  if (label === 'Attendance' && (role === 'admin' || role === 'teacher')) return '/staging/attendance';
  if ((label === 'Assessments' || label === 'Academics') && (role === 'admin' || role === 'teacher')) return '/staging/assessments';
  if (label === 'Overview') return '/staging/dashboard';
  if (label === 'Students' && role === 'admin') return '/staging/students';
  if (label === 'My classes' && role === 'teacher') return '/staging/classes';
  if (label === 'Report cards' && (role === 'admin' || role === 'teacher')) return '/staging/reports';
  return null;
}
export function filterAcademicRecords(data: StagingDashboardData, search: string, classKey: string, stage: string): DashboardRecord[] {
  const query = search.trim().toLowerCase().slice(0, 200);
  return data.records.filter(r => (classKey === 'all' || r.classKey === classKey) && (stage === 'all' || r.reportStage === stage) &&
    `${r.name} ${r.id}`.toLowerCase().includes(query));
}
export function reportWorkflowHref(classKey: string): string | null {
  return classKey === 'primary5' || classKey === 'creche' ? '/staging/report-cards?class=' + classKey : null;
}
