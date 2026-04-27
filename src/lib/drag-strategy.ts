export interface DragScheduleEntry {
  id?: number | string | null;
  title?: string | null;
  time?: string | null;
  sortOrder?: number | null;
  orderInDay?: number | null;
}

export interface TimeRangeMinutes {
  startMinutes: number;
  endMinutes: number;
}

export interface SmartPlacementOptions {
  defaultStart?: string;
  durationMinutes?: number;
  gapMinutes?: number;
}

export interface SmartPlacement extends TimeRangeMinutes {
  startTime: string;
  endTime: string;
  time: string;
  sortOrder: number;
  orderInDay: number;
}

const DEFAULT_START = '09:00';
const DEFAULT_DURATION_MINUTES = 60;
const DEFAULT_GAP_MINUTES = 60;
const MINUTES_PER_DAY = 24 * 60;

export function parseClockToMinutes(clock: string): number | null {
  const match = clock.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

export function formatMinutesAsClock(minutes: number): string {
  const normalized = ((Math.trunc(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hour = Math.floor(normalized / 60);
  const minute = normalized % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function parseEntryTimeRange(
  time: string | null | undefined,
  fallbackDurationMinutes = DEFAULT_DURATION_MINUTES,
): TimeRangeMinutes | null {
  if (!time) return null;
  const [rawStart, rawEnd] = time.split('-');
  const start = parseClockToMinutes(rawStart ?? '');
  if (start == null) return null;
  const parsedEnd = rawEnd ? parseClockToMinutes(rawEnd) : null;
  let end = parsedEnd ?? start + fallbackDurationMinutes;
  if (end <= start) end += MINUTES_PER_DAY;
  return { startMinutes: start, endMinutes: end };
}

export function hasTimeConflict(candidate: TimeRangeMinutes, entries: DragScheduleEntry[]): boolean {
  return findFirstTimeConflict(candidate, entries) != null;
}

export function findFirstTimeConflict(candidate: TimeRangeMinutes, entries: DragScheduleEntry[]): DragScheduleEntry | null {
  return entries.find((entry) => {
    const range = parseEntryTimeRange(entry.time);
    if (!range) return false;
    return candidate.startMinutes < range.endMinutes && candidate.endMinutes > range.startMinutes;
  }) ?? null;
}

function nextNumericOrder(entries: DragScheduleEntry[], key: 'sortOrder' | 'orderInDay'): number {
  const values = entries
    .map((entry) => entry[key])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (values.length === 0) return entries.length;
  return Math.max(...values) + 1;
}

export function getSmartPlacement(
  entries: DragScheduleEntry[],
  options: SmartPlacementOptions = {},
): SmartPlacement {
  const durationMinutes = options.durationMinutes ?? DEFAULT_DURATION_MINUTES;
  const gapMinutes = options.gapMinutes ?? DEFAULT_GAP_MINUTES;
  const defaultStart = parseClockToMinutes(options.defaultStart ?? DEFAULT_START) ?? parseClockToMinutes(DEFAULT_START)!;
  const ranges = entries
    .map((entry) => parseEntryTimeRange(entry.time, durationMinutes))
    .filter((range): range is TimeRangeMinutes => range != null);

  const latestEnd = ranges.length > 0
    ? Math.max(...ranges.map((range) => range.endMinutes))
    : null;

  let startMinutes = latestEnd == null ? defaultStart : Math.max(defaultStart, latestEnd + gapMinutes);
  let candidate: TimeRangeMinutes = {
    startMinutes,
    endMinutes: startMinutes + durationMinutes,
  };

  for (let guard = 0; guard < entries.length + 24 && hasTimeConflict(candidate, entries); guard++) {
    startMinutes += gapMinutes;
    candidate = {
      startMinutes,
      endMinutes: startMinutes + durationMinutes,
    };
  }

  const startTime = formatMinutesAsClock(candidate.startMinutes);
  const endTime = formatMinutesAsClock(candidate.endMinutes);
  return {
    ...candidate,
    startTime,
    endTime,
    time: `${startTime}-${endTime}`,
    sortOrder: nextNumericOrder(entries, 'sortOrder'),
    orderInDay: nextNumericOrder(entries, 'orderInDay'),
  };
}

export function getExplicitSlotPlacement(
  startTime: string,
  entries: DragScheduleEntry[],
  options: Omit<SmartPlacementOptions, 'defaultStart'> = {},
): SmartPlacement {
  const startMinutes = parseClockToMinutes(startTime);
  if (startMinutes == null) {
    throw new Error(`Invalid time slot: ${startTime}`);
  }
  const durationMinutes = options.durationMinutes ?? DEFAULT_DURATION_MINUTES;
  const endMinutes = startMinutes + durationMinutes;
  const endTime = formatMinutesAsClock(endMinutes);
  return {
    startMinutes,
    endMinutes,
    startTime,
    endTime,
    time: `${startTime}-${endTime}`,
    sortOrder: nextNumericOrder(entries, 'sortOrder'),
    orderInDay: nextNumericOrder(entries, 'orderInDay'),
  };
}
