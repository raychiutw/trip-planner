/**
 * Entry time helpers — v2.26.0 (migration 0056) start_time / end_time vs legacy time
 * dual-write 共用邏輯。
 *
 * 為什麼集中：4 個 INSERT 點（PATCH /entries, POST /days/N/entries, PUT /days/N,
 * copy.ts, poi-favorites/add-to-trip.ts）都需要把 body 提供的 `start_time`/`end_time`
 * 與 legacy `time` 互相同步。重複 inline 寫過幾次後出現 inconsistency
 * （`composeTime(start, null) → start` 而 inline copy 寫成 `null`），合併到單一
 * helper 避免漂移。
 *
 * Migration 0057 後 legacy `time` 會 drop，屆時這個檔可以 simplify 掉 compose 邏輯
 * 只保留 validation。
 */

/** HH:MM zero-padded 0-23 / 0-59 strict. */
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Compose legacy `time` string from start/end pair (dual-write 用)。 */
export function composeTime(start?: string | null, end?: string | null): string | null {
  if (start && end) return `${start}-${end}`;
  if (start) return start;
  return null;
}

/** Parse legacy `time` string → { start, end }。雙向 dual-write 用。 */
export function parseTime(time?: string | null): { start: string | null; end: string | null } {
  if (!time || typeof time !== 'string') return { start: null, end: null };
  const trimmed = time.trim();
  if (!trimmed) return { start: null, end: null };
  const dash = trimmed.indexOf('-');
  if (dash > 0) {
    return { start: trimmed.slice(0, dash).trim(), end: trimmed.slice(dash + 1).trim() };
  }
  return { start: trimmed, end: null };
}

/**
 * 從 INSERT body / day timeline entry 解出 (timeStr, startTime, endTime) triple。
 *
 * 規則：
 *   - body.start_time / body.end_time 顯式提供 → 優先（compose time）
 *   - body.time legacy → 解析回填 start/end
 *   - 都沒提供 → 三個 null
 *
 * 用於：PUT /days/:num bulk-insert、POST /days/:num/entries、copy.ts。
 * PATCH /entries 因為要 merge oldRow 用獨立邏輯（mergeTimesForPatch）。
 */
export function resolveEntryTimes(body: {
  start_time?: unknown;
  end_time?: unknown;
  time?: unknown;
}): { time: string | null; startTime: string | null; endTime: string | null } {
  const explicitStart = typeof body.start_time === 'string' ? body.start_time : null;
  const explicitEnd = typeof body.end_time === 'string' ? body.end_time : null;
  if (explicitStart !== null || explicitEnd !== null) {
    return {
      startTime: explicitStart,
      endTime: explicitEnd,
      time: composeTime(explicitStart, explicitEnd),
    };
  }
  if (typeof body.time === 'string' && body.time.trim()) {
    const { start, end } = parseTime(body.time);
    return { time: body.time, startTime: start, endTime: end };
  }
  return { time: null, startTime: null, endTime: null };
}
