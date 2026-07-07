/**
 * v2.31.77 fix #196：lock entry time read sites use **camelCase**
 * (startTime / endTime) — backend `json()` 經 `deepCamel` 已把 D1 snake_case
 * column `start_time` / `end_time` 轉成 camelCase。
 *
 * 從 v2.29.0 (`trip_entries.time` DROP COLUMN) 起，6 個 frontend 模組的 read
 * path 一直用 snake_case → 永遠 undefined → 各種 silent 失效（TimelineRail
 * row 不顯時間、validateDay 警告永不觸發、buildWeatherDay 預設 0 點、
 * parseEntryTimeRange 全 null）。本 test 鎖此修正後的 invariant。
 *
 * 寫操作（PATCH /trip-entries body）保留 snake_case — backend ALLOWED_FIELDS
 * 是 ['start_time', 'end_time']，frontend write 端 (EditEntryPage) 不變。
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEntryTime } from '../../src/lib/timelineUtils';
import { parseEntryTimeRange } from '../../src/lib/drag-strategy';
import { validateDay } from '../../src/lib/validateDay';
import { buildWeatherDay } from '../../src/lib/weather';

describe('v2.31.77: entry time read uses camelCase (startTime / endTime)', () => {
  describe('parseEntryTime accepts camelCase input', () => {
    it('reads startTime + endTime → returns non-empty parsed', () => {
      const parsed = parseEntryTime({ startTime: '10:00', endTime: '11:30' });
      expect(parsed.start).toBe('10:00');
      expect(parsed.end).toBe('11:30');
      expect(parsed.duration).toBe(90);
    });

    it('snake_case input now returns empty (regression: ensure type lock)', () => {
      // @ts-expect-error legacy snake_case keys are no longer in the type
      const parsed = parseEntryTime({ start_time: '10:00', end_time: '11:30' });
      // Body should read undefined and return empty → catches accidental
      // re-introduction of snake_case fallback during future refactors
      expect(parsed.start).toBe('');
      expect(parsed.end).toBe('');
    });
  });

  describe('parseEntryTimeRange accepts camelCase input', () => {
    it('reads startTime + endTime → returns range', () => {
      const range = parseEntryTimeRange({ startTime: '09:00', endTime: '10:00' });
      expect(range).not.toBeNull();
      expect(range!.startMinutes).toBe(540);
      expect(range!.endMinutes).toBe(600);
    });
  });

  describe('validateDay accepts camelCase input', () => {
    it('warns when entry startTime is earlier than POI hours', () => {
      const warnings = validateDay([
        {
          startTime: '08:00',
          endTime: '09:00',
          title: '早餐店',
          stopPois: [{ name: '某早餐店', hours: '09:00–14:00' }],
        },
      ]);
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toMatch(/可能早於/);
    });
  });

  describe('buildWeatherDay accepts camelCase input', () => {
    it('parses startTime hour for weather time slot', () => {
      const day = buildWeatherDay('2026-05-18', [
        { startTime: '09:00', displayTitle: '景點 A', location: { lat: 26.21, lng: 127.72 } },
        { startTime: '15:00', displayTitle: '景點 B', location: { lat: 26.50, lng: 127.99 } },
      ]);
      expect(day).not.toBeNull();
      expect(day!.locations).toHaveLength(2);
      // Day-built locations carry the parsed hour
      expect(day!.locations[0]).toBeTruthy();
    });
  });

  describe('source-grep: no .start_time / .end_time READS in src/ (writes excluded)', () => {
    const SRC_READ_FILES = [
      '../../src/lib/timelineUtils.ts',
      '../../src/lib/validateDay.ts',
      '../../src/lib/weather.ts',
      '../../src/lib/drag-strategy.ts',
      '../../src/lib/mapDay.ts',
    ];

    for (const relPath of SRC_READ_FILES) {
      it(`${relPath} has no .start_time / .end_time property reads`, () => {
        const content = readFileSync(join(__dirname, relPath), 'utf8');
        // Strip comments first
        const codeOnly = content
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/\/\/.*$/gm, '');
        // .start_time or .end_time on identifiers (excluding string literals)
        expect(codeOnly).not.toMatch(/\.start_time\b/);
        expect(codeOnly).not.toMatch(/\.end_time\b/);
      });
    }
  });

  describe('source-grep: EditEntryPage PATCH body keeps snake_case (backend contract)', () => {
    it('write payload still sends start_time / end_time (snake)', () => {
      const content = readFileSync(
        join(__dirname, '../../src/pages/EditEntryPage.tsx'),
        'utf8',
      );
      expect(content).toMatch(/body\.start_time\s*=/);
      expect(content).toMatch(/body\.end_time\s*=/);
    });
  });
});
