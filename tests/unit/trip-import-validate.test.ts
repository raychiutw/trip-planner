/**
 * PR3 — parseAndValidateImport (the import security boundary).
 * The import body is attacker-controlled: schemaVersion gate, dangerous-key
 * rejection, array caps, enum coercion (to satisfy D1 CHECK constraints),
 * entryPosition flatten order, segment idx-range filtering, camelCase→snake_case
 * notes, primary POI preservation.
 */
import { describe, it, expect } from 'vitest';
import { parseAndValidateImport, hasDangerousKey, MAX_DAYS } from '../../functions/api/trips/_import';

const ok = (r: ReturnType<typeof parseAndValidateImport>) => {
  if (!r.ok) throw new Error('expected ok, got: ' + r.error);
  return r.data;
};

const valid = {
  schemaVersion: 1,
  meta: { name: '沖繩', title: '沖繩五日', countries: 'JP', destinations: [{ name: '那霸', lat: 26.2, lng: 127.6, subAreas: ['國際通'] }] },
  days: [
    { dayNum: 1, date: '2026-07-26', dayOfWeek: '六', label: '', timeline: [
      { sortOrder: 1, startTime: '09:00', endTime: '10:00', title: '', stopPois: [{ sortOrder: 1, name: '那霸機場', type: 'transport', lat: 26.2, lng: 127.6, googleRating: 4.1 }] },
      { sortOrder: 2, title: '午餐', stopPois: [] },
    ], hotel: { name: '東急 REI', googleRating: 4.2 } },
    { dayNum: 2, date: '2026-07-27', timeline: [{ sortOrder: 1, title: '美麗海', stopPois: [{ sortOrder: 1, name: '美麗海水族館', type: 'attraction' }] }] },
  ],
  segments: [
    { fromEntryIdx: 0, toEntryIdx: 1, mode: 'driving', min: 12, distanceM: 2100, source: 'google' },
    { fromEntryIdx: 1, toEntryIdx: 2, mode: 'walking', min: 8, distanceM: null, source: null },
  ],
  notes: {
    flights: [{ airline: 'BR', flightNo: '112', cabinClass: 'Y', departAirport: 'TPE', arriveAirport: 'OKA', departAt: '08:55', arriveAt: '11:40', note: '' }],
    lodgings: [{ name: '東急 REI', checkInAt: '15:00', checkOutAt: '11:00' }],
    reservations: [{ kind: 'restaurant', title: '暖暮', partySize: 4 }],
    pretripNotes: [{ section: '證件', title: '駕照', content: '國際駕照' }],
    emergencyContacts: [{ name: '辦事處', kind: 'embassy', phone: '+81' }],
  },
};

describe('parseAndValidateImport — gates', () => {
  it('rejects non-object', () => { expect(parseAndValidateImport(null).ok).toBe(false); expect(parseAndValidateImport(42).ok).toBe(false); });
  it('rejects wrong schemaVersion', () => {
    expect(parseAndValidateImport({ schemaVersion: 2, meta: { name: 'x' } }).ok).toBe(false);
    expect(parseAndValidateImport({ meta: { name: 'x' } }).ok).toBe(false);
  });
  it('rejects prototype-pollution keys', () => {
    const bad = JSON.parse('{"schemaVersion":1,"meta":{"name":"x"},"days":[{"__proto__":{"x":1}}]}');
    expect(parseAndValidateImport(bad).ok).toBe(false);
    expect(hasDangerousKey({ a: { b: JSON.parse('{"constructor":1}') } })).toBe(true);
  });
  it('rejects a trip with no name', () => {
    expect(parseAndValidateImport({ schemaVersion: 1, meta: {}, days: [] }).ok).toBe(false);
  });
  it('caps day count', () => {
    const days = Array.from({ length: MAX_DAYS + 1 }, (_, i) => ({ dayNum: i + 1, timeline: [] }));
    expect(parseAndValidateImport({ schemaVersion: 1, meta: { name: 'x' }, days }).ok).toBe(false);
  });
  it('caps entries per day', () => {
    const timeline = Array.from({ length: 101 }, (_, i) => ({ sortOrder: i, title: 't' }));
    expect(parseAndValidateImport({ schemaVersion: 1, meta: { name: 'x' }, days: [{ timeline }] }).ok).toBe(false);
  });
});

describe('parseAndValidateImport — normalization', () => {
  it('uses meta name, assigns entryPosition in flatten order', () => {
    const d = ok(parseAndValidateImport(valid));
    expect(d.name).toBe('沖繩');
    const positions = d.days.flatMap((day) => day.entries.map((e) => e.entryPosition));
    expect(positions).toEqual([0, 1, 2]);
  });
  it('keeps display names on primary POIs, not entry rows', () => {
    const d = ok(parseAndValidateImport(valid));
    expect(d.days[0]!.entries[0]!.pois[0]!.name).toBe('那霸機場');
    expect(d.days[0]!.entries[1]!.pois).toHaveLength(0);
  });
  it('keeps valid segments in idx range, mapped + coerced', () => {
    const d = ok(parseAndValidateImport(valid));
    expect(d.segments).toHaveLength(2);
    expect(d.segments[0]).toMatchObject({ fromEntryIdx: 0, toEntryIdx: 1, mode: 'driving' });
  });
  it('v2.55.45：submode transit 保留、控制/雙向字元剝除、非-transit 強制 null', () => {
    // 危險字元用 fromCodePoint 明確建構（避免 source 塞不可見字元）：RTL override + ZWSP。
    const dirty = '水上' + String.fromCodePoint(0x202e) + '巴士' + String.fromCodePoint(0x200b);
    const withSub = { ...valid, segments: [
      { fromEntryIdx: 0, toEntryIdx: 1, mode: 'transit', submode: 'monorail' },  // 保留
      { fromEntryIdx: 1, toEntryIdx: 2, mode: 'transit', submode: dirty },       // 剝 bidi+零寬
    ] };
    const d = ok(parseAndValidateImport(withSub));
    expect(d.segments[0]).toMatchObject({ mode: 'transit', submode: 'monorail' });
    expect(d.segments[1]!.submode).toBe('水上巴士'); // 危險字元已剝
    // 非-transit（driving）即使帶 submode 也強制 null
    const driving = { ...valid, segments: [{ fromEntryIdx: 0, toEntryIdx: 1, mode: 'driving', submode: 'monorail' }] };
    expect(ok(parseAndValidateImport(driving)).segments[0]!.submode).toBeNull();
  });
  it('noTravel=1 強制清 min/dist/source（不變式：untrusted payload 帶髒值也擋掉）', () => {
    // v2.55.46：POST/PATCH 都保證 no_travel=1 ⟹ min/dist/source NULL；import 邊界同樣強制，
    // 否則髒 row（no_travel=1 + min=500）會被 recompute 永久跳過又餵給健檢。
    const dirty = { ...valid, segments: [
      { fromEntryIdx: 0, toEntryIdx: 1, mode: 'driving', min: 500, distanceM: 9400, source: 'manual', noTravel: 1 },
      { fromEntryIdx: 1, toEntryIdx: 2, mode: 'walking', min: 8, distanceM: 100, source: 'google', noTravel: true },
    ] };
    const d = ok(parseAndValidateImport(dirty));
    expect(d.segments[0]).toMatchObject({ noTravel: 1, min: null, distanceM: null, source: null });
    expect(d.segments[1]).toMatchObject({ noTravel: 1, min: null, distanceM: null, source: null });
    // 正常段（無 noTravel）不受影響
    expect(ok(parseAndValidateImport(valid)).segments[0]).toMatchObject({ noTravel: null, min: 12, source: 'google' });
  });
  it('drops out-of-range / self-loop segments', () => {
    const bad = { ...valid, segments: [
      { fromEntryIdx: 0, toEntryIdx: 99, mode: 'driving' }, // to out of range
      { fromEntryIdx: 1, toEntryIdx: 1, mode: 'driving' },  // self loop
      { fromEntryIdx: 0, toEntryIdx: 2, mode: 'driving' },  // valid
    ] };
    const d = ok(parseAndValidateImport(bad));
    expect(d.segments).toHaveLength(1);
    expect(d.segments[0]).toMatchObject({ fromEntryIdx: 0, toEntryIdx: 2 });
  });
  it('coerces enum columns to satisfy CHECK constraints', () => {
    const evil = { ...valid,
      days: [{ timeline: [{ sortOrder: 1, title: 'x', stopPois: [{ sortOrder: 1, name: 'p', type: 'EVIL' }] }] }],
      segments: [{ fromEntryIdx: 0, toEntryIdx: 0, mode: 'rocket' }],
      notes: { ...valid.notes, reservations: [{ kind: 'HACK', title: 'r' }], emergencyContacts: [{ name: 'e', kind: 'HACK' }] },
    };
    const d = ok(parseAndValidateImport(evil));
    expect(d.days[0]!.entries[0]!.pois[0]!.type).toBe('other');     // poi type CHECK
    expect((d.notes.reservations[0] as Record<string, unknown>).kind).toBe('restaurant'); // resv kind CHECK
    expect((d.notes.emergencyContacts[0] as Record<string, unknown>).kind).toBe('other'); // emergency kind CHECK
  });
  it('maps notes camelCase → snake_case columns', () => {
    const d = ok(parseAndValidateImport(valid));
    const f = d.notes.flights[0] as Record<string, unknown>;
    expect(f).toMatchObject({ sort_order: 0, flight_no: '112', depart_airport: 'TPE', cabin_class: 'Y' });
    const l = d.notes.lodgings[0] as Record<string, unknown>;
    expect(l).toMatchObject({ check_in_at: '15:00', check_out_at: '11:00' });
  });
  it('clamps an over-long name', () => {
    const d = ok(parseAndValidateImport({ schemaVersion: 1, meta: { name: 'x'.repeat(500) }, days: [] }));
    expect(d.name.length).toBeLessThanOrEqual(200);
  });

  it('renumbers POI sort_order 1..N (guards UNIQUE(entry_id, sort_order))', () => {
    const dupes = { schemaVersion: 1, meta: { name: 'x' }, days: [{ timeline: [
      { sortOrder: 1, title: 't', stopPois: [
        { sortOrder: 1, name: 'a', type: 'attraction' },
        { sortOrder: 1, name: 'b', type: 'attraction' }, // duplicate sort_order
        { sortOrder: 9, name: 'c', type: 'attraction' }, // gap
      ] },
    ] }] };
    const d = ok(parseAndValidateImport(dupes));
    expect(d.days[0]!.entries[0]!.pois.map((p) => p.sortOrder)).toEqual([1, 2, 3]);
  });

  it('dedupes duplicate (from,to) segment pairs (guards UNIQUE(from,to))', () => {
    const dup = { ...valid, segments: [
      { fromEntryIdx: 0, toEntryIdx: 1, mode: 'driving' },
      { fromEntryIdx: 0, toEntryIdx: 1, mode: 'walking' }, // dupe pair
    ] };
    const d = ok(parseAndValidateImport(dup));
    expect(d.segments).toHaveLength(1);
  });

  it('caps total entries across all days (defends D1 batch blowout)', () => {
    // 20 days × 60 entries = 1200 > MAX_TOTAL_ENTRIES (1000)
    const days = Array.from({ length: 20 }, () => ({ timeline: Array.from({ length: 60 }, (_, i) => ({ sortOrder: i, title: 't' })) }));
    expect(parseAndValidateImport({ schemaVersion: 1, meta: { name: 'x' }, days }).ok).toBe(false);
  });
});

describe('parseAndValidateImport — entry-level note → master POI note (migration 0078)', () => {
  const oneEntry = (timeline: unknown[]) =>
    ok(parseAndValidateImport({ schemaVersion: 1, meta: { name: 'x' }, days: [{ timeline }] }))
      .days[0]!.entries[0]!;

  it('folds an OLD-file entry-level note onto the master POI when master note is empty', () => {
    const e = oneEntry([
      { sortOrder: 1, title: '午餐', note: '整體備註', stopPois: [
        { sortOrder: 1, name: 'a', type: 'restaurant' },
        { sortOrder: 2, name: 'b', type: 'restaurant', note: '備案備註' },
      ] },
    ]);
    expect(e.pois[0]!.note).toBe('整體備註'); // master gets entry note
    expect(e.pois[1]!.note).toBe('備案備註'); // alternate untouched
  });

  it('keeps the master POI note (master-wins) when BOTH master note and entry-level note exist', () => {
    // import 採 master-wins（對齊 import.ts orchestration `p.note ?? e.note` 與
    // import-entry-note.integration 契約），非 migration D5 的換行串接。
    const e = oneEntry([
      { sortOrder: 1, title: '午餐', note: '整體備註不該贏', stopPois: [
        { sortOrder: 1, name: 'a', type: 'restaurant', note: '正選備註' },
      ] },
    ]);
    expect(e.pois[0]!.note).toBe('正選備註');
  });

  it('leaves the master POI note untouched when there is NO entry-level note', () => {
    const e = oneEntry([
      { sortOrder: 1, title: '午餐', stopPois: [
        { sortOrder: 1, name: 'a', type: 'restaurant', note: '正選備註' },
      ] },
    ]);
    expect(e.pois[0]!.note).toBe('正選備註');
  });

  it('drops an entry-level note with no POIs to attach to (no crash, empty pois)', () => {
    const e = oneEntry([{ sortOrder: 1, title: '純佔位', note: '無處可掛', stopPois: [] }]);
    expect(e.pois).toHaveLength(0);
  });
});
