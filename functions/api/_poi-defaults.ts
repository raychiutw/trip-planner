/**
 * POI default heuristics — stay duration / start time / time format。
 * Shared by saved-pois fast-path endpoint + tp-request skill。
 */

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

const STAY_MINUTES: Record<string, number> = {
  hotel: 0,
  restaurant: 90,
  shopping: 60,
  attraction: 120,
  parking: 15,
  transport: 30,
  activity: 90,
  other: 60,
};

export function stayMinutesFor(type: string): number {
  return STAY_MINUTES[type] ?? 60;
}

export function defaultStartFor(type: string): string {
  if (type === 'restaurant') return '12:00';
  if (type === 'shopping') return '14:00';
  if (type === 'hotel') return '15:00';
  return '10:00';
}

export function addMinutes(hhmm: string, mins: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = (h ?? 0) * 60 + (m ?? 0) + mins;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
