/**
 * Trip export/download logic — JSON, Markdown, CSV, PDF formats.
 * Extracted from TripPage.tsx to reduce file size.
 */

import { apiFetch } from './apiClient';
import { DOC_KEYS } from '../hooks/useTrip';
import type { Trip } from '../types/trip';

/* ===== Internal raw types for API responses ===== */

type RawDayEntry = {
  time?: unknown; title?: unknown; description?: unknown; body?: unknown; note?: unknown;
  googleRating?: unknown; rating?: unknown; maps?: unknown; source?: unknown;
  travel?: unknown; travelType?: unknown; travelDesc?: unknown; travelMin?: unknown;
  restaurants?: Record<string, unknown>[];
  shopping?: Record<string, unknown>[];
  [key: string]: unknown;
};
type RawHotel = {
  name?: unknown; checkout?: unknown; note?: unknown; breakfast?: unknown;
  parking?: unknown;
  shopping?: Record<string, unknown>[];
  [key: string]: unknown;
};
type RawDay = {
  dayNum?: number; date?: string; dayOfWeek?: string; label?: string;
  hotel?: RawHotel | null;
  timeline?: RawDayEntry[];
  [key: string]: unknown;
};

/* ===== Helpers ===== */

function downloadBlob(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const DOC_LABEL_MAP: Record<string, string> = {
  flights: '航班資訊', checklist: '出發前確認清單',
  backup: '備案', emergency: '緊急聯絡', suggestions: 'AI 解籤',
};
const DOC_EMOJI: Record<string, string> = {
  flights: '✈️', checklist: '✅', backup: '🔄', emergency: '🚨', suggestions: '🔮',
};

async function fetchAllData(tripId: string) {
  // 1. meta + day summaries
  const [meta, daySummaries] = await Promise.all([
    apiFetch<Record<string, unknown>>(`/trips/${tripId}`),
    apiFetch<Array<{ dayNum: number; date?: string; dayOfWeek?: string; label?: string }>>(`/trips/${tripId}/days`),
  ]);

  // 2. all full days + all docs in parallel
  const [fullDays, docResults] = await Promise.all([
    Promise.all(
      daySummaries.map(ds =>
        apiFetch<RawDay>(`/trips/${tripId}/days/${ds.dayNum}`)
          .catch(() => null),
      ),
    ),
    Promise.all(
      DOC_KEYS.map(dtype =>
        apiFetch<{ docType: string; content: string; updatedAt: string }>(`/trips/${tripId}/docs/${dtype}`)
          .then(d => {
            let parsed: unknown = d.content;
            if (typeof parsed === 'string') {
              try { parsed = JSON.parse(parsed); } catch { /* keep as string */ }
            }
            return { type: dtype, data: parsed };
          })
          .catch(() => ({ type: dtype, data: null })),
      ),
    ),
  ]);

  const daysData = fullDays.filter((d): d is RawDay => d !== null);
  const docsMap: Record<string, unknown> = {};
  for (const doc of docResults) {
    if (doc.data !== null) docsMap[doc.type] = doc.data;
  }

  return { meta, daySummaries, daysData, docsMap };
}

/* ===== Public API ===== */

/**
 * Download the trip in the specified format (json | md | csv | pdf).
 */
export async function downloadTripFormat(
  format: string,
  opts: { tripId: string; trip: Trip | null },
): Promise<void> {
  const { tripId, trip } = opts;
  const tripName = trip?.name || 'trip';
  const today = new Date().toISOString().slice(0, 10);
  const fileBase = `${tripName}-${today}`;

  const s = (v: unknown) => (v != null && v !== '') ? String(v) : '';

  try {
    if (format === 'json') {
      /* -- JSON: complete dump -- */
      const { meta, daysData, docsMap } = await fetchAllData(tripId);
      const output = { meta, days: daysData, docs: docsMap };
      downloadBlob(JSON.stringify(output, null, 2), `${fileBase}.json`, 'application/json');

    } else if (format === 'md') {
      /* -- Markdown: human-readable complete -- */
      const { meta, daysData, docsMap } = await fetchAllData(tripId);

      let md = `# ${s(meta.name) || tripName}\n`;
      if (meta.title) md += `${s(meta.title)}\n`;
      md += '\n';

      for (const day of daysData) {
        // Day header
        md += `## Day ${day.dayNum}`;
        if (day.label) md += ` ${day.label}`;
        if (day.date) {
          md += ` — ${day.date}`;
          if (day.dayOfWeek) md += `（${day.dayOfWeek}）`;
        }
        md += '\n\n';

        // Hotel
        const hotel = day.hotel;
        if (hotel?.name) {
          md += `### 🏨 住宿：${s(hotel.name)}\n`;
          if (hotel.checkout) md += `- 退房：${s(hotel.checkout)}\n`;
          if (hotel.breakfast) md += `- 早餐：${typeof hotel.breakfast === 'object' ? JSON.stringify(hotel.breakfast) : s(hotel.breakfast)}\n`;
          const parking = hotel.parking;
          if (parking) {
            const pInfo = typeof parking === 'object' ? (parking as Record<string, unknown>).info ?? JSON.stringify(parking) : s(parking);
            md += `- 停車場：${pInfo}\n`;
          }
          if (hotel.note) md += `- 備註：${s(hotel.note)}\n`;

          // Hotel shopping
          const hotelShopping = hotel.shopping;
          if (Array.isArray(hotelShopping) && hotelShopping.length > 0) {
            md += '\n#### 🛍 住宿附近購物\n';
            md += '| 店名 | 類別 | 評分 | 營業時間 | 必買 |\n';
            md += '|------|------|------|---------|------|\n';
            for (const sh of hotelShopping) {
              md += `| ${s(sh.name)} | ${s(sh.category)} | ${s(sh.googleRating)} | ${s(sh.hours)} | ${s(sh.mustBuy)} |\n`;
            }
          }
          md += '\n';
        }

        // Timeline entries
        const timeline = day.timeline ?? [];
        for (let i = 0; i < timeline.length; i++) {
          const e = timeline[i];
          if (!e) continue;
          md += `### ${i + 1} ${s(e.time)} ${s(e.title)}`;
          if (e.googleRating) md += ` ★ ${e.googleRating}`;
          md += '\n';

          if (e.description) md += `${s(e.description)}\n`;
          if (e.note) md += `\n${s(e.note)}\n`;
          if (e.maps) md += `\n📍 Map: ${s(e.maps)}\n`;

          // Travel
          const travel = e.travel !== null && typeof e.travel === 'object' ? e.travel as Record<string, unknown> : null;
          if (travel?.type || e.travelType) {
            const tType = s(travel?.type ?? e.travelType);
            const tDesc = s(travel?.desc ?? e.travelDesc);
            const tMin = travel?.min ?? e.travelMin;
            md += `🚗 → ${tType}`;
            if (tDesc) md += ` ${tDesc}`;
            if (tMin) md += `（${tMin} 分）`;
            md += '\n';
          }

          // Restaurants
          const restaurants = e.restaurants ?? [];
          if (restaurants.length > 0) {
            md += '\n#### 🍽 餐廳推薦\n';
            md += '| 餐廳 | 類別 | 評分 | 價格 | 營業時間 | 備註 |\n';
            md += '|------|------|------|------|---------|------|\n';
            for (const r of restaurants) {
              md += `| ${s(r.name)} | ${s(r.category)} | ${s(r.googleRating)} | ${s(r.price)} | ${s(r.hours)} | ${s(r.note)} |\n`;
            }
          }

          // Shopping
          const shopping = e.shopping ?? [];
          if (shopping.length > 0) {
            md += '\n#### 🛍 購物推薦\n';
            md += '| 店名 | 類別 | 評分 | 營業時間 | 必買 |\n';
            md += '|------|------|------|---------|------|\n';
            for (const sh of shopping) {
              md += `| ${s(sh.name)} | ${s(sh.category)} | ${s(sh.googleRating)} | ${s(sh.hours)} | ${s(sh.mustBuy)} |\n`;
            }
          }

          md += '\n';
        }
        md += '---\n\n';
      }

      // Docs
      for (const dtype of DOC_KEYS) {
        const docData = docsMap[dtype];
        if (!docData) continue;
        md += `## ${DOC_EMOJI[dtype]} ${DOC_LABEL_MAP[dtype]}\n\n`;
        md += typeof docData === 'string' ? docData : JSON.stringify(docData, null, 2);
        md += '\n\n';
      }

      downloadBlob(md, `${fileBase}.md`, 'text/markdown');

    } else if (format === 'csv') {
      /* -- CSV: spreadsheet-friendly with expanded rows -- */
      const { daysData, docsMap } = await fetchAllData(tripId);

      const headers = [
        'Day', '日期', '星期', '時間', '地點', '評分', '說明', '備註',
        '交通方式', '交通時間(分)', '餐廳名', '餐廳類別', '餐廳評分', '餐廳價格',
        '購物店名', '購物類別', '購物必買', '住宿名', '退房時間',
      ];
      const rows: string[][] = [headers];

      const csvCell = (v: unknown) => s(v);

      for (const day of daysData) {
        const dayNum = s(day.dayNum);
        const dayDate = s(day.date);
        const dayWeek = s(day.dayOfWeek);

        // Hotel row
        const hotel = day.hotel;
        if (hotel?.name) {
          rows.push([
            dayNum, dayDate, dayWeek, '住宿', csvCell(hotel.name), '', '', csvCell(hotel.note),
            '', '', '', '', '', '',
            '', '', '', csvCell(hotel.name), csvCell(hotel.checkout),
          ]);
        }

        // Timeline entries
        const timeline = day.timeline ?? [];
        for (const e of timeline) {
          const travel = e.travel !== null && typeof e.travel === 'object' ? e.travel as Record<string, unknown> : null;
          const travelType = csvCell(travel?.type ?? e.travelType);
          const travelMin = csvCell(travel?.min ?? e.travelMin);

          const baseRow = [
            dayNum, dayDate, dayWeek, csvCell(e.time), csvCell(e.title),
            csvCell(e.googleRating), csvCell(e.description), csvCell(e.note),
            travelType, travelMin,
          ];

          const restaurants = e.restaurants ?? [];
          const shopping = e.shopping ?? [];
          const maxNested = Math.max(restaurants.length, shopping.length, 1);

          for (let n = 0; n < maxNested; n++) {
            const r = restaurants[n];
            const sh = shopping[n];
            // For subsequent rows, repeat entry base columns
            const row = n === 0 ? [...baseRow] : [dayNum, dayDate, dayWeek, csvCell(e.time), csvCell(e.title), '', '', '', '', ''];
            // Restaurant columns
            row.push(r ? csvCell(r.name) : '', r ? csvCell(r.category) : '', r ? csvCell(r.googleRating) : '', r ? csvCell(r.price) : '');
            // Shopping columns
            row.push(sh ? csvCell(sh.name) : '', sh ? csvCell(sh.category) : '', sh ? csvCell(sh.mustBuy) : '');
            // Hotel columns (empty for timeline entries)
            row.push('', '');
            rows.push(row);
          }
        }
      }

      // Append docs as separate rows
      for (const dtype of DOC_KEYS) {
        const docData = docsMap[dtype];
        if (!docData) continue;
        const docStr = typeof docData === 'string' ? docData : JSON.stringify(docData);
        const row = new Array(headers.length).fill('');
        row[0] = '附錄';
        row[3] = DOC_LABEL_MAP[dtype] || dtype;
        row[6] = s(docStr);
        rows.push(row);
      }

      const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      downloadBlob('\uFEFF' + csv, `${fileBase}.csv`, 'text/csv;charset=utf-8');

    } else if (format === 'pdf') {
      /* -- PDF: generate and download via html2pdf.js -- */
      const html2pdf = (await import('html2pdf.js')).default;
      document.body.classList.add('print-mode');
      window.scrollTo(0, 0);
      await new Promise(r => setTimeout(r, 500));
      const el = document.getElementById('tripContent');
      if (el) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (html2pdf as any)()
          .set({
            margin: [10, 10, 10, 10],
            filename: `${fileBase}.pdf`,
            image: { type: 'jpeg', quality: 0.92 },
            html2canvas: { scale: 2, useCORS: true, scrollY: -window.scrollY, windowWidth: el.scrollWidth },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'legacy'] },
          })
          .from(el)
          .save();
      }
      document.body.classList.remove('print-mode');
    }
  } catch {
    document.body.classList.remove('print-mode');
    alert('下載失敗，請稍後再試');
  }
}
