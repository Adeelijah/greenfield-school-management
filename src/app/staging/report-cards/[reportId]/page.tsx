import Link from 'next/link';
import { StagingLinkProgress } from '@/components/academics/staging-pending';
import { notFound, redirect } from 'next/navigation';
import { stagingUiEnabled } from '@/lib/academics/report-card-staging-ui';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { readLocalStagingResult } from '@/server/academics/report-card-staging-result';
import { StagingReportPrint } from '@/components/academics/staging-report-print';
import './staging-result.css';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = { title: 'Test result | Greenfield Staging', robots: { index: false, follow: false } };

export default async function StagingResultPage({ params }: { params: Promise<{ reportId: string }> }) {
  if (!stagingUiEnabled(process.env)) notFound();
  const client = await createSupabaseServerClient();
  const verified = await client.auth.getUser();
  if (verified.error || !verified.data.user) redirect('/staging/login');
  const { reportId } = await params;
  const result = await readLocalStagingResult(reportId);
  if (!result.ok) return <main className="content staging-result"><Link href="/staging/report-cards" prefetch={false}>Back to report cards<StagingLinkProgress /></Link><section className="card"><h1>Result unavailable</h1><p>{result.code === 'forbidden' ? 'This report is not approved, has been withdrawn, or your current account does not have access.' : 'The approved result could not be verified. No replacement result has been generated.'}</p></section></main>;
  const { view } = result;
  return <main className="content staging-result">
    <nav className="result-tools" aria-label="Report tools"><Link href="/staging/report-cards" prefetch={false}>Back to report cards<StagingLinkProgress /></Link><StagingReportPrint /></nav>
    <article className="card result-paper" aria-label="Approved fictional result">
      <header><p className="result-test-mark">TEST COPY · NOT AN OFFICIAL RESULT</p><h1>Greenfield Staging</h1><h2>Student progress report</h2><p>{view.stage === 'published' ? 'Published in staging' : 'Approved · not published'}</p></header>
      <dl className="result-details"><div><dt>Directory name (current)</dt><dd>{result.directoryName}</dd></div><div><dt>Class</dt><dd>{result.classLabel}</dd></div><div><dt>Academic session</dt><dd>{view.sessionStartsOn} to {view.sessionEndsOn}</dd></div><div><dt>Term dates</dt><dd>{view.termStartsOn} to {view.termEndsOn}</dd></div></dl>
      <div className="result-table-wrap" role="region" aria-label="Approved subject results" tabIndex={0}><table><caption>Results saved at approval</caption><thead><tr><th scope="col">Subject / learning area</th><th scope="col">Score</th><th scope="col">Grade / observation</th></tr></thead><tbody>{view.subjects.map((s, i) => <tr key={i}><th scope="row">{s.name}</th><td>{s.total === null ? '—' : s.total + '%'}</td><td>{s.grade ?? s.observations.join('; ')}</td></tr>)}</tbody></table></div>
      <footer><p>Approved version {view.approvedVersion} · source revision {view.sourceRevision}</p><p>Approved at {view.approvedAt} (UTC)</p><p>Scores and observations come from the immutable approved result. The directory name is current and is not part of that snapshot.</p><p>Fictional academic review records were operator-seeded. Attendance, remarks and parent delivery are unavailable in this test report.</p></footer>
    </article>
  </main>;
}
