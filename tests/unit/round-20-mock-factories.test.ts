/**
 * round-20-mock-factories.test.ts — v2.33.70 shared mock factory smoke
 *
 * 驗 6 個 factory return shape 對齊 canonical type (camelCase, deepCamel'd backend
 * response)，避免 v2.31.14/15/27 family drift bug 重演 — future test 用 factory
 * 寫 mock data 自然 type-safe + shape-correct。
 */
import { describe, it, expect } from 'vitest';
import {
  makeTrip,
  makeTripListItem,
  makeEntry,
  makeStopPoi,
  makeDay,
  makeUser,
  makeAuthData,
  makePoiFavorite,
  makeSegment,
} from './__factories__';

describe('v2.33.70 — makeTrip canonical shape', () => {
  it('返 camelCase fields (對齊 deepCamel backend response)', () => {
    const t = makeTrip({ name: 'Okinawa' });
    expect(t.tripId).toBeDefined();
    expect(t.id).toBe(t.tripId);
    expect(t.name).toBe('Okinawa');
    expect(t.dataSource).toBeDefined(); // camelCase NOT data_source
    expect(t.lang).toBeDefined();
  });

  it('destinations 用 destOrder/dayQuota/subAreas (v2.31.13 fix)', () => {
    const t = makeTrip({ destinations: [{ name: '那霸' }, { name: '名護' }] });
    expect(t.destinations).toHaveLength(2);
    expect(t.destinations![0]).toMatchObject({ destOrder: 1, name: '那霸' });
    expect(t.destinations![1]).toMatchObject({ destOrder: 2, name: '名護' });
    // 拒寫 snake_case (typescript 型別防護 + runtime shape correct)
    expect('dest_order' in t.destinations![0]).toBe(false);
  });
});

describe('v2.33.70 — makeTripListItem', () => {
  it('shape 對齊 GET /api/trips list response', () => {
    const t = makeTripListItem({ name: 'Test' });
    expect(t.tripId).toBeDefined();
    expect(t.name).toBe('Test');
    expect(t.owner).toBeDefined();
    expect(t.dataSource).toBeDefined();
  });
});

describe('v2.33.70 — makeEntry + makeStopPoi camelCase', () => {
  it('entry 含 startTime/endTime/entryPoisVersion (camelCase)', () => {
    const e = makeEntry({ title: 'Test' });
    expect(e.title).toBe('Test');
    expect('startTime' in e).toBe(true); // not start_time
    expect('endTime' in e).toBe(true);
    expect('entryPoisVersion' in e).toBe(true);
  });

  it('stopPois sortOrder 從 1 開始 (master=1, alternates 2+)', () => {
    const e = makeEntry({
      master: { name: 'Primary' },
      alternates: [{ name: 'Alt 1' }, { name: 'Alt 2' }],
    });
    expect(e.stopPois).toHaveLength(3);
    expect(e.stopPois![0].sortOrder).toBe(1);
    expect(e.stopPois![0].name).toBe('Primary');
    expect(e.stopPois![1].sortOrder).toBe(2);
    expect(e.stopPois![2].sortOrder).toBe(3);
  });

  it('master 含 poiId/lat/lng/rating camelCase', () => {
    const poi = makeStopPoi(1, { name: 'X', reservation: '12:30' });
    expect(poi.poiId).toBeDefined();
    expect(poi.reservation).toBe('12:30');
    expect('reservationUrl' in poi).toBe(true); // NOT reservation_url
  });
});

describe('v2.33.70 — makeDay timeline', () => {
  it('entryCount 自動產生 timeline', () => {
    const d = makeDay({ entryCount: 3 });
    expect(d.timeline).toHaveLength(3);
    expect(d.dayNum).toBeDefined();
    expect(d.dayOfWeek).toBeDefined();
  });
});

describe('v2.33.70 — makeUser + makeAuthData', () => {
  it('makeUser 返 email + id + displayName', () => {
    const u = makeUser({ email: 'test@x.com' });
    expect(u.email).toBe('test@x.com');
    expect(u.id).toBeDefined();
  });

  it('makeAuthData 對齊 AuthData type (userId/isServiceToken)', () => {
    const a = makeAuthData({});
    expect(a.email).toBeDefined();
    expect(a.userId).toBeDefined();
    expect(a.isServiceToken).toBe(false);
  });
});

describe('v2.33.70 — makePoiFavorite usages camelCase', () => {
  it('返 camelCase (poiId/poiName/favoritedAt)', () => {
    const f = makePoiFavorite({ poiName: 'My fav' });
    expect(f.poiName).toBe('My fav');
    expect(f.favoritedAt).toBeDefined();
    expect(f.poiLat).toBeDefined();
  });

  it('usages 含 tripId/tripName/dayNum/entryId', () => {
    const f = makePoiFavorite({ usages: [{ tripId: 'okinawa', tripName: '沖繩' }] });
    expect(f.usages).toHaveLength(1);
    expect(f.usages![0].tripId).toBe('okinawa');
    expect(f.usages![0].tripName).toBe('沖繩');
  });
});

describe('v2.33.70 — makeSegment camelCase', () => {
  it('返 fromEntryId/toEntryId/distanceM (camelCase)', () => {
    const s = makeSegment({ from: 10, to: 20 });
    expect(s.fromEntryId).toBe(10);
    expect(s.toEntryId).toBe(20);
    expect(s.distanceM).toBeDefined();
    expect(s.mode).toBe('driving');
  });
});
