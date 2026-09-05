/**
 * entry intake：resortDayByArrival 失敗是 best-effort —— entry 已 commit，不可回 5xx（否則 client
 * 重試 → 重複 entry）。獨立檔案以免 vi.mock 外溢到其他 integration 測試。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createTestDb, disposeMiniflare } from './setup';
import { seedUser, seedTrip, seedPoi, getDayId } from './helpers';

vi.mock('../../functions/api/_entry_sort', () => ({
  resortDayByArrival: vi.fn(async () => { throw new Error('resort boom'); }),
}));
import { createEntry } from '../../functions/api/_entryWrite';

let db: D1Database;
const tripId = 'trip-intake-resort';
beforeAll(async () => {
  db = await createTestDb();
  await seedUser(db, 'resort@test.com');
  await seedTrip(db, { id: tripId, owner: 'resort@test.com', days: 1 });
});
afterAll(disposeMiniflare);

describe('createEntry 與 resort 失敗', () => {
  it('resort 丟例外 → createEntry 仍成功回傳，entry 與正選都在', async () => {
    const dayId = await getDayId(db, tripId, 1);
    const poiId = await seedPoi(db, { name: 'Resort 失敗 POI', type: 'attraction' });
    const res = await createEntry(db, { dayId, poi: { id: poiId }, startTime: '09:00', endTime: '10:00', audit: { tripId, changedBy: 'resort@test.com' } });
    const m = await db.prepare('SELECT poi_id FROM trip_entry_pois WHERE entry_id = ? AND sort_order = 1').bind(res.entryId).first<{ poi_id: number }>();
    expect(m!.poi_id).toBe(poiId);
  });
});
