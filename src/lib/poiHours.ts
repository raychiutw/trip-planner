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

// v2.33.36 code review round 1: 之前 export 過會踩到 stateful `lastIndex` bug。
// 每次 parse 建立新 regex 完全 stateless，且不再依賴 lastIndex reset。
const WEEKDAY_RE_SOURCE = '(?:星期[一二三四五六日天])\\s*:?\\s*(.+?)(?=\\s*星期[一二三四五六日天]|$)';

/** 把整週時段字串拆成 { 一/二/.../日: time-or-rest } map。 */
function parseWeeklyHours(raw: string): Map<string, string> | null {
  const map = new Map<string, string>();
  // Normalize: 換行 / 多空格 → 單空格
  const flat = raw.replace(/\s+/g, ' ').trim();
  const re = new RegExp(WEEKDAY_RE_SOURCE, 'g');
  const matches = [...flat.matchAll(re)];
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
 *  - 無法壓縮（含「休息」日的不規則週排程）→ 原字串（fallback）
 */
export function condenseHours(raw: string | null | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';

  // v2.31.24: Google Places 對日本 24h 商家會回日文「24時間」/「24 時間営業」。
  // 中文 UI 顯日文「時間」 confusing — 統一改「24 小時」。
  if (/^24\s*時間(?:営業)?$/.test(trimmed)) return '24 小時';

  const parsed = parseWeeklyHours(trimmed);
  if (!parsed) return trimmed; // Not a weekly schedule — return as-is

  // All 7 days identical?
  const uniqueValues = new Set(parsed.values());
  if (uniqueValues.size === 1) {
    const v = [...uniqueValues][0]!;
    if (/^24\s*時間(?:営業)?$/.test(v)) return '24 小時';
    return v;
  }

  // Weekday vs weekend split (平日 vs 週末)?
  // 用 reduce 一次過 — RBP-30 spirit：避免 map+filter 重複 iter（雖然 5/2 元素
  // micro-optimisation 影響微，pattern 維持一致）。
  const weekdayValues = WEEKDAY_KEYS.reduce<string[]>((acc, k) => {
    const v = parsed.get(k);
    if (v) acc.push(v);
    return acc;
  }, []);
  const weekendValues = WEEKEND_KEYS.reduce<string[]>((acc, k) => {
    const v = parsed.get(k);
    if (v) acc.push(v);
    return acc;
  }, []);
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
