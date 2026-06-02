/**
 * PR2 — buildTripExportJson round-trip schema (pure function).
 * Locks: schemaVersion, entryPosition flatten order, segment positional re-keying
 * (fromEntryId → fromEntryIdx), orphan-segment drop, notes passthrough.
 *
 * v2.x (migration 0078): entry-level note DROPPED. The export→import round-trip
 * now carries the (former) entry-level note as the master POI's per-POI note
 * (stopPois[sortOrder=1].note). This block locks that the export passes master
 * note through and the import validator round-trips it onto pois[0].note.
 */
import { describe, it, expect } from 'vitest';
import { buildTripExportJson } from '../../src/lib/tripExport';
import { parseAndValidateImport } from '../../functions/api/trips/_import';

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

describe('export → import round-trip — entry note carried by master POI note (migration 0078)', () => {
  // Helper: run the exported `days` array back through the import validator and
  // return the normalized entry at day/entry position.
  const reimport = (out: ReturnType<typeof buildTripExportJson>, di = 0, ei = 0) => {
    const r = parseAndValidateImport({
      schemaVersion: 1,
      meta: { name: '沖繩' },
      days: out.days,
      segments: out.segments,
      notes: out.notes,
    });
    if (!r.ok) throw new Error('expected ok, got: ' + r.error);
    return r.data.days[di]!.entries[ei]!;
  };

  it('a post-DROP export (no entry-level note) round-trips master note via stopPois[0].note', () => {
    // Post-migration export shape: entry has NO top-level `note`; master note
    // lives on the sort_order=1 stopPoi.
    const out = buildTripExportJson({
      meta: { name: '沖繩' },
      days: [
        {
          dayNum: 1,
          date: '2026-07-26',
          timeline: [
            {
              id: 10,
              title: '午餐',
              stopPois: [
                { sortOrder: 1, poiId: 100, name: '暖暮拉麵', type: 'restaurant', note: '必點豚骨' },
                { sortOrder: 2, poiId: 101, name: '通堂拉麵', type: 'restaurant', note: '備案：週三休' },
              ],
            },
          ],
        },
      ],
      segments: [],
      notes: {},
    });
    // Export carries master note through verbatim.
    const exportedStopPois = (out.days[0]!.timeline as any[])[0].stopPois as any[];
    expect(exportedStopPois[0].note).toBe('必點豚骨');

    // Import validator round-trips master note onto pois[0].note (master).
    const e = reimport(out);
    expect(e.pois[0]!.note).toBe('必點豚骨');
    expect(e.pois[1]!.note).toBe('備案：週三休');
  });

  it('an OLD export (entry-level note, empty master note) folds entry note onto the master POI', () => {
    // Pre-migration export shape: entry carries a top-level `note`; master stopPoi
    // has none. Round-trip must NOT lose the (former) entry-level note — it folds
    // onto the master POI (sort_order=1).
    const out = buildTripExportJson({
      meta: { name: '沖繩' },
      days: [
        {
          dayNum: 1,
          date: '2026-07-26',
          timeline: [
            {
              id: 10,
              title: '午餐',
              note: '整體備註：先訂位',
              stopPois: [
                { sortOrder: 1, poiId: 100, name: '暖暮拉麵', type: 'restaurant' },
                { sortOrder: 2, poiId: 101, name: '通堂拉麵', type: 'restaurant', note: '備案備註' },
              ],
            },
          ],
        },
      ],
      segments: [],
      notes: {},
    });
    const e = reimport(out);
    expect(e.pois[0]!.note).toBe('整體備註：先訂位'); // entry note folded onto master
    expect(e.pois[1]!.note).toBe('備案備註');         // alternate note untouched
  });

  it('an OLD export with BOTH entry-level note AND master note keeps master (master-wins)', () => {
    const out = buildTripExportJson({
      meta: { name: '沖繩' },
      days: [
        {
          dayNum: 1,
          date: '2026-07-26',
          timeline: [
            {
              id: 10,
              title: '午餐',
              note: '整體備註不該贏',
              stopPois: [
                { sortOrder: 1, poiId: 100, name: '暖暮拉麵', type: 'restaurant', note: '正選備註' },
              ],
            },
          ],
        },
      ],
      segments: [],
      notes: {},
    });
    const e = reimport(out);
    // import 採 master-wins（對齊 import.ts orchestration `p.note ?? e.note` 與
    // import-entry-note.integration 契約）：master 自己有 note → 保留，不被 entry note 覆蓋。
    expect(e.pois[0]!.note).toBe('正選備註');
  });

  it('an OLD export with entry-level note but NO pois drops the note without error', () => {
    const out = buildTripExportJson({
      meta: { name: '沖繩' },
      days: [
        { dayNum: 1, date: '2026-07-26', timeline: [{ id: 10, title: '純佔位', note: '無處可掛', stopPois: [] }] },
      ],
      segments: [],
      notes: {},
    });
    const e = reimport(out);
    expect(e.pois).toHaveLength(0); // no POI to attach to → note dropped, no crash
  });
});
