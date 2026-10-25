import { notFound } from 'next/navigation';
import { stagingUiEnabled } from '@/lib/academics/report-card-staging-ui';
import '@/components/academics/staging-loading.css';
export default function Loading() {
  if (!stagingUiEnabled(process.env)) notFound();
  return <main className="content staging-loading" aria-busy="true"><p className="staging-loading-status" role="status"><span className="staging-spinner" aria-hidden="true" />Loading staff dashboard…</p><div aria-hidden="true"><div className="staging-skeleton staging-skeleton-title" />{[0,1,2].map(i=><div className="card staging-skeleton-card" key={i}><div className="staging-skeleton staging-skeleton-line" /><div className="staging-skeleton staging-skeleton-line staging-skeleton-short" /></div>)}</div></main>;
}
