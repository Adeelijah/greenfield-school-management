import { randomUUID } from 'node:crypto';
import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { StagingPendingButton, StagingLinkProgress } from '@/components/academics/staging-pending';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { stagingUiEnabled, stagingCommandsEnabled, stagingSelector, stagingClassChoices } from '@/lib/academics/report-card-staging-ui';
import { readLocalStagingWorkspace } from '@/server/academics/report-card-staging-workspace';
import { signOutOfStaging } from '../login/actions';
import { StagingReportWorkspace } from '@/components/academics/staging-report-workspace';
import './staging-report-cards.css';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const metadata = { title: 'Staging report cards | Greenfield', robots: { index: false, follow: false } };

export default async function StagingReportCardsPage({ searchParams }: { searchParams: Promise<{ class?: string }> }) {
  if (!stagingUiEnabled(process.env)) notFound();
  const client = await createSupabaseServerClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect('/staging/login');
  const query = await searchParams;
  const choice = typeof query.class === 'string' ? query.class : 'primary5';
  const selector = stagingSelector(choice);
  if (!selector) notFound();
  const result = await readLocalStagingWorkspace(choice);
  return <main className="content staging-reports">
    <header className="page-heading"><div><p className="muted">GREENFIELD STAGING · TEST DATA</p><h1>Report cards</h1><p>TEST Term 1 · 2026/27 · Primary 5 school</p></div><form action={signOutOfStaging}><StagingPendingButton label="Sign out" pendingLabel="Signing out…" /></form></header>
    <nav className="staging-class-links" aria-label="Staff workspace"><Link href="/staging/dashboard" prefetch={false}>Dashboard<StagingLinkProgress /></Link><Link href="/staging/reports" prefetch={false}>Report cards<StagingLinkProgress /></Link><Link href="/staging/account-design" prefetch={false}>Design preview<StagingLinkProgress /></Link></nav>
    <nav className="staging-class-links" aria-label="Class selection">{stagingClassChoices.map(c => <Link key={c.key} href={'/staging/report-cards?class=' + c.key} prefetch={false} aria-current={choice === c.key ? 'page' : undefined}>{c.label}<StagingLinkProgress /></Link>)}</nav>
    {!result.ok ? <section className="card"><h2>{result.code === 'forbidden' ? 'Academic access unavailable' : 'Unable to load report cards'}</h2><p>{result.code === 'forbidden' ? 'Your current account does not have access to this class. Sign in with an assigned teacher or administrator account.' : 'Check the local staging connection and finalized source, then refresh. No report action was performed.'}</p></section>
      : <StagingReportWorkspace workspace={result.workspace} selector={selector} intentId={randomUUID()} commandsEnabled={stagingCommandsEnabled(process.env)} />}
    <p className="muted staging-note">Fictional staging records. Academic reviews and finalizations were operator-seeded; they do not prove staff review through the app. Report actions save test records when enabled. Parent delivery is unavailable. Approved results can be printed as test copies.</p>
  </main>;
}
