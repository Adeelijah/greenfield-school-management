import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { LifecyclePreviewWorkspace } from '@/components/students/lifecycle-preview-workspace';

export const dynamic = 'force-dynamic';

export default function StudentsDevelopmentPreview() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <AppShell><LifecyclePreviewWorkspace /></AppShell>;
}
