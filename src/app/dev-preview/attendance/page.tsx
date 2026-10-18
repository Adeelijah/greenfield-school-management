import { notFound } from 'next/navigation';
import { AppShell } from '@/components/app-shell';
import { AttendanceWorkspace } from '@/components/attendance/attendance-workspace';

export const dynamic = 'force-dynamic';

export default function AttendanceDevelopmentPreview() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <AppShell><AttendanceWorkspace /></AppShell>;
}
