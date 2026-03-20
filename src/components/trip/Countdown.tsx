import Icon from '../shared/Icon';
import { MS_PER_DAY } from '../../lib/constants';

/* ===== Props ===== */

interface CountdownProps {
  /** Sorted array of ISO date strings for the trip (e.g. ["2026-07-25", "2026-07-26", ...]). */
  autoScrollDates: string[];
}

/* ===== Component ===== */

export default function Countdown({ autoScrollDates }: CountdownProps) {
  if (!autoScrollDates || !autoScrollDates.length) return null;

  const start = autoScrollDates[0];
  const end = autoScrollDates[autoScrollDates.length - 1];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');

  if (today < startDate) {
    const diff = Math.ceil((startDate.getTime() - today.getTime()) / MS_PER_DAY);
    return (
      <div className="info-card countdown-card">
        <div className="countdown-number">
          <span className="countdown-num">{diff}</span>
          <span className="countdown-unit">天</span>
        </div>
      </div>
    );
  }

  if (today <= endDate) {
    const dayN = Math.floor((today.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;
    return (
      <div className="info-card countdown-card">
        <div className="countdown-number">
          <span className="countdown-num">Day {dayN}</span>
        </div>
        <div className="countdown-label">旅行進行中</div>
      </div>
    );
  }

  return (
    <div className="info-card countdown-card">
      <div className="countdown-number">
        <Icon name="plane" />
      </div>
      <div className="countdown-label">旅程已結束</div>
    </div>
  );
}
