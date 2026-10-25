import { notFound } from 'next/navigation';
import { stagingUiEnabled } from '@/lib/academics/report-card-staging-ui';
import { AccountDashboardSkeleton } from '@/components/account-design/account-dashboard-skeleton';
export default function Loading() {
  if (!stagingUiEnabled(process.env)) notFound();
  return <AccountDashboardSkeleton view="directory" />;
}
