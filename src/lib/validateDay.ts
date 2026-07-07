/**
 * Validates a day's timeline entries against stop/shop opening hours.
 * Returns warning messages for entries that may arrive before opening.
 */

interface ValidateEntry {
  startTime?: string | null;
  endTime?: string | null;
  displayTitle?: string | null;
  title?: string | null;
  stopPois?: Array<{ name?: string | null; hours?: string | null }>;
}

function parseHour(timeStr: string): number {
  const clean = (timeStr.split('-')[0] ?? '').replace(':', '');
  return parseInt(clean.substring(0, clean.length - 2), 10) || 0;
}

function checkHours(entryTitle: string, entryTime: string, entryHour: number, name: string, hours: string): string | null {
  const m = hours.match(/(\d{1,2}):(\d{2})/);
  if (m && entryHour < parseInt(m[1] ?? '0', 10)) {
    return `${entryTitle}（${entryTime}）可能早於 ${name} 營業時間（${hours}）`;
  }
  return null;
}

export function validateDay(timeline: ValidateEntry[]): string[] {
  const warnings: string[] = [];
  if (!timeline?.length) return warnings;

  timeline.forEach((entry) => {
    // v2.29.0: entry.time DROPPED — 用 startTime/endTime 重組 display string
    // v2.31.77 fix #196: 改用 camelCase (deepCamel'd API response)
    const composedTime = entry.startTime && entry.endTime
      ? `${entry.startTime}-${entry.endTime}`
      : (entry.startTime ?? null);
    if (!composedTime) return;
    const entryTime = entry.startTime ?? '';
    const entryHour = parseHour(composedTime);
    const title = entry.displayTitle || entry.stopPois?.[0]?.name || '';

    // v2.29.0: shopping array removed — shopping POI 已合進 stopPois (filter by type)
    entry.stopPois?.forEach((p) => {
      if (p && p.hours) {
        const w = checkHours(title, entryTime, entryHour, p.name || '', p.hours);
        if (w) warnings.push(w);
      }
    });
  });

  return warnings;
}
