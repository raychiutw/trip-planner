/**
 * Formatting utilities shared across trip components.
 */

/**
 * Converts a total number of minutes into a human-readable string.
 * - 90 => "1 小時 30 分鐘"
 * - 45 => "45 分鐘"
 * - 120 => "2 小時"
 */
export function formatMinutes(totalMins: number): string {
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs > 0) {
    return mins > 0 ? `${hrs} 小時 ${mins} 分鐘` : `${hrs} 小時`;
  }
  return `${totalMins} 分鐘`;
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
