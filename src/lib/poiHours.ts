/**
 * poiHours.ts — POI 營業時間字串壓縮。
 *
 * Google Place Details API 回傳的 `weekday_descriptions` 是全週 7 行字串：
 *   星期一: 08:00–17:30
 *   星期二: 08:00–17:30
 *   ...
 *   星期日: 08:00–17:30
 *
 * 直接塞進 timeline rail expand 區的 meta line 會吃掉 5-6 行高度，把 ★ rating
 * 推出 fold。本檔提供 `condenseHours()`：偵測全週時段一致時壓成單一 range，
 * 平假日不同時壓成「平日 X / 週末 Y」，否則保留原字串（fallback）。
 *
 * v2.30.16：terracotta UX 精修，PR-A 後續 follow-up（task #71）。
 */

const WEEKDAY_RE = /(?:星期[一二三四五六日天])\s*:?\s*(.+?)(?=\s*星期[一二三四五六日天]|$)/g;

/** 把整週時段字串拆成 { 一/二/.../日: time-or-rest } map。 */
function parseWeeklyHours(raw: string): Map<string, string> | null {
  const map = new Map<string, string>();
  // Normalize: 換行 / 多空格 → 單空格
  const flat = raw.replace(/\s+/g, ' ').trim();
  // Reset regex state
  WEEKDAY_RE.lastIndex = 0;
  const matches = [...flat.matchAll(WEEKDAY_RE)];
  if (matches.length < 5) return null;
  for (const m of matches) {
    const fullMatch = m[0];
    const dayMatch = fullMatch.match(/星期([一二三四五六日天])/);
    if (!dayMatch || !dayMatch[1] || !m[1]) continue;
    const dayKey = dayMatch[1] === '天' ? '日' : dayMatch[1];
    map.set(dayKey, m[1].trim());
  }
  return map.size >= 5 ? map : null;
}

const WEEKDAY_KEYS = ['一', '二', '三', '四', '五'];
const WEEKEND_KEYS = ['六', '日'];

/**
 * Condense 全週時段字串：
 *  - 7 天全相同 → 「08:00–17:30」
 *  - 平日同 + 週末同（兩組各自一致）→ 「週一–五 08:00–17:30 · 週末 09:00–18:00」
 *  - 其中有 1-2 天「休息」→ 「週一–六 08:00–17:30 · 週日休」
 *  - 無法壓縮 → 原字串
 */
export function condenseHours(raw: string | null | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const parsed = parseWeeklyHours(trimmed);
  if (!parsed) return trimmed; // Not a weekly schedule — return as-is

  // All 7 days identical?
  const uniqueValues = new Set(parsed.values());
  if (uniqueValues.size === 1) {
    return [...uniqueValues][0]!;
  }

  // Weekday vs weekend split (平日 vs 週末)?
  const weekdayValues = WEEKDAY_KEYS.map((k) => parsed.get(k)).filter(Boolean);
  const weekendValues = WEEKEND_KEYS.map((k) => parsed.get(k)).filter(Boolean);
  if (weekdayValues.length === 5 && weekendValues.length === 2) {
    const weekdaySet = new Set(weekdayValues);
    const weekendSet = new Set(weekendValues);
    if (weekdaySet.size === 1 && weekendSet.size === 1) {
      const wd = [...weekdaySet][0]!;
      const we = [...weekendSet][0]!;
      if (wd === we) return wd;
      return `週一–五 ${wd} · 週末 ${we}`;
    }
  }

  // Fallback: return raw — UI may need to wrap. 仍比顯示「undefined」好。
  return trimmed;
}
