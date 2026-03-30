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

