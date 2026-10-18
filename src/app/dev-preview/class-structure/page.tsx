import { notFound } from 'next/navigation';
import { ClassStructureEditor } from '@/components/academics/class-structure-editor';

export default function ClassStructurePreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <ClassStructureEditor />;
}