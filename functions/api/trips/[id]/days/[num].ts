import { logAudit } from '../../../_audit';
import { hasWritePermission } from '../../../_auth';
import { syncEntryMaster } from '../../../_entry_pois';
import { AppError } from '../../../_errors';
import { batchFindOrCreatePois, type FindOrCreatePoiData } from '../../../_poi';
import { resolveEntryTimes } from '../../../_time';
import { validateDayBody, detectGarbledText } from '../../../_validate';
import { json, getAuth, parseJsonBody } from '../../../_utils';
import type { Env } from '../../../_types';
import {
  assembleDay,
  fetchEntryPoisByEntries,
  fetchHotelAndParking,
  fetchTripSegmentsMap,
} from './_merge';

// ---------------------------------------------------------------------------
// GET /api/trips/:id/days/:num — canonical entry POIs + contextual day POIs
// ---------------------------------------------------------------------------

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { id, num } = context.params as { id: string; num: string };
  const db = context.env.DB;

  const day = await db
    .prepare('SELECT * FROM trip_days WHERE trip_id = ? AND day_num = ?')
    .bind(id, Number(num))
    .first() as Record<string, unknown> | null;

  if (!day) throw new AppError('DATA_NOT_FOUND');

  const dayId = day.id as number;

  // v2.29.0: trip_pois DROPPED. Hotel ← trip_days.hotel_poi_id; entry POIs ← trip_entry_pois;
  // travel ← trip_segments; parking ← poi_relations.
  const [entriesResult, segmentsMap] = await Promise.all([
    db.prepare('SELECT * FROM trip_entries WHERE day_id = ? ORDER BY sort_order ASC').bind(dayId).all(),
    fetchTripSegmentsMap(db, id),
  ]);

  const entryRows = entriesResult.results as Record<string, unknown>[];

  const hotelPoiId = day.hotel_poi_id as number | null;
  const { poiMap, parkingMap } = await fetchHotelAndParking(db, hotelPoiId ? [hotelPoiId] : []);

  const entryPoisMap = await fetchEntryPoisByEntries(db, entryRows.map((e) => e.id as number));

  const assembled = assembleDay(
    day,
    entryRows,
    poiMap,
    parkingMap,
    entryPoisMap,
    segmentsMap,
  );

  return json(assembled);
};

// ---------------------------------------------------------------------------
// PUT /api/trips/:id/days/:num — canonical entry POIs + contextual day POIs
// ---------------------------------------------------------------------------

type TimelineEntryBody = Record<string, unknown> & {
  shopping?: unknown[];
  stopPois?: unknown[];
  alternates?: unknown[];
  master?: unknown;
  travel?: { type?: unknown; desc?: unknown; min?: unknown };
};

type EntryPoiChoiceBuilder = {
  poiItemIdx?: number;
  poiId?: number;
  description: string | null;
  note: string | null;
  reservation: string | null;
  reservationUrl: string | null;
};

type ResolvedEntryPoiChoice = Omit<EntryPoiChoiceBuilder, 'poiItemIdx' | 'poiId'> & {
  poiId: number;
};

function recordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object' && !Array.isArray(item)) : [];
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function positiveInt(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) return null;
  return value;
}

function canonicalChoiceInputs(entry: TimelineEntryBody): Array<{ item: Record<string, unknown>; defaultType: string }> {
  const stopPois = recordArray(entry.stopPois);
  if (stopPois.length > 0) return stopPois.map((item) => ({ item, defaultType: 'attraction' }));

  const master = recordValue(entry.master);
  const alternates = recordArray(entry.alternates);
  if (master || alternates.length > 0) {
    return [
      ...(master ? [{ item: master, defaultType: 'attraction' }] : []),
      ...alternates.map((item) => ({ item, defaultType: 'attraction' })),
    ];
  }

  return [];
}

export const onRequestPut: PagesFunction<Env> = async (context) => {
  const auth = getAuth(context);
  if (!auth) throw new AppError('AUTH_REQUIRED');

  const { id, num } = context.params as { id: string; num: string };
  const changedBy = auth.email;
  const db = context.env.DB;

  if (!await hasWritePermission(db, auth, id, auth.isAdmin)) {
    throw new AppError('PERM_DENIED');
  }

  const day = await db
    .prepare('SELECT id, version FROM trip_days WHERE trip_id = ? AND day_num = ?')
    .bind(id, Number(num))
    .first() as { id: number; version: number } | null;

  if (!day) throw new AppError('DATA_NOT_FOUND');
  const dayId = day.id;
  const currentDayVersion = day.version ?? 0;

  // Snapshot old data for audit
  // v2.29.0: trip_pois DROPPED. Snapshot 只含 entries + day.hotel_poi_id。
  const [oldDay, oldEntries] = await Promise.all([
    db.prepare('SELECT hotel_poi_id FROM trip_days WHERE id = ?').bind(dayId).first<{ hotel_poi_id: number | null }>(),
    db.prepare('SELECT * FROM trip_entries WHERE day_id = ? ORDER BY sort_order ASC').bind(dayId).all(),
  ]);
  const snapshot = JSON.stringify({ dayId, hotelPoiId: oldDay?.hotel_poi_id ?? null, entries: oldEntries.results });

  type DayBody = {
    date?: string;
    dayOfWeek?: string;
    label?: string;
    hotel?: Record<string, unknown> & { shopping?: unknown[]; parking?: unknown[]; description?: unknown };
    timeline?: TimelineEntryBody[];
    /** v2.30.x (migration 0065)：Day-level OCC token。Client 帶 GET 時拿到的
     *  `version`，backend 比對 trip_days.version 不符 → 409 STALE_ENTRY，未帶
     *  則 backwards-compat 略過 check（既有 client 不會受影響）。 */
    expectedDayVersion?: number;
  };
  const body = await parseJsonBody<DayBody>(context.request);

  // v2.30.x (migration 0065)：Day-level OCC check — body 帶 expectedDayVersion 才驗
  if (body.expectedDayVersion !== undefined && body.expectedDayVersion !== currentDayVersion) {
    throw new AppError('STALE_ENTRY');
  }

  const validation = validateDayBody(body);
  if (!validation.ok) throw new AppError('DATA_VALIDATION', validation.error);

  // Garbled text detection
  const timelineEntries = Array.isArray(body.timeline) ? body.timeline : [];
  for (let i = 0; i < timelineEntries.length; i++) {
    const e = timelineEntries[i]!;
    if ('restaurants' in e) {
      throw new AppError('DATA_VALIDATION', `timeline[${i}].restaurants 已移除，請使用 stopPois`);
    }
    if ('stop_pois' in e) {
      throw new AppError('DATA_VALIDATION', `timeline[${i}].stop_pois 已移除，請使用 stopPois`);
    }
    if ('poi' in e) {
      throw new AppError('DATA_VALIDATION', `timeline[${i}].poi 已移除，請使用 master 或 stopPois`);
    }
    for (const f of ['title', 'description', 'note'] as const) {
      const val = e[f as keyof typeof e];
      if (typeof val === 'string' && detectGarbledText(val)) {
        throw new AppError('DATA_ENCODING', `timeline[${i}].${f} 包含疑似亂碼`);
      }
    }
  }

  // Phase 2: poi_type 白名單驗證（避免 CHECK 失敗讓 batch 炸在半途）
  const ALLOWED_POI_TYPES = new Set(['hotel', 'restaurant', 'shopping', 'parking', 'attraction', 'transport', 'activity', 'other']);
  for (let i = 0; i < timelineEntries.length; i++) {
    const pt = (timelineEntries[i] as Record<string, unknown>).poi_type;
    if (pt !== undefined && (typeof pt !== 'string' || !ALLOWED_POI_TYPES.has(pt))) {
      throw new AppError('DATA_VALIDATION', `timeline[${i}].poi_type 無效（允許：${[...ALLOWED_POI_TYPES].join(', ')}）`);
    }
  }

  // round 5 fix (was round 4 adv-C5): snapshot alternates per OLD entry, each entry's alts
  // kept as a separate list so restore can match 1:1 without conflation. Round 4 keyed by
  // master_poi_id and merged lists from multiple old entries — if two old entries shared
  // a master POI, INSERT OR IGNORE silently dropped collisions (round 5 HIGH finding).
  //
  // Strategy: snapshot each old entry's master POI + alt list. On restore, for each new
  // entry, find the FIRST old snapshot with matching master POI that hasn't been claimed
  // yet, transfer its alts. Edge cases:
  //  - User replaces an entry's POI entirely → no match → alts gracefully lost (acceptable;
  //    they belonged to the replaced POI)
  //  - Two new entries with same master POI → first claims the first old snapshot's alts,
  //    second claims the second old snapshot's alts (1:1 by order)
  //  - Read trip_entry_pois.sort_order=1 (canonical master since v2.29.0 DROP trip_entries.poi_id)
  type OldEntrySnapshot = { masterPoiId: number; alts: Array<{ poiId: number; sortOrder: number }> };
  const oldEntrySnapshots: OldEntrySnapshot[] = [];
  {
    const entriesRow = await db
      .prepare(
        `SELECT e.id AS entry_id, tep.poi_id AS master_poi_id
         FROM trip_entries e
         JOIN trip_entry_pois tep ON tep.entry_id = e.id AND tep.sort_order = 1
         WHERE e.day_id = ?
         ORDER BY e.sort_order ASC`,
      )
      .bind(dayId)
      .all<{ entry_id: number; master_poi_id: number }>();
    const entryIdToSnapshot = new Map<number, OldEntrySnapshot>();
    for (const e of entriesRow.results) {
      const snap = { masterPoiId: e.master_poi_id, alts: [] as Array<{ poiId: number; sortOrder: number }> };
      oldEntrySnapshots.push(snap);
      entryIdToSnapshot.set(e.entry_id, snap);
    }
    if (entriesRow.results.length > 0) {
      const altPlaceholders = entriesRow.results.map(() => '?').join(',');
      const altsRow = await db
        .prepare(
          `SELECT entry_id, poi_id, sort_order
           FROM trip_entry_pois
           WHERE entry_id IN (${altPlaceholders}) AND sort_order > 1`,
        )
        .bind(...entriesRow.results.map((e) => e.entry_id))
        .all<{ entry_id: number; poi_id: number; sort_order: number }>();
      for (const a of altsRow.results) {
        entryIdToSnapshot.get(a.entry_id)?.alts.push({ poiId: a.poi_id, sortOrder: a.sort_order });
      }
    }
  }

  try {
    // Batch 1: delete old entries, update day, insert new entries
    // v2.29.0: trip_pois DROPPED, no DELETE FROM trip_pois needed. ON DELETE CASCADE
    // on trip_entries clears trip_entry_pois automatically.
    const batch1: D1PreparedStatement[] = [];

    batch1.push(
      db.prepare('DELETE FROM trip_entries WHERE day_id = ?').bind(dayId),
      // v2.30.x (migration 0065)：bump version 同 batch atomic，下次 PUT 用此 version 對齊 OCC
      db.prepare('UPDATE trip_days SET date = ?, day_of_week = ?, label = ?, version = version + 1 WHERE id = ?')
        .bind(body.date!, body.dayOfWeek!, body.label!, dayId),
    );

    const timeline = Array.isArray(body.timeline) ? body.timeline : [];
    const ENTRIES_START = batch1.length;
    for (let i = 0; i < timeline.length; i++) {
      const e = timeline[i]!;
      // v2.29.0: trip_entries.{time, travel_*} DROPPED. body.travel.* 被 ignore；
      // travel info 改寫 trip_segments by /recompute-travel。
      const { startTime, endTime } = resolveEntryTimes(e as Record<string, unknown>);
      batch1.push(
        db.prepare('INSERT INTO trip_entries (day_id, sort_order, start_time, end_time, title, description, note) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id')
          .bind(dayId, i, startTime, endTime, e.title ?? null, e.description ?? null, e.note ?? null),
      );
    }

    const batch1Results = await db.batch(batch1);

    const entryIds: number[] = [];
    for (let i = 0; i < timeline.length; i++) {
      const rows = batch1Results[ENTRIES_START + i]!.results as { id: number }[];
      entryIds.push(rows[0]?.id ?? 0);
    }

    // Collect all POI data for batch find-or-create (eliminates N+1 sequential queries)
    type TripPoiBuilder = (poiIds: number[]) => D1PreparedStatement[];
    const poiItems: FindOrCreatePoiData[] = [];
    const tripPoiBuilders: TripPoiBuilder[] = [];
    let hotelPoiIdx = -1;
    // Phase 2: entry-level POI — each timeline entry gets a poi_id FK into pois master.
    // -1 means no POI needed (empty title / placeholder entry).
    const entryPoiIdx: number[] = new Array(timeline.length).fill(-1);

    // Hotel
    if (body.hotel) {
      const h = body.hotel;
      hotelPoiIdx = poiItems.length;
      // Migration 0055 (v2.25.5): hours 寫進 pois master，不再寫 trip_pois.hours。
      poiItems.push({
        name: (h.name as string) || '', type: 'hotel',
        description: h.description as string,
        hours: h.hours as string,
        lat: h.lat as number, lng: h.lng as number, source: 'ai',
      });
      // v2.29.0: hotel 改寫 trip_days.hotel_poi_id (FK to pois)。
      // hotel-specific cols (checkout/breakfast/reservation) 已 DROPPED, body 帶值會被 ignore。
      tripPoiBuilders.push((ids) => [
        db.prepare(`UPDATE trip_days SET hotel_poi_id = ? WHERE id = ?`)
          .bind(ids[hotelPoiIdx], dayId),
      ]);

      // Hotel parking — 仍寫 poi_relations (relation_type='parking')；trip_pois.parking row 不再寫。
      if (Array.isArray(h.parking)) {
        for (const p of h.parking as Record<string, unknown>[]) {
          const parkIdx = poiItems.length;
          poiItems.push({
            name: (p.name as string) || '停車場', type: 'parking',
            description: p.price ? `費用：${p.price}` : null,
            lat: p.lat as number, lng: p.lng as number, source: 'ai',
          });
          tripPoiBuilders.push((ids) => [
            db.prepare(`INSERT OR IGNORE INTO poi_relations (poi_id, related_poi_id, relation_type) VALUES (?, ?, 'parking')`)
              .bind(ids[hotelPoiIdx], ids[parkIdx]),
          ]);
        }
      }

      // v2.29.0: hotel.shopping (day-level) DELETED — design 決定不遷，user 接受 data loss。
      // body.hotel.shopping 帶值會被 ignore (frontend 已停送)。
    }

    // Entry-level POI (Phase 2)：每個 timeline entry 對應一筆 pois master。
    // type 來自 body.timeline[].poi_type，預設 attraction；機場/車站請傳 transport、預訂體驗請傳 activity。
    for (let i = 0; i < timeline.length; i++) {
      const e = timeline[i] as Record<string, unknown>;
      if (canonicalChoiceInputs(timeline[i]!).length > 0) continue;
      const title = typeof e.title === 'string' ? e.title.trim() : '';
      if (!title) continue;
      const rawType = typeof e.poi_type === 'string' ? e.poi_type : 'attraction';
      entryPoiIdx[i] = poiItems.length;
      poiItems.push({
        name: title,
        type: rawType,
        description: (e.description as string | undefined) ?? null,
        lat: (e.lat as number | undefined) ?? null,
        lng: (e.lng as number | undefined) ?? null,
        rating: (e.rating as number | undefined) ?? null,
        source: 'ai',
      });
    }

    // Canonical entry POI choices + contextual entry shopping.
    const entryPoiChoiceBuilders: EntryPoiChoiceBuilder[][] = timeline.map(() => []);

    for (let i = 0; i < timeline.length; i++) {
      const e = timeline[i]!;

      for (const { item, defaultType } of canonicalChoiceInputs(e)) {
        const directPoiId = positiveInt(item.poiId ?? item.poi_id);
        const choice: EntryPoiChoiceBuilder = {
          description: stringOrNull(item.description),
          note: stringOrNull(item.note),
          reservation: stringOrNull(item.reservation),
          reservationUrl: stringOrNull(item.reservation_url ?? item.reservationUrl),
        };

        if (directPoiId !== null) {
          entryPoiChoiceBuilders[i]!.push({ ...choice, poiId: directPoiId });
          continue;
        }

        const name = stringOrNull(item.name);
        if (!name) continue;

        const choiceType = stringOrNull(item.type) ?? defaultType;
        if (!ALLOWED_POI_TYPES.has(choiceType)) {
          throw new AppError('DATA_VALIDATION', `timeline[${i}].stopPois.type 無效（允許：${[...ALLOWED_POI_TYPES].join(', ')}）`);
        }

        const pIdx = poiItems.length;
        poiItems.push({
          name,
          type: choiceType,
          description: stringOrNull(item.description),
          rating: numberOrNull(item.rating),
          category: stringOrNull(item.category),
          hours: stringOrNull(item.hours),
          source: 'ai',
          price: stringOrNull(item.price),
          lat: numberOrNull(item.lat),
          lng: numberOrNull(item.lng),
        });
        entryPoiChoiceBuilders[i]!.push({ ...choice, poiItemIdx: pIdx });
      }

      // v2.29.0: entry-level shopping 改進 trip_entry_pois (sort_order = next, 同 main alternates).
      // body.shopping 仍接受（backward-compat），但 INSERT 到 trip_entry_pois 而非 trip_pois。
      if (Array.isArray((e as Record<string, unknown>).shopping)) {
        for (const s of (e as Record<string, unknown>).shopping as Record<string, unknown>[]) {
          const sIdx = poiItems.length;
          poiItems.push({
            name: (s.name as string) || '', type: 'shopping',
            rating: s.rating as number,
            category: s.category as string, hours: s.hours as string, source: 'ai',
          });
          // 收進 entryPoiChoiceBuilders[i] 跟 main alternates 一視同仁
          entryPoiChoiceBuilders[i]!.push({
            description: null,
            note: stringOrNull(s.note),
            reservation: null,
            reservationUrl: null,
            poiItemIdx: sIdx,
          });
        }
      }
    }

    // Batch resolve all POIs (2–3 DB round-trips instead of N)
    const poiIds = await batchFindOrCreatePois(db, poiItems);

    const directChoicePoiIds = new Set<number>();
    for (const choices of entryPoiChoiceBuilders) {
      for (const choice of choices) {
        if (choice.poiId !== undefined) directChoicePoiIds.add(choice.poiId);
      }
    }
    if (directChoicePoiIds.size > 0) {
      const directIds = [...directChoicePoiIds];
      const placeholders = directIds.map(() => '?').join(',');
      const existing = await db
        .prepare(`SELECT id FROM pois WHERE id IN (${placeholders})`)
        .bind(...directIds)
        .all<{ id: number }>();
      const existingIds = new Set(existing.results.map((row) => row.id));
      const missing = directIds.filter((poiId) => !existingIds.has(poiId));
      if (missing.length > 0) {
        throw new AppError('DATA_VALIDATION', `stopPois.poiId 不存在: ${missing.join(', ')}`);
      }
    }

    function resolveEntryChoices(index: number): ResolvedEntryPoiChoice[] {
      const seen = new Set<number>();
      const resolved: ResolvedEntryPoiChoice[] = [];
      for (const choice of entryPoiChoiceBuilders[index] ?? []) {
        const poiId = choice.poiId ?? (choice.poiItemIdx !== undefined ? poiIds[choice.poiItemIdx] : undefined);
        if (typeof poiId !== 'number' || seen.has(poiId)) continue;
        seen.add(poiId);
        resolved.push({
          poiId,
          description: choice.description,
          note: choice.note,
          reservation: choice.reservation,
          reservationUrl: choice.reservationUrl,
        });
      }
      return resolved;
    }

    // Build batch2: (a) canonical entry POIs (trip_entry_pois), (b) hotel UPDATE + parking poi_relations (via tripPoiBuilders).
    // batch1 DELETE FROM trip_entries → ON DELETE CASCADE 清掉舊 trip_entry_pois。
    const batch2: D1PreparedStatement[] = [];
    const entriesNeedingMaster: Array<{ entryId: number; poiId: number }> = [];
    const nowEntryPois = new Date().toISOString();
    for (let i = 0; i < timeline.length; i++) {
      const entryId = entryIds[i]!;
      const explicitChoices = resolveEntryChoices(i);
      if (explicitChoices.length > 0) {
        // v2.29.0: trip_entries.poi_id DROPPED. Just bump entry_pois_version.
        batch2.push(
          db.prepare('UPDATE trip_entries SET entry_pois_version = entry_pois_version + 1 WHERE id = ?')
            .bind(entryId),
        );
        for (const [idx, choice] of explicitChoices.entries()) {
          batch2.push(
            db
              .prepare(
                `INSERT INTO trip_entry_pois (
                   entry_id,
                   poi_id,
                   sort_order,
                   added_at,
                   updated_at,
                   description,
                   note,
                   reservation,
                   reservation_url
                 )
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              )
              .bind(
                entryId,
                choice.poiId,
                idx + 1,
                nowEntryPois,
                nowEntryPois,
                choice.description,
                choice.note,
                choice.reservation,
                choice.reservationUrl,
              ),
          );
        }
        continue;
      }

      const pIdx = entryPoiIdx[i]!;
      if (pIdx < 0) continue;
      const poiId = poiIds[pIdx];
      if (typeof poiId !== 'number') continue;
      // v2.29.0: trip_entries.poi_id DROPPED. syncEntryMaster 寫 trip_entry_pois.sort_order=1
      // 並 bump entry_pois_version (見 _entry_pois.ts)。
      entriesNeedingMaster.push({ entryId, poiId });
    }
    for (const builder of tripPoiBuilders) {
      batch2.push(...builder(poiIds));
    }
    if (batch2.length > 0) await db.batch(batch2);

    // Title-only entries use the shared helper to keep the master invariant aligned
    // with POST /entries and copy.ts.
    await Promise.all(
      entriesNeedingMaster.map((p) => syncEntryMaster(db, p.entryId, p.poiId)),
    );

    // round 5 fix: claim-once snapshot restore — for each new entry, find first unclaimed
    // old snapshot with matching master POI, transfer its alts. Prevents conflation of
    // two old entries sharing the same master POI (round 5 HIGH finding). Each new entry
    // gets at most ONE old snapshot's alts. Also bumps entry_pois_version for any entry
    // that received restored alts so clients can detect the day-level reshape.
    const altRestoreStatements: D1PreparedStatement[] = [];
    const nowAlt = new Date().toISOString();
    const claimed = new Set<OldEntrySnapshot>();
    const entriesGainingAlts: number[] = [];
    for (const { entryId, poiId: newMasterPoiId } of entriesNeedingMaster) {
      const match = oldEntrySnapshots.find(
        (s) => s.masterPoiId === newMasterPoiId && !claimed.has(s) && s.alts.length > 0,
      );
      if (!match) continue;
      claimed.add(match);
      entriesGainingAlts.push(entryId);
      for (const alt of match.alts) {
        if (alt.poiId === newMasterPoiId) continue; // would violate UNIQUE(entry_id, poi_id)
        altRestoreStatements.push(
          db
            .prepare(
              `INSERT OR IGNORE INTO trip_entry_pois (entry_id, poi_id, sort_order, added_at, updated_at)
               VALUES (?, ?, ?, ?, ?)`,
            )
            .bind(entryId, alt.poiId, alt.sortOrder, nowAlt, nowAlt),
        );
      }
    }
    // Bump entry_pois_version on entries that gained restored alts (round 5 monotonic invariant).
    for (const entryId of entriesGainingAlts) {
      altRestoreStatements.push(
        db.prepare('UPDATE trip_entries SET entry_pois_version = entry_pois_version + 1 WHERE id = ?').bind(entryId),
      );
    }
    if (altRestoreStatements.length > 0) {
      await db.batch(altRestoreStatements);
    }

    // Audit log AFTER both batches succeed (prevents phantom audit entries on failure)
    await logAudit(db, {
      tripId: id, tableName: 'trip_days', recordId: dayId, action: 'update', changedBy,
      snapshot, diffJson: JSON.stringify({ day_num: Number(num), overwrite: true }),
    });
  } catch (err) {
    if (err instanceof AppError) throw err;
    await logAudit(db, {
      tripId: id, tableName: 'trip_days', recordId: dayId, action: 'error', changedBy,
      diffJson: JSON.stringify({ error: 'Partial write failure', message: err instanceof Error ? err.message : String(err) }),
    });
    throw new AppError('DATA_SAVE_FAILED', '儲存失敗，請稍後再試');
  }

  // v2.30.x (migration 0065)：surface new OCC token 給 client 下次 PUT 用
  return json({ ok: true, dayVersion: currentDayVersion + 1 });
};
