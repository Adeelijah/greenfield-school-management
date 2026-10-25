import './staging-loading.css';

export function StagingReportSkeleton({ result = false }: { result?: boolean }) {
  return <main className="content staging-loading" aria-busy="true" aria-label={result ? 'Loading approved result' : 'Loading report cards'}>
    <p className="staging-loading-status" role="status"><span className="staging-spinner" aria-hidden="true" />{result ? 'Loading approved result…' : 'Loading report cards…'}</p>
    <div aria-hidden="true">
      {result ? <div className="card staging-skeleton-paper"><div className="staging-skeleton staging-skeleton-heading" />{[0, 1, 2].map(i => <div className="staging-skeleton staging-skeleton-line" key={i} />)}{[0, 1, 2, 3].map(i => <div className="staging-skeleton staging-skeleton-row" key={i} />)}</div>
        : <><div className="staging-skeleton staging-skeleton-title" /><div className="staging-skeleton-tabs">{[0, 1].map(i => <div className="staging-skeleton staging-skeleton-tab" key={i} />)}</div>{[0, 1, 2].map(i => <div className="card staging-skeleton-card" key={i}><div className="staging-skeleton staging-skeleton-line staging-skeleton-short" /><div className="staging-skeleton staging-skeleton-line" /><div className="staging-skeleton staging-skeleton-button" /></div>)}</>}
    </div>
  </main>;
}
