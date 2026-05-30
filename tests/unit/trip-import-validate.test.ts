/**
 * PR3 — parseAndValidateImport (the import security boundary).
 * The import body is attacker-controlled: schemaVersion gate, dangerous-key
 * rejection, array caps, enum coercion (to satisfy D1 CHECK constraints),
 * entryPosition flatten order, segment idx-range filtering, camelCase→snake_case
 * notes, empty-title backfill from the master POI.
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
  it('backfills empty entry title from the master POI name', () => {
    const d = ok(parseAndValidateImport(valid));
    expect(d.days[0]!.entries[0]!.title).toBe('那霸機場'); // entry title was ''
    expect(d.days[0]!.entries[1]!.title).toBe('午餐');     // explicit title kept
  });
  it('keeps valid segments in idx range, mapped + coerced', () => {
    const d = ok(parseAndValidateImport(valid));
    expect(d.segments).toHaveLength(2);
    expect(d.segments[0]).toMatchObject({ fromEntryIdx: 0, toEntryIdx: 1, mode: 'driving' });
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
