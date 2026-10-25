import { notFound, redirect } from 'next/navigation';
import { stagingUiEnabled } from '@/lib/academics/report-card-staging-ui';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AccountDesignWorkspace } from '@/components/account-design/account-design-workspace';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Account design preview | Greenfield', robots: { index: false, follow: false } };

export default async function AccountDesignPage() {
  if (!stagingUiEnabled(process.env)) notFound();
  const client = await createSupabaseServerClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect('/staging/login');
  return <AccountDesignWorkspace />;
}
