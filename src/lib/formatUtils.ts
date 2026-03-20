/**
 * Formatting utilities shared across trip components.
 */

/**
 * Converts a total number of minutes into a compact time string.
 * - 0   => "—"
 * - 30  => "30m"
 * - 90  => "1h30m"
 * - 120 => "2h00m"
 */
export function formatMinutes(totalMins: number): string {
  if (totalMins === 0) return '—';
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs >= 1) {
    return `${hrs}h${String(mins).padStart(2, '0')}m`;
  }
  return `${mins}m`;
}

/**
 * Formats a day object's date + dayOfWeek into a compact display string.
 * ISO "2026-07-29" + dayOfWeek "三" => "7/29（三）"
 */
export function formatDayDate(day: {
  date?: string | null;
  dayOfWeek?: string | null;
}): string {
  const d = day.date || '';
  const m = d.match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (m) {
    const month = parseInt(m[1], 10);
    const date = parseInt(m[2], 10);
    const dow = day.dayOfWeek ? `（${day.dayOfWeek}）` : '';
    return `${month}/${date}${dow}`;
  }
  return d; // fallback for non-ISO dates
}
