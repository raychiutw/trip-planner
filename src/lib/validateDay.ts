/**
 * Validates a day's timeline entries against restaurant/shop opening hours.
 * Returns warning messages for entries that may arrive before opening.
 */

interface ValidateEntry {
  time?: string | null;
  title?: string | null;
  restaurants?: Array<{ name?: string; hours?: string | null }>;
  shopping?: Array<{ name?: string; hours?: string | null }>;
}

function parseHour(timeStr: string): number {
  const clean = timeStr.split('-')[0].replace(':', '');
  return parseInt(clean.substring(0, clean.length - 2), 10) || 0;
}

function checkHours(entryTitle: string, entryTime: string, entryHour: number, name: string, hours: string): string | null {
  const m = hours.match(/(\d{1,2}):(\d{2})/);
  if (m && entryHour < parseInt(m[1], 10)) {
    return `${entryTitle}（${entryTime}）可能早於 ${name} 營業時間（${hours}）`;
  }
  return null;
}

export function validateDay(timeline: ValidateEntry[]): string[] {
  const warnings: string[] = [];
  if (!timeline?.length) return warnings;

  timeline.forEach((entry) => {
    if (!entry.time) return;
    const entryTime = entry.time.split('-')[0].trim();
    const entryHour = parseHour(entry.time);
    const title = entry.title || '';

    entry.restaurants?.forEach((r) => {
      if (r.hours) {
        const w = checkHours(title, entryTime, entryHour, r.name || '', r.hours);
        if (w) warnings.push(w);
      }
    });

    entry.shopping?.forEach((s) => {
      if (s.hours) {
        const w = checkHours(title, entryTime, entryHour, s.name || '', s.hours);
        if (w) warnings.push(w);
      }
    });
  });

  return warnings;
}
