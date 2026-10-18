import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { AcademicOperationsWorkspace } from '@/components/academics/academic-operations-workspace';

export const dynamic = 'force-dynamic';

export default function AcademicOperationsDevelopmentPreview() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <AppShell><AcademicOperationsWorkspace /></AppShell>;
}
