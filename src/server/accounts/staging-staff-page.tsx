import { notFound, redirect } from 'next/navigation';
import { readStagingStaffPage } from '@/server/accounts/staging-academic-entry';
import type { AcademicPage } from '@/lib/accounts/staging-academic-pages';
import { AccountDesignWorkspace } from '@/components/account-design/account-design-workspace';
import { signOutOfStaging } from '@/app/staging/login/actions';
import { StagingPendingButton } from '@/components/academics/staging-pending';

export async function renderStagingStaffPage(view?: AcademicPage, selectedClass: unknown = 'all') {
  const result = await readStagingStaffPage(view, selectedClass);
  if (result.kind === 'not-found') notFound();
  if (result.kind === 'sign-in') redirect('/staging/login');
  if (result.kind === 'unavailable') return <main className="content"><section className="card"><h1>Account workspace unavailable</h1><p>A unique active staging staff membership could not be verified. Your access may have changed. No account role was assumed.</p><form action={signOutOfStaging}><StagingPendingButton label="Sign out" pendingLabel="Signing out…" /></form></section></main>;
  return <AccountDesignWorkspace key={result.role + ':' + (view ?? 'overview') + ':' + result.selectedClass} initialRole={result.role} preview={false} liveData={result.data} academicView={view} initialClass={result.selectedClass} assessmentEditor={result.editor} />;
}
