import { notFound } from 'next/navigation';
import { StudentExitWorkspace } from '@/components/students/student-exit-workspace';

export default function StudentExitPreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <StudentExitWorkspace />;
}