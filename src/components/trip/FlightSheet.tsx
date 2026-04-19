/**
 * FlightSheet — rich flight-card renderer (design_mobile 與 editor.jsx 的 FlightInfo 參照)
 *
 * 對 DocEntry.content (markdown / plain text) 嘗試解析:
 *  - label (去程/回程/outbound/return)
 *  - code (BR 106, CI 123 etc)
 *  - 時間 HH:MM → HH:MM
 *  - 機場代碼 TPE / OKA / NRT
 *  - 座位 (32A / 32B)
 *  - 確認碼 (X7K9PQ)
 *
 * 解析不到的欄位 gracefully fall back 到原 description 顯示。
 */

import { memo } from 'react';
import type { DocEntry } from './DocCard';

interface ParsedFlight {
  label: string;
  code?: string;
  depT?: string;
  dep?: string;
  depC?: string;
  arrT?: string;
  arr?: string;
  arrC?: string;
  date?: string;
  dur?: string;
  seat?: string;
  gate?: string;
  raw: string;
}

const AIRPORT_CODE = /\b([A-Z]{3})\b/g;
const TWO_TIMES = /(\d{1,2}:\d{2})[^\d]{1,30}?(\d{1,2}:\d{2})/;
const FLIGHT_CODE_STRICT = /\b(BR|CI|JL|NH|MM|JX|GE|EVA|CAL|IT|TR|VJ|AK|VA|UA|AA|DL|CX|KE|OZ|7C|LJ|HX|3K|ZH)\s?(\d{2,4})\b/i;
const SEAT = /座位[：:]*\s*([0-9A-Z\s,/]+)/;
const GATE = /(?:登機門|gate)[：:]*\s*([A-Z0-9-]+)/i;
const DATE_TOKEN = /(\d{1,2}\/\d{1,2}(?:\s*[（(][一二三四五六日][）)])?)/;
const DUR_TOKEN = /(\d+h\s*\d*m?|\d+\s*小時\s*\d*\s*分?)/;
const AIRPORT_ALLOW = /^(TPE|TSA|OKA|NRT|HND|KIX|ITM|FUK|KOJ|NGO|SDJ|CTS|ICN|GMP|PEK|PVG|HKG|SIN|BKK|KUL|DPS)$/;
const LABEL_OUTBOUND = /去程|outbound/i;
const LABEL_RETURN = /回程|return/i;

function extractAirports(text: string): string[] {
  const airports: string[] = [];
  const matches = text.match(AIRPORT_CODE);
  if (!matches) return airports;
  for (const m of matches) {
    if (AIRPORT_ALLOW.test(m) && !airports.includes(m)) {
      airports.push(m);
      if (airports.length >= 2) break;
    }
  }
  return airports;
}

function parseFlight(entry: DocEntry): ParsedFlight {
  const text = `${entry.section ?? ''} ${entry.title ?? ''}\n${entry.content ?? ''}`;
  const raw = entry.content ?? '';

  // Label: 去程 / 回程 — section/title/content 任一命中
  let label = (entry.section || entry.title || '').trim();
  if (LABEL_RETURN.test(text)) label = '回程';
  else if (LABEL_OUTBOUND.test(text)) label = '去程';

  // Flight code — 嚴格比對航空公司前綴
  const codeMatch = text.match(FLIGHT_CODE_STRICT);
  const code = codeMatch ? `${codeMatch[1]?.toUpperCase()} ${codeMatch[2]}` : undefined;

  // Times: 找任兩個 HH:MM，中間容許最多 30 個非數字字元
  const timeMatch = raw.match(TWO_TIMES);
  const depT = timeMatch?.[1];
  const arrT = timeMatch?.[2];

  // Airports: 只接受已知機場代碼
  const airports = extractAirports(text);
  const dep = airports[0];
  const arr = airports[1];

  const seat = text.match(SEAT)?.[1]?.trim();
  const gate = text.match(GATE)?.[1];
  const date = text.match(DATE_TOKEN)?.[1];
  const dur = text.match(DUR_TOKEN)?.[1];

  return { label, code, depT, dep, arrT, arr, date, dur, seat, gate, raw };
}

interface FlightSheetProps {
  entries: DocEntry[];
}

const FlightSheet = memo(function FlightSheet({ entries }: FlightSheetProps) {
  if (!entries || entries.length === 0) {
    return <p className="text-callout text-muted text-center py-4">尚無航班資料</p>;
  }

  const parsed = entries.map(parseFlight);
  const hasStructured = parsed.some((p) => p.depT && p.arrT);

  return (
    <div className="flex flex-col gap-3 p-padding-h">
      {hasStructured && (
        <div className="flex items-baseline justify-between pb-2 border-b border-border">
          <span className="text-caption2 font-semibold tracking-[0.18em] uppercase text-muted">Flight Info</span>
          <span className="text-caption text-muted">{parsed.length} 航段</span>
        </div>
      )}
      {parsed.map((f, i) => {
        const hasTimes = !!(f.depT && f.arrT);
        if (!hasTimes) {
          // Fallback to original content display
          return (
            <div key={i} className="ocean-side-card">
              <div className="ocean-side-card-header">
                <span className="ocean-side-card-title">{f.label || '航班'}</span>
              </div>
              <div
                className="text-callout leading-relaxed"
                dangerouslySetInnerHTML={{ __html: f.raw }}
              />
            </div>
          );
        }
        return (
          <div key={i} className="ocean-flight-card">
            <div className="flex justify-between items-baseline mb-3">
              <span className="text-caption2 font-semibold tracking-[0.18em] uppercase text-muted">
                {f.label}{f.code ? ` · ${f.code}` : ''}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-success">
                <span className="w-1.5 h-1.5 rounded-full bg-success" /> 已確認
              </span>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
              <div>
                <div className="text-[28px] font-extrabold tabular-nums leading-none tracking-tight">{f.depT}</div>
                {f.dep && <div className="text-footnote font-bold mt-1">{f.dep}</div>}
              </div>
              <div className="text-center text-muted">
                {f.dur && <div className="text-[10px] tracking-wider">{f.dur}</div>}
                <div className="my-1" aria-hidden="true">
                  <svg width="22" height="12" viewBox="0 0 22 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M1 6 H21 M16 2 L20 6 L16 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                {f.date && <div className="text-[10px]">{f.date}</div>}
              </div>
              <div className="text-right">
                <div className="text-[28px] font-extrabold tabular-nums leading-none tracking-tight">{f.arrT}</div>
                {f.arr && <div className="text-footnote font-bold mt-1">{f.arr}</div>}
              </div>
            </div>
            {(f.seat || f.gate) && (
              <div className="mt-3 pt-3 border-t border-border flex gap-5 text-caption">
                {f.seat && (
                  <div>
                    <span className="text-muted">座位</span>
                    <b className="ml-1.5 tabular-nums">{f.seat}</b>
                  </div>
                )}
                {f.gate && (
                  <div>
                    <span className="text-muted">登機門</span>
                    <b className="ml-1.5">{f.gate}</b>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

export default FlightSheet;
