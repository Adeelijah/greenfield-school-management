import type { StagingWorkspace } from '../academics/report-card-staging-ui';
export type DashboardRecord = { id: string; name: string; klass: string; status: string; balance: number | null; attendance: string; reportStatus: string; method: string; amount: number | null; receipt: string };
export type StagingDashboardData = { records: DashboardRecord[]; metrics: [string, string][]; tasks: string[]; scope: string };
export const dashboardReportLabels = { draft: 'Draft', submitted: 'Awaiting review', returned: 'Returned', approved: 'Approved', published: 'Published' };
/** Projection only: caller supplies separately authorized class indexes. This
 * is not a school-wide count or proof of finalized academic content. */
export function projectStagingDashboard(role: 'admin' | 'teacher', classes: { label: string; workspace: StagingWorkspace }[]): StagingDashboardData | null {
  const records: DashboardRecord[] = [], seen = new Set<string>();
  let submitted = 0, pending = 0, published = 0;
  for (const c of classes) {
    const w = c.workspace;
    if (w.role !== role || !c.label || new Set(w.reports.map(r => r.enrollmentId)).size !== w.reports.length) return null;
    if (w.reports.some(r => !w.pupils.some(p => p.enrollmentId === r.enrollmentId && p.studentId === r.studentId))) return null;
    for (const p of w.pupils) {
      if (seen.has(p.studentId)) return null;
      seen.add(p.studentId);
      const report = w.reports.find(r => r.enrollmentId === p.enrollmentId);
      if (!report || ['draft', 'returned'].includes(report.stage)) pending++;
      if (report?.stage === 'submitted') submitted++;
      if (report?.stage === 'published') published++;
      records.push({ id: p.studentId, name: p.label, klass: c.label, status: 'Active enrollment', balance: null, attendance: 'Not connected', reportStatus: report ? dashboardReportLabels[report.stage] : 'Not created', method: 'Not connected', amount: null, receipt: '' });
    }
  }
  return { records, metrics: [[String(records.length), 'Pupils in available test classes'], [String(classes.length), 'Available test classes'], [String(role === 'admin' ? submitted : pending), role === 'admin' ? 'Reports awaiting review' : 'Reports not submitted'], [String(published), 'Published test reports']],
    tasks: role === 'admin' ? [`${submitted} reports awaiting review`, `${published} published test reports`] : [`${pending} reports not submitted`, `${submitted} reports awaiting administrator review`],
    scope: 'Available fictional staging classes · TEST Term 1 · 2026/27. Each class is verified independently; these are not school-wide totals.' };
}
