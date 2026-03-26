import Icon from '../shared/Icon';
import { TRANSPORT_TYPE_ORDER } from '../../lib/constants';
import { formatMinutes } from '../../lib/formatUtils';
import { calcTripDrivingStats } from '../../lib/drivingStats';
import type { Day } from '../../types/trip';

/* ===== Types ===== */

interface BudgetItem {
  amount?: number;
}

interface Budget {
  items?: BudgetItem[];
  currency?: string;
}

/** Day-like structure that includes content for stats calculation. */
interface DayWithContent extends Day {
  /** Budget data may live on the day content. */
  budget?: Budget;
}

/* ===== Props ===== */

interface TripStatsCardProps {
  /** All day data with timeline and budget. */
  days: DayWithContent[];
}

/* ===== Component ===== */

export default function TripStatsCard({ days }: TripStatsCardProps) {
  // Total spots
  let spots = 0;
  days.forEach((day) => {
    if (day.timeline) spots += day.timeline.length;
  });

  // Transport summary by type
  const tripStats = calcTripDrivingStats(days);

  // Total budget
  let totalBudget = 0;
  let currency = '';
  days.forEach((day) => {
    const budget = (day as DayWithContent).budget;
    if (budget && budget.items) {
      budget.items.forEach((item) => {
        totalBudget += item.amount || 0;
      });
      if (!currency && budget.currency) currency = budget.currency;
    }
  });

  return (
    <div className="bg-secondary rounded-md p-4 mb-3">
      <div className="font-bold text-title3 mb-3">行程統計</div>

      {/* Total days */}
      <div className="flex justify-between items-center py-1 text-callout">
        <span className="text-muted">天數</span>
        <span className="font-semibold">{days.length} 天</span>
      </div>

      {/* Total spots */}
      <div className="flex justify-between items-center py-1 text-callout">
        <span className="text-muted">景點數</span>
        <span className="font-semibold">{spots} 個</span>
      </div>

      {/* Transport summary by type */}
      {tripStats &&
        tripStats.grandByType &&
        TRANSPORT_TYPE_ORDER.map((key) => {
          const g = tripStats.grandByType[key];
          if (!g) return null;
          return (
            <div key={key} className="flex justify-between items-center py-1 text-callout">
              <span className="text-muted">
                <Icon name={g.icon} /> {g.label}
              </span>
              <span className="font-semibold">
                {formatMinutes(g.totalMinutes)}
              </span>
            </div>
          );
        })}

      {/* Total budget */}
      {totalBudget > 0 && (
        <div className="flex justify-between items-center py-1 text-callout">
          <span className="text-muted">預估預算</span>
          <span className="font-semibold">
            {currency} {totalBudget.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}
