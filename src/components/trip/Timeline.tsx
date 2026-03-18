/* ===== Timeline Component ===== */
/* Renders the full day timeline — maps each entry to a <TimelineEvent>. */

import TimelineEvent, { type TimelineEntryData } from './TimelineEvent';

interface TimelineProps {
  /** Array of timeline entries for a single day */
  events: TimelineEntryData[];
}

export default function Timeline({ events }: TimelineProps) {
  if (!events || events.length === 0) return null;

  return (
    <div className="timeline">
      {events.map((ev, i) => (
        <TimelineEvent key={ev.id ?? i} entry={ev} index={i + 1} />
      ))}
    </div>
  );
}
