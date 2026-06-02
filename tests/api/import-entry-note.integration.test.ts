/**
 * Integration test — POST /api/trips/import 的 entry note round-trip（migration 0078）
 *
 * 備註 source of truth 已從 trip_entries.note（entry-level）改為 master
 * trip_entry_pois.note（per-(entry, poi)，sort_order=1 正選）。import.ts 對應 cutover：
 *   - INSERT INTO trip_entries 不再帶 note（欄位已 DROP）。
 *   - 舊匯出檔的 entry-level note coalesce 到 master poi 的 note（master 自己沒帶 → 用 e.note）。
 *   - 備選（sort_order>1）維持各自 p.note，entry-level note 不外洩到備選。
 *
 * 用真正的 Miniflare D1（setup.ts 已套全部 migration 含 0078，trip_entries 無 note 欄位），
 * 端到端跑 handler 驗 DB 真實寫入 —— 比 source-grep 更能鎖住行為契約（design §5）。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockAuth, mockContext, seedUser, callHandler } from './helpers';
import { onRequestPost } from '../../functions/api/trips/import';
import type { Env } from '../../functions/api/_types';

let db: D1Database;
let env: Env;

const USER_EMAIL = 'importer@test.com';

beforeAll(async () => {
  db = await createTestDb();
  env = mockEnv(db);
  await seedUser(db, USER_EMAIL);
});

afterAll(disposeMiniflare);

/** 跑 import handler，回傳新建 tripId（已斷言 201）。 */
async function runImport(payload: unknown): Promise<string> {
  const ctx = mockContext({
    request: new Request('https://test.com/api/trips/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
    env,
    auth: mockAuth({ email: USER_EMAIL }),
  });
  const resp = await callHandler(onRequestPost, ctx);
  const body = (await resp.json()) as { ok?: boolean; tripId?: string; error?: { message?: string } };
  expect(resp.status, `import 應 201，實得 ${resp.status}：${JSON.stringify(body)}`).toBe(201);
  expect(body.ok).toBe(true);
  return body.tripId!;
}

/** 取某 entry（依 title 找）的 trip_entry_pois rows（poi 名稱 + note + sort_order）。 */
async function entryPoiNotes(tripId: string, entryTitle: string) {
  const rows = await db
    .prepare(
      `SELECT p.name AS poi_name, tep.note AS note, tep.sort_order AS sort_order
       FROM trip_entry_pois tep
       JOIN trip_entries te ON te.id = tep.entry_id
       JOIN trip_days td ON td.id = te.day_id
       JOIN pois p ON p.id = tep.poi_id
       WHERE td.trip_id = ? AND te.title = ?
       ORDER BY tep.sort_order ASC`,
    )
    .bind(tripId, entryTitle)
    .all<{ poi_name: string; note: string | null; sort_order: number }>();
  return rows.results;
}

/** 用唯一後綴避免 find-or-create POI 在不同測試間撞 UNIQUE(name,type)。 */
function payloadWith(suffix: string, timeline: unknown[]) {
  return {
    schemaVersion: 1,
    meta: { name: `Note RT ${suffix}`, title: `Note RT ${suffix}`, countries: 'JP' },
    days: [{ dayNum: 1, date: '2026-07-26', dayOfWeek: '六', label: '', timeline }],
    segments: [],
    notes: {},
  };
}

describe('POST /api/trips/import — entry note round-trip（master poi note）', () => {
  it('entry-level note → master poi（master 自己沒帶 note 時繼承）', async () => {
    const tripId = await runImport(
      payloadWith('inherit', [
        {
          sortOrder: 1,
          title: '午餐 inherit',
          note: '整體備註：記得帶現金',
          stopPois: [{ sortOrder: 1, name: '暖暮拉麵 inherit', type: 'restaurant' }],
        },
      ]),
    );
    const rows = await entryPoiNotes(tripId, '午餐 inherit');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ sort_order: 1, note: '整體備註：記得帶現金' });
  });

  it('master poi 自己的 note 優先，不被 entry-level note 覆蓋', async () => {
    const tripId = await runImport(
      payloadWith('master-wins', [
        {
          sortOrder: 1,
          title: '午餐 master-wins',
          note: '整體備註不該贏',
          stopPois: [
            { sortOrder: 1, name: '暖暮拉麵 master-wins', type: 'restaurant', note: '必點山苦瓜炒麵' },
          ],
        },
      ]),
    );
    const rows = await entryPoiNotes(tripId, '午餐 master-wins');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.note).toBe('必點山苦瓜炒麵');
  });

  it('備選（sort_order>1）保留各自 note，entry-level note 不外洩到備選', async () => {
    const tripId = await runImport(
      payloadWith('alts', [
        {
          sortOrder: 1,
          title: '晚餐',
          note: '只該落在正選',
          stopPois: [
            { sortOrder: 1, name: '正選餐廳 alts', type: 'restaurant' },
            { sortOrder: 2, name: '備選A alts', type: 'restaurant', note: '備選A：週三休' },
            { sortOrder: 3, name: '備選B alts', type: 'restaurant' },
          ],
        },
      ]),
    );
    const rows = await entryPoiNotes(tripId, '晚餐');
    expect(rows).toHaveLength(3);
    // 正選（sort_order=1）繼承 entry-level note
    expect(rows.find((r) => r.sort_order === 1)!.note).toBe('只該落在正選');
    // 備選A 保留自己的 note
    expect(rows.find((r) => r.sort_order === 2)!.note).toBe('備選A：週三休');
    // 備選B 沒帶 note → 維持 null，未被 entry-level note 污染
    expect(rows.find((r) => r.sort_order === 3)!.note).toBeNull();
  });

  it('entry 無任何 POI 但帶 entry-level note → 不報錯、note 無處可掛被丟棄', async () => {
    // master poi 是唯一掛載點；無 POI 的 placeholder entry 其 entry-level note 丟棄（design 接受）。
    const tripId = await runImport(
      payloadWith('no-poi', [
        { sortOrder: 1, title: '自由活動', note: '無 POI 的備註', stopPois: [] },
      ]),
    );
    const rows = await entryPoiNotes(tripId, '自由活動');
    expect(rows).toHaveLength(0); // 無 trip_entry_pois row
    // entry 本身仍建立成功
    const entry = await db
      .prepare(
        `SELECT te.id AS id FROM trip_entries te
         JOIN trip_days td ON td.id = te.day_id
         WHERE td.trip_id = ? AND te.title = ?`,
      )
      .bind(tripId, '自由活動')
      .first<{ id: number }>();
    expect(entry?.id).toBeGreaterThan(0);
  });

  it('trip_entries 不再有 note 欄位（DROP 後 import 仍成功，證明 cutover 安全）', async () => {
    const tripId = await runImport(
      payloadWith('schema', [
        {
          sortOrder: 1,
          title: '早餐',
          note: 'x',
          stopPois: [{ sortOrder: 1, name: '早餐店 schema', type: 'restaurant' }],
        },
      ]),
    );
    // PRAGMA 確認 trip_entries 無 note 欄位（migration 0078 已 DROP）。
    const cols = await db.prepare(`PRAGMA table_info(trip_entries)`).all<{ name: string }>();
    const colNames = cols.results.map((c) => c.name);
    expect(colNames).not.toContain('note');
    // import 仍成功且正選 note 落地，間接證明 INSERT INTO trip_entries 沒帶 note。
    const rows = await entryPoiNotes(tripId, '早餐');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.note).toBe('x');
  });
});
