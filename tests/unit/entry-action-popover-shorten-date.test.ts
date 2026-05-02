/**
 * shortenDateLabel — pure regex helper for entry copy/move day picker.
 * Compresses `2026-07-26 (六)` → `7/26 (六)` so the day list doesn't wrap.
 *
 * Caller contract (TripPage.tsx dayOptions via mapDay.parseLocalDate): always
 * zero-padded `YYYY-MM-DD（週）`. Fallback returns label as-is so a future
 * caller-contract change doesn't crash the picker.
 */
import { describe, it, expect } from 'vitest';
import { shortenDateLabel } from '../../src/lib/entryAction';

describe('shortenDateLabel', () => {
  it('canonical YYYY-MM-DD with 半形括號 weekday → strips year + leading zero', () => {
    expect(shortenDateLabel('2026-07-26 (六)')).toBe('7/26 (六)');
  });

  it('canonical YYYY-MM-DD with 全形（）weekday → strips year + leading zero', () => {
    expect(shortenDateLabel('2026-07-29（三）')).toBe('7/29（三）');
  });

  it('double-digit month + day kept intact', () => {
    expect(shortenDateLabel('2026-12-25（四）')).toBe('12/25（四）');
  });

  it('label with no weekday suffix still shortens', () => {
    expect(shortenDateLabel('2026-08-01')).toBe('8/1');
  });

  it('non-matching label falls back to itself (e.g. plain "Day 1")', () => {
    expect(shortenDateLabel('Day 1')).toBe('Day 1');
  });

  it('empty string falls back to itself', () => {
    expect(shortenDateLabel('')).toBe('');
  });

  it('non-hyphen separator falls back (e.g. 2026/07/26)', () => {
    // tightened regex requires literal `-` — slash format is not the canonical
    // format and should not silently re-shape into '2026//7' garbage.
    expect(shortenDateLabel('2026/07/26')).toBe('2026/07/26');
  });

  it('non zero-padded month falls back (caller contract is strict YYYY-MM-DD)', () => {
    // Tightened regex from `\d{1,2}` to `\d{2}` to mirror caller contract.
    // Documents that loose forms are NOT shortened — fallback preserves full.
    expect(shortenDateLabel('2026-7-2（一）')).toBe('2026-7-2（一）');
  });
});
