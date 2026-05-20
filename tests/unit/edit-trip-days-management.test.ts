/**
 * v2.33.0 — EditTripPage 「行程天數」section source-grep regression test。
 *
 * 涵蓋：
 * - days state + DaySummary type
 * - GET /days?all=1 fetch + refetchDays helper
 * - handleAddDay (POST /days with position) + handleConfirmDelete (DELETE /days/:num)
 * - 雙向 card-style add button（prepend 在 list 上方、append 在下方）
 * - per-row ✕ button + ConfirmModal wire
 * - 取代 v2.32.5 read-only date section
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const EDIT_TRIP_SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/EditTripPage.tsx'),
  'utf8',
);

describe('EditTripPage — v2.33.0 行程天數 section', () => {
  it('DaySummary / PendingDelete interfaces 已定義', () => {
    expect(EDIT_TRIP_SRC).toMatch(/interface DaySummary\b/);
    expect(EDIT_TRIP_SRC).toMatch(/interface PendingDelete\b/);
  });

  it('days state useState<DaySummary[] | null>(null)', () => {
    expect(EDIT_TRIP_SRC).toMatch(/useState<DaySummary\[\]\s*\|\s*null>\(null\)/);
  });

  it('refetchDays callback fetch /trips/:id/days?all=1', () => {
    expect(EDIT_TRIP_SRC).toMatch(/refetchDays.*useCallback/);
    expect(EDIT_TRIP_SRC).toMatch(/\/trips\/\$\{encodeURIComponent\(tripId\)\}\/days\?all=1/);
  });

  it('handleAddDay POST /days with body { position }', () => {
    expect(EDIT_TRIP_SRC).toMatch(/handleAddDay = useCallback\(async \(position: 'start' \| 'end'\)/);
    expect(EDIT_TRIP_SRC).toMatch(
      /apiFetchRaw\(`\/trips\/\$\{encodeURIComponent\(tripId\)\}\/days`,[\s\S]{0,200}method: 'POST'[\s\S]{0,200}position/,
    );
  });

  it('handleConfirmDelete DELETE /days/:dayNum', () => {
    expect(EDIT_TRIP_SRC).toMatch(/handleConfirmDelete = useCallback/);
    expect(EDIT_TRIP_SRC).toMatch(
      /apiFetchRaw\([\s\S]{0,80}\/days\/\$\{dayNum\}`,[\s\S]{0,80}method: 'DELETE'/,
    );
  });

  it('ConfirmModal import + mount with pendingDelete state', () => {
    expect(EDIT_TRIP_SRC).toMatch(/import ConfirmModal from/);
    expect(EDIT_TRIP_SRC).toMatch(/<ConfirmModal\b[\s\S]{0,400}open=\{!!pendingDelete\}/);
  });

  it('prepend / append testid + Icon plus 用 card style', () => {
    expect(EDIT_TRIP_SRC).toMatch(/data-testid="edit-trip-day-prepend"/);
    expect(EDIT_TRIP_SRC).toMatch(/data-testid="edit-trip-day-append"/);
    expect(EDIT_TRIP_SRC).toMatch(/className="tp-edit-day-add-card"/);
  });

  it('per-row ✕ testid + has-entries-warning class', () => {
    expect(EDIT_TRIP_SRC).toMatch(/data-testid=\{`edit-trip-day-remove-\$\{d\.dayNum\}`\}/);
    expect(EDIT_TRIP_SRC).toMatch(/has-entries-warning/);
  });

  it('v2.33.5: ✕ icon 用 name="x-mark" (不是 "x" — 後者 Icon component 沒對應)', () => {
    expect(EDIT_TRIP_SRC).toMatch(/<Icon name="x-mark"/);
    expect(EDIT_TRIP_SRC).not.toMatch(/<Icon name="x"\s*\/>/);
  });

  it('v2.33.7: 中間天 gap 偵測 + dashed placeholder 加回功能', () => {
    // gap detection helpers
    expect(EDIT_TRIP_SRC).toMatch(/function daysBetween/);
    expect(EDIT_TRIP_SRC).toMatch(/function shiftDateByDays/);
    expect(EDIT_TRIP_SRC).toMatch(/function chineseDayOfWeek/);
    // handleRestoreDay 呼叫 POST position: 'insert', date
    expect(EDIT_TRIP_SRC).toMatch(/handleRestoreDay = useCallback/);
    expect(EDIT_TRIP_SRC).toMatch(/JSON\.stringify\(\{ position: 'insert', date \}\)/);
    // gap placeholder render with testid
    expect(EDIT_TRIP_SRC).toMatch(/data-testid=\{`edit-trip-day-gap-\$\{gapDate\}`\}/);
    expect(EDIT_TRIP_SRC).toMatch(/className="tp-edit-day-gap"/);
    expect(EDIT_TRIP_SRC).toMatch(/加回 \$\{formatShortDate\(gapDate\)\}/);
    // CSS .tp-edit-day-gap
    expect(EDIT_TRIP_SRC).toMatch(/\.tp-edit-day-gap\s*\{[\s\S]{0,500}border: 1px dashed/);
  });

  it('取代既有 read-only date section（不再 render tp-edit-date-readonly）', () => {
    expect(EDIT_TRIP_SRC).not.toMatch(/data-testid="edit-trip-date-readonly"/);
    expect(EDIT_TRIP_SRC).not.toMatch(/修改日期請另建新行程/);
  });

  it('section testid edit-trip-days-section + loading placeholder', () => {
    expect(EDIT_TRIP_SRC).toMatch(/data-testid="edit-trip-days-section"/);
    expect(EDIT_TRIP_SRC).toMatch(/data-testid="edit-trip-days-loading"/);
  });

  it('儲存變更 button label 不再寫 dateRange const（避免 unused var）', () => {
    expect(EDIT_TRIP_SRC).not.toMatch(/const dateRange = original\?\.startDate/);
  });

  it('CSS class .tp-edit-day-add-card + min-height 56px + accent-subtle bg', () => {
    expect(EDIT_TRIP_SRC).toMatch(/\.tp-edit-day-add-card\s*\{[\s\S]{0,500}min-height:\s*56px/);
    expect(EDIT_TRIP_SRC).toMatch(/\.tp-edit-day-add-card\s*\{[\s\S]{0,500}background:\s*var\(--color-accent-subtle\)/);
  });

  it('v2.33.3: day row 顯示 「N 個景點 · X km」對齊 mockup', () => {
    expect(EDIT_TRIP_SRC).toMatch(/function computeTotalKm/);
    expect(EDIT_TRIP_SRC).toMatch(/totalKm: computeTotalKm\(d\.timeline\)/);
    // Conditional render: 有 km 顯示「· X km」，無則只「N 個景點」
    expect(EDIT_TRIP_SRC).toMatch(
      /d\.totalKm != null[\s\S]{0,200}`\$\{d\.entryCount\} 個景點 · \$\{d\.totalKm\} km`/,
    );
  });

  it('v2.33.2: date 顯示用 formatShortDate (mockup 對齊 M/D 短格式)', () => {
    expect(EDIT_TRIP_SRC).toMatch(/function formatShortDate/);
    // day row date 呼叫 formatShortDate
    expect(EDIT_TRIP_SRC).toMatch(
      /\$\{formatShortDate\(d\.date\)\}（\$\{d\.dayOfWeek/,
    );
    // header date range 也用 formatShortDate
    expect(EDIT_TRIP_SRC).toMatch(/formatShortDate\(days\[0\]!\.date\)/);
    expect(EDIT_TRIP_SRC).toMatch(/formatShortDate\(days\[days\.length - 1\]!\.date\)/);
    // ConfirmModal 內也用
    expect(EDIT_TRIP_SRC).toMatch(/formatShortDate\(pendingDelete\.date\)/);
  });
});
