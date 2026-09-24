/**
 * 建立一趟新行程：持有階段、來源 key → 新 ID、已建立資料帳本及失敗補償。
 * 各來源先驗證並轉成 plan；這裡只接收已授權、已正規化的資料。
 * 分批提交不是整趟原子交易；共用 POI 的 fill-null 也不會隨補償還原。
 */
import { createEntriesBatch, type BatchEntrySpec, type EntryPoiFields } from '../_entryWrite';
import { findOrCreatePoi, type FindOrCreatePoiData } from '../_poi';
import { reqId, rollbackTrip, runChunked } from './_tripWrite';

export interface TripCreationNotes {
  flights: Record<string, string | number | null>[];
  lodgings: Record<string, string | number | null>[];
  reservations: Record<string, string | number | null>[];
  pretripNotes: Record<string, string | number | null>[];
  emergencyContacts: Record<string, string | number | null>[];
}

export interface TripCreationPlan {
  trip: { id: string; ownerUserId: string; name: string; title: string | null; description: string | null; countries: string; published: number; dataSource: string; lang: string };
  audit: { changedBy: string; diff: Record<string, unknown> };
  destinations: { name: string; lat: number | null; lng: number | null; dayQuota: number | null; subAreas: string[] | null }[];
  notes: TripCreationNotes;
  days: {
    key: number; dayNum: number; date: string; dayOfWeek: string; label: string;
    hotel: FindOrCreatePoiData | null;
    entries: {
      key: number; sortOrder: number; startTime: string | null; endTime: string | null; description: string | null; source: string;
      pois: ({ data: FindOrCreatePoiData } & EntryPoiFields)[];
    }[];
  }[];
  segments: {
    fromEntryKey: number; toEntryKey: number; mode: string; submode: string | null;
    min: number | null; distanceM: number | null; source: string | null; computedAt: number | null; noTravel: number | null;
  }[];
}

export async function createTrip(db: D1Database, plan: TripCreationPlan): Promise<{ tripId: string; daysCreated: number }> {
  const trip = plan.trip;
  const tripId = trip.id;
  let createdTrip = false;
  const createdEntryIds: number[] = [];
  const createdPoiIds: number[] = [];
  const dayIds = new Map<number, number>();
  const entryIds = new Map<number, number>();
  const resolvePoi = (data: FindOrCreatePoiData) => findOrCreatePoi(db, data, {
    policy: 'fill-null', createdPoiIds, defaultCountry: null,
  });
  let stage = 'trip';
  try {
    await runChunked(db, [
      db.prepare('INSERT INTO trips (id, name, owner_user_id, title, description, countries, published, data_source, lang) VALUES (?,?,?,?,?,?,?,?,?)')
        .bind(tripId, trip.name, trip.ownerUserId, trip.title, trip.description, trip.countries, trip.published, trip.dataSource, trip.lang),
      db.prepare('INSERT INTO trip_permissions (user_id, trip_id, role) VALUES (?,?,?)').bind(trip.ownerUserId, tripId, 'owner'),
      ...plan.destinations.map((d, i) =>
        db.prepare('INSERT INTO trip_destinations (trip_id, dest_order, name, lat, lng, day_quota, sub_areas) VALUES (?,?,?,?,?,?,?)')
          .bind(tripId, i + 1, d.name, d.lat, d.lng, d.dayQuota, d.subAreas ? JSON.stringify(d.subAreas) : null)),
      ...noteStatements(db, tripId, plan.notes),
    ], (_result, index) => { if (index === 0) createdTrip = true; });

    stage = 'days';
    await runChunked(db, plan.days.map(d =>
      db.prepare('INSERT INTO trip_days (trip_id, day_num, date, day_of_week, label) VALUES (?,?,?,?,?) RETURNING id')
        .bind(tripId, d.dayNum, d.date, d.dayOfWeek, d.label)),
    (result, index) => dayIds.set(plan.days[index]!.key, reqId(result)));

    stage = 'entries';
    const specs: BatchEntrySpec[] = [];
    const entryKeys: number[] = [];
    for (const day of plan.days) {
      for (const entry of day.entries) {
        const pois: BatchEntrySpec['pois'] = [];
        for (const poi of entry.pois) {
          pois.push({ poiId: await resolvePoi(poi.data), description: poi.description, note: poi.note,
            reservation: poi.reservation, reservationUrl: poi.reservationUrl });
        }
        specs.push({ dayId: dayIds.get(day.key)!, sortOrder: entry.sortOrder, startTime: entry.startTime,
          endTime: entry.endTime, description: entry.description, source: entry.source, pois });
        entryKeys.push(entry.key);
      }
    }
    await createEntriesBatch(db, specs, {
      audit: { tripId, ...plan.audit },
      // 整趟補償包含 entry、day、POI 與筆記；intake 不先清理而遮住原始寫入錯誤。
      failureCleanup: 'caller',
      onEntryId: (id, index) => {
        createdEntryIds.push(id);
        entryIds.set(entryKeys[index]!, id);
      },
    });

    stage = 'hotels';
    const hotels: D1PreparedStatement[] = [];
    for (const day of plan.days) {
      if (day.hotel) {
        hotels.push(db.prepare('UPDATE trip_days SET hotel_poi_id = ? WHERE id = ?')
          .bind(await resolvePoi(day.hotel), dayIds.get(day.key)!));
      }
    }
    await runChunked(db, hotels);

    stage = 'segments';
    const segments: D1PreparedStatement[] = [];
    for (const segment of plan.segments) {
      const from = entryIds.get(segment.fromEntryKey);
      const to = entryIds.get(segment.toEntryKey);
      if (from === undefined || to === undefined) continue;
      segments.push(db.prepare('INSERT INTO trip_segments (trip_id, from_entry_id, to_entry_id, mode, submode, min, distance_m, source, computed_at, version, no_travel) VALUES (?,?,?,?,?,?,?,?,?,0,?)')
        .bind(tripId, from, to, segment.mode, segment.submode, segment.min, segment.distanceM, segment.source, segment.computedAt, segment.noTravel));
    }
    await runChunked(db, segments);
    return { tripId, daysCreated: plan.days.length };
  } catch (error) {
    const creationError = error instanceof Error ? error.cause ?? error : error;
    if (!createdTrip) {
      console.error('[trip creation] failed before trip committed', { tripId, stage, error: creationError, cleanup: 'not-needed' });
      throw error;
    }
    try {
      await rollbackTrip(db, tripId, createdEntryIds, createdPoiIds);
    } catch (cleanupError) {
      console.error('[trip creation] failed; compensation failed', { tripId, stage, error: creationError, cleanup: 'failed', cleanupError });
      throw error;
    }
    console.error('[trip creation] failed; compensation completed', { tripId, stage, error: creationError, cleanup: 'completed' });
    throw error;
  }
}

function noteStatements(db: D1Database, tripId: string, n: TripCreationNotes): D1PreparedStatement[] {
  const out: D1PreparedStatement[] = [];
  for (const f of n.flights) {
    out.push(db.prepare('INSERT INTO trip_flights (trip_id, sort_order, airline, flight_no, cabin_class, depart_airport, arrive_airport, depart_at, arrive_at, note) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind(tripId, f.sort_order, f.airline, f.flight_no, f.cabin_class, f.depart_airport, f.arrive_airport, f.depart_at, f.arrive_at, f.note));
  }
  for (const l of n.lodgings) {
    out.push(db.prepare('INSERT INTO trip_lodgings (trip_id, sort_order, name, address, check_in_at, check_out_at, booking_no, phone, note) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(tripId, l.sort_order, l.name, l.address, l.check_in_at, l.check_out_at, l.booking_no, l.phone, l.note));
  }
  for (const r of n.reservations) {
    out.push(db.prepare('INSERT INTO trip_reservations (trip_id, sort_order, kind, title, reserved_at, party_size, reservation_no, phone, note) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(tripId, r.sort_order, r.kind, r.title, r.reserved_at, r.party_size, r.reservation_no, r.phone, r.note));
  }
  for (const p of n.pretripNotes) {
    out.push(db.prepare('INSERT INTO trip_pretrip_notes (trip_id, sort_order, section, title, content) VALUES (?,?,?,?,?)')
      .bind(tripId, p.sort_order, p.section, p.title, p.content));
  }
  for (const c of n.emergencyContacts) {
    out.push(db.prepare('INSERT INTO trip_emergency_contacts (trip_id, sort_order, name, relationship, phone, email, kind) VALUES (?,?,?,?,?,?,?)')
      .bind(tripId, c.sort_order, c.name, c.relationship, c.phone, c.email, c.kind));
  }
  return out;
}
