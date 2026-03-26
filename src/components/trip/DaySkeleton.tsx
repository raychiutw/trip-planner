import { memo } from 'react';

const DaySkeleton = memo(function DaySkeleton() {
  return (
    <div className="px-padding-h" role="status" aria-label="行程載入中" aria-busy="true">
      {/* Day header */}
      <div className="py-3 pb-4">
        <div className="skeleton-bone" style={{ width: '40%', height: 24 }} />
        <div className="skeleton-bone" style={{ width: '30%', height: 16, marginTop: 4 }} />
      </div>
      {/* Weather bar */}
      <div className="skeleton-bone w-full h-14 mb-4" />
      {/* Timeline events — 2 items closer to median, reduces layout shift */}
      {[1, 2].map(i => (
        <div key={i} className="flex gap-3 mb-4">
          <div className="w-6 shrink-0 flex justify-center">
            <div className="skeleton-bone w-5 h-5 rounded-full" />
          </div>
          <div className="flex-1 bg-secondary rounded-md p-4">
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
