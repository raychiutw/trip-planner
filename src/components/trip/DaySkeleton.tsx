import { memo } from 'react';

const DaySkeleton = memo(function DaySkeleton() {
  return (
    <div className="day-skeleton">
      {/* Day header */}
      <div className="skeleton-header">
        <div className="skeleton-bone" style={{ width: '40%', height: 24 }} />
        <div className="skeleton-bone" style={{ width: '30%', height: 16, marginTop: 4 }} />
      </div>
      {/* Weather bar */}
      <div className="skeleton-bone skeleton-weather" />
      {/* Timeline events */}
      {[1, 2, 3].map(i => (
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
