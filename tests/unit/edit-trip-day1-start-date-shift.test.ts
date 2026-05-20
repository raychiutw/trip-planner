/**
 * v2.33.8 — EditTripPage 整體平移行程 (Day 1 起始日期 shift) source-grep tests.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = readFileSync(
  path.resolve(__dirname, '../../src/pages/EditTripPage.tsx'),
  'utf8',
);

describe('EditTripPage — v2.33.8 Day 1 起始日期平移', () => {
  it('handleConfirmShift callback 呼叫 POST /days/shift', () => {
    expect(SRC).toMatch(/handleConfirmShift = useCallback/);
    expect(SRC).toMatch(
      /apiFetchRaw\(`\/trips\/\$\{encodeURIComponent\(tripId\)\}\/days\/shift`,[\s\S]{0,250}method: 'POST'/,
    );
    expect(SRC).toMatch(/JSON\.stringify\(\{ startDate: shiftNewDate \}\)/);
  });

  it('shift button — 精簡單行「Day 1 起始日期：M/D（週幾）」+ chev，無 icon', () => {
    expect(SRC).toMatch(/data-testid="edit-trip-day-shift-btn"/);
    expect(SRC).toMatch(/Day 1 起始日期：/);
    expect(SRC).toMatch(/className="tp-edit-day-shift-chev"/);
    // 不該有 icon (calendar / 📅)
    expect(SRC).not.toMatch(/<Icon name="calendar"\s*\/>[\s\S]{0,200}tp-edit-day-shift-btn/);
  });

  it('shift modal — title「整體平移行程」+ date input + preview「old → new」', () => {
    expect(SRC).toMatch(/data-testid="edit-trip-shift-modal"/);
    expect(SRC).toMatch(/整體平移行程/);
    expect(SRC).toMatch(/data-testid="edit-trip-shift-date-input"/);
    expect(SRC).toMatch(/data-testid="edit-trip-shift-preview"/);
    expect(SRC).toMatch(/data-testid="edit-trip-shift-confirm-btn"/);
  });

  it('confirm button disabled when shiftNewDate === current Day 1 date (no-op)', () => {
    expect(SRC).toMatch(/disabled=\{daysMutating \|\| shiftNewDate === days\[0\]!\.date\}/);
  });

  it('CSS .tp-edit-day-shift-btn 樣式 + .tp-shift-modal', () => {
    expect(SRC).toMatch(/\.tp-edit-day-shift-btn\s*\{/);
    expect(SRC).toMatch(/\.tp-shift-modal\s*\{/);
    expect(SRC).toMatch(/\.tp-shift-modal-preview/);
  });
});
