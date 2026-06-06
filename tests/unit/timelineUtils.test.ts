/**
 * tests/unit/timelineUtils.test.ts
 *
 * F001 紅測試 — 確認 timelineUtils lib 行為
 * F002 補充 source-match guard（確保兩 component 不再有本地函式定義）
 * F003 source-match guard（TimelineRail.tsx 已移除 mobile-only / design_mobile.jsx）
 * F004 source-match guard（TimelineEventProps 不含 index 欄位）
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/* ============================================================
   F001 — formatDuration / deriveTypeMeta
   v2.33.91: parseTimeRange 删（v2.29.0 trip_entries.time DROPPED 後死碼），改 parseEntryTime
   ============================================================ */

import { formatDuration, formatDurationCompact, deriveTypeMeta } from '../../src/lib/timelineUtils';
import type { TimelineEntryData } from '../../src/components/trip/TimelineEvent';

describe('formatDuration', () => {
  it('0 → ""', () => {
    expect(formatDuration(0)).toBe('');
  });

  it('negative → ""', () => {
    expect(formatDuration(-5)).toBe('');
  });

  it('45 → "45 分鐘"', () => {
    expect(formatDuration(45)).toBe('45 分鐘');
  });

  it('60 → "1 小時"', () => {
    expect(formatDuration(60)).toBe('1 小時');
  });

  it('90 → "1 小時 30 分"', () => {
    expect(formatDuration(90)).toBe('1 小時 30 分');
  });

  it('120 → "2 小時"', () => {
    expect(formatDuration(120)).toBe('2 小時');
  });

  it('NaN → "" (malformed time input guard)', () => {
    expect(formatDuration(NaN)).toBe('');
  });

  it('Infinity → ""', () => {
    expect(formatDuration(Infinity)).toBe('');
  });
});

describe('formatDurationCompact', () => {
  it('0 → ""', () => { expect(formatDurationCompact(0)).toBe(''); });
  it('negative → ""', () => { expect(formatDurationCompact(-5)).toBe(''); });
  it('NaN → ""', () => { expect(formatDurationCompact(NaN)).toBe(''); });
  it('30 → "30 min"', () => { expect(formatDurationCompact(30)).toBe('30 min'); });
  it('59 → "59 min"', () => { expect(formatDurationCompact(59)).toBe('59 min'); });
  it('60 → "1 hr"', () => { expect(formatDurationCompact(60)).toBe('1 hr'); });
  it('90 → "1.5 hr"', () => { expect(formatDurationCompact(90)).toBe('1.5 hr'); });
  it('240 → "4 hr"', () => { expect(formatDurationCompact(240)).toBe('4 hr'); });
});

describe('deriveTypeMeta', () => {
  it('機場接送 → plane / 飛行 / accent:false', () => {
    const entry: TimelineEntryData = { title: '機場接送' };
    expect(deriveTypeMeta(entry)).toEqual({ icon: 'plane', label: '飛行', accent: false, tone: 'sage' });
  });

  it('午餐 (description: restaurant) → utensils / 用餐 / accent:true', () => {
    const entry: TimelineEntryData = { title: '午餐', description: 'restaurant' };
    expect(deriveTypeMeta(entry)).toEqual({ icon: 'utensils', label: '用餐', accent: true, tone: 'pink' });
  });

  it('步行市區 → walking / 散步 / accent:false', () => {
    const entry: TimelineEntryData = { title: '步行市區' };
    expect(deriveTypeMeta(entry)).toEqual({ icon: 'walking', label: '散步', accent: false, tone: 'sage' });
  });

  it('無特殊關鍵字 → location-pin / 景點 / accent:true', () => {
    const entry: TimelineEntryData = { title: '首里城' };
    expect(deriveTypeMeta(entry)).toEqual({ icon: 'location-pin', label: '景點', accent: true, tone: 'accent' });
  });

  // 柔褐三色主題 tone 對應（v2.53 調整：用餐→粉、住宿→sage、活動→柔褐）
  it('活動 (poiType: activity) → sparkle / 活動 / tone:accent（柔褐）', () => {
    expect(deriveTypeMeta({ title: 'X', poiType: 'activity' })).toEqual({ icon: 'sparkle', label: '活動', accent: true, tone: 'accent' });
  });

  it('用餐 (poiType: restaurant) → tone:pink（粉）', () => {
    expect(deriveTypeMeta({ title: 'X', poiType: 'restaurant' }).tone).toBe('pink');
  });

  it('住宿 (poiType: hotel) → tone:sage（綠）', () => {
    expect(deriveTypeMeta({ title: 'X', poiType: 'hotel' }).tone).toBe('sage');
  });

  it('交通 (poiType: transport) → car / 交通 / tone:sage', () => {
    expect(deriveTypeMeta({ title: 'X', poiType: 'transport' })).toEqual({ icon: 'car', label: '交通', accent: false, tone: 'sage' });
  });

  it('景點 (poiType: attraction) → tone:accent（柔褐）', () => {
    expect(deriveTypeMeta({ title: 'X', poiType: 'attraction' }).tone).toBe('accent');
  });

  // Regression guard：deriveTypeMeta 回傳的 icon name 必須存在於 Icon.tsx ICONS registry，
  // 否則 <Icon name=…> 會 silently render null（user 看到的「缺少 icon」即此 bug）。
  it('所有 deriveTypeMeta 回傳的 icon name 都在 ICONS registry', () => {
    const iconSrc = fs.readFileSync(
      path.resolve(__dirname, '../../src/components/shared/Icon.tsx'),
      'utf-8',
    );
    const registered = new Set<string>();
    for (const m of iconSrc.matchAll(/'([\w-]+)':\s*'<path/g)) registered.add(m[1]!);

    const cases: TimelineEntryData[] = [
      { title: '機場接送' },
      { title: '飯店' },
      { title: '午餐 restaurant' },
      { title: 'cafe 咖啡' },
      { title: 'shopping 購物' },
      { title: '開車自駕' },
      { title: '步行市區' },
      { title: 'spa 泡湯' },
      { title: '東京迪士尼樂園', travel: { type: 'walking' } },
      { title: '首里城' },
    ];
    const missing: string[] = [];
    for (const c of cases) {
      const { icon } = deriveTypeMeta(c);
      if (!registered.has(icon)) missing.push(`${c.title}→${icon}`);
    }
    expect(missing).toEqual([]);
  });
});

/* ============================================================
   F005 — parseStartMinutes / parseEndMinutes
   ============================================================ */

import { parseStartMinutes, parseEndMinutes } from '../../src/lib/timelineUtils';

describe('parseStartMinutes', () => {
  it('undefined → -1', () => {
    expect(parseStartMinutes(undefined)).toBe(-1);
  });

  it('null → -1', () => {
    expect(parseStartMinutes(null)).toBe(-1);
  });

  it('malformed (no colon) → -1', () => {
    expect(parseStartMinutes('0900-1200')).toBe(-1);
  });

  it('"09:30-11:00" → 570', () => {
    expect(parseStartMinutes('09:30-11:00')).toBe(570);
  });

  it('"00:00-01:00" → 0', () => {
    expect(parseStartMinutes('00:00-01:00')).toBe(0);
  });

  it('"23:30-01:15" (跨日) → start 23:30 = 1410', () => {
    expect(parseStartMinutes('23:30-01:15')).toBe(1410);
  });

  it('"10:45" (無 end) → 645', () => {
    expect(parseStartMinutes('10:45')).toBe(645);
  });
});

describe('parseEndMinutes', () => {
  it('undefined → -1', () => {
    expect(parseEndMinutes(undefined)).toBe(-1);
  });

  it('null → -1', () => {
    expect(parseEndMinutes(null)).toBe(-1);
  });

  it('malformed (no colon) → -1', () => {
    expect(parseEndMinutes('0900-1200')).toBe(-1);
  });

  it('"09:30-11:00" → 660', () => {
    expect(parseEndMinutes('09:30-11:00')).toBe(660);
  });

  it('"10:45" (no end segment) → -1', () => {
    expect(parseEndMinutes('10:45')).toBe(-1);
  });

  it('"23:30-01:15" (跨日 end) → 75', () => {
    expect(parseEndMinutes('23:30-01:15')).toBe(75);
  });

  it('"00:00-00:00" → 0', () => {
    expect(parseEndMinutes('00:00-00:00')).toBe(0);
  });
});

/* ============================================================
   F005 source-match guard：Timeline.tsx 不再含本地定義
   ============================================================ */

describe('F005 source-match: Timeline.tsx 不含本地 parseStartMinutes / parseEndMinutes', () => {
  it('Timeline.tsx 不含 "function parseStartMinutes"', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../src/components/trip/Timeline.tsx'),
      'utf8',
    );
    expect(src).not.toContain('function parseStartMinutes');
  });

  it('Timeline.tsx 不含 "function parseEndMinutes"', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../src/components/trip/Timeline.tsx'),
      'utf8',
    );
    expect(src).not.toContain('function parseEndMinutes');
  });
});

/* ============================================================
   F002 — source-match guards：兩 component 不含本地函式定義
   ============================================================ */

describe('F002 source-match: TimelineEvent.tsx 不含本地 parseTimeRange 定義', () => {
  it('TimelineEvent.tsx 不含 "function parseTimeRange"', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../src/components/trip/TimelineEvent.tsx'),
      'utf8',
    );
    expect(src).not.toContain('function parseTimeRange');
  });

  it('TimelineEvent.tsx 不含本地 "function formatDuration"', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../src/components/trip/TimelineEvent.tsx'),
      'utf8',
    );
    expect(src).not.toContain('function formatDuration');
  });

  it('TimelineEvent.tsx 不含本地 "function deriveTypeMeta"', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../src/components/trip/TimelineEvent.tsx'),
      'utf8',
    );
    expect(src).not.toContain('function deriveTypeMeta');
  });
});

describe('F002 source-match: TimelineRail.tsx 不含本地函式定義', () => {
  it('TimelineRail.tsx 不含 "function parseTimeRange"', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../src/components/trip/TimelineRail.tsx'),
      'utf8',
    );
    expect(src).not.toContain('function parseTimeRange');
  });

  it('TimelineRail.tsx 不含本地 "function formatDuration"', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../src/components/trip/TimelineRail.tsx'),
      'utf8',
    );
    expect(src).not.toContain('function formatDuration');
  });

  it('TimelineRail.tsx 不含本地 "function deriveTypeMeta"', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../src/components/trip/TimelineRail.tsx'),
      'utf8',
    );
    expect(src).not.toContain('function deriveTypeMeta');
  });
});

/* ============================================================
   F003 — source-match guards：TimelineRail JSDoc 已更新
   ============================================================ */

describe('F003 source-match: TimelineRail.tsx JSDoc 不含過時字串', () => {
  it('TimelineRail.tsx 不含 "mobile-only"', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../src/components/trip/TimelineRail.tsx'),
      'utf8',
    );
    expect(src).not.toContain('mobile-only');
  });

  it('TimelineRail.tsx 不含 "design_mobile.jsx"', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../src/components/trip/TimelineRail.tsx'),
      'utf8',
    );
    expect(src).not.toContain('design_mobile.jsx');
  });
});

/* ============================================================
   F004 — source-match guard：TimelineEventProps 不含 index 欄位
   ============================================================ */

describe('F004 source-match: TimelineEventProps 不含 index 欄位', () => {
  it('TimelineEvent.tsx TimelineEventProps 不含 "index: number"', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../src/components/trip/TimelineEvent.tsx'),
      'utf8',
    );
    expect(src).not.toContain('index: number');
  });
});
