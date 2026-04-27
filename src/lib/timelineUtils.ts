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
 * 根據行程項目的 title / description / travel.type 推導類型 meta。
 * 回傳 Icon name、中文標籤與 accent 旗標。
 */
export function deriveTypeMeta(entry: TimelineEntryData): { icon: string; label: string; accent: boolean } {
  const title = (entry.title ?? '').toLowerCase();
  const desc = (entry.description ?? '').toLowerCase();
  const travelType = (entry.travel && typeof entry.travel === 'object' ? entry.travel.type ?? '' : '').toLowerCase();
  const blob = `${title} ${desc} ${travelType}`;

  // Order matters — most specific first.
  if (/機場|flight|機票/.test(blob)) return { icon: 'plane', label: '飛行', accent: false };
  if (/飯店|旅館|hotel|check[- ]?in|民宿/.test(blob)) return { icon: 'hotel', label: '住宿', accent: false };
  if (/餐|食|restaurant|lunch|dinner|breakfast|用餐/.test(blob)) return { icon: 'fork-knife', label: '用餐', accent: true };
  if (/咖啡|café|cafe|coffee/.test(blob)) return { icon: 'coffee', label: '咖啡', accent: true };
  if (/購物|shopping|mall|market/.test(blob)) return { icon: 'shopping', label: '購物', accent: false };
  if (/開車|drive|car|自駕|租車/.test(blob)) return { icon: 'car', label: '移動', accent: false };
  if (/步行|walk|散步/.test(blob)) return { icon: 'walk', label: '散步', accent: false };
  if (/休息|rest|spa|泡湯/.test(blob)) return { icon: 'coffee', label: '休息', accent: false };
  return { icon: 'location-pin', label: '景點', accent: true };
}
