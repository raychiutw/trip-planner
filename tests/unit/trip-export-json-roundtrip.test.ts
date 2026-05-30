/**
 * PR2 — buildTripExportJson round-trip schema (pure function).
 * Locks: schemaVersion, entryPosition flatten order, segment positional re-keying
 * (fromEntryId → fromEntryIdx), orphan-segment drop, notes passthrough.
 */
import { describe, it, expect } from 'vitest';
import { buildTripExportJson } from '../../src/lib/tripExport';

/* eslint-disable @typescript-eslint/no-explicit-any */
const input = {
  meta: { id: 't1', name: '沖繩', title: '沖繩五日' },
  days: [
    { dayNum: 1, date: '2026-07-26', timeline: [{ id: 10, title: 'A' }, { id: 11, title: 'B' }] },
    { dayNum: 2, date: '2026-07-27', timeline: [{ id: 20, title: 'C' }] },
  ],
  segments: [
    { id: 1, fromEntryId: 10, toEntryId: 11, mode: 'driving', min: 12, distanceM: 2100, source: 'google' },
    { id: 2, fromEntryId: 11, toEntryId: 20, mode: 'walking', min: 8, distanceM: null, source: null },
    { id: 3, fromEntryId: 999, toEntryId: 10, mode: 'transit', min: 5, distanceM: null, source: null }, // orphan from-id
    { id: 4, fromEntryId: 10, toEntryId: 888, mode: 'ferry', min: 5, distanceM: null, source: null }, // orphan to-id
  ],
  notes: { flights: [{ flightNo: '112' }], lodgings: [], reservations: [], pretripNotes: [], emergencyContacts: [] },
};

const positions = (out: ReturnType<typeof buildTripExportJson>) =>
  out.days.flatMap((d) => (d.timeline as any[]).map((e) => e.entryPosition));

describe('buildTripExportJson — round-trip schema', () => {
  it('sets schemaVersion 1 and carries meta + notes', () => {
    const out = buildTripExportJson(input);
    expect(out.schemaVersion).toBe(1);
    expect(out.meta).toEqual(input.meta);
    expect((out.notes as any).flights).toHaveLength(1);
  });

  it('assigns entryPosition in flatten order (day then timeline)', () => {
    expect(positions(buildTripExportJson(input))).toEqual([0, 1, 2]);
  });

  it('re-keys segments to positional fromEntryIdx/toEntryIdx', () => {
    const out = buildTripExportJson(input);
    expect(out.segments).toEqual([
      { fromEntryIdx: 0, toEntryIdx: 1, mode: 'driving', min: 12, distanceM: 2100, source: 'google' },
      { fromEntryIdx: 1, toEntryIdx: 2, mode: 'walking', min: 8, distanceM: null, source: null },
    ]);
  });

  it('drops orphan segments — missing from-id OR missing to-id', () => {
    const out = buildTripExportJson(input);
    expect(out.segments.find((s) => s.mode === 'transit')).toBeUndefined(); // orphan from-id
    expect(out.segments.find((s) => s.mode === 'ferry')).toBeUndefined();   // orphan to-id
    expect(out.segments).toHaveLength(2);
    expect(out.segments.every((s) => s.fromEntryIdx >= 0 && s.toEntryIdx >= 0)).toBe(true);
  });

  it('preserves full entry fields alongside entryPosition (import fidelity)', () => {
    const out = buildTripExportJson(input);
    expect((out.days[0]!.timeline as any[])[0]).toMatchObject({ id: 10, title: 'A', entryPosition: 0 });
  });

  it('handles an empty trip (0 days / 0 segments)', () => {
    const out = buildTripExportJson({ meta: {}, days: [], segments: [], notes: {} });
    expect(out.days).toEqual([]);
    expect(out.segments).toEqual([]);
    expect(out.schemaVersion).toBe(1);
  });
});
