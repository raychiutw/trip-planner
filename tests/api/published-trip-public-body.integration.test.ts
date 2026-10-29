/**
 * 特徵測試（ADR-0008）：已發布行程的本體對匿名讀者全公開。
 *
 * 這不是漏洞，是 owner 決定的隱私模型（2026-10-09，#1426 關閉為 not planned）：
 * 行程本體（含每個景點的 reservation／reservation_url／note）永遠公開，
 * 私人資訊請放『筆記區塊』（預設拒絕）。這個測試的作用是讓『改變這個決定』必須是有意識的動作，
 * 不會因為重構（例如有人開始用 requireTripReadAccess 的回傳值過濾欄位）而靜默改變。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { mockEnv, mockContext, seedTrip, getDayId, seedEntry, seedPoi, callHandler } from './helpers';
import { onRequestGet } from '../../functions/api/trips/[id]/days/[num]';

let db: D1Database;
beforeAll(async () => { db = await createTestDb(); });
afterAll(disposeMiniflare);

async function seedPublishedDayWithBooking(tripId: string, published: number) {
  await seedTrip(db, { id: tripId, days: 1, published });
  const dayId = await getDayId(db, tripId, 1);
  const poi = await seedPoi(db, { name: `poi-${tripId}` });
  const entryId = await seedEntry(db, dayId, { poiId: poi });
  await db
    .prepare(`UPDATE trip_entry_pois SET reservation = 'SECRET-RES-123', reservation_url = 'https://booking.example/abc', note = 'PRIVATE-NOTE' WHERE entry_id = ?`)
    .bind(entryId)
    .run();
}

function anonymousGet(tripId: string) {
  return callHandler(onRequestGet, mockContext({
    request: new Request(`https://test.com/api/trips/${tripId}/days/1`),
    env: mockEnv(db),
    params: { id: tripId, num: '1' },
  }));
}

describe('已發布行程：本體全公開（ADR-0008）', () => {
  it('匿名讀者看得到景點的 reservation／reservation_url／note', async () => {
    await seedPublishedDayWithBooking('trip-pub-open', 1);
    const resp = await anonymousGet('trip-pub-open');
    expect(resp.status).toBe(200);
    const text = await resp.text();
    expect(text).toContain('SECRET-RES-123');
    expect(text).toContain('booking.example');
    expect(text).toContain('PRIVATE-NOTE');
  });

  it('未發布的行程匿名讀者不行（公開的前提是 owner 按了發布）', async () => {
    await seedPublishedDayWithBooking('trip-unpub', 0);
    const resp = await anonymousGet('trip-unpub');
    expect(resp.status).toBe(403);
  });
});
