import { memo } from 'react';

const DaySkeleton = memo(function DaySkeleton() {
  return (
    <div className="day-skeleton" role="status" aria-label="行程載入中" aria-busy="true">
      {/* Day header */}
      <div className="skeleton-header">
        <div className="skeleton-bone" style={{ width: '40%', height: 24 }} />
        <div className="skeleton-bone" style={{ width: '30%', height: 16, marginTop: 4 }} />
      </div>
      {/* Weather bar */}
      <div className="skeleton-bone skeleton-weather" />
      {/* Timeline events — 2 items closer to median, reduces layout shift */}
      {[1, 2].map(i => (
        <div key={i} className="skeleton-event">
          <div className="skeleton-flag">
            <div className="skeleton-bone skeleton-dot" />
          </div>
          <div className="skeleton-card">
            <div className="skeleton-bone" style={{ width: '60%', height: 18 }} />
            <div className="skeleton-bone" style={{ width: '80%', height: 14, marginTop: 8 }} />
            <div className="skeleton-bone" style={{ width: '45%', height: 14, marginTop: 4 }} />
          </div>
        </div>
      ))}
    </div>
  );
});

export default DaySkeleton;
