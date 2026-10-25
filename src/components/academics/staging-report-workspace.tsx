'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { runStagingReportCommand } from '@/app/staging/report-cards/actions';
import type { StagingWorkspace, StagingReportRow } from '@/lib/academics/report-card-staging-ui';
import type { ReportCardRequestCommand } from '@/lib/academics/report-card-request-command';

type Selector = { classId: string; sessionId: string; termId: string };
const labels = { draft: 'Draft', submitted: 'Awaiting review', returned: 'Returned for correction', approved: 'Approved', published: 'Published in staging' };
const actionLabels = { create: 'Create draft', submit: 'Submit for review', return: 'Return for correction', approve: 'Approve', reopen: 'Reopen draft', publish: 'Publish test report', revoke: 'Withdraw test report' };

export function StagingReportWorkspace({ workspace, selector, intentId, commandsEnabled }: {
  workspace: StagingWorkspace; selector: Selector; intentId: string; commandsEnabled: boolean;
}) {
  const [result, dispatch, pending] = useActionState(runStagingReportCommand, null);
  // The action's revalidatePath already refreshes this workspace in its response.
  // A second router.refresh repeats the expensive, locking source read.
  function actionForm(action: ReportCardRequestCommand['action'], fields: Record<string, string | number>, key: string) {
    return <form action={dispatch} className="staging-command" key={action + ':' + key}>
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="operationKey" value={`${intentId}:${action}:${key}`} />
      {Object.entries(fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={String(value)} />)}
      {(action === 'return' || action === 'revoke') && <label>Reason for {action === 'return' ? 'correction' : 'withdrawal'}<textarea name="reason" rows={2} required maxLength={2000} disabled={pending || !commandsEnabled} /></label>}
      {(action === 'publish' || action === 'revoke') && <label className="staging-confirm"><input type="checkbox" required disabled={pending || !commandsEnabled} />I confirm this change to the test report.</label>}
      <button className={action === 'submit' || action === 'create' || action === 'approve' ? 'primary' : ''} type="submit" disabled={pending || !commandsEnabled}>{actionLabels[action]}</button>
    </form>;
  }
  function reportActions(report: StagingReportRow) {
    const base = { reportId: report.reportId, expectedVersion: report.version };
    const form = (action: ReportCardRequestCommand['action'], extra: Record<string, string> = {}) => actionForm(action, { ...base, ...extra }, report.reportId);
    if (workspace.role === 'teacher') return ['draft', 'returned'].includes(report.stage) ? form('submit') : <p className="muted">Waiting for administrator review.</p>;
    if (report.stage === 'submitted') return <>{form('approve')}{form('return')}</>;
    if (report.stage === 'approved') return <>{form('publish')}{form('reopen')}</>;
    if (report.stage === 'published' && report.releaseId) return form('revoke', { releaseId: report.releaseId });
    return <p className="muted">Waiting for the assigned teacher to submit.</p>;
  }
  return <>
    <section className="card staging-summary"><h2>Current class workspace</h2><p>Signed in as {workspace.role === 'admin' ? 'administrator' : 'assigned teacher'}. {workspace.pupils.length} pupils · {workspace.subjectCount} subjects in roster · source revision {workspace.assessmentRevision}.</p>
      <p className="muted">This list shows report status. Complete results are verified when you submit, approve, publish or open an approved result.</p>
      {!commandsEnabled && <p role="status">Read-only mode. Report actions are disabled.</p>}
      {pending && <p role="status">Saving the test report. This connection can take a few minutes; leave this page open.</p>}
      {result && <p role="status">{result.ok ? `Report ${result.kind === 'replay' ? 'already saved' : 'saved'}: ${labels[result.stage]}.` : result.code === 'forbidden' ? 'Your access has changed or this action is not permitted. Refresh before continuing.' : result.code === 'conflict' ? 'The report changed. Refresh to use the current version.' : result.code === 'invalid' ? 'Check the form details and try again.' : 'Unable to save. Retry this same form safely, or refresh to check the report.'}</p>}
    </section>
    <section className="staging-pupils" aria-label="Student report workflow">{workspace.pupils.length === 0 ? <div className="card"><h2>No eligible pupils</h2><p>No active enrollments are available for this class.</p></div> : workspace.pupils.map(pupil => {
      const report = workspace.reports.find(r => r.enrollmentId === pupil.enrollmentId);
      return <article className="card" key={pupil.enrollmentId}><div className="staging-pupil-heading"><h2>{pupil.label}</h2><span>{report ? labels[report.stage] : 'No report yet'}</span></div>
        {report && <p className="muted">Report version {report.version}</p>}
        {report && ['approved', 'published'].includes(report.stage) && <p><Link href={'/staging/report-cards/' + report.reportId} prefetch={false}>View approved result / print test copy</Link></p>}
        {report?.returnReason && <p>Correction requested: {report.returnReason}</p>}
        <div className="staging-command-list">{report ? reportActions(report) : workspace.role === 'teacher' ? actionForm('create', { ...selector, studentId: pupil.studentId, enrollmentId: pupil.enrollmentId }, pupil.enrollmentId) : <p className="muted">The assigned teacher can create this test report.</p>}</div>
      </article>;
    })}</section>
  </>;
}
