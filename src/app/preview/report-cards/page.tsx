import { notFound } from 'next/navigation';
import { ReportCardWorkspace } from '@/components/academics/report-card-workspace';

export default function ReportCardsPreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <div style={{maxWidth:1450,margin:'0 auto',padding:'28px clamp(14px,3vw,36px)'}}><ReportCardWorkspace /></div>;
}
