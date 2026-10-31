import './account-design.css';
import './account-dashboard-skeleton.css';

function Line({ short = false }: { short?: boolean }) {
  return <span className={'account-loading-shape account-loading-line' + (short ? ' short' : '')} />;
}
function RecordPlaceholder() {
  return <div className="account-record-card"><div className="account-record-heading"><span className="account-loading-shape account-record-avatar" /><div className="account-loading-grow"><Line /><Line short /></div></div><div className="account-record-facts"><span className="account-loading-shape account-loading-badge" /><span className="account-loading-shape account-loading-badge" /></div></div>;
}
/** Neutral geometry only: no role, pupil count or data is inferred while auth
 * and class reads are pending. Uses the real shell's responsive layout. */
export function AccountDashboardSkeleton({ view }: { view?: 'directory' | 'classes' | 'operations' | 'assessments' }) {
  return <div className={'account-design account-dashboard-loading' + (view ? ' account-page-loading-' + view : '')} aria-busy="true">
    <p className="account-sr-only" role="status">{view === 'operations' || view === 'assessments' ? 'Loading academic workspace…' : 'Loading staff dashboard…'}</p>
    <div aria-hidden="true">
      <div className="account-preview-bar"><span>Greenfield staging</span><div className="account-desktop-preview-tools"><Line short /></div></div>
      <aside className="account-sidebar"><div className="account-brand"><span className="account-loading-shape account-loading-brand-icon" /><div><strong>Greenfield</strong><span>Primary School</span></div></div><div className="account-loading-sidebar-label"><Line short /></div><div className="account-loading-nav">{[0,1,2,3,4,5,6].map(i=><div key={i}><span className="account-loading-shape account-loading-nav-icon" /><Line /></div>)}</div></aside>
      <div className="account-body"><div className="account-topbar"><span className="account-loading-shape account-loading-menu-icon" /><div className="account-mobile-brand">Greenfield</div><div className="account-search"><Line /></div><div className="account-profile"><span className="account-loading-shape account-avatar" /><span className="account-profile-name"><Line short /></span></div><span className="account-loading-shape account-loading-signout account-desktop-signout" /></div>
        <main className="account-main"><div className="account-heading"><div className="account-loading-grow"><span className="account-loading-shape account-loading-title" /><div className="account-heading-description"><Line /></div><span className="account-loading-mobile-term"><Line short /></span></div><span className="account-term"><Line short /></span></div>
          <div className="account-notice account-loading-scope"><Line /></div>
          <div className="account-metrics">{[0,1,2,3].map(i=><div className="account-panel account-metric" key={i}><span className="account-loading-shape account-metric-icon" /><div className="account-loading-grow"><span className="account-loading-shape account-loading-number" /><Line /></div></div>)}</div>
          {view === 'classes' && <div className="academic-loading-class-grid">{[0,1].map(i=><div className="account-panel academic-loading-class-card" key={i}><Line short /><Line /><div className="academic-loading-class-metrics">{[0,1,2,3].map(j=><div key={j}><Line short /><span className="account-loading-shape account-loading-number" /></div>)}</div><Line /><span className="account-loading-shape account-loading-action" /></div>)}</div>}
          {view === 'operations' && <div><div className="account-filters"><div className="account-loading-shape account-loading-control" /><div className="account-loading-shape account-loading-control" /></div><div className="account-panel operations-loading-panel"><Line short /><Line />{[0,1,2].map(i=><RecordPlaceholder key={i} />)}<span className="account-loading-shape account-loading-action" /></div></div>}
          {view === 'assessments' && <div><div className="account-filters"><div className="account-loading-shape account-loading-control" /><div className="account-loading-shape account-loading-control" /></div><Line /><div className="account-panel operations-loading-panel"><Line short /><Line /><div className="account-loading-shape score-loading-config" />{[0,1,2].map(i=><div className="score-loading-pupil" key={i}><Line short /><div className="score-loading-inputs">{[0,1].map(j=><div key={j}><Line short /><Line /><span className="account-loading-shape score-loading-input" /></div>)}</div></div>)}<Line short /><div className="account-loading-shape score-loading-reason" /><div className="score-loading-actions">{[0,1,2].map(i=><span key={i} className="account-loading-shape account-loading-action" />)}</div></div></div>}
          <div className="account-columns"><div className="account-panel account-table-panel"><div className="account-panel-heading"><div className="account-loading-grow"><Line short /><Line /></div><span className="account-loading-shape account-loading-action" /></div>
            <div className="account-filters"><div className="account-filter-search account-loading-shape account-loading-control" />{[0,1].map(i=><div className="greenfield-dropdown" key={i}><Line short /><span className="account-loading-shape account-loading-control" /></div>)}</div>
            <div className="account-table-scroll"><div className="account-loading-table-head">{[0,1,2,3,4].map(i=><Line key={i} short />)}</div>{[0,1,2,3].map(i=><div className="account-loading-table-row" key={i}>{[0,1,2,3,4].map(j=><Line key={j} />)}</div>)}</div>
            <div className="account-mobile-records">{[0,1,2].map(i=><RecordPlaceholder key={i} />)}</div><div className="account-table-footer"><Line short /><Line short /></div>
          </div><div className="account-side-panels">{[0,1].map(i=><div className="account-panel" key={i}><div className="account-panel-heading"><Line short /></div>{[0,1,2].map(j=><div className="account-loading-task" key={j}><span className="account-loading-shape account-task-icon" /><div className="account-loading-grow"><Line /><Line short /></div></div>)}</div>)}</div>
          </div>
        </main>
      </div>
    </div>
  </div>;
}
