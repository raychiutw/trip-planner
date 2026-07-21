// @vitest-environment node
/**
 * demo 行程 fixture 能真的匯入成一個行程（不只是通過 validator）
 *
 * `tests/unit/demo-trip-fixture.test.ts` 證明 fixture 通過 `parseAndValidateImport`，
 * 但 validator 過了不等於寫得進 DB —— import.ts 還有 UNIQUE 約束、chunked batch、
 * POI 解析、segment 由 positional index 重新對映到新 entry id 等一整段 orchestration。
 * fixture 若在那裡炸，會等到審核前一刻匯入 prod 才發現。
 *
 * 這支用真 D1（Miniflare）跑完整條 import 路徑，並回查資料庫確認：
 * 行程建起來了、每天的景點都在、交通段有正確接上新的 entry id。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { onRequestPost as importTrip } from '../../functions/api/trips/import';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv } from './helpers';

const DEMO_TRIP = JSON.parse(
  readFileSync(resolve(__dirname, '../../docs/demo/demo-trip.json'), 'utf-8'),
);

const DEMO_USER_ID = 'demo-user-for-import-test';

describe('demo 行程匯入 —— 真 D1 全路徑', () => {
  let db: D1Database;
  let tripId: string;

  beforeAll(async () => {
    db = await createTestDb();
    await db
      .prepare('INSERT INTO users (id, email, display_name) VALUES (?,?,?)')
      .bind(DEMO_USER_ID, 'demo@example.com', 'Demo')
      .run();

    const request = new Request('https://trip-planner-dby.pages.dev/api/trips/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(DEMO_TRIP),
    });
    const context = {
      request,
      env: mockEnv(db),
      params: {} as never,
      // requireAuth 讀 data.auth —— 直接注入已登入的 demo 使用者。
      data: { auth: { userId: DEMO_USER_ID, isServiceToken: false } },
      next: () => Promise.resolve(new Response()),
      waitUntil: () => undefined,
      passThroughOnException: () => undefined,
    } as unknown as Parameters<typeof importTrip>[0];

    const res = await importTrip(context);
    expect(res.status, '匯入應成功').toBeLessThan(400);
    const created = (await res.json()) as { tripId?: string; id?: string };
    tripId = (created.tripId ?? created.id)!;
    expect(tripId, '回應必須帶新行程 id').toBeTruthy();
  }, 40000);

  afterAll(async () => { await disposeMiniflare(); });

  it('行程本體寫入，owner 是匯入者', async () => {
    const trip = await db
      .prepare('SELECT name, owner_user_id FROM trips WHERE id = ?')
      .bind(tripId)
      .first<{ name: string; owner_user_id: string }>();
    expect(trip).not.toBeNull();
    expect(trip!.name).toBe(DEMO_TRIP.meta.name);
    expect(trip!.owner_user_id).toBe(DEMO_USER_ID);
  });

  it('天數與 fixture 一致', async () => {
    const row = await db
      .prepare('SELECT COUNT(*) AS n FROM trip_days WHERE trip_id = ?')
      .bind(tripId)
      .first<{ n: number }>();
    expect(row!.n).toBe(DEMO_TRIP.days.length);
  });

  it('每個 entry 都掛到 POI —— 沒有 POI 的 entry 在地圖上是空的', async () => {
    const fixtureEntries = DEMO_TRIP.days.reduce(
      (sum: number, d: { timeline: unknown[] }) => sum + d.timeline.length, 0,
    );
    const entries = await db
      .prepare(`SELECT COUNT(*) AS n FROM trip_entries e
                JOIN trip_days d ON d.id = e.day_id WHERE d.trip_id = ?`)
      .bind(tripId)
      .first<{ n: number }>();
    expect(entries!.n).toBe(fixtureEntries);

    const orphan = await db
      .prepare(`SELECT COUNT(*) AS n FROM trip_entries e
                JOIN trip_days d ON d.id = e.day_id
                WHERE d.trip_id = ?
                  AND NOT EXISTS (SELECT 1 FROM trip_entry_pois p WHERE p.entry_id = e.id)`)
      .bind(tripId)
      .first<{ n: number }>();
    expect(orphan!.n, '有 entry 沒有任何 POI').toBe(0);
  });

  it('交通段重新對映到新 entry id，沒有落空', async () => {
    // segment 在匯出檔是 positional index，import 要換成剛產生的 auto-increment id。
    // 這段最容易錯，且錯了不會噴錯 —— 只是地圖上路線消失。
    const segs = await db
      .prepare(`SELECT COUNT(*) AS n FROM trip_segments s
                WHERE EXISTS (SELECT 1 FROM trip_entries e JOIN trip_days d ON d.id = e.day_id
                              WHERE d.trip_id = ? AND e.id = s.from_entry_id)`)
      .bind(tripId)
      .first<{ n: number }>();
    expect(segs!.n).toBe(DEMO_TRIP.segments.length);
  });

  it('住宿寫入（前兩天各一晚）', async () => {
    const hotels = await db
      .prepare(`SELECT COUNT(*) AS n FROM trip_days d
                WHERE d.trip_id = ? AND d.hotel_poi_id IS NOT NULL`)
      .bind(tripId)
      .first<{ n: number }>();
    const expected = DEMO_TRIP.days.filter((d: { hotel: unknown }) => d.hotel).length;
    expect(hotels!.n).toBe(expected);
  });
});
