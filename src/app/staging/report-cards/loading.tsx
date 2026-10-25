import { notFound } from 'next/navigation';
import { stagingUiEnabled } from '@/lib/academics/report-card-staging-ui';
import { StagingReportSkeleton } from '@/components/academics/staging-report-skeleton';

export default function Loading() {
  if (!stagingUiEnabled(process.env)) notFound();
  return <StagingReportSkeleton />;
}
