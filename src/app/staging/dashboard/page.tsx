import { notFound, redirect } from 'next/navigation';
import { stagingUiEnabled } from '@/lib/academics/report-card-staging-ui';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { readStagingStaffAccount } from '@/server/accounts/staging-staff-account';
import { AccountDesignWorkspace } from '@/components/account-design/account-design-workspace';
import { signOutOfStaging } from '../login/actions';
import { StagingPendingButton } from '@/components/academics/staging-pending';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Staff dashboard | Greenfield staging', robots: { index: false, follow: false } };
export default async function StagingDashboardPage() {
  if (!stagingUiEnabled(process.env)) notFound();
  const client = await createSupabaseServerClient();
  const auth = await client.auth.getUser();
  if (auth.error || !auth.data.user) redirect('/staging/login');
  const role = await readStagingStaffAccount();
  if (!role) return <main className="content"><section className="card"><h1>Account workspace unavailable</h1><p>A unique active staging staff membership could not be verified. The staff lookup may need installation, or your access may have changed. No account role was assumed.</p><form action={signOutOfStaging}><StagingPendingButton label="Sign out" pendingLabel="Signing out…" /></form></section></main>;
  return <AccountDesignWorkspace key={role} initialRole={role} preview={false} />;
}
