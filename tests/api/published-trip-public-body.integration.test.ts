/**
 * 特徵測試（ADR-0008）：已發布行程的本體對匿名讀者全公開。
 *
 * 這不是漏洞，是 owner 決定的隱私模型（2026-10-09，#1426 關閉為 not planned）：
 * 行程本體（含每個景點的 reservation／reservation_url／note）永遠公開，
 * 私人資訊請放『筆記區塊』（預設拒絕）。這個測試的作用是讓『改變這個決定』必須是有意識的動作，
 * 不會因為重構（例如有人開始用 requireTripReadAccess 的回傳值過濾欄位）而靜默改變。
 *
 * 走 HTTP 邊界（tests/api/http.ts）：匿名讀者不帶任何憑證，經過 middleware。
 * 共用 D1：trip／POI／email 一律用 `s15-` 前綴，結束時只清自己的資料。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, seedTrip, getDayId, seedEntry, seedPoi, userIdFor } from './helpers';
import { createApi, type Api } from './http';
import { cleanupS15 } from './cleanup-shares';

let db: D1Database;
let api: Api;
const owner = 's15-public-body-owner@test.com';
beforeAll(async () => {
  db = await createTestDb();
  api = createApi({ env: mockEnv(db) });
  await cleanupS15(db);
});
afterAll(async () => {
  await cleanupS15(db);
  await disposeMiniflare();
});

async function seedPublishedDayWithBooking(tripId: string, published: number) {
  await seedTrip(db, { id: tripId, owner, days: 1, published });
  const dayId = await getDayId(db, tripId, 1);
  const poi = await seedPoi(db, { name: `s15-poi-${tripId}` });
  const entryId = await seedEntry(db, dayId, { poiId: poi });
  await db
    .prepare(`UPDATE trip_entry_pois SET reservation = 'SECRET-RES-123', reservation_url = 'https://booking.example/abc', note = 'PRIVATE-NOTE' WHERE entry_id = ?`)
    .bind(entryId)
    .run();
}

function anonymousGet(tripId: string) {
  return api.get(`/api/trips/${tripId}/days/1`);
}

describe('已發布行程：本體全公開（ADR-0008）', () => {
  it('匿名讀者看得到景點的 reservation／reservation_url／note', async () => {
    await seedPublishedDayWithBooking('s15-trip-pub-open', 1);
    const resp = await anonymousGet('s15-trip-pub-open');
    expect(resp.status).toBe(200);
    const text = await resp.text();
    expect(text).toContain('SECRET-RES-123');
    expect(text).toContain('booking.example');
    expect(text).toContain('PRIVATE-NOTE');
  });

  it('未發布的行程匿名讀者不行（公開的前提是 owner 按了發布）', async () => {
    await seedPublishedDayWithBooking('s15-trip-unpub', 0);
    const resp = await anonymousGet('s15-trip-unpub');
    expect(resp.status).toBe(403);
  });

  it('未發布行程的拒絕回應不洩漏行程內容；owner 本人仍看得到', async () => {
    const resp = await anonymousGet('s15-trip-unpub');
    const text = await resp.text();
    expect(text).not.toContain('SECRET-RES-123');
    expect(text).not.toContain('PRIVATE-NOTE');
    const own = await api.get('/api/trips/s15-trip-unpub/days/1', { as: owner });
    expect(own.status).toBe(200);
    expect(await own.text()).toContain('SECRET-RES-123');
  });

  it('本體全公開不等於身分公開：匿名回應不含 owner 的 email 與 user id', async () => {
    const resp = await anonymousGet('s15-trip-pub-open');
    const text = await resp.text();
    expect(text).not.toContain(owner);
    expect(text).not.toContain(userIdFor(owner));
  });
});
