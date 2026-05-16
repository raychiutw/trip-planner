/**
 * timelineUtils.ts — 時間軸共用工具函式
 *
 * 從 TimelineEvent.tsx / TimelineRail.tsx 提取，PR 12 重構。
 * 兩個 component 共享相同邏輯，單一來源避免分歧。
 */

import type { TimelineEntryData } from '../components/trip/TimelineEvent';

/* ===== Types ===== */

interface ParsedTime {
  start: string;
  end: string;
  duration: number;
}

/* ===== Functions ===== */

/**
 * 解析時間字串（如 "10:45-12:00"）為結構化物件。
 * 支援跨日（如 "23:00-01:00"，duration=120）。
 */
export function parseTimeRange(timeStr?: string | null): ParsedTime {
  if (!timeStr) return { start: '', end: '', duration: 0 };
  const parts = timeStr.split('-');
  const start = (parts[0] ?? '').trim();
  const end = parts.length > 1 ? (parts[1] ?? '').trim() : '';
  let duration = 0;
  if (start && end) {
    const s = start.split(':');
    const e = end.split(':');
    if (s.length === 2 && e.length === 2) {
      duration =
        (parseInt(e[0] ?? '0', 10) * 60 + parseInt(e[1] ?? '0', 10)) -
        (parseInt(s[0] ?? '0', 10) * 60 + parseInt(s[1] ?? '0', 10));
      if (duration < 0) duration += 24 * 60;
    }
  }
  return { start, end, duration };
}

/**
 * v2.29.0: trip_entries.time DROPPED。從 entry.{start_time, end_time} 直接取 ParsedTime。
 */
export function parseEntryTime(entry: { start_time?: string | null; end_time?: string | null }): ParsedTime {
  const start = (entry.start_time ?? '').trim();
  const end = (entry.end_time ?? '').trim();
  let duration = 0;
  if (start && end) {
    const s = start.split(':');
    const e = end.split(':');
    if (s.length === 2 && e.length === 2) {
      duration =
        (parseInt(e[0] ?? '0', 10) * 60 + parseInt(e[1] ?? '0', 10)) -
        (parseInt(s[0] ?? '0', 10) * 60 + parseInt(s[1] ?? '0', 10));
      if (duration < 0) duration += 24 * 60;
    }
  }
  return { start, end, duration };
}

/**
 * 格式化分鐘數為可讀字串（中文）。
 * QA 2026-04-26 BUG-038/048：raw 「30m」「1h 30m」 改中文化，整個 UI 中文一致。
 * 非有限數（NaN/Infinity）、0、負數一律回 ""；60 → "1 小時"；90 → "1 小時 30 分"；45 → "45 分鐘"。
 */
export function formatDuration(mins: number): string {
  if (!Number.isFinite(mins) || mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0 && m > 0) return `${h} 小時 ${m} 分`;
  if (h > 0) return `${h} 小時`;
  return `${m} 分鐘`;
}

/**
 * 短格式 duration（英文）— 對應 mockup .tp-detail-body-sub 的 "30 min" / "4 hr" / "1.5 hr"。
 * 與 formatDuration（中文長）並存：rail body sub-line 一行多資訊用短格式較密；
 * 其他情境（TravelPill、weather summary、整列描述）維持中文 formatDuration。
 *   30  → "30 min"
 *   60  → "1 hr"
 *   90  → "1.5 hr"
 *   240 → "4 hr"
 *   非有限/0/負數 → ""
 */
export function formatDurationCompact(mins: number): string {
  if (!Number.isFinite(mins) || mins <= 0) return '';
  if (mins < 60) return `${mins} min`;
  const hrs = mins / 60;
  // 整數小時不帶小數；非整數保留 1 位小數（去尾 0），例如 1.5 / 1.25→1.3
  const display = Number.isInteger(hrs) ? String(hrs) : hrs.toFixed(1).replace(/\.0$/, '');
  return `${display} hr`;
}

/**
 * 解析時間字串的起始分鐘數（since midnight）。
 * "09:30-11:00" → 570；無 / null / malformed → -1。
 */
export function parseStartMinutes(time?: string | null): number {
  if (!time) return -1;
  const start = (time.split('-')[0] ?? '').trim();
  const parts = start.split(':');
  if (parts.length !== 2) return -1;
  return parseInt(parts[0] ?? '0', 10) * 60 + parseInt(parts[1] ?? '0', 10);
}

/**
 * 解析時間字串的結束分鐘數（since midnight）。
 * "09:30-11:00" → 660；無 end 段 / null / malformed → -1。
 * 支援跨日（如 "23:30-01:15" → 75）。
 */
export function parseEndMinutes(time?: string | null): number {
  if (!time) return -1;
  const segments = time.split('-');
  if (segments.length < 2) return -1;
  const end = (segments[1] ?? '').trim();
  const parts = end.split(':');
  if (parts.length !== 2) return -1;
  return parseInt(parts[0] ?? '0', 10) * 60 + parseInt(parts[1] ?? '0', 10);
}

/**
 * 根據行程項目推導類型 meta（icon + 中文 label + accent 旗標）。
 * 優先級：
 *   1. entry.poiType（POI master 的 canonical type，最權威）— v2.x normalized schema 後加入
 *   2. title / description / travel.type 文字 keyword match（fallback for legacy entries
 *      或 POI 還沒 attach 完成的 entries）
 *
 * 不同來源同義對齊：poi.type 'attraction' → label '景點' icon 'location-pin'；
 * 文字 match 「美術館」也走 fallback location-pin/景點，最終視覺一致。
 */
export function deriveTypeMeta(entry: TimelineEntryData): { icon: string; label: string; accent: boolean } {
  // 1. POI master type 優先（v2.x normalized）
  const poiType = (entry.poiType ?? '').toLowerCase();
  if (poiType === 'hotel') return { icon: 'hotel', label: '住宿', accent: false };
  if (poiType === 'restaurant') return { icon: 'utensils', label: '用餐', accent: true };
  if (poiType === 'shopping') return { icon: 'shopping', label: '購物', accent: true };
  if (poiType === 'attraction') return { icon: 'location-pin', label: '景點', accent: true };
  // v2.31.23: 對齊 POI_TYPE_LABELS canonical mapping（poiCategory.ts / TimelineRail
  // POI_TYPE_LABEL / EditEntryPage POI_TYPE_LABEL 都用「交通」）。「移動」保留給
  // line 154 text-based 「開車/drive」偵測，描述 segment 行為而非 POI 屬性。
  if (poiType === 'transport') return { icon: 'car', label: '交通', accent: false };
  if (poiType === 'parking') return { icon: 'parking', label: '停車', accent: false };
  if (poiType === 'activity') return { icon: 'sparkle', label: '活動', accent: true };

  // 2. Fallback：text keyword match
  const title = (entry.title ?? '').toLowerCase();
  const desc = (entry.description ?? '').toLowerCase();
  const travelType = (entry.travel && typeof entry.travel === 'object' ? entry.travel.type ?? '' : '').toLowerCase();
  const blob = `${title} ${desc} ${travelType}`;
  if (/機場|flight|機票/.test(blob)) return { icon: 'plane', label: '飛行', accent: false };
  if (/飯店|旅館|hotel|check[- ]?in|民宿/.test(blob)) return { icon: 'hotel', label: '住宿', accent: false };
  if (/餐|食|restaurant|lunch|dinner|breakfast|用餐/.test(blob)) return { icon: 'utensils', label: '用餐', accent: true };
  if (/咖啡|café|cafe|coffee/.test(blob)) return { icon: 'coffee', label: '咖啡', accent: true };
  if (/購物|shopping|mall|market|道之驛/.test(blob)) return { icon: 'shopping', label: '購物', accent: true };
  if (/開車|drive|car|自駕|租車/.test(blob)) return { icon: 'car', label: '移動', accent: false };
  if (/步行|walk|散步/.test(blob)) return { icon: 'walking', label: '散步', accent: false };
  if (/休息|rest|spa|泡湯/.test(blob)) return { icon: 'coffee', label: '休息', accent: false };
  return { icon: 'location-pin', label: '景點', accent: true };
}
