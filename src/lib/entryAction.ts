/**
 * entryAction — types + helpers shared between TimelineRail (caller) and
 * EntryActionPage (route component, /trip/:id/stop/:eid/copy or /move).
 *
 * 2026-05-03 modal-to-fullpage migration: 取代 EntryActionPopover 內 export。
 * shortenDateLabel 為純字串轉換 (無 React)，DayOption 為純 type。
 */

export interface DayOption {
  dayNum: number;
  dayId: number;
  label: string;
  stopCount: number;
  /** Tailwind -500 hex used as the day's accent swatch. */
  swatchColor?: string;
}

export interface EntryActionConfirmPayload {
  targetDayId: number;
  /** key from TIME_SLOTS — caller decides how to map to time string. */
  timeSlot: string;
}

/**
 * Caller 餵 label 格式為「YYYY-MM-DD（週）」(TripPage.tsx dayOptions，
 * 經 mapDay.parseLocalDate 確保 zero-padded `\d{2}-\d{2}` 形態)。
 * 行動裝置 picker 內擠不下，shorten 為「M/D（週）」。Fallback 原 label 若 parse 失敗
 * （防呆，理論不會 hit — caller contract 已固定 zero-padded）。
 */
export function shortenDateLabel(label: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})(.*)$/.exec(label);
  if (!m) return label;
  const month = parseInt(m[1]!, 10);
  const dom = parseInt(m[2]!, 10);
  const rest = m[3] ?? '';
  return `${month}/${dom}${rest}`;
}

export const ENTRY_ACTION_TIME_SLOTS = [
  { key: 'same', label: '同原時段' },
  { key: 'morning', label: '09:00 — 11:30（早上第一站）' },
  { key: 'noon', label: '12:00 — 13:30（午餐）' },
  { key: 'afternoon', label: '14:00 — 16:30（午後）' },
  { key: 'evening', label: '18:00 — 20:00（晚餐）' },
  { key: 'custom', label: '自訂時段⋯' },
] as const;
