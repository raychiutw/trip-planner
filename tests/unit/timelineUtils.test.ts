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
   F001 — parseTimeRange / formatDuration / deriveTypeMeta
   ============================================================ */

import { parseTimeRange, formatDuration, deriveTypeMeta } from '../../src/lib/timelineUtils';
import type { TimelineEntryData } from '../../src/components/trip/TimelineEvent';

describe('parseTimeRange', () => {
  it('undefined → empty', () => {
    expect(parseTimeRange(undefined)).toEqual({ start: '', end: '', duration: 0 });
  });

  it('null → empty', () => {
    expect(parseTimeRange(null)).toEqual({ start: '', end: '', duration: 0 });
  });

  it('"09:00-11:30" → start=09:00, end=11:30, duration=150', () => {
    expect(parseTimeRange('09:00-11:30')).toEqual({ start: '09:00', end: '11:30', duration: 150 });
  });

  it('"10:45-12:00" → start=10:45, end=12:00, duration=75', () => {
    expect(parseTimeRange('10:45-12:00')).toEqual({ start: '10:45', end: '12:00', duration: 75 });
  });

  it('"10:45" (no end) → start=10:45, end="", duration=0', () => {
    expect(parseTimeRange('10:45')).toEqual({ start: '10:45', end: '', duration: 0 });
  });

  it('"23:00-01:00" midnight crossing → duration=120', () => {
    expect(parseTimeRange('23:00-01:00')).toEqual({ start: '23:00', end: '01:00', duration: 120 });
  });
});

describe('formatDuration', () => {
  it('0 → ""', () => {
    expect(formatDuration(0)).toBe('');
  });

  it('negative → ""', () => {
    expect(formatDuration(-5)).toBe('');
  });

  it('45 → "45m"', () => {
    expect(formatDuration(45)).toBe('45m');
  });

  it('60 → "1h"', () => {
    expect(formatDuration(60)).toBe('1h');
  });

  it('90 → "1h 30m"', () => {
    expect(formatDuration(90)).toBe('1h 30m');
  });

  it('120 → "2h"', () => {
    expect(formatDuration(120)).toBe('2h');
  });

  it('NaN → "" (malformed time input guard)', () => {
    expect(formatDuration(NaN)).toBe('');
  });

  it('Infinity → ""', () => {
    expect(formatDuration(Infinity)).toBe('');
  });
});

describe('deriveTypeMeta', () => {
  it('機場接送 → plane / 飛行 / accent:false', () => {
    const entry: TimelineEntryData = { title: '機場接送' };
    expect(deriveTypeMeta(entry)).toEqual({ icon: 'plane', label: '飛行', accent: false });
  });

  it('午餐 (description: restaurant) → fork-knife / 用餐 / accent:true', () => {
    const entry: TimelineEntryData = { title: '午餐', description: 'restaurant' };
    expect(deriveTypeMeta(entry)).toEqual({ icon: 'fork-knife', label: '用餐', accent: true });
  });

  it('步行市區 → walk / 散步 / accent:false', () => {
    const entry: TimelineEntryData = { title: '步行市區' };
    expect(deriveTypeMeta(entry)).toEqual({ icon: 'walk', label: '散步', accent: false });
  });

  it('無特殊關鍵字 → location-pin / 景點 / accent:true', () => {
    const entry: TimelineEntryData = { title: '首里城' };
    expect(deriveTypeMeta(entry)).toEqual({ icon: 'location-pin', label: '景點', accent: true });
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
