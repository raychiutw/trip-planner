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

  let numberContent: React.ReactNode;
  let label: string;
  let dateDisplay: string | null = null;

  if (today < startDate) {
    // Before trip: show countdown
    const diff = Math.ceil((startDate.getTime() - today.getTime()) / MS_PER_DAY);
    numberContent = diff;
    label = '天後出發';
    dateDisplay = start;
  } else if (today <= endDate) {
    // During trip: show current day
    const dayN =
      Math.floor((today.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;
    numberContent = `Day ${dayN}`;
    label = '旅行進行中';
  } else {
    // After trip: show ended
    numberContent = <Icon name="plane" />;
    label = '旅程已結束';
  }

  return (
    <div className="info-card countdown-card">
      <div className="countdown-number">{numberContent}</div>
      <div className="countdown-label">{label}</div>
      {dateDisplay && <div className="countdown-date">{dateDisplay}</div>}
    </div>
  );
}
